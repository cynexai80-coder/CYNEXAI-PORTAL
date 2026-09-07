import { client } from '../turso';
import { cachedQuery, invalidateQueryCache } from '../queryCache';

export interface Session {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  module: string;
  teacher: string;
  room: string;
}

export interface ClassRow {
  id: string;
  title: string;
  description: string;
  module_title?: string;
  type: string;
  status: string;
  ai_ppt_markdown: string | null;
  ai_script: string | null;
  ai_keypoints: string | null;
  youtube_video_id: string | null;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function executeWithRetry(query: string, args: any[] = [], retries = MAX_RETRIES): Promise<any> {
  try {
    if (!client) throw new Error('Database client not configured');
    return await client.execute({ sql: query, args });
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return executeWithRetry(query, args, retries - 1);
    }
    throw error;
  }
}

export async function getTimetables(): Promise<Session[]> {
  return cachedQuery('timetables_all', 60000, async () => {
    try {
      const res = await executeWithRetry("SELECT * FROM timetable_slots");
      return res.rows.map((r: any) => ({
        id: r.id as string,
        day: r.day_of_week as string,
        startTime: r.start_time as string,
        endTime: r.end_time as string,
        module: r.batch_id as string,
        teacher: r.teacher_id as string,
        room: r.timing as string
      }));
    } catch (e) {
      console.error("Failed to fetch timetables", e);
      return [];
    }
  });
}

export async function saveTimetable(session: Partial<Session>): Promise<void> {
  try {
    const sessId = session.id || `tt_${Date.now()}`;
    if (session.id) {
      await executeWithRetry(
        "UPDATE timetable_slots SET batch_id=?, teacher_id=?, timing=?, day_of_week=?, start_time=?, end_time=? WHERE id=?",
        [session.module, session.teacher, session.room, session.day, session.startTime, session.endTime, sessId]
      );
    } else {
      await executeWithRetry(
        "INSERT INTO timetable_slots (id, batch_id, teacher_id, timing, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [sessId, session.module, session.teacher, session.room, session.day, session.startTime, session.endTime]
      );
    }
    invalidateQueryCache('timetables');
    invalidateQueryCache('teacher_check');
  } catch (e) {
    console.error("Failed to save timetable", e);
    throw e;
  }
}

export async function deleteTimetable(id: string): Promise<void> {
  try {
    await executeWithRetry("DELETE FROM timetable_slots WHERE id = ?", [id]);
    invalidateQueryCache('timetables');
    invalidateQueryCache('teacher_check');
  } catch (e) {
    console.error("Failed to delete timetable", e);
    throw e;
  }
}

