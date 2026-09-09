import { client, isTursoConfigured } from '../turso';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface EmployeeReport {
  user_id: string;
  user_name: string;
  user_role: string;
  total_calls: number;
  total_tasks: number;
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_overdue: number;
  daily_tasks_missed: number;
  subtasks_completed: number;
  total_time_minutes: number;
  conversions: number; // leads converted to admissions
  completion_rate: number;
  login_time: string | null;
  logout_time: string | null;
}

export interface TimeLog {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  task_title?: string;
  user_name?: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'general_manager' | 'manager' | 'member';
  assigned_by: string;
  assigned_at: string;
  user_name?: string;
  user_role?: string;
}

// ─── Time Tracking ───────────────────────────────────────────────────────────

export const startTimeLog = async (taskId: string, userId: string): Promise<string | null> => {
  if (!isTursoConfigured || !client) return null;
  const id = 'tl_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  try {
    await client.execute({
      sql: `INSERT INTO time_logs (id, task_id, user_id, started_at) VALUES (?, ?, ?, ?)`,
      args: [id, taskId, userId, new Date().toISOString()]
    });
    return id;
  } catch (e) {
    console.error('Failed to start time log', e);
    return null;
  }
};

export const stopTimeLog = async (timeLogId: string): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  const endedAt = new Date().toISOString();
  try {
    // Get started_at to compute duration
    const res = await client.execute({
      sql: `SELECT started_at FROM time_logs WHERE id = ?`,
      args: [timeLogId]
    });
    if (res.rows.length === 0) return false;
    const startedAt = new Date(res.rows[0].started_at as string);
    const durationMinutes = Math.round((new Date().getTime() - startedAt.getTime()) / 60000);
    await client.execute({
      sql: `UPDATE time_logs SET ended_at = ?, duration_minutes = ? WHERE id = ?`,
      args: [endedAt, durationMinutes, timeLogId]
    });
    return true;
  } catch (e) {
    console.error('Failed to stop time log', e);
    return false;
  }
};

export const getTimeLogsByTask = async (taskId: string): Promise<TimeLog[]> => {
  if (!isTursoConfigured || !client) return [];
  try {
    const res = await client.execute({
      sql: `SELECT time_logs.*, users.name as user_name FROM time_logs 
            LEFT JOIN users ON time_logs.user_id = users.id 
            WHERE task_id = ? ORDER BY started_at DESC`,
      args: [taskId]
    });
    return res.rows as unknown as TimeLog[];
  } catch (e) {
    console.error('Failed to get time logs', e);
    return [];
  }
};

export const getActiveTimeLog = async (userId: string): Promise<TimeLog | null> => {
  if (!isTursoConfigured || !client) return null;
  try {
    const res = await client.execute({
      sql: `SELECT time_logs.*, tasks.title as task_title FROM time_logs 
            LEFT JOIN tasks ON time_logs.task_id = tasks.id
            WHERE time_logs.user_id = ? AND time_logs.ended_at IS NULL 
            ORDER BY time_logs.started_at DESC LIMIT 1`,
      args: [userId]
    });
    if (res.rows.length === 0) return null;
    return res.rows[0] as unknown as TimeLog;
  } catch (e) {
    console.error('Failed to get active time log', e);
    return null;
  }
};

// ─── Office Attendance (Employee) ─────────────────────────────────────────────

export interface EmployeeAttendance {
  id: string;
  user_id: string;
  date: string;
  login_time: string | null;
  logout_time: string | null;
  duration_minutes: number | null;
}

export const getTodayAttendance = async (userId: string): Promise<EmployeeAttendance | null> => {
  if (!isTursoConfigured || !client) return null;
  const today = new Date().toISOString().split('T')[0];
  try {
    const res = await client.execute({
      sql: `SELECT * FROM employee_attendance WHERE user_id = ? AND date = ? ORDER BY login_time DESC LIMIT 1`,
      args: [userId, today]
    });
    if (res.rows.length === 0) return null;
    return res.rows[0] as unknown as EmployeeAttendance;
  } catch (e) {
    console.error('Failed to get today attendance', e);
    return null;
  }
};

