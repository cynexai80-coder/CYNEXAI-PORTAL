import { client, isTursoConfigured } from '../turso';
import { cachedQuery } from '../queryCache';

export type PendingApproval = {
  id: string;
  sale_id: string;
  lead_name: string;
  course: string;
  amount_paid: number;
  total_fee: number;
  status: string;
  created_at: string;
};

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

export const getPendingApprovals = async (): Promise<PendingApproval[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute(`
        SELECT ma.id, ma.sale_id, l.name as lead_name, s.course_id as course, s.amount_paid, s.total_fee, ma.status, s.timestamp as created_at
        FROM manager_approvals ma
        JOIN sales s ON ma.sale_id = s.id
        JOIN crm_leads l ON s.lead_id = l.id
        WHERE ma.status = 'Pending'
        ORDER BY s.timestamp DESC
      `);
      
      return result.rows.map(row => ({
        id: row.id as string,
        sale_id: row.sale_id as string,
        lead_name: row.lead_name as string,
        course: row.course as string,
        amount_paid: row.amount_paid as number,
        total_fee: row.total_fee as number,
        status: row.status as string,
        created_at: row.created_at as string
      }));
    } catch (e) {
      console.error(e);
    }
  }
  return [];
};

export const approveSale = async (approvalId: string, approverId: string, saleId: string) => {
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: `UPDATE manager_approvals SET status = 'Approved', approver_id = ?, decided_at = ? WHERE id = ?`,
        args: [approverId, new Date().toISOString(), approvalId]
      });
      
      // Fetch onboarding record to link student, or create one
      const onbResult = await client.execute({ sql: `SELECT id FROM onboardings WHERE sale_id = ? ORDER BY rowid DESC LIMIT 1`, args: [saleId] });
      let onbId = onbResult.rows.length > 0 ? onbResult.rows[0].id : null;
      if (!onbId) {
        onbId = 'onb_' + Date.now().toString(36);
        await client.execute({
          sql: `INSERT INTO onboardings (id, sale_id, batch_id, teacher_id, mode, joining_date, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [onbId, saleId, '', '', '', '', '']
        });
      }

      // Find the lead associated with this sale to update bucket
      const saleResult = await client.execute({ sql: `SELECT s.lead_id, l.name as lead_name FROM sales s JOIN crm_leads l ON s.lead_id = l.id WHERE s.id = ?`, args: [saleId] });
      if (saleResult.rows.length > 0) {
        const leadId = saleResult.rows[0].lead_id;
        const leadName = saleResult.rows[0].lead_name;
        
        // Generate student credentials
        const studentId = 'stu_' + Date.now().toString(36);
        const studentCode = 'CNX-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
        const email = `${studentCode.toLowerCase()}@student.cynexai.com`;
        
        await client.execute({
          sql: `INSERT INTO students (id, onboarding_id, student_code, portal_login_email, status) VALUES (?, ?, ?, ?, ?)`,
          args: [studentId, onbId, studentCode, email, 'Active']
        });

        // AUTOMATION: MOCKED EMAIL DISPATCH
        console.log(`[AUTOMATION: EMAIL] 🚀 Sent welcome email to ${email} with portal login credentials.`);

        await client.execute({ sql: `UPDATE crm_leads SET status = 'Closed Won' WHERE id = ?`, args: [leadId] });
        
        // Create Manager Task to assign batch
        const taskId = 'tsk_' + Date.now().toString(36);
        await client.execute({
          sql: `INSERT INTO tasks (id, title, description, assignee_id, created_by, status, due_date, priority, task_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            taskId,
            `Assign Batch & Teacher: ${leadName}`,
            `Please assign a batch and teacher for the newly onboarded student.\n\nLink: /manager/assign-batch/${studentId}`,
            approverId, 
            approverId, 
            'To Do',
            new Date().toISOString().split('T')[0], 
            'High',
            'One-Time',
            new Date().toISOString()
          ]
        });

        return { leadId, studentCode, email, studentId };
      }
    } catch(e) { console.error(e); }
  }
  return null;
};

export const rejectSale = async (approvalId: string, approverId: string, notes: string) => {
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: `UPDATE manager_approvals SET status = 'Rejected', notes = ?, approver_id = ?, decided_at = ? WHERE id = ?`,
        args: [notes, approverId, new Date().toISOString(), approvalId]
      });
      return true;
    } catch(e) { console.error(e); }
  }
  return false;
};

