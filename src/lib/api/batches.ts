import { client, isTursoConfigured } from '../turso';
import { cachedQuery, invalidateQueryCache } from '../queryCache';

export interface SubjectClassProgress {
  subject: string;
  completed: number;
  total?: number;
}

export interface BatchItem {
  id: string;
  name: string;
  course_id?: string;
  course_name?: string;
  primary_teacher_id?: string;
  primary_teacher_name?: string;
  start_date?: string;
  timing?: string;
  schedule_pattern?: string;
  max_students?: number;
  current_enrolled?: number;
  status: 'Active' | 'Upcoming' | 'Completed' | 'Paused';
  mode?: 'Online' | 'Offline' | 'Hybrid';
  created_at?: string;
  subject_progress_json?: string;
  completion_percentage?: number;
}

export interface StudentAssignmentItem {
  id: string;
  name: string;
  email: string;
  student_code?: string;
  course?: string;
  batch_number?: string;
  status?: string;
}

// Utility for execute with retry
const executeWithRetry = async (sql: string, args: any[] = []) => {
  if (!client) throw new Error("Database client not initialized");
  try {
    return await client.execute({ sql, args });
  } catch (err: any) {
    if (err.message && err.message.includes('fetch failed')) {
      console.warn('Network timeout, retrying sql query:', sql);
      await new Promise(r => setTimeout(r, 1000));
      return await client.execute({ sql, args });
    }
    throw err;
  }
};

/**
 * Ensures the batches table exists and has all required columns.
 */
export async function ensureBatchesTable() {
  if (!isTursoConfigured || !client) return;

  try {
    await executeWithRetry(`
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        name TEXT,
        course_id TEXT,
        primary_teacher_id TEXT,
        start_date TEXT,
        timing TEXT,
        schedule_pattern TEXT,
        max_students INTEGER DEFAULT 30,
        current_enrolled INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active',
        mode TEXT DEFAULT 'Hybrid',
        created_at TEXT,
        subject_progress_json TEXT,
        completion_percentage INTEGER DEFAULT 0
      )
    `);

    // Add missing columns safely if table already existed without them
    const safeAddColumn = async (col: string, def: string) => {
      try {
        await executeWithRetry(`ALTER TABLE batches ADD COLUMN ${col} ${def}`);
      } catch (e) {
        // Ignored if column already exists
      }
    };

    await safeAddColumn('timing', 'TEXT');
    await safeAddColumn('schedule_pattern', 'TEXT');
    await safeAddColumn('max_students', 'INTEGER DEFAULT 30');
    await safeAddColumn('current_enrolled', 'INTEGER DEFAULT 0');
    await safeAddColumn('status', "TEXT DEFAULT 'Active'");
    await safeAddColumn('mode', "TEXT DEFAULT 'Hybrid'");
    await safeAddColumn('subject_progress_json', 'TEXT');
    await safeAddColumn('completion_percentage', 'INTEGER DEFAULT 0');
  } catch (e) {
    console.error("Error ensuring batches table:", e);
  }
}

export const DEFAULT_DIAGRAM_SUBJECTS: SubjectClassProgress[] = [
  { subject: 'SQL', completed: 5, total: 10 },
  { subject: 'Python', completed: 3, total: 10 },
  { subject: 'AI', completed: 4, total: 10 },
  { subject: 'ML', completed: 5, total: 10 }
];

export function parseBatchSubjectProgress(batch: BatchItem): SubjectClassProgress[] {
  if (batch.subject_progress_json) {
    try {
      const parsed = JSON.parse(batch.subject_progress_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => ({
          subject: item.subject || 'Subject',
          completed: Math.max(0, Number(item.completed) || 0),
          total: Math.max(1, Number(item.total) || 10)
        }));
      }
    } catch (e) {
      console.error("Failed to parse subject_progress_json", e);
    }
  }
  return DEFAULT_DIAGRAM_SUBJECTS.map(s => ({ ...s }));
}