export async function getActiveLiveClass(instructorId: string): Promise<any> {
  try {
    let res = await executeWithRetry(
      `SELECT DISTINCT c.id, c.title, c.description, c.module_id, m.title as module_title
       FROM classes c
       JOIN modules m ON c.module_id = m.id
       LEFT JOIN course_module_mapping cmm ON m.id = cmm.module_id
       LEFT JOIN courses crs ON cmm.course_id = crs.id
       WHERE (m.instructor_id = ? 
              OR m.title IN (SELECT json_each.value FROM timetable_slots s, json_each(s.course_name) WHERE s.teacher_id = ?)
              OR crs.title IN (SELECT json_each.value FROM timetable_slots s, json_each(s.course_name) WHERE s.teacher_id = ?)
             )
         AND c.status IN ('live', 'in_progress', 'upcoming')
       ORDER BY c.order_index ASC LIMIT 1`,
      [instructorId, instructorId, instructorId]
    );

    if (res.rows.length === 0) {
      res = await executeWithRetry(
        `SELECT DISTINCT c.id, c.title, c.description, c.module_id, m.title as module_title
         FROM classes c
         JOIN modules m ON c.module_id = m.id
         WHERE c.status IN ('live', 'in_progress', 'upcoming')
         ORDER BY c.order_index ASC LIMIT 1`
      );
    }

    if (res.rows.length === 0) {
      res = await executeWithRetry(
        `SELECT DISTINCT c.id, c.title, c.description, c.module_id, m.title as module_title
         FROM classes c
         JOIN modules m ON c.module_id = m.id
         WHERE c.status IS NULL OR c.status != 'completed'
         ORDER BY c.order_index ASC LIMIT 1`
      );
    }

    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (e) {
    console.error("Failed to fetch active live class", e);
    return null;
  }
}

export async function getAllAvailableClasses(): Promise<any[]> {
  try {
    const res = await executeWithRetry(
      `SELECT DISTINCT c.id, c.title, c.description, c.module_id, c.order_index, m.title as module_title, c.status
       FROM classes c
       JOIN modules m ON c.module_id = m.id
       ORDER BY m.title ASC, c.order_index ASC`
    );
    return res.rows;
  } catch (e) {
    console.error("Failed to fetch available classes", e);
    return [];
  }
}

export async function ensureAttendanceSchema() {
  if (!client) return;
  try {
    await executeWithRetry(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        class_id TEXT,
        student_id TEXT,
        join_time TEXT,
        leave_time TEXT,
        duration_minutes INTEGER DEFAULT 0,
        attendance_type TEXT DEFAULT 'Manual',
        status TEXT DEFAULT 'Present'
      )
    `);
    const safeAddColumn = async (col: string, def: string) => {
      try { await executeWithRetry(`ALTER TABLE attendance_logs ADD COLUMN ${col} ${def}`); } catch (e) {}
    };
    await safeAddColumn('class_id', 'TEXT');
    await safeAddColumn('leave_time', 'TEXT');
    await safeAddColumn('duration_minutes', 'INTEGER DEFAULT 0');
    await safeAddColumn('attendance_type', "TEXT DEFAULT 'Manual'");
    await safeAddColumn('status', "TEXT DEFAULT 'Present'");
  } catch (e) {
    console.error("Error ensuring attendance_logs schema", e);
  }
}

export async function logAttendance(studentId: string, classId: string, type: string = 'Manual'): Promise<void> {
  await ensureAttendanceSchema();
  try {
    const id = `att_${Date.now()}`;
    await executeWithRetry(
      "INSERT INTO attendance_logs (id, batch_id, class_id, student_id, join_time, duration_minutes, attendance_type, status) VALUES (?, ?, ?, ?, ?, 60, ?, 'Present')",
      [id, classId, classId, studentId, new Date().toISOString(), type]
    );
  } catch (e) {
    console.error("Failed to log attendance", e);
    throw e;
  }
}

export async function logOnlineAttendancePing(studentId: string, classId: string, batchId: string = 'default', durationMinutes: number = 1): Promise<{ markedPresent: boolean; durationMinutes: number }> {
  await ensureAttendanceSchema();
  try {
    const isPresent = durationMinutes >= 5;
    const statusStr = isPresent ? 'Present' : 'Pending';

    const checkRes = await executeWithRetry(
      "SELECT id, duration_minutes FROM attendance_logs WHERE student_id = ? AND (batch_id = ? OR class_id = ?) LIMIT 1",
      [studentId, classId, classId]
    );

    if (checkRes.rows.length > 0) {
      const existing = checkRes.rows[0];
      const maxDuration = Math.max(Number(existing.duration_minutes) || 0, durationMinutes);
      const newStatus = maxDuration >= 5 ? 'Present' : 'Pending';
      await executeWithRetry(
        "UPDATE attendance_logs SET duration_minutes = ?, status = ?, leave_time = ? WHERE id = ?",
        [maxDuration, newStatus, new Date().toISOString(), existing.id]
      );
      return { markedPresent: maxDuration >= 5, durationMinutes: maxDuration };
    } else {
      const id = `att_on_${Date.now()}`;
      await executeWithRetry(
        "INSERT INTO attendance_logs (id, batch_id, class_id, student_id, join_time, duration_minutes, attendance_type, status) VALUES (?, ?, ?, ?, ?, ?, 'Online', ?)",
        [id, batchId, classId, studentId, new Date().toISOString(), durationMinutes, statusStr]
      );
      return { markedPresent: isPresent, durationMinutes };
    }
  } catch (e) {
    console.error("Failed to log online attendance ping", e);
    return { markedPresent: durationMinutes >= 5, durationMinutes };
  }
}

export async function logQRAttendance(studentId: string, classId: string): Promise<boolean> {
  await ensureAttendanceSchema();
  try {
    const id = `att_qr_${Date.now()}`;
    await executeWithRetry(
      "INSERT INTO attendance_logs (id, batch_id, class_id, student_id, join_time, duration_minutes, attendance_type, status) VALUES (?, ?, ?, ?, ?, 60, 'Offline_QR', 'Present')",
      [id, classId, classId, studentId, new Date().toISOString()]
    );
    return true;
  } catch (e) {
    console.error("Failed to log QR attendance", e);
    return false;
  }
}

export async function removeAttendance(studentId: string, classId: string): Promise<void> {
  try {
    await executeWithRetry(
      "DELETE FROM attendance_logs WHERE student_id = ? AND (batch_id = ? OR class_id = ?)",
      [studentId, classId, classId]
    );
  } catch (e) {
    console.error("Failed to remove attendance", e);
    throw e;
  }
}

export async function getLiveAttendance(classId: string, batchName?: string): Promise<any[]> {
  await ensureAttendanceSchema();
  try {
    let sql = `
      SELECT 
        a.student_id, 
        COALESCE(u.name, s.name, 'Student') as student_name, 
        COALESCE(u.email, s.portal_login_email, '') as student_email, 
        COALESCE(b.name, s.batch_number, 'Global') as batch_name, 
        MAX(a.join_time) as join_time,
        MAX(a.duration_minutes) as duration_minutes,
        MAX(a.attendance_type) as attendance_type,
        MAX(a.status) as status
      FROM attendance_logs a
      LEFT JOIN users u ON a.student_id = u.id OR LOWER(a.student_id) = LOWER(u.email)
      LEFT JOIN students s ON a.student_id = s.id OR LOWER(a.student_id) = LOWER(s.portal_login_email)
      LEFT JOIN batches b ON LOWER(TRIM(s.batch_number)) = LOWER(TRIM(b.name))
      WHERE (a.batch_id = ? OR a.class_id = ? ${batchName ? 'OR LOWER(TRIM(s.batch_number)) = LOWER(TRIM(?))' : ''})
      GROUP BY a.student_id
      ORDER BY MAX(a.join_time) DESC
    `;
    const args = batchName ? [classId, classId, batchName] : [classId, classId];
    const res = await executeWithRetry(sql, args);
    return res.rows;
  } catch (e) {
    console.error("Failed to get live attendance", e);
    return [];
  }
}

export async function getAllAttendanceLogsMatrix(): Promise<any[]> {
  await ensureAttendanceSchema();
  try {
    const res = await executeWithRetry(
      `SELECT DISTINCT id, batch_id, class_id, student_id, join_time, duration_minutes, attendance_type, status 
       FROM attendance_logs`
    );
    return res.rows || [];
  } catch (e) {
    console.error("Failed to fetch all attendance logs matrix", e);
    return [];
  }
}

export async function getInstructorClasses(instructorId: string, specificClassId?: string): Promise<ClassRow[]> {
  try {
    if (specificClassId && (specificClassId.startsWith('slot_') || specificClassId.startsWith('ts_') || specificClassId.startsWith('tt_'))) {
      const slotRes = await executeWithRetry('SELECT course_name FROM timetable_slots WHERE id = ?', [specificClassId]);
      if (slotRes.rows.length > 0) {
        const courseName = slotRes.rows[0].course_name as string;
        let parsedCourses: string[] = [];
        try { parsedCourses = JSON.parse(courseName); } catch (e) { parsedCourses = [courseName]; }
        if (!Array.isArray(parsedCourses)) parsedCourses = [parsedCourses];
        parsedCourses = parsedCourses.map(c => String(c).trim()).filter(Boolean);

        if (parsedCourses.length > 0) {
          const coursePlaceholders = parsedCourses.map(() => '?').join(',');

          const res = await executeWithRetry(
            `SELECT DISTINCT c.id, c.title, c.description, c.type, c.status, 
                    c.ai_ppt_markdown, c.ai_script, c.ai_keypoints, c.youtube_video_id,
                    m.title as module_title
             FROM classes c 
             JOIN modules m ON c.module_id = m.id 
             LEFT JOIN course_module_mapping cmm ON m.id = cmm.module_id
             LEFT JOIN courses crs ON cmm.course_id = crs.id
             WHERE (crs.title IN (${coursePlaceholders}) OR m.title IN (${coursePlaceholders}))
               AND c.status != 'completed' 
             ORDER BY c.order_index ASC LIMIT 1`,
            [...parsedCourses, ...parsedCourses]
          );
          if (res.rows.length > 0) return res.rows as unknown as ClassRow[];
        }
      }
      specificClassId = undefined;
    }

    if (specificClassId) {
      const res = await executeWithRetry(
        `SELECT DISTINCT c.id, c.title, c.description, c.type, c.status, 
                c.ai_ppt_markdown, c.ai_script, c.ai_keypoints, c.youtube_video_id,
                m.title as module_title
         FROM classes c 
         JOIN modules m ON c.module_id = m.id 
         WHERE c.id = ?`,
        [specificClassId]
      );
      if (res.rows.length > 0) return res.rows as unknown as ClassRow[];
    }

    const res = await executeWithRetry(
      `SELECT DISTINCT c.id, c.title, c.description, c.type, c.status, 
              c.ai_ppt_markdown, c.ai_script, c.ai_keypoints, c.youtube_video_id,
              m.title as module_title
       FROM classes c 
       JOIN modules m ON c.module_id = m.id 
       WHERE c.status != 'completed' 
       ORDER BY c.order_index ASC LIMIT 1`
    );
    return res.rows as unknown as ClassRow[];
  } catch (e) {
    console.error("Failed to fetch instructor classes", e);
    return [];
  }
}

export async function updateClassMaterials(classId: string, ppt: string, script: string, keypoints: string): Promise<void> {
  try {
    await executeWithRetry(
      'UPDATE classes SET ai_ppt_markdown = ?, ai_script = ?, ai_keypoints = ? WHERE id = ?',
      [ppt, script, keypoints, classId]
    );
  } catch (e) {
    console.error("Failed to update materials", e);
    throw e;
  }
}

export async function createClass(moduleId: string, title: string, description: string): Promise<void> {
  try {
    const maxRes = await executeWithRetry("SELECT MAX(order_index) as max_idx FROM classes WHERE module_id = ?", [moduleId]);
    const maxIdx = maxRes.rows[0]?.max_idx || 0;
    const orderIndex = Number(maxIdx) + 1;
    
    await executeWithRetry(
      "INSERT INTO classes (id, module_id, title, description, type, status, order_index) VALUES (?, ?, ?, ?, 'live', 'upcoming', ?)",
      [`cls_${Date.now()}`, moduleId, title, description, orderIndex]
    );
  } catch (e) {
    console.error("Failed to create class", e);
    throw e;
  }
}

export async function updateClassDetails(classId: string, title: string, description: string): Promise<void> {
  try {
    await executeWithRetry(
      "UPDATE classes SET title = ?, description = ? WHERE id = ?",
      [title, description, classId]
    );
  } catch (e) {
    console.error("Failed to update class details", e);
    throw e;
  }
}

export async function updateClassStatus(classId: string, status: string, type: string, ytUrl: string = ''): Promise<void> {
  try {
    if (ytUrl) {
      await executeWithRetry(
        "UPDATE classes SET status = ?, type = ?, youtube_video_id = ? WHERE id = ?",
        [status, type, ytUrl, classId]
      );
    } else {
      await executeWithRetry(
        "UPDATE classes SET status = ?, type = ? WHERE id = ?",
        [status, type, classId]
      );
    }
  } catch (e) {
    console.error("Failed to update status", e);
    throw e;
  }
}

export async function completeClassWithSummary(classId: string, summary: string, ytUrl: string | null) {
  try {
    await executeWithRetry(
      "UPDATE classes SET status = 'completed', ai_summary = ?, youtube_video_id = ? WHERE id = ?",
      [summary, ytUrl, classId]
    );
  } catch (e) {
    console.error(e);
  }
}

export async function getClassForPresentation(classId: string) {
  try {
    const res = await executeWithRetry(
      'SELECT title, description, ai_ppt_markdown FROM classes WHERE id = ?',
      [classId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getTeacherCMSModules(isSuper: boolean, instructorId: string) {
  try {
    if (isSuper) {
      const res = await executeWithRetry("SELECT * FROM modules ORDER BY title ASC");
      return res.rows;
    } else {
      const res = await executeWithRetry(
        `SELECT DISTINCT m.* 
         FROM modules m 
         LEFT JOIN course_module_mapping cmm ON m.id = cmm.module_id
         LEFT JOIN courses crs ON cmm.course_id = crs.id
         WHERE m.instructor_id = ? 
            OR m.instructor_id = 'usr_teacher'
            OR m.instructor_id = 'usr_teacher_venkat'
            OR m.instructor_id IN (SELECT id FROM users WHERE email = ? OR email = 'teacher@cynexai.com')
            OR m.title IN (SELECT json_each.value FROM timetable_slots s, json_each(s.course_name) WHERE s.teacher_id = ? OR s.teacher_id = 'usr_teacher' OR s.teacher_id = 'usr_teacher_venkat')
            OR crs.title IN (SELECT json_each.value FROM timetable_slots s, json_each(s.course_name) WHERE s.teacher_id = ? OR s.teacher_id = 'usr_teacher' OR s.teacher_id = 'usr_teacher_venkat')
         ORDER BY m.title ASC`,
        [instructorId, instructorId, instructorId, instructorId]
      );
      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
      // Fallback: If no modules explicitly matched this instructor yet, return all modules so teacher is not blocked
      const fallback = await executeWithRetry("SELECT * FROM modules ORDER BY title ASC");
      return fallback.rows;
    }
  } catch (e) {
    console.error("getTeacherCMSModules error:", e);
    const fallback = await executeWithRetry("SELECT * FROM modules ORDER BY title ASC").catch(() => ({ rows: [] }));
    return fallback.rows;
  }
}

export async function getClassesForModules(modIds: string) {
  try {
    const res = await executeWithRetry(`SELECT * FROM classes WHERE module_id IN (${modIds}) ORDER BY order_index ASC`);
    return res.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getTeacherTimetables(teacherId: string) {
  try {
    const res = teacherId
      ? await executeWithRetry("SELECT * FROM timetable_slots WHERE teacher_id = ? OR teacher_id = 'usr_teacher' OR teacher_id = 'usr_teacher_venkat'", [teacherId])
      : await executeWithRetry("SELECT * FROM timetable_slots LIMIT 50");
    return res.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getTeacherFirstCourse(instructorId: string) {
  try {
    let res = await executeWithRetry(
      `SELECT DISTINCT c.* 
       FROM courses c
       JOIN course_module_mapping cmm ON c.id = cmm.course_id
       JOIN modules m ON cmm.module_id = m.id
       WHERE m.instructor_id = ?
       LIMIT 1`,
      [instructorId]
    );
    if (res.rows.length === 0) {
      res = await executeWithRetry("SELECT * FROM courses ORDER BY created_at ASC LIMIT 1");
    }
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getCourseModulesMap(courseId: string) {
  try {
    const res = await executeWithRetry(
      `SELECT m.* FROM modules m JOIN course_module_mapping cmm ON m.id = cmm.module_id WHERE cmm.course_id = ? ORDER BY cmm.order_index ASC`,
      [courseId]
    );
    return res.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function getCourseClassesMap(courseId: string) {
  try {
    const res = await executeWithRetry(
      `SELECT id, module_id, status FROM classes WHERE module_id IN (SELECT module_id FROM course_module_mapping WHERE course_id = ?)`,
      [courseId]
    );
    return res.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ─── Class Reschedule / Postpone ────────────────────────────────────────────

export interface RescheduleInput {
  slotId: string;
  slotTitle: string;
  originalDate?: string;
  originalTime: string;
  newDate?: string;
  newTime: string;
  reason: string;
  createdBy: string;
  batchId?: string;  // batch to notify
  courseId?: string; // course to notify
}

export async function postponeClass(input: RescheduleInput): Promise<{ success: boolean; message: string }> {
  try {
    // Create the class_reschedules table if it doesn't exist
    await executeWithRetry(`
      CREATE TABLE IF NOT EXISTS class_reschedules (
        id TEXT PRIMARY KEY,
        slot_id TEXT,
        slot_title TEXT,
        original_time TEXT,
        new_time TEXT,
        new_date TEXT,
        reason TEXT,
        created_by TEXT,
        batch_id TEXT,
        course_id TEXT,
        created_at TEXT
      )
    `);

    const id = `rs_${Date.now()}`;
    await executeWithRetry(
      `INSERT INTO class_reschedules (id, slot_id, slot_title, original_time, new_time, new_date, reason, created_by, batch_id, course_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.slotId, input.slotTitle, input.originalTime, input.newTime, input.newDate || null, input.reason, input.createdBy, input.batchId || null, input.courseId || null, new Date().toISOString()]
    );

    // Also insert into announcements table so students see it as a popup
    const announcementId = `ann_rs_${Date.now()}`;
    const announcementBody = `📅 Class "${input.slotTitle}" has been rescheduled.\n\n🕐 Original Time: ${input.originalTime}\n🕐 New Time: ${input.newTime}${input.newDate ? `\n📆 New Date: ${input.newDate}` : ''}\n\n📝 Reason: ${input.reason}`;
    
    await executeWithRetry(
      `INSERT INTO announcements (id, title, body, is_active, created_at, batch_id) VALUES (?, ?, ?, 1, ?, ?)`,
      [announcementId, `⏰ Class Rescheduled: ${input.slotTitle}`, announcementBody, new Date().toISOString(), input.batchId || null]
    );

    // Update the timetable slot's time
    await executeWithRetry(
      `UPDATE timetable_slots SET start_time = ? WHERE id = ?`,
      [input.newTime, input.slotId]
    );

    return { success: true, message: 'Class rescheduled and students notified.' };
  } catch (e) {
    console.error('Failed to postpone class:', e);
    return { success: false, message: 'Failed to reschedule class.' };
  }
}

