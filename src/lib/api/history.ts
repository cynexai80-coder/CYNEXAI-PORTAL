import { client, isTursoConfigured } from '../turso';

export type HistoryEventType = 'sale' | 'activity' | 'stage_change' | 'approval' | 'onboarding' | 'task';

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  timestamp: string;
  user_name: string;
  user_id?: string;
  title: string;
  details: string;
  amount?: number;
  old_val?: string;
  new_val?: string;
  lead_name?: string;
  lead_id?: string;
  student_name?: string;
  student_id?: string;
  category?: string;
}

export interface HistoryStats {
  totalLogs: number;
  salesCount: number;
  activitiesCount: number;
  stageChangesCount: number;
  tasksCount: number;
}

export const getMasterHistory = async (params?: {
  search?: string;
  type?: string;
  userId?: string;
  dateRange?: string;
}): Promise<HistoryEvent[]> => {
  if (!isTursoConfigured || !client) {
    return [];
  }

  const allEvents: HistoryEvent[] = [];

  // 1. Fetch Sales History
  try {
    const salesRes = await client.execute(`
      SELECT 
        s.id, 
        s.total_fee, 
        s.amount_paid, 
        s.payment_mode, 
        s.status, 
        s.sales_exec_id,
        u.name as exec_name, 
        l.name as lead_name, 
        l.id as lead_id, 
        COALESCE(l.created_at, CURRENT_TIMESTAMP) as event_time 
      FROM sales s 
      LEFT JOIN users u ON (s.sales_exec_id = u.id OR s.sales_rep_id = u.id) 
      LEFT JOIN crm_leads l ON s.lead_id = l.id
      ORDER BY event_time DESC LIMIT 150
    `);
    salesRes.rows.forEach(r => {
      const amountPaid = Number(r.amount_paid || 0);
      const totalFee = Number(r.total_fee || 0);
      const status = (r.status as string) || 'Completed';
      
      allEvents.push({
        id: 'sale_' + r.id,
        type: 'sale',
        timestamp: (r.event_time as string) || new Date().toISOString(),
        user_name: (r.exec_name as string) || 'Sales Rep',
        user_id: r.sales_exec_id as string,
        title: `Sale: ${status}`,
        details: `Paid: ₹${amountPaid.toLocaleString()} of ₹${totalFee.toLocaleString()}` + (r.payment_mode ? ` via ${r.payment_mode}` : ''),
        amount: amountPaid,
        lead_name: r.lead_name as string,
        lead_id: r.lead_id as string,
        category: 'Finance'
      });
    });
  } catch (e) {
    console.error("MasterHistory: Failed to fetch sales", e);
  }

  // 2. Fetch Lead & Student Activities (Calls, Notes, WhatsApp, Demos)
  try {
    const actsRes = await client.execute(`
      SELECT 
        a.id, 
        a.created_at, 
        a.type, 
        a.content, 
        a.user_id,
        a.lead_id,
        a.student_id,
        u.name as user_name, 
        l.name as lead_name, 
        st.name as student_name
      FROM crm_activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN crm_leads l ON a.lead_id = l.id
      LEFT JOIN students st ON a.student_id = st.id
      ORDER BY a.created_at DESC LIMIT 250
    `);
    actsRes.rows.forEach(r => {
      const actType = (r.type as string) || 'Activity';
      allEvents.push({
        id: 'act_' + r.id,
        type: 'activity',
        timestamp: (r.created_at as string) || new Date().toISOString(),
        user_name: (r.user_name as string) || 'System',
        user_id: r.user_id as string,
        title: actType,
        details: (r.content as string) || '',
        lead_name: (r.lead_name || r.student_name) as string,
        lead_id: (r.lead_id || r.student_id) as string,
        category: 'CRM Activity'
      });
    });
  } catch (e) {
    console.error("MasterHistory: Failed to fetch activities", e);
  }

  // 3. Fetch Stage History
  try {
    const stageRes = await client.execute(`
      SELECT 
        h.id, 
        h.created_at, 
        h.old_stage, 
        h.new_stage, 
        h.lead_id,
        l.name as lead_name, 
        u.name as user_name,
        u.id as user_id
      FROM crm_stage_history h
      LEFT JOIN crm_leads l ON h.lead_id = l.id
      LEFT JOIN users u ON l.assigned_to = u.id
      ORDER BY h.created_at DESC LIMIT 200
    `);
    stageRes.rows.forEach(r => {
      allEvents.push({
        id: 'stage_' + r.id,
        type: 'stage_change',
        timestamp: (r.created_at as string) || new Date().toISOString(),
        user_name: (r.user_name as string) || 'System Auto',
        user_id: r.user_id as string,
        title: 'Stage Transition',
        details: `Lead moved from "${r.old_stage || 'New'}" → "${r.new_stage}"`,
        old_val: r.old_stage as string,
        new_val: r.new_stage as string,
        lead_name: r.lead_name as string,
        lead_id: r.lead_id as string,
        category: 'Pipeline'
      });
    });
  } catch (e) {
    console.error("MasterHistory: Failed to fetch stage history", e);
  }

  // 4. Fetch Tasks Log
  try {
    const tasksRes = await client.execute(`
      SELECT 
        t.id, 
        COALESCE(t.updated_at, t.created_at) as event_time, 
        t.title, 
        t.description, 
        t.status, 
        t.priority,
        t.assignee_id,
        u1.name as creator_name, 
        u2.name as assignee_name
      FROM tasks t
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assignee_id = u2.id
      ORDER BY event_time DESC LIMIT 200
    `);
    tasksRes.rows.forEach(r => {
      allEvents.push({
        id: 'task_' + r.id,
        type: 'task',
        timestamp: (r.event_time as string) || new Date().toISOString(),
        user_name: (r.assignee_name || r.creator_name || 'Team Member') as string,
        user_id: r.assignee_id as string,
        title: `Task [${r.status}]: ${r.title}`,
        details: (r.description as string) || `Priority: ${r.priority || 'Medium'}`,
        category: 'Operations'
      });
    });
  } catch (e) {
    console.error("MasterHistory: Failed to fetch tasks history", e);
  }

  // 5. Fetch Manager Approvals & Onboarding History
  try {
    const apprRes = await client.execute(`
      SELECT 
        ma.id, 
        COALESCE(ma.decided_at, CURRENT_TIMESTAMP) as event_time, 
        ma.status, 
        ma.notes, 
        ma.approver_id,
        u.name as user_name,
        l.name as lead_name
      FROM manager_approvals ma
      LEFT JOIN sales s ON ma.sale_id = s.id
      LEFT JOIN crm_leads l ON s.lead_id = l.id
      LEFT JOIN users u ON ma.approver_id = u.id
      ORDER BY event_time DESC LIMIT 50
    `);
    apprRes.rows.forEach(r => {
      allEvents.push({
        id: 'appr_' + r.id,
        type: 'approval',
        timestamp: (r.event_time as string) || new Date().toISOString(),
        user_name: (r.user_name as string) || 'Manager',
        user_id: r.approver_id as string,
        title: `Approval ${r.status}`,
        details: (r.notes as string) || `Discount / Admission Approval Status: ${r.status}`,
        lead_name: r.lead_name as string,
        category: 'Management'
      });
    });
  } catch (e) {
    console.error("MasterHistory: Failed to fetch approvals history", e);
  }

  // Sort combined events by descending timestamp
  allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filtering
  let filtered = allEvents;

  if (params?.type && params.type !== 'all') {
    filtered = filtered.filter(e => e.type === params.type);
  }

  if (params?.userId && params.userId !== 'all') {
    const targetUserId = params.userId;
    filtered = filtered.filter(e => e.user_id === targetUserId || e.user_name?.toLowerCase().includes(targetUserId.toLowerCase()));
  }

  if (params?.dateRange && params.dateRange !== 'all') {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (params.dateRange === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(e => e.timestamp.startsWith(todayStr));
    } else if (params.dateRange === '7days') {
      filtered = filtered.filter(e => (now - new Date(e.timestamp).getTime()) <= 7 * oneDay);
    } else if (params.dateRange === '30days') {
      filtered = filtered.filter(e => (now - new Date(e.timestamp).getTime()) <= 30 * oneDay);
    }
  }

  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    filtered = filtered.filter(e => 
      e.title?.toLowerCase().includes(q) ||
      e.details?.toLowerCase().includes(q) ||
      e.user_name?.toLowerCase().includes(q) ||
      e.lead_name?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    );
  }

  return filtered;
};