/**
 * Updates batch subject progress and completion percentage in Turso DB.
 */
export async function updateBatchSubjectProgress(batchId: string, subjectProgress: SubjectClassProgress[]): Promise<boolean> {
  if (!isTursoConfigured || !client) return false;

  await ensureBatchesTable();

  try {
    const totalCompleted = subjectProgress.reduce((acc, s) => acc + (s.completed || 0), 0);
    const totalClasses = subjectProgress.reduce((acc, s) => acc + (s.total || 10), 0);
    const completionPercentage = totalClasses > 0 ? Math.min(100, Math.round((totalCompleted / totalClasses) * 100)) : 0;
    const jsonStr = JSON.stringify(subjectProgress);

    await executeWithRetry(`
      UPDATE batches SET
        subject_progress_json = ?,
        completion_percentage = ?
      WHERE id = ?
    `, [jsonStr, completionPercentage, batchId]);

    // Also update matching module classes status to 'completed' so student portal shows "Watch Class"
    for (const sp of subjectProgress) {
      if (sp.completed > 0 && sp.subject) {
        try {
          const modRes = await executeWithRetry(
            `SELECT id FROM modules WHERE LOWER(title) LIKE ? LIMIT 1`,
            [`%${sp.subject.toLowerCase().trim()}%`]
          );
          if (modRes.rows.length > 0) {
            const modId = modRes.rows[0].id;
            const clsRes = await executeWithRetry(
              `SELECT id FROM classes WHERE module_id = ? ORDER BY order_index ASC LIMIT ?`,
              [modId, sp.completed]
            );
            for (const cRow of clsRes.rows) {
              await executeWithRetry(
                `UPDATE classes SET status = 'completed' WHERE id = ? AND (status IS NULL OR status = 'upcoming' OR status = 'in_progress' OR status = 'draft')`,
                [cRow.id]
              );
            }
          }
        } catch (err) {
          console.warn("Could not sync class status for batch progress:", err);
        }
      }
    }

    invalidateQueryCache('batches_all');
    return true;
  } catch (e) {
    console.error("Error updating batch subject progress:", e);
    return false;
  }
}

/**
 * Fetches all batches with teacher names, course titles, and calculated enrolled student counts.
 */
export async function getAllBatches(): Promise<BatchItem[]> {
  if (!isTursoConfigured || !client) return [];

  return cachedQuery('batches_all', 60000, async () => {
    await ensureBatchesTable();

    try {
      const res = await executeWithRetry(`
        SELECT 
          b.id,
          b.name,
          b.course_id,
          b.primary_teacher_id,
          b.start_date,
          b.timing,
          b.schedule_pattern,
          b.max_students,
          b.current_enrolled,
          b.status,
          b.mode,
          b.created_at,
          b.subject_progress_json,
          b.completion_percentage,
          u.name as primary_teacher_name,
          c.title as course_name
        FROM batches b
        LEFT JOIN users u ON b.primary_teacher_id = u.id OR b.primary_teacher_id = u.email
        LEFT JOIN courses c ON b.course_id = c.id OR b.course_id = c.title
        ORDER BY b.created_at DESC
      `);

      // Fetch live student counts grouped by batch
      const studentCountRes = await executeWithRetry(`
        SELECT batch_number, COUNT(*) as cnt 
        FROM students 
        WHERE batch_number IS NOT NULL AND batch_number != '' 
        GROUP BY batch_number
      `).catch(() => ({ rows: [] }));

      const countMap = new Map<string, number>();
      studentCountRes.rows.forEach((r: any) => {
        if (r.batch_number) {
          countMap.set(String(r.batch_number).trim().toLowerCase(), Number(r.cnt));
        }
      });

      return res.rows.map((row: any) => {
        const batchName = String(row.name || '').trim();
        const liveEnrolled = countMap.get(batchName.toLowerCase()) ?? (Number(row.current_enrolled) || 0);

        return {
          id: String(row.id),
          name: batchName || 'Unnamed Batch',
          course_id: row.course_id ? String(row.course_id) : undefined,
          course_name: row.course_name ? String(row.course_name) : (row.course_id ? String(row.course_id) : undefined),
          primary_teacher_id: row.primary_teacher_id ? String(row.primary_teacher_id) : undefined,
          primary_teacher_name: row.primary_teacher_name ? String(row.primary_teacher_name) : undefined,
          start_date: row.start_date ? String(row.start_date) : undefined,
          timing: row.timing ? String(row.timing) : (row.schedule_pattern ? String(row.schedule_pattern) : undefined),
          schedule_pattern: row.schedule_pattern ? String(row.schedule_pattern) : undefined,
          max_students: Number(row.max_students) || 30,
          current_enrolled: liveEnrolled,
          status: (row.status as any) || 'Active',
          mode: (row.mode as any) || 'Hybrid',
          created_at: row.created_at ? String(row.created_at) : undefined,
          subject_progress_json: row.subject_progress_json ? String(row.subject_progress_json) : undefined,
          completion_percentage: row.completion_percentage !== undefined && row.completion_percentage !== null ? Number(row.completion_percentage) : undefined,
        };
      });
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      return [];
    }
  });
}

