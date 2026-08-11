import { client, isTursoConfigured, initTursoDB } from '../turso';
import { getCurrentUser } from '../auth';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee_id: string;
  created_by?: string;
  priority: string;
  due_date: string;
  status: string;
  project_id?: string | null;
  related_entity?: string | null;
  task_type?: 'One-Time' | 'Daily' | 'Yes/No' | 'Number';
  target_number?: number;
  current_number?: number;
  start_date?: string;
  tags?: string;
  recurrence_rule?: string | null;
  created_at?: string;
  updated_at?: string;
  lead_id?: string | null;
  student_id?: string | null;
}

export const createTask = async (task: Omit<Task, 'id' | 'status'>) => {
  const id = 'task_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const status = 'To Do';
  const created_at = new Date().toISOString();
  const updated_at = created_at;
  
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: `INSERT INTO tasks (id, title, description, assignee_id, status, priority, due_date, project_id, related_entity, task_type, target_number, current_number, start_date, tags, recurrence_rule, created_by, lead_id, student_id, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, 
          task.title, 
          task.description || '', 
          task.assignee_id, 
          status, 
          task.priority || 'Medium', 
          task.due_date || null, 
          task.project_id || null,
          task.related_entity || null,
          task.task_type || 'One-Time',
          task.target_number || null,
          task.current_number || 0,
          task.start_date || null,
          task.tags || null,
          task.recurrence_rule || null,
          task.created_by || null,
          task.lead_id || null,
          task.student_id || null,
          created_at,
          updated_at
        ]
      });
      return id;
    } catch (e) {
      console.error("Failed to create task", e);
    }
  }
  return id;
};

export const getTasksForUser = async (userId: string): Promise<Task[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM tasks WHERE assignee_id = ? ORDER BY due_date ASC",
        args: [userId]
      });
      return result.rows as unknown as Task[];
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    }
  }
  return [];
};

export const getTasksByProject = async (projectId: string): Promise<Task[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM tasks WHERE project_id = ? ORDER BY due_date ASC",
        args: [projectId]
      });
      return result.rows as unknown as Task[];
    } catch (e) {
      console.error("Failed to fetch tasks by project", e);
    }
  }
  return [];
};

export const ensureDailyTasks = async (tasks: Task[], userId: string) => {
  const today = new Date().toISOString().split('T')[0];
  const dailyTasks = tasks.filter(t => t.task_type === 'Daily');

  // Group daily tasks by title (each unique title = one recurring task template)
  const grouped = new Map<string, Task[]>();
  dailyTasks.forEach(t => {
    const arr = grouped.get(t.title) || [];
    arr.push(t);
    grouped.set(t.title, arr);
  });

  let updatedAny = false;

  for (const [, groupTasks] of grouped.entries()) {
    // Sort descending — latest first
    groupTasks.sort((a, b) => new Date(b.due_date || '').getTime() - new Date(a.due_date || '').getTime());

    // Auto-mark ALL past incomplete daily tasks as Missed
    for (const t of groupTasks) {
      const taskDate = t.due_date ? t.due_date.split('T')[0] : '';
      if (taskDate && taskDate < today && t.status !== 'Done' && t.status !== 'Excused' && t.status !== 'Missed') {
        if (isTursoConfigured && client) {
          try {
            await client.execute({
              sql: `UPDATE tasks SET status = 'Missed' WHERE id = ?`,
              args: [t.id]
            });
            t.status = 'Missed'; // update in-memory too
            updatedAny = true;
          } catch (e) {
            console.error('Failed to mark task as Missed', e);
          }
        }
      }
    }

    // Check if today's copy already exists
    const todayExists = groupTasks.some(t => {
      const d = t.due_date ? t.due_date.split('T')[0] : '';
      return d === today;
    });

    if (!todayExists) {
      // Use the most recent task as the template for today's new copy
      const template = groupTasks[0];
      if (!template) continue;

      const newTask = {
        title: template.title,
        description: template.description,
        assignee_id: template.assignee_id,
        priority: template.priority,
        due_date: today,
        related_entity: template.related_entity,
        task_type: 'Daily' as const,
        target_number: template.target_number,
        current_number: 0,
        tags: template.tags,
        created_by: template.created_by,
        lead_id: template.lead_id,
        student_id: template.student_id,
        recurrence_rule: template.recurrence_rule,
      };
      await createTask(newTask as any);
      updatedAny = true;
    }
  }

  return updatedAny;
};


export const getTasksByLead = async (leadId: string): Promise<Task[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM tasks WHERE lead_id = ? ORDER BY due_date ASC",
        args: [leadId]
      });
      return result.rows as unknown as Task[];
    } catch (e) {
      console.error("Failed to fetch tasks by lead", e);
    }
  }
  return [];
};

export const getTasksByStudent = async (studentId: string): Promise<Task[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM tasks WHERE student_id = ? ORDER BY due_date ASC",
        args: [studentId]
      });
      return result.rows as unknown as Task[];
    } catch (e) {
      console.error("Failed to fetch tasks by student", e);
    }
  }
  return [];
};

const getTaskById = async (taskId: string): Promise<Task | null> => {
  if (isTursoConfigured && client) {
    const result = await client.execute({
      sql: "SELECT * FROM tasks WHERE id = ?",
      args: [taskId]
    });
    if (result.rows.length > 0) return result.rows[0] as unknown as Task;
  }
  return null;
};

const isAuthorized = (task: Task | null): boolean => {
  if (!task) return false;
  const user = getCurrentUser();
  if (!user) return false;
  return user.id === task.assignee_id || user.id === task.created_by || user.role === 'CEO' || user.role === 'Manager';
};

export const updateTaskStatus = async (taskId: string, newStatus: string): Promise<{ success: boolean, error?: string }> => {
  if (!isTursoConfigured || !client) return { success: false, error: 'DB not configured' };
  
  const task = await getTaskById(taskId);
  if (!isAuthorized(task)) return { success: false, error: 'Unauthorized' };

  try {
    await client.execute({
      sql: `UPDATE tasks SET status = ? WHERE id = ?`,
      args: [newStatus, taskId]
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Update failed' };
  }
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<{ success: boolean, error?: string }> => {
  if (!isTursoConfigured || !client) return { success: false, error: 'DB not configured' };

  const task = await getTaskById(taskId);
  if (!isAuthorized(task)) return { success: false, error: 'Unauthorized' };

  try {
    const keys = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'created_by');
    if (keys.length === 0) return { success: true };

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const args = keys.map(k => (updates as any)[k]);
    args.push(taskId);

    await client.execute({
      sql: `UPDATE tasks SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Update failed' };
  }
};