export const getHistoryUsersList = async (): Promise<{ id: string; name: string }[]> => {
  if (!isTursoConfigured || !client) return [];
  try {
    const res = await client.execute("SELECT id, name FROM users WHERE name IS NOT NULL ORDER BY name ASC");
    return res.rows.map(r => ({ id: r.id as string, name: r.name as string }));
  } catch (e) {
    console.error("Failed to fetch users list", e);
    return [];
  }
};

export const createCustomAuditLog = async (
  type: HistoryEventType,
  title: string,
  details: string,
  userId: string,
  leadId?: string
): Promise<boolean> => {
  if (!isTursoConfigured || !client) return false;
  try {
    const actId = 'act_' + Date.now();
    await client.execute({
      sql: `INSERT INTO crm_activities (id, lead_id, user_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [actId, leadId || null, userId, type, `${title}: ${details}`, new Date().toISOString().replace('T', ' ').substring(0, 19)]
    });
    return true;
  } catch (e) {
    console.error("Failed to create custom audit log", e);
    return false;
  }
};

export const exportHistoryCSV = (events: HistoryEvent[]) => {
  if (events.length === 0) return;
  const headers = ['Timestamp', 'Category', 'Event Type', 'Title', 'User', 'Lead/Student', 'Details'];
  const rows = events.map(e => [
    `"${e.timestamp}"`,
    `"${e.category || e.type}"`,
    `"${e.type}"`,
    `"${(e.title || '').replace(/"/g, '""')}"`,
    `"${(e.user_name || '').replace(/"/g, '""')}"`,
    `"${(e.lead_name || '').replace(/"/g, '""')}"`,
    `"${(e.details || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `master_history_audit_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
