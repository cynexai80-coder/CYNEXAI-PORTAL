import { client, isDbFailed, setDbConnectionFailed } from '../turso';
import { encryptPassword } from '../crypto';
import { cachedQuery, invalidateQueryCache } from '../queryCache';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const checkDbFailed = () => {
  try {
    return typeof isDbFailed === 'function' ? isDbFailed() : false;
  } catch {
    return false;
  }
};

const markDbFailed = () => {
  try {
    if (typeof setDbConnectionFailed === 'function') {
      setDbConnectionFailed(true);
    }
  } catch {}
};

async function executeWithRetry(query: string, args: any[] = [], retries = MAX_RETRIES): Promise<any> {
  try {
    if (!client || checkDbFailed()) throw new Error('Database client not configured or offline');
    return await client.execute({ sql: query, args });
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    if (msg.includes('BLOCKED') || msg.includes('forbidden') || msg.includes('403')) {
      markDbFailed();
      throw error;
    }
    if (retries > 0 && !checkDbFailed()) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return executeWithRetry(query, args, retries - 1);
    }
    throw error;
  }
}

export async function getUsers(filters?: Record<string, any>, sortBy?: string, sortDir?: string): Promise<any[]> {
  const cacheKey = `users_${JSON.stringify(filters || {})}_${sortBy || ''}_${sortDir || ''}`;
  return cachedQuery(cacheKey, 30000, async () => {
    try {
      let query = `SELECT u.*, 
        s.id as student_db_id,
        s.classes_attended_json, s.preferred_mode, s.batch_number, s.course,
        s.topic_completed, s.joining_date, s.training_start_date,
        s.phone as stu_phone, s.dob, s.address, s.blood_group, s.gender,
        s.emergency_contact, s.father_name, s.mother_name,
        s.fees_total, s.fees_paid, s.fees_pending,
        s.documents_submitted, s.approval_status,
        s.streak, s.coins, s.student_code
        FROM users u LEFT JOIN students s ON u.email = s.portal_login_email`;
      const args: any[] = [];
      
      if (filters && Object.keys(filters).length > 0) {
        const conditions = [];
        for (const [key, val] of Object.entries(filters)) {
          if (!val) continue;

          if (key === 'search') {
            conditions.push(`(u.name LIKE ? OR u.email LIKE ? OR u.id LIKE ?)`);
            args.push(`%${val}%`, `%${val}%`, `%${val}%`);
          } else if (key === 'course') {
            conditions.push(`s.course = ?`);
            args.push(val);
          } else if (key === 'batch') {
            conditions.push(`s.batch_number = ?`);
            args.push(val);
          } else if (key === 'startDate') {
            conditions.push(`s.joining_date >= ?`);
            args.push(val);
          } else if (key === 'endDate') {
            conditions.push(`s.joining_date <= ?`);
            args.push(val);
          } else if (key === 'role') {
            if (typeof val === 'object' && val !== null && val._neq !== undefined) {
              conditions.push(`u.role != ?`);
              args.push(val._neq);
            } else {
              conditions.push(`u.role = ?`);
              args.push(val);
            }
          }
        }
        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }
      }
      
      if (sortBy && sortBy !== 'actions') {
        const sortColumnMap: Record<string, string> = {
          'name': 'u.name',
          'email': 'u.email',
          'role': 'u.role',
          'status': 'u.status',
          'salary': 'u.salary'
        };
        const dbColumn = sortColumnMap[sortBy];
        
        if (dbColumn) {
          query += ` ORDER BY ${dbColumn}`;
          if (sortDir === 'desc' || sortDir === 'asc') {
            query += ` ${sortDir.toUpperCase()}`;
          }
        }
      }

      const res = await executeWithRetry(query, args);
      return res.rows.map((row: any) => ({
        ...row,
        salary: Number(row.salary) || 0,
        phone: row.stu_phone || row.phone || '',
        dob: row.dob || '',
        fees_total: Number(row.fees_total) || 0,
        fees_paid: Number(row.fees_paid) || 0,
        fees_pending: Number(row.fees_pending) || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch users', error);
      return [];
    }
  });
}

export async function getFilterOptions(): Promise<{courses: string[], batches: string[]}> {
  return cachedQuery('filter_options', 60000, async () => {
    try {
      const coursesRes = await executeWithRetry('SELECT DISTINCT title FROM courses WHERE title IS NOT NULL');
      let courses: string[] = Array.from(new Set<string>(coursesRes.rows.map((r: any) => String(r.title)).filter((c: string) => c && c !== 'null')));
      if (courses.length === 0) {
        const studentCourses = await executeWithRetry('SELECT DISTINCT course FROM students WHERE course IS NOT NULL');
        courses = Array.from(new Set<string>(studentCourses.rows.map((r: any) => String(r.course)).filter((c: string) => c && c !== 'null')));
      }

      const batchesRes = await executeWithRetry('SELECT DISTINCT name FROM batches WHERE name IS NOT NULL').catch(() => ({ rows: [] }));
      const studentBatchesRes = await executeWithRetry('SELECT DISTINCT batch_number FROM students WHERE batch_number IS NOT NULL').catch(() => ({ rows: [] }));
      const allBatchNames = [
        ...batchesRes.rows.map((r: any) => String(r.name)),
        ...studentBatchesRes.rows.map((r: any) => String(r.batch_number))
      ].filter((b: string) => b && b !== 'null' && b.trim() !== '');
      const batches: string[] = Array.from(new Set<string>(allBatchNames));

      return { courses, batches };
    } catch (error) {
      console.error('Failed to fetch filter options', error);
      return { courses: [], batches: [] };
    }
  });
}

export async function getCourseCurriculum(): Promise<Record<string, string[]>> {
  try {
    const res = await executeWithRetry(`
      SELECT c.title as course_title, m.title as module_title 
      FROM courses c 
      JOIN course_module_mapping cmm ON c.id = cmm.course_id 
      JOIN modules m ON cmm.module_id = m.id
      ORDER BY c.title, cmm.order_index
    `);
    
    const mapping: Record<string, string[]> = {};
    for (const row of res.rows) {
      const course = String(row.course_title);
      const mod = String(row.module_title);
      if (!mapping[course]) mapping[course] = [];
      mapping[course].push(mod);
    }
    return mapping;
  } catch (error) {
    console.error('Failed to get course curriculum', error);
    return {};
  }
}

export async function saveUser(user: any): Promise<void> {
  try {
    const encPw = user.password ? encryptPassword(user.password) : encryptPassword('cynex123');
    const salary = user.salary || 0;
    const status = user.status || 'Active';

    if (user.id) {
      await executeWithRetry(
        "UPDATE users SET name=?, email=?, phone=?, role=?, salary=?, status=?, password_hash=?, password_encrypted=?, permissions_json=? WHERE id=?",
        [user.name, user.email, user.phone || '', user.role, salary, status, encPw, encPw, user.permissions_json, user.id]
      );
    } else {
      const newId = `usr_${Date.now()}`;
      await executeWithRetry(
        "INSERT INTO users (id, name, email, phone, role, salary, status, password_hash, password_encrypted, permissions_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [newId, user.name, user.email, user.phone || '', user.role, salary, status, encPw, encPw, user.permissions_json]
      );
    }
    invalidateQueryCache('users');
    invalidateQueryCache('filter_options');
  } catch (error) {
    console.error('Failed to save user', error);
    throw error;
  }
}

export async function saveStudent(studentData: any): Promise<void> {
  try {
    const encPw = studentData.password ? encryptPassword(studentData.password) : encryptPassword('cynex123');
    const status = studentData.status || 'Active';

    if (studentData.id) {
      await executeWithRetry(
        "UPDATE users SET name=?, email=?, phone=?, role='Student', status=?, password_hash=?, password_encrypted=? WHERE id=?",
        [studentData.name, studentData.email, studentData.phone || '', status, encPw, encPw, studentData.id]
      );
    } else {
      const newId = `usr_${Date.now()}`;
      await executeWithRetry(
        "INSERT INTO users (id, name, email, phone, role, salary, status, password_hash, password_encrypted) VALUES (?, ?, ?, ?, 'Student', 0, ?, ?, ?)",
        [newId, studentData.name, studentData.email, studentData.phone || '', status, encPw, encPw]
      );
    }

    const existing = await executeWithRetry(`SELECT id FROM students WHERE portal_login_email = ?`, [studentData.email]);
    if (existing.rows.length === 0) {
      const studentCode = `CNX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const stuId = `stu_${Date.now()}`;
      await executeWithRetry(
        `INSERT INTO students (id, student_code, name, portal_login_email, status, phone, course, batch_number, joining_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [stuId, studentCode, studentData.name, studentData.email, status, studentData.phone || null, studentData.course || null, studentData.batch_number || null, studentData.joining_date || null]
      );
    } else {
      await executeWithRetry(
        `UPDATE students SET name=?, phone=?, course=?, batch_number=?, joining_date=?, status=? WHERE portal_login_email=?`,
        [studentData.name, studentData.phone || null, studentData.course || null, studentData.batch_number || null, studentData.joining_date || null, status, studentData.email]
      );
    }
    invalidateQueryCache('users');
    invalidateQueryCache('filter_options');
  } catch (error) {
    console.error('Failed to save student', error);
    throw error;
  }
}

export async function patchUser(id: string, updates: Record<string, any>): Promise<void> {
  try {
    if (!updates || Object.keys(updates).length === 0) return;
    
    const setClauses = Object.keys(updates).map(key => `${key} = ?`);
    const args = [...Object.values(updates), id];
    
    const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;
    await executeWithRetry(query, args);
    invalidateQueryCache('users');
  } catch (error) {
    console.error('Failed to patch user', error);
    throw error;
  }
}

export async function updateStudentAttended(email: string, classesAttendedJson: string): Promise<void> {
  try {
    await executeWithRetry(
      "UPDATE students SET classes_attended_json = ? WHERE portal_login_email = ?",
      [classesAttendedJson, email]
    );
  } catch (error) {
    console.error('Failed to update student attended classes', error);
    throw error;
  }
}

export async function deleteUser(id: string, email: string): Promise<void> {
  try {
    await executeWithRetry("DELETE FROM users WHERE id = ?", [id]);
    if (email) {
      await executeWithRetry("DELETE FROM students WHERE portal_login_email = ?", [email]);
    }
  } catch (error) {
    console.error('Failed to delete user', error);
    throw error;
  }
}

export async function uploadStudentDocument(
  studentId: string,
  docType: string,
  fileName: string,
  fileData: string,
  uploadedBy: string
): Promise<string> {
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await executeWithRetry(
    `INSERT INTO student_documents (id, student_id, doc_type, file_name, file_data, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, studentId, docType, fileName, fileData, uploadedBy, new Date().toISOString()]
  );
  return id;
}

export async function getStudentDocuments(studentId: string): Promise<any[]> {
  try {
    const res = await executeWithRetry(
      `SELECT id, student_id, doc_type, file_name, uploaded_by, uploaded_at FROM student_documents WHERE student_id = ? ORDER BY uploaded_at DESC`,
      [studentId]
    );
    return res.rows;
  } catch (error) {
    console.error('Failed to get student documents', error);
    return [];
  }
}

export async function getStudentDocumentData(docId: string): Promise<string | null> {
  try {
    const res = await executeWithRetry(
      `SELECT file_data FROM student_documents WHERE id = ?`,
      [docId]
    );
    return res.rows[0]?.file_data as string ?? null;
  } catch (error) {
    console.error('Failed to get document data', error);
    return null;
  }
}

export async function deleteStudentDocument(docId: string): Promise<void> {
  await executeWithRetry(`DELETE FROM student_documents WHERE id = ?`, [docId]);
}

export async function updateStudentProfile(emailOrId: string, profile: {
  name?: string; phone?: string; dob?: string; address?: string;
  father_name?: string; mother_name?: string;
  emergency_contact?: string; blood_group?: string;
  batch_number?: string; course?: string; joining_date?: string; status?: string;
  gender?: string; fees_total?: number; fees_paid?: number; fees_pending?: number;
  training_start_date?: string; documents_submitted?: number;
  aadhar_file?: string; other_attachments?: string; topic_completed?: string;
}): Promise<void> {
  const fields = Object.keys(profile) as (keyof typeof profile)[];
  if (fields.length === 0) return;
  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const args = [...fields.map(f => (profile[f] ?? null) as any), emailOrId, emailOrId];
  await executeWithRetry(
    `UPDATE students SET ${setClauses} WHERE portal_login_email = ? OR id = ?`,
    args
  );
}

export async function bulkImportStudents(rows: {
  name: string; email: string; phone?: string;
  course?: string; batch_number?: string; joining_date?: string;
  training_start_date?: string; status?: string; password?: string;
  gender?: string; blood_group?: string; address?: string;
  emergency_contact?: string; fees_total?: number; fees_paid?: number;
  dob?: string;
}[]): Promise<{ imported: number; errors: string[] }> {
  const { encryptPassword } = await import('../crypto');
  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.name || !row.email) {
      errors.push(`Skipped row — missing name or email: ${JSON.stringify(row)}`);
      continue;
    }
    try {
      const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const studentId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const studentCode = `CNX-${new Date().getFullYear()}-${String(imported + 1).padStart(4, '0')}`;
      const encPw = encryptPassword(row.password || 'cynex123');
      const feesTotal = Number(row.fees_total) || 0;
      const feesPaid = Number(row.fees_paid) || 0;

      await executeWithRetry(
        `INSERT OR IGNORE INTO users (id, name, email, phone, role, status, password_hash, password_encrypted)
         VALUES (?, ?, ?, ?, 'Student', ?, ?, ?)`,
        [userId, row.name, row.email, row.phone || '', row.status || 'Active', encPw, encPw]
      );
      await executeWithRetry(
        `INSERT OR IGNORE INTO students (
          id, student_code, name, portal_login_email, status, course, batch_number, joining_date, phone,
          training_start_date, gender, blood_group, address, emergency_contact,
          fees_total, fees_paid, fees_pending, dob
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentId, studentCode, row.name, row.email, row.status || 'Active',
          row.course || null, row.batch_number || null, row.joining_date || null, row.phone || null,
          row.training_start_date || null, row.gender || null, row.blood_group || null,
          row.address || null, row.emergency_contact || null,
          feesTotal, feesPaid, feesTotal - feesPaid, row.dob || null
        ]
      );
      imported++;
    } catch (err: any) {
      errors.push(`Failed for ${row.email}: ${err.message}`);
    }
  }
  return { imported, errors };
}