export const deleteTask = async (taskId: string): Promise<{ success: boolean, error?: string }> => {
  if (!isTursoConfigured || !client) return { success: false, error: 'DB not configured' };

  const task = await getTaskById(taskId);
  if (!isAuthorized(task)) return { success: false, error: 'Unauthorized' };

  try {
    await client.execute({
      sql: `DELETE FROM tasks WHERE id = ?`,
      args: [taskId]
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Delete failed' };
  }
};

export const getAllTasks = async (): Promise<Task[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute(`
        SELECT t.*, 
               u1.name as assignee_name, 
               u2.name as created_by_name 
        FROM tasks t 
        LEFT JOIN users u1 ON t.assignee_id = u1.id 
        LEFT JOIN users u2 ON t.created_by = u2.id 
        ORDER BY t.due_date ASC
      `);
      return result.rows as unknown as Task[];
    } catch (e) {
      console.error("Failed to fetch all tasks", e);
    }
  }
  return [];
};

export const getTasksByDateRange = async (startDate: string, endDate: string): Promise<Task[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM tasks WHERE due_date >= ? AND due_date <= ? ORDER BY due_date ASC",
        args: [startDate, endDate]
      });
      return result.rows as unknown as Task[];
    } catch (e) {
      console.error("Failed to fetch tasks by date range", e);
    }
  }
  return [];
};

export const getTasksByCreator = async (creatorId: string): Promise<Task[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM tasks WHERE created_by = ? ORDER BY due_date ASC",
        args: [creatorId]
      });
      return result.rows as unknown as Task[];
    } catch (e) {
      console.error("Failed to fetch tasks by creator", e);
    }
  }
  return [];
};