const autoCleanupAttendance = async () => {
  if (!isTursoConfigured || !client) return;
  const today = new Date().toISOString().split('T')[0];
  try {
    const res = await client.execute({
      sql: `SELECT id, date, login_time FROM employee_attendance WHERE logout_time IS NULL AND date < ?`,
      args: [today]
    });
    for (const row of res.rows) {
      const date = row.date as string;
      const loginTime = row.login_time as string;
      const endOfThatDay = new Date(`${date}T23:59:59`).toISOString();
      const duration = Math.max(0, Math.round((new Date(endOfThatDay).getTime() - new Date(loginTime).getTime()) / 60000));
      
      await client.execute({
        sql: `UPDATE employee_attendance SET logout_time = ?, duration_minutes = ? WHERE id = ?`,
        args: [endOfThatDay, duration, row.id]
      });
    }
  } catch (e) {
    console.error('Failed auto cleanup', e);
  }
};

export const logOfficeAttendance = async (userId: string, action: 'login' | 'logout'): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();
  
  try {
    const existing = await getTodayAttendance(userId);
    if (action === 'login') {
      if (existing) {
        // If user logged out earlier today and is logging back in, clear logout_time to mark them active again
        if (existing.logout_time) {
          await client.execute({
            sql: `UPDATE employee_attendance SET logout_time = NULL, duration_minutes = NULL WHERE id = ?`,
            args: [existing.id]
          });
        }
        return true;
      }
      const id = 'att_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      await client.execute({
        sql: `INSERT INTO employee_attendance (id, user_id, date, login_time) VALUES (?, ?, ?, ?)`,
        args: [id, userId, today, now]
      });
      return true;
    } else {
      if (!existing || !existing.login_time) return false; // Not logged in
      const start = new Date(existing.login_time);
      const duration = Math.max(0, Math.round((new Date(now).getTime() - start.getTime()) / 60000));
      await client.execute({
        sql: `UPDATE employee_attendance SET logout_time = ?, duration_minutes = ? WHERE id = ?`,
        args: [now, duration, existing.id]
      });
      return true;
    }
  } catch (e) {
    console.error('Failed to log office attendance', e);
    return false;
  }
};

// ─── Project Hierarchy ────────────────────────────────────────────────────────

export const getProjectMembers = async (projectId: string): Promise<ProjectMember[]> => {
  if (!isTursoConfigured || !client) return [];
  try {
    const res = await client.execute({
      sql: `SELECT pm.*, u.name as user_name, u.role as user_role 
            FROM project_members pm 
            LEFT JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = ?
            ORDER BY CASE pm.role WHEN 'general_manager' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END`,
      args: [projectId]
    });
    return res.rows as unknown as ProjectMember[];
  } catch (e) {
    console.error('Failed to get project members', e);
    return [];
  }
};