export async function createPendingStudent(data: {
  name: string; email: string; phone: string; fees_total: number;
  fees_paid: number; fees_pending: number; joining_date: string;
  training_start_date: string; course: string; documents_submitted: number;
  gender: string; dob: string;
}): Promise<string> {
  const studentId = `stu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await executeWithRetry(
    `INSERT INTO students (
      id, name, portal_login_email, phone, fees_total, fees_paid, fees_pending, 
      joining_date, training_start_date, course, documents_submitted, 
      gender, dob, approval_status, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Active')`,
    [
      studentId, data.name, data.email, data.phone, data.fees_total, data.fees_paid,
      data.fees_pending, data.joining_date, data.training_start_date,
      data.course, data.documents_submitted, data.gender, data.dob
    ]
  );
  return studentId;
}

export async function getPendingStudents(): Promise<any[]> {
  const res = await executeWithRetry(`SELECT * FROM students WHERE approval_status = ?`, ['Pending']);
  return res.rows;
}

export async function approveStudent(studentId: string, portalId: string, passwordPlain: string, email: string, name: string): Promise<void> {
  const { encryptPassword } = await import('../crypto');
  const encPw = encryptPassword(passwordPlain);
  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  await executeWithRetry(
    `UPDATE students SET approval_status = ?, student_code = ? WHERE id = ?`,
    ['Approved', portalId, studentId]
  );

  const existingUser = await executeWithRetry(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existingUser.rows.length > 0) {
    await executeWithRetry(
      `UPDATE users SET password_hash = ?, password_encrypted = ?, status = 'Active' WHERE email = ?`,
      [encPw, encPw, email]
    );
  } else {
    await executeWithRetry(
      `INSERT INTO users (id, name, email, role, status, password_hash, password_encrypted)
       VALUES (?, ?, ?, 'Student', 'Active', ?, ?)`,
      [userId, name, email, encPw, encPw]
    );
  }
}

export async function rejectStudent(studentId: string): Promise<void> {
  await executeWithRetry(
    `UPDATE students SET approval_status = ? WHERE id = ?`,
    ['Rejected', studentId]
  );
}