/**
 * Creates a new batch record in Turso DB.
 */
export async function createBatch(data: Partial<BatchItem>): Promise<BatchItem | null> {
  if (!isTursoConfigured || !client) return null;

  await ensureBatchesTable();

  const id = data.id || `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  try {
    await executeWithRetry(`
      INSERT INTO batches (
        id, name, course_id, primary_teacher_id, start_date, timing, schedule_pattern, max_students, current_enrolled, status, mode, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.name || 'New Batch',
      data.course_id || null,
      data.primary_teacher_id || null,
      data.start_date || null,
      data.timing || null,
      data.schedule_pattern || data.timing || null,
      Number(data.max_students) || 30,
      Number(data.current_enrolled) || 0,
      data.status || 'Active',
      data.mode || 'Hybrid',
      now
    ]);

    invalidateQueryCache('batches_all');
    return {
      id,
      name: data.name || 'New Batch',
      course_id: data.course_id,
      primary_teacher_id: data.primary_teacher_id,
      start_date: data.start_date,
      timing: data.timing,
      schedule_pattern: data.schedule_pattern || data.timing,
      max_students: Number(data.max_students) || 30,
      current_enrolled: Number(data.current_enrolled) || 0,
      status: (data.status as any) || 'Active',
      mode: (data.mode as any) || 'Hybrid',
      created_at: now
    };
  } catch (e) {
    console.error("Error creating batch:", e);
    throw e;
  }
}

/**
 * Updates an existing batch record in Turso DB.
 */
export async function updateBatch(id: string, data: Partial<BatchItem>): Promise<boolean> {
  if (!isTursoConfigured || !client) return false;

  try {
    await executeWithRetry(`
      UPDATE batches SET
        name = ?,
        course_id = ?,
        primary_teacher_id = ?,
        start_date = ?,
        timing = ?,
        schedule_pattern = ?,
        max_students = ?,
        status = ?,
        mode = ?
      WHERE id = ?
    `, [
      data.name,
      data.course_id || null,
      data.primary_teacher_id || null,
      data.start_date || null,
      data.timing || null,
      data.schedule_pattern || data.timing || null,
      Number(data.max_students) || 30,
      data.status || 'Active',
      data.mode || 'Hybrid',
      id
    ]);
    invalidateQueryCache('batches_all');
    return true;
  } catch (e) {
    console.error("Error updating batch:", e);
    throw e;
  }
}

/**
 * Deletes a batch record from Turso DB.
 */
export async function deleteBatch(id: string): Promise<boolean> {
  if (!isTursoConfigured || !client) return false;

  try {
    await executeWithRetry("DELETE FROM batches WHERE id = ?", [id]);
    invalidateQueryCache('batches_all');
    return true;
  } catch (e) {
    console.error("Error deleting batch:", e);
    throw e;
  }
}