export const addProjectMember = async (
  projectId: string,
  userId: string,
  role: ProjectMember['role'],
  assignedBy: string
): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  const id = 'pm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  try {
    await client.execute({
      sql: `INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, assigned_by, assigned_at) 
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [id, projectId, userId, role, assignedBy, new Date().toISOString()]
    });
    return true;
  } catch (e) {
    console.error('Failed to add project member', e);
    return false;
  }
};

export const removeProjectMember = async (projectId: string, userId: string): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  try {
    await client.execute({
      sql: `DELETE FROM project_members WHERE project_id = ? AND user_id = ?`,
      args: [projectId, userId]
    });
    return true;
  } catch (e) {
    console.error('Failed to remove project member', e);
    return false;
  }
};

export const updateProjectMemberRole = async (
  projectId: string,
  userId: string,
  newRole: ProjectMember['role']
): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  try {
    await client.execute({
      sql: `UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?`,
      args: [newRole, projectId, userId]
    });
    return true;
  } catch (e) {
    console.error('Failed to update project member role', e);
    return false;
  }
};

// ─── Employee Reports ─────────────────────────────────────────────────────────

export const getEmployeeReports = async (
  dateFrom?: string,
  dateTo?: string
): Promise<EmployeeReport[]> => {
  if (!isTursoConfigured || !client) return [];

  // Auto-cleanup missed logouts before generating reports
  await autoCleanupAttendance();

  try {
    const effectiveDateFrom = dateFrom ? (dateFrom.length === 10 ? dateFrom + 'T00:00:00.000Z' : dateFrom) : undefined;
    const effectiveDateTo = dateTo ? (dateTo.length === 10 ? dateTo + 'T23:59:59.999Z' : dateTo) : undefined;

    // Build task date filter
    let taskDateFilter = '';
    const taskDateArgs: string[] = [];
    if (effectiveDateFrom) {
      taskDateFilter += ` AND (t.created_at >= ? OR t.created_at >= ?)`;
      taskDateArgs.push(effectiveDateFrom, dateFrom!);
    }
    if (effectiveDateTo) {
      taskDateFilter += ` AND (t.created_at <= ? OR t.created_at <= ?)`;
      taskDateArgs.push(effectiveDateTo, dateTo!);
    }

    // Fetch all staff users
    const usersRes = await client.execute(
      `SELECT id, name, role FROM users WHERE role NOT IN ('Student') ORDER BY name ASC`
    );

    const reports: EmployeeReport[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (const userRow of usersRes.rows) {
      const userId = userRow.id as string;

      // Task stats
      const taskRes = await client.execute({
        sql: `SELECT 
                COUNT(CASE WHEN status != 'Excused' THEN 1 END) as total_tasks,
                SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as tasks_completed,
                SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as tasks_in_progress,
                SUM(CASE WHEN due_date < ? AND status NOT IN ('Done', 'Excused') THEN 1 ELSE 0 END) as tasks_overdue,
                SUM(CASE WHEN task_type = 'Daily' AND due_date < ? AND status NOT IN ('Done', 'Excused') THEN 1 ELSE 0 END) as daily_tasks_missed
              FROM tasks t
              WHERE (assignee_id = ? OR created_by = ?) ${taskDateFilter}`,
        args: [todayStr, todayStr, userId, userId, ...taskDateArgs]
      });

      const taskRow = taskRes.rows[0] || {};
      const totalTasks = Number(taskRow.total_tasks) || 0;
      const tasksCompleted = Number(taskRow.tasks_completed) || 0;

      // Subtasks stats
      let subtasksCompleted = 0;
      try {
        const subtaskRes = await client.execute({
          sql: `SELECT COUNT(*) as subtasks_completed
                FROM task_subtasks ts
                JOIN tasks t ON ts.task_id = t.id
                WHERE (t.assignee_id = ? OR t.created_by = ?) AND ts.status = 'Done' ${taskDateFilter}`,
          args: [userId, userId, ...taskDateArgs]
        });
        subtasksCompleted = Number(subtaskRes.rows[0]?.subtasks_completed) || 0;
      } catch { /* ignore if task_subtasks missing */ }

      // Call stats (from CRM activities)
      let totalCalls = 0;
      try {
        const callRes = await client.execute({
          sql: `SELECT COUNT(*) as total_calls FROM crm_activities WHERE user_id = ? AND (LOWER(type) = 'call' OR type = 'Call' OR type LIKE '%call%')`,
          args: [userId]
        });
        totalCalls = Number(callRes.rows[0]?.total_calls) || 0;
      } catch { /* crm_activities error fallback */ }

      // Conversions (leads assigned to this user that became admissions)
      let conversions = 0;
      try {
        const convRes = await client.execute({
          sql: `SELECT COUNT(*) as cnt FROM sales s 
                LEFT JOIN crm_leads l ON s.lead_id = l.id 
                WHERE (s.sales_exec_id = ? OR s.sales_rep_id = ? OR l.assigned_to = ?)`,
          args: [userId, userId, userId]
        });
        conversions = Number(convRes.rows[0]?.cnt) || 0;
      } catch {
        try {
          const leadConv = await client.execute({
            sql: `SELECT COUNT(*) as cnt FROM crm_leads WHERE assigned_to = ? AND (status IN ('Admission Completed', 'Converted', 'Admission') OR stage IN ('Admission Completed', 'Admission'))`,
            args: [userId]
          });
          conversions = Number(leadConv.rows[0]?.cnt) || 0;
        } catch { /* fallback 0 */ }
      }

      // Attendance stats & Time spent
      let login_time: string | null = null;
      let logout_time: string | null = null;
      let totalTimeMinutes = 0;

      try {
        const dateOnlyFrom = dateFrom ? dateFrom.split('T')[0] : undefined;
        const dateOnlyTo = dateTo ? dateTo.split('T')[0] : undefined;
        let attFilter = '';
        const attArgs: string[] = [userId];
        if (dateOnlyFrom) {
          attFilter += ` AND date >= ?`;
          attArgs.push(dateOnlyFrom);
        }
        if (dateOnlyTo) {
          attFilter += ` AND date <= ?`;
          attArgs.push(dateOnlyTo);
        }

        const attRes = await client.execute({
          sql: `SELECT login_time, logout_time FROM employee_attendance 
                WHERE user_id = ? ${attFilter} 
                ORDER BY date DESC, login_time DESC LIMIT 1`,
          args: attArgs
        });
        if (attRes.rows.length > 0) {
          login_time = attRes.rows[0].login_time as string;
          logout_time = attRes.rows[0].logout_time as string;
        }

        // Calculate attendance time spent (completed sessions + active live session)
        const allAttRes = await client.execute({
          sql: `SELECT login_time, logout_time, duration_minutes FROM employee_attendance 
                WHERE user_id = ? ${attFilter}`,
          args: attArgs
        });

        const nowMs = Date.now();
        let attMins = 0;
        for (const row of allAttRes.rows) {
          if (row.logout_time && row.duration_minutes != null) {
            attMins += Number(row.duration_minutes);
          } else if (row.login_time && !row.logout_time) {
            const live = Math.max(0, Math.round((nowMs - new Date(row.login_time as string).getTime()) / 60000));
            attMins += live;
          }
        }

        // Calculate task-specific time logs
        let timeLogFilter = '';
        const timeLogArgs: string[] = [userId];
        if (effectiveDateFrom) {
          timeLogFilter += ` AND started_at >= ?`;
          timeLogArgs.push(effectiveDateFrom);
        }
        if (effectiveDateTo) {
          timeLogFilter += ` AND started_at <= ?`;
          timeLogArgs.push(effectiveDateTo);
        }

        let taskMins = 0;
        try {
          const timeRes = await client.execute({
            sql: `SELECT COALESCE(SUM(duration_minutes), 0) as total_time FROM time_logs WHERE user_id = ? AND ended_at IS NOT NULL ${timeLogFilter}`,
            args: timeLogArgs
          });
          taskMins = Number(timeRes.rows[0]?.total_time) || 0;
        } catch { /* fallback 0 */ }

        totalTimeMinutes = Math.max(attMins, taskMins);
      } catch (e) {
        console.error('Time spent calculation error:', e);
      }

      reports.push({
        user_id: userId,
        user_name: userRow.name as string,
        user_role: userRow.role as string,
        total_calls: totalCalls,
        total_tasks: totalTasks,
        tasks_completed: tasksCompleted,
        tasks_in_progress: Number(taskRow.tasks_in_progress) || 0,
        tasks_overdue: Number(taskRow.tasks_overdue) || 0,
        daily_tasks_missed: Number(taskRow.daily_tasks_missed) || 0,
        subtasks_completed: subtasksCompleted,
        total_time_minutes: totalTimeMinutes,
        conversions,
        completion_rate: totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0,
        login_time,
        logout_time
      });
    }

    return reports;
  } catch (e) {
    console.error('Failed to get employee reports', e);
    return [];
  }
};

export const getProjectHierarchyReport = async (): Promise<any[]> => {
  if (!isTursoConfigured || !client) return [];
  try {
    const res = await client.execute(`
      SELECT 
        p.id as project_id,
        p.name as project_name,
        p.status as project_status,
        p.color as project_color,
        pm.role as member_role,
        u.id as user_id,
        u.name as user_name,
        u.role as user_role,
        COUNT(t.id) as task_count,
        SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) as tasks_done
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN users u ON pm.user_id = u.id
      LEFT JOIN tasks t ON t.project_id = p.id AND t.assignee_id = u.id
      GROUP BY p.id, pm.user_id
      ORDER BY p.name, CASE pm.role WHEN 'general_manager' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
    `);
    return res.rows as any[];
  } catch (e) {
    console.error('Failed to get project hierarchy', e);
    return [];
  }
};