// Prod-Level Asana Features
export const addTaskComment = async (taskId: string, content: string): Promise<string | null> => {
  const id = 'comment_' + Date.now().toString(36);
  const user = getCurrentUser();
  if (!user || !isTursoConfigured || !client) return null;

  try {
    await client.execute({
      sql: "INSERT INTO task_comments (id, task_id, user_id, content) VALUES (?, ?, ?, ?)",
      args: [id, taskId, user.id, content]
    });
    return id;
  } catch (e) {
    console.error("Failed to add comment", e);
  }
  return null;
};

export const addSubtask = async (taskId: string, title: string): Promise<string | null> => {
  const id = 'sub_' + Date.now().toString(36);
  if (!isTursoConfigured || !client) return null;

  try {
    await client.execute({
      sql: "INSERT INTO task_subtasks (id, task_id, title) VALUES (?, ?, ?)",
      args: [id, taskId, title]
    });
    return id;
  } catch (e) {
    console.error("Failed to add subtask", e);
  }
  return null;
};

export const getTaskComments = async (taskId: string): Promise<any[]> => {
  if (isTursoConfigured && client) {
    const result = await client.execute({
      sql: "SELECT task_comments.*, erp_users.name as user_name FROM task_comments LEFT JOIN erp_users ON task_comments.user_id = erp_users.id WHERE task_id = ? ORDER BY task_comments.created_at ASC",
      args: [taskId]
    });
    return result.rows as any[];
  }
  return [];
};

export const getTaskSubtasks = async (taskId: string): Promise<any[]> => {
  if (isTursoConfigured && client) {
    const result = await client.execute({
      sql: "SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY created_at ASC",
      args: [taskId]
    });
    return result.rows as any[];
  }
  return [];
};

export const updateSubtaskStatus = async (subtaskId: string, status: string): Promise<boolean> => {
  if (isTursoConfigured && client) {
    await client.execute({
      sql: "UPDATE task_subtasks SET status = ? WHERE id = ?",
      args: [status, subtaskId]
    });
    return true;
  }
  return false;
};

export const deleteSubtask = async (subtaskId: string): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  try {
    await client.execute({
      sql: "DELETE FROM task_subtasks WHERE id = ?",
      args: [subtaskId]
    });
    return true;
  } catch (e) {
    console.error("Failed to delete subtask", e);
  }
  return false;
};

export const updateSubtask = async (subtaskId: string, updates: Record<string, any>): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  
  try {
    const keys = Object.keys(updates).filter(k => k !== 'id' && k !== 'task_id' && k !== 'created_at');
    if (keys.length === 0) return true;
    
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const args = keys.map(k => updates[k]);
    args.push(subtaskId);
    
    await client.execute({
      sql: `UPDATE task_subtasks SET ${setClause} WHERE id = ?`,
      args
    });
    return true;
  } catch (e) {
    console.error("Failed to update subtask", e);
  }
  return false;
};

export const addTaskDependency = async (taskId: string, dependsOnId: string): Promise<string | null> => {
  const id = 'dep_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  if (!isTursoConfigured || !client) return null;
  
  try {
    await client.execute({
      sql: "INSERT INTO task_dependencies (id, task_id, depends_on_id) VALUES (?, ?, ?)",
      args: [id, taskId, dependsOnId]
    });
    return id;
  } catch (e) {
    console.error("Failed to add task dependency", e);
  }
  return null;
};

export const removeTaskDependency = async (dependencyId: string): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  
  try {
    await client.execute({
      sql: "DELETE FROM task_dependencies WHERE id = ?",
      args: [dependencyId]
    });
    return true;
  } catch (e) {
    console.error("Failed to remove task dependency", e);
  }
  return false;
};

export const getTaskDependencies = async (taskId: string): Promise<any[]> => {
  if (!isTursoConfigured || !client) return [];
  
  try {
    const result = await client.execute({
      sql: "SELECT * FROM task_dependencies WHERE task_id = ?",
      args: [taskId]
    });
    return result.rows as any[];
  } catch (e) {
    console.error("Failed to get task dependencies", e);
  }
  return [];
};