/**
 * Fetches all students currently assigned to a batch.
 */
export async function getStudentsInBatch(batchName: string): Promise<StudentAssignmentItem[]> {
  if (!isTursoConfigured || !client || !batchName) return [];

  try {
    const res = await executeWithRetry(`
      SELECT 
        s.id,
        COALESCE(s.name, u.name, 'Unnamed Student') as name,
        COALESCE(s.portal_login_email, u.email, '') as email,
        s.student_code,
        s.course,
        s.batch_number,
        COALESCE(s.status, 'Active') as status
      FROM students s
      LEFT JOIN users u ON LOWER(TRIM(s.portal_login_email)) = LOWER(TRIM(u.email))
      WHERE LOWER(TRIM(s.batch_number)) = LOWER(TRIM(?))
      ORDER BY name ASC
    `, [batchName.trim()]);

    return res.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name || 'Unnamed Student').trim(),
      email: String(r.email || '').trim(),
      student_code: r.student_code ? String(r.student_code).trim() : undefined,
      course: r.course ? String(r.course).trim() : undefined,
      batch_number: r.batch_number ? String(r.batch_number).trim() : undefined,
      status: r.status ? String(r.status) : undefined,
    }));
  } catch (e) {
    console.error("Error fetching students in batch:", e);
    return [];
  }
}

/**
 * Fetches all student records across the system for batch assignment selection.
 */
export async function getAllStudentsForAssignment(): Promise<StudentAssignmentItem[]> {
  if (!isTursoConfigured || !client) return [];

  try {
    const res = await executeWithRetry(`
      SELECT 
        COALESCE(s.id, u.id) as id,
        COALESCE(s.name, u.name, 'Unnamed Student') as name,
        COALESCE(s.portal_login_email, u.email, '') as email,
        s.student_code,
        s.course,
        s.batch_number,
        COALESCE(s.status, u.status, 'Active') as status
      FROM students s
      LEFT JOIN users u ON LOWER(TRIM(s.portal_login_email)) = LOWER(TRIM(u.email))
      
      UNION
      
      SELECT 
        u.id as id,
        u.name as name,
        u.email as email,
        NULL as student_code,
        NULL as course,
        NULL as batch_number,
        COALESCE(u.status, 'Active') as status
      FROM users u
      WHERE LOWER(u.role) = 'student' 
        AND LOWER(TRIM(u.email)) NOT IN (
          SELECT LOWER(TRIM(portal_login_email)) FROM students WHERE portal_login_email IS NOT NULL AND portal_login_email != ''
        )
      ORDER BY name ASC
    `);

    return res.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name || 'Unnamed Student').trim(),
      email: String(r.email || '').trim(),
      student_code: r.student_code ? String(r.student_code).trim() : undefined,
      course: r.course ? String(r.course).trim() : undefined,
      batch_number: r.batch_number ? String(r.batch_number).trim() : undefined,
      status: String(r.status || 'Active'),
    }));
  } catch (e) {
    console.error("Error fetching all students for assignment:", e);
    return [];
  }
}

/**
 * Assigns selected students to a batch and updates the live enrolled count in Turso DB.
 */
