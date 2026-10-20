import { client, isTursoConfigured } from '../turso';
import { getCurrentUser } from '../auth';

export interface Activity {
  id: string;
  lead_id?: string | null;
  student_id?: string | null;
  user_id: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Note';
  content: string;
  created_at?: string;
  user_name?: string; // joined field
}

export const createActivity = async (activity: Omit<Activity, 'id' | 'user_id' | 'created_at' | 'user_name'>): Promise<string | null> => {
  const user = getCurrentUser();
  if (!user) return null;
  
  const id = 'act_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
  if (isTursoConfigured && client) {
    try {
      try {
        await client.execute({
          sql: `INSERT INTO crm_activities (id, lead_id, student_id, user_id, type, content) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            activity.lead_id || null,
            activity.student_id || null,
            user.id,
            activity.type,
            activity.content
          ]
        });
        return id;
      } catch (innerE: any) {
        if (innerE.message && innerE.message.includes('has no column named student_id')) {
           // Fallback for older schema
           await client.execute({
             sql: `INSERT INTO crm_activities (id, lead_id, user_id, type, content) VALUES (?, ?, ?, ?, ?)`,
             args: [
               id,
               activity.lead_id || null,
               user.id,
               activity.type,
               activity.content
             ]
           });
           return id;
        } else {
           throw innerE;
        }
      }
    } catch (e) {
      console.error("Failed to create activity", e);
    }
  }
  return null;
};

export const getActivitiesByLead = async (leadId: string): Promise<Activity[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: `SELECT crm_activities.*, COALESCE(users.name, erp_users.name) as user_name 
              FROM crm_activities 
              LEFT JOIN users ON crm_activities.user_id = users.id LEFT JOIN erp_users ON crm_activities.user_id = erp_users.id 
              WHERE lead_id = ? 
              ORDER BY crm_activities.created_at DESC`,
        args: [leadId]
      });
      return result.rows as unknown as Activity[];
    } catch (e) {
      console.error("Failed to fetch lead activities", e);
    }
  }
  return [];
};

export const getActivitiesByStudent = async (studentId: string): Promise<Activity[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: `SELECT crm_activities.*, COALESCE(users.name, erp_users.name) as user_name 
              FROM crm_activities 
              LEFT JOIN users ON crm_activities.user_id = users.id LEFT JOIN erp_users ON crm_activities.user_id = erp_users.id 
              WHERE student_id = ? 
              ORDER BY crm_activities.created_at DESC`,
        args: [studentId]
      });
      return result.rows as unknown as Activity[];
    } catch (e: any) {
      if (e.message && e.message.includes('no such column: student_id')) {
         console.warn("crm_activities missing student_id column, skipping student activities fetch.");
         return [];
      }
      console.error("Failed to fetch student activities", e);
    }
  }
  return [];
};

const getActivityById = async (activityId: string): Promise<Activity | null> => {
  if (isTursoConfigured && client) {
    const result = await client.execute({
      sql: "SELECT * FROM crm_activities WHERE id = ?",
      args: [activityId]
    });
    if (result.rows.length > 0) return result.rows[0] as unknown as Activity;
  }
  return null;
};

const isAuthorized = (activity: Activity | null): boolean => {
  if (!activity) return false;
  const user = getCurrentUser();
  if (!user) return false;
  return user.id === activity.user_id || user.role === 'Admin' || user.role === 'CEO' || user.role === 'Manager';
};

export const updateActivity = async (activityId: string, updates: Partial<Activity>): Promise<{ success: boolean, error?: string }> => {
  if (!isTursoConfigured || !client) return { success: false, error: 'DB not configured' };

  const activity = await getActivityById(activityId);
  if (!isAuthorized(activity)) return { success: false, error: 'Unauthorized' };

  try {
    const keys = Object.keys(updates).filter(k => k === 'content' || k === 'type'); // only allow updating content and type
    if (keys.length === 0) return { success: true };

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const args = keys.map(k => (updates as any)[k]);
    args.push(activityId);

    await client.execute({
      sql: `UPDATE crm_activities SET ${setClause} WHERE id = ?`,
      args
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Update failed' };
  }
};

export const deleteActivity = async (activityId: string): Promise<{ success: boolean, error?: string }> => {
  if (!isTursoConfigured || !client) return { success: false, error: 'DB not configured' };

  const activity = await getActivityById(activityId);
  if (!isAuthorized(activity)) return { success: false, error: 'Unauthorized' };

  try {
    await client.execute({
      sql: `DELETE FROM crm_activities WHERE id = ?`,
      args: [activityId]
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Delete failed' };
  }
};