export const assignBatchToStudent = async (studentId: string, batchId: string, teacherId: string, mode: string, joiningDate: string, remarks: string, taskId?: string) => {
  if (isTursoConfigured && client) {
    try {
      // Find the onboarding ID for this student, or create one if none exists
      const studentResult = await client.execute({ sql: `SELECT onboarding_id, portal_login_email FROM students WHERE id = ?`, args: [studentId] });
      if (studentResult.rows.length === 0) return false;
      
      let onbId = studentResult.rows[0].onboarding_id as string | null;
      if (!onbId) {
        onbId = 'onb_' + Date.now().toString(36);
        await client.execute({
          sql: `INSERT INTO onboardings (id, batch_id, teacher_id, mode, joining_date, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [onbId, batchId, teacherId, mode, joiningDate, remarks]
        });
        await client.execute({ sql: `UPDATE students SET onboarding_id = ? WHERE id = ?`, args: [onbId, studentId] });
      } else {
        await client.execute({
          sql: `UPDATE onboardings SET batch_id = ?, teacher_id = ?, mode = ?, joining_date = ?, remarks = ? WHERE id = ?`,
          args: [batchId, teacherId, mode, joiningDate, remarks, onbId]
        });
      }

      // Mark task as Done if provided
      if (taskId) {
        await client.execute({ sql: `UPDATE tasks SET status = 'Done' WHERE id = ?`, args: [taskId] });
      }

      return true;
    } catch(e) { console.error(e); }
  }
  return false;
};

export const getManagerAnalytics = async () => {
  if (isTursoConfigured && client) {
    try {
      const stats = {
        totalStudents: 0,
        totalLeads: 0,
        totalRevenue: 0,
        classesCompleted: 0
      };
      
      const stdRes = await client.execute("SELECT COUNT(*) as c FROM students");
      if(stdRes.rows.length) stats.totalStudents = Number(stdRes.rows[0].c);
      
      const leadRes = await client.execute("SELECT COUNT(*) as c FROM crm_leads");
      if(leadRes.rows.length) stats.totalLeads = Number(leadRes.rows[0].c);
      
      const revRes = await client.execute("SELECT SUM(amount_paid) as sum FROM sales");
      if(revRes.rows.length) stats.totalRevenue = Number(revRes.rows[0].sum) || 0;
      
      const clsRes = await client.execute("SELECT COUNT(*) as c FROM classes WHERE status = 'completed'");
      if(clsRes.rows.length) stats.classesCompleted = Number(clsRes.rows[0].c);

      return stats;
    } catch(e) { console.error(e); }
  }
  return { totalStudents: 0, totalLeads: 0, totalRevenue: 0, classesCompleted: 0 };
};

export const getApprovalDetails = async (id: string) => {
  try {
    const res = await executeWithRetry(
      `SELECT ma.*, s.amount_paid, s.total_fee, s.course_id, l.name as lead_name, l.id as lead_id
       FROM manager_approvals ma
       JOIN sales s ON ma.sale_id = s.id
       JOIN crm_leads l ON s.lead_id = l.id
       WHERE ma.id = ?`,
      [id]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const getManagerTasks = async (userId: string) => {
  try {
    const res = await executeWithRetry("SELECT * FROM tasks WHERE created_by = ? ORDER BY id DESC", [userId]);
    return res.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const deleteManagerTask = async (id: string) => {
  try {
    await executeWithRetry("DELETE FROM tasks WHERE id = ?", [id]);
  } catch (e) {
    console.error(e);
  }
};

export const getOnboardingDetails = async (saleId: string) => {
  try {
    const res = await executeWithRetry(
      `SELECT s.id, l.name as lead_name, l.id as lead_id, s.course_id 
       FROM sales s JOIN crm_leads l ON s.lead_id = l.id WHERE s.id = ?`,
      [saleId]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const getErpUsers = async () => {
  try {
    const res = await executeWithRetry("SELECT id, name, email, role FROM users WHERE role != 'Student'");
    return res.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const getErpModules = async () => {
  try {
    const res = await executeWithRetry("SELECT id, title, instructor_id FROM modules ORDER BY title ASC");
    return res.rows;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const saveErpUser = async (form: any) => {
  try {
    if (form.id.startsWith('usr_')) {
      await executeWithRetry("UPDATE erp_users SET name = ?, email = ?, role = ? WHERE id = ?", [form.name, form.email, form.role, form.id]);
    } else {
      await executeWithRetry("INSERT INTO erp_users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)", [form.id, form.name, form.email, form.password, form.role]);
    }
  } catch (e) {
    console.error(e);
  }
};

export const assignModulesToInstructor = async (instructorId: string, moduleIds: string[]) => {
  try {
    await executeWithRetry("UPDATE modules SET instructor_id = NULL WHERE instructor_id = ?", [instructorId]);
    for (const mid of moduleIds) {
      await executeWithRetry("UPDATE modules SET instructor_id = ? WHERE id = ?", [instructorId, mid]);
    }
  } catch (e) {
    console.error(e);
  }
};

// --- Timetable API ---

export interface GlobalTimetableSlot {
  id: string;
  batch_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  course_name: string;
  teacher_id: string;
  timing: string;
  status?: string;
  week_start?: string;
  teacher_name?: string;
  batch_name?: string;
}

export interface LeaveRequestData {
  id: string;
  user_id: string;
  date: string;
  reason: string;
  status: string;
  created_at: string;
  teacher_name?: string;
}

export const getGlobalTimetable = async (filters?: { course?: string, module?: string, teacher?: string, weekStart?: string }): Promise<GlobalTimetableSlot[]> => {
  if (isTursoConfigured && client) {
    try {
      let sql = `
        SELECT ts.*, COALESCE(u.name, eu.name, 'Teacher') as teacher_name
        FROM timetable_slots ts
        LEFT JOIN users u ON ts.teacher_id = u.id
        LEFT JOIN erp_users eu ON ts.teacher_id = eu.id
        WHERE 1=1
      `;
      const args: any[] = [];
      
      if (filters?.course) {
        sql += ` AND (ts.course_name LIKE ? OR ts.batch_id LIKE ?)`;
        args.push(`%${filters.course}%`, `%${filters.course}%`);
      }
      if (filters?.teacher) {
        sql += ` AND (ts.teacher_id = ? OR ts.teacher_id = 'usr_teacher' OR ts.teacher_id = 'usr_teacher_venkat')`;
        args.push(filters.teacher);
      }
      if (filters?.weekStart) {
        sql += ` AND (ts.week_start = ? OR ts.week_start IS NULL OR ts.week_start = '' OR ts.status IN ('ongoing', 'weekly', 'active') OR ts.week_start <= ?)`;
        args.push(filters.weekStart, filters.weekStart);
      }

      const res = await executeWithRetry(sql, args);
      let slots = res.rows as unknown as GlobalTimetableSlot[];

      // Fallback: If no custom timetable_slots match, query legacy timetables table
      if (!slots || slots.length === 0) {
        const legacyRes = await executeWithRetry(
          `SELECT tt.*, COALESCE(u.name, eu.name, 'Teacher') as teacher_name
           FROM timetables tt
           LEFT JOIN users u ON tt.teacher_id = u.id
           LEFT JOIN erp_users eu ON tt.teacher_id = eu.id`
        );
        slots = legacyRes.rows.map((row: any) => {
          const matchTime = (t: string) => {
            if (!t) return '09:00';
            const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (!m) return t;
            let h = parseInt(m[1], 10);
            if (m[3]) {
              if (m[3].toUpperCase() === 'PM' && h < 12) h += 12;
              if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
            }
            return (h < 10 ? '0' + h : '' + h) + ':' + m[2];
          };
          return {
            id: row.id,
            batch_id: row.batch_id,
            batch_name: row.batch_id,
            course_name: 'Data Science & AI',
            day_of_week: row.day_of_week,
            start_time: matchTime(row.start_time),
            end_time: matchTime(row.end_time),
            teacher_id: row.teacher_id,
            teacher_name: row.teacher_name,
            timing: 'Online / Live',
            status: 'weekly',
            week_start: filters?.weekStart || ''
          };
        }) as GlobalTimetableSlot[];
      }

      return slots;
    } catch (e) {
      console.error(e);
    }
  }
  return [];
};

export const getBatchesList = async () => {
  if (isTursoConfigured && client) {
    try {
      const batchesRes = await executeWithRetry("SELECT id, name, course_id FROM batches ORDER BY name ASC");
      const studentBatchesRes = await executeWithRetry("SELECT DISTINCT batch_number, course FROM students WHERE batch_number IS NOT NULL AND batch_number != '' AND batch_number != 'null'");
      
      const allBatches: { id: string; name: string; course_id?: string }[] = batchesRes.rows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name || 'Unnamed Batch'),
        course_id: r.course_id ? String(r.course_id) : undefined,
      }));
      
      studentBatchesRes.rows.forEach((r: any) => {
        const batchNum = String(r.batch_number).trim();
        const course = String(r.course || '').trim();
        if (batchNum && batchNum !== 'null') {
          const normName = batchNum.toLowerCase().startsWith('batch') ? batchNum : 'Batch ' + batchNum;
          const exists = allBatches.some(b => 
            String(b.id) === batchNum || 
            String(b.name).toLowerCase() === normName.toLowerCase() ||
            String(b.name).toLowerCase() === batchNum.toLowerCase()
          );
          if (!exists) {
            allBatches.push({ id: batchNum, name: normName, course_id: course });
          }
        }
      });
      
      return allBatches;
    } catch (e) {
      console.error(e);
    }
  }
  return [];
};

export const saveTimetableSlot = async (slot: Partial<GlobalTimetableSlot>) => {
  if (isTursoConfigured && client) {
    try {
      const id = slot.id || 'ts_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
      const batchId = slot.batch_id ?? '{}';
      const dayOfWeek = slot.day_of_week ?? 'Monday';
      const startTime = slot.start_time ?? '09:00';
      const endTime = slot.end_time ?? '10:00';
      const courseName = slot.course_name ?? '[]';
      const teacherId = slot.teacher_id ?? '';
      const timing = slot.timing ?? 'Offline';
      const status = slot.status ?? 'one-time';
      const weekStart = slot.week_start ?? '';

      if (slot.id) {
        await executeWithRetry(
          "UPDATE timetable_slots SET batch_id=?, day_of_week=?, start_time=?, end_time=?, course_name=?, teacher_id=?, timing=?, status=?, week_start=? WHERE id=?",
          [batchId, dayOfWeek, startTime, endTime, courseName, teacherId, timing, status, weekStart, id]
        );
      } else {
        await executeWithRetry(
          "INSERT INTO timetable_slots (id, batch_id, day_of_week, start_time, end_time, course_name, teacher_id, timing, status, week_start) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [id, batchId, dayOfWeek, startTime, endTime, courseName, teacherId, timing, status, weekStart]
        );
      }
      return true;
    } catch (e) {
      console.error('Error in saveTimetableSlot:', e);
      throw e;
    }
  }
  return false;
};

export const deleteTimetableSlot = async (id: string) => {
  if (isTursoConfigured && client) {
    try {
      await executeWithRetry("DELETE FROM timetable_slots WHERE id = ?", [id]);
      return true;
    } catch (e) {
      console.error(e);
    }
  }
  return false;
};

export const getLeaveRequests = async (): Promise<LeaveRequestData[]> => {
  if (isTursoConfigured && client) {
    try {
      const res = await executeWithRetry(`
        SELECT l.*, u.name as teacher_name
        FROM leaves l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
      `);
      return res.rows as unknown as LeaveRequestData[];
    } catch (e) {
      console.error(e);
    }
  }
  return [];
};

export const updateLeaveStatus = async (leaveId: string, status: string) => {
  if (isTursoConfigured && client) {
    try {
      await executeWithRetry("UPDATE leaves SET status = ? WHERE id = ?", [status, leaveId]);
      return true;
    } catch (e) {
      console.error(e);
    }
  }
  return false;
};


export const checkTeacherAssignment = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  return cachedQuery(`teacher_assigned_${userId}`, async () => {
    if (isTursoConfigured && client) {
      try {
        const res = await executeWithRetry("SELECT count(*) as count FROM timetable_slots WHERE teacher_id = ?", [userId]);
        const count = Number(res.rows[0]?.count || 0);
        return count > 0;
      } catch (e) {
        console.error(e);
      }
    }
    return false;
  }, 5 * 60 * 1000); // 5 minutes cache
};