export async function assignStudentsToBatch(batchName: string, batchId: string, studentIdentifiers: string[]): Promise<boolean> {
  if (!isTursoConfigured || !client || studentIdentifiers.length === 0 || !batchName) return false;

  try {
    const cleanBatchName = batchName.trim();
    for (const identifier of studentIdentifiers) {
      const cleanId = identifier.trim();

      const checkRes = await executeWithRetry(`
        SELECT id, portal_login_email FROM students 
        WHERE id = ? OR LOWER(TRIM(portal_login_email)) = LOWER(?)
      `, [cleanId, cleanId]);

      if (checkRes.rows.length > 0) {
        await executeWithRetry(`
          UPDATE students SET batch_number = ? 
          WHERE id = ? OR LOWER(TRIM(portal_login_email)) = LOWER(?)
        `, [cleanBatchName, cleanId, cleanId]);
      } else {
        const userRes = await executeWithRetry(`
          SELECT id, name, email FROM users 
          WHERE id = ? OR LOWER(TRIM(email)) = LOWER(?)
        `, [cleanId, cleanId]);

        if (userRes.rows.length > 0) {
          const u = userRes.rows[0];
          const stdId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await executeWithRetry(`
            INSERT INTO students (id, name, portal_login_email, batch_number, status)
            VALUES (?, ?, ?, ?, 'Active')
          `, [stdId, String(u.name), String(u.email), cleanBatchName]);
        }
      }
    }

    // Update live enrolled count in batches table
    const countRes = await executeWithRetry(`
      SELECT COUNT(*) as cnt FROM students WHERE LOWER(TRIM(batch_number)) = LOWER(?)
    `, [cleanBatchName]);

    const liveCnt = Number(countRes.rows[0]?.cnt || 0);
    await executeWithRetry(`
      UPDATE batches SET current_enrolled = ? WHERE id = ? OR LOWER(TRIM(name)) = LOWER(?)
    `, [liveCnt, batchId, cleanBatchName]);

    return true;
  } catch (e) {
    console.error("Error assigning students to batch:", e);
    throw e;
  }
}

/**
 * Removes a student from a batch and updates the live enrolled count in Turso DB.
 */
export async function removeStudentFromBatch(studentIdentifier: string, batchName: string, batchId?: string): Promise<boolean> {
  if (!isTursoConfigured || !client || !batchName) return false;

  try {
    const cleanBatchName = batchName.trim();
    const cleanId = studentIdentifier.trim();

    await executeWithRetry(`
      UPDATE students SET batch_number = NULL 
      WHERE (id = ? OR LOWER(TRIM(portal_login_email)) = LOWER(?)) AND LOWER(TRIM(batch_number)) = LOWER(?)
    `, [cleanId, cleanId, cleanBatchName]);

    // Recalculate live enrolled count
    const countRes = await executeWithRetry(`
      SELECT COUNT(*) as cnt FROM students WHERE LOWER(TRIM(batch_number)) = LOWER(?)
    `, [cleanBatchName]);

    const liveCnt = Number(countRes.rows[0]?.cnt || 0);
    await executeWithRetry(`
      UPDATE batches SET current_enrolled = ? WHERE LOWER(TRIM(name)) = LOWER(?) ${batchId ? 'OR id = ?' : ''}
    `, batchId ? [liveCnt, cleanBatchName, batchId] : [liveCnt, cleanBatchName]);

    return true;
  } catch (e) {
    console.error("Error removing student from batch:", e);
    throw e;
  }
}

/**
 * Fetches basic batch details for dropdown/assignment list.
 */
export async function getBatchesForAssignment(): Promise<{ id: string; name: string; course_id?: string }[]> {
  if (!isTursoConfigured || !client) return [];
  try {
    const res = await executeWithRetry(`SELECT id, name, course_id FROM batches ORDER BY created_at DESC`);
    return res.rows.map((r: any) => ({
      id: String(r.id),
      name: String(r.name || 'Unnamed Batch'),
      course_id: r.course_id ? String(r.course_id) : undefined,
    }));
  } catch (e) {
    console.error("Error fetching batches for assignment:", e);
    return [];
  }
}

/**
 * Finds a pending task associated with a specific entity by description pattern matching.
 */
export async function findPendingTaskForEntity(entityId: string): Promise<string | null> {
  if (!isTursoConfigured || !client || !entityId) return null;
  try {
    const res = await executeWithRetry(
      `SELECT id FROM tasks WHERE description LIKE '%' || ? || '%' AND status != 'Done' LIMIT 1`,
      [entityId]
    );
    return res.rows.length > 0 ? String(res.rows[0].id) : null;
  } catch (e) {
    console.error("Error finding pending task for entity:", e);
    return null;
  }
}