export async function getRescheduleHistory(slotId?: string): Promise<any[]> {
  try {
    await executeWithRetry(`
      CREATE TABLE IF NOT EXISTS class_reschedules (
        id TEXT PRIMARY KEY, slot_id TEXT, slot_title TEXT,
        original_time TEXT, new_time TEXT, new_date TEXT,
        reason TEXT, created_by TEXT, batch_id TEXT, course_id TEXT, created_at TEXT
      )
    `);
    const res = slotId
      ? await executeWithRetry(`SELECT * FROM class_reschedules WHERE slot_id = ? ORDER BY created_at DESC`, [slotId])
      : await executeWithRetry(`SELECT * FROM class_reschedules ORDER BY created_at DESC LIMIT 50`);
    return res.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function ensureClassQuestions(classId: string, title: string, description: string = '', keypoints: string = ''): Promise<void> {
  try {
    const existing = await executeWithRetry('SELECT id FROM class_questions WHERE class_id = ? LIMIT 1', [classId]);
    if (existing.rows.length === 0) {
      const { generateAIQuestions } = await import('../aiGenerator');
      const generated = await generateAIQuestions(title, description, keypoints, true);
      for (const q of generated) {
        const qId = 'cq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const optionsJson = q.options ? JSON.stringify(q.options) : null;
        const boilerplate = q.boilerplate ? JSON.stringify(q.boilerplate) : null;
        const testCases = q.test_cases ? (typeof q.test_cases === 'string' ? q.test_cases : JSON.stringify(q.test_cases)) : null;

        await executeWithRetry(
          `INSERT INTO class_questions (id, class_id, type, question_text, options_json, correct_answer_idx, boilerplate_json, test_cases_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [qId, classId, q.type || 'mcq', q.question_text, optionsJson, q.correct_answer_idx ?? 0, boilerplate, testCases]
        );
      }
    }
  } catch (e) {
    console.error('ensureClassQuestions failed:', e);
  }
}

