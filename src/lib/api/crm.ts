import { client, isTursoConfigured, dbConnectionFailed } from '../turso';
import { Lead, LeadStatus, CrmActivity } from '../types';

// Demo leads are for local development only; production must never show invented people.
const DEV_FALLBACK_LEADS: Lead[] = [
  {
    id: 'lead_1',
    name: 'Rahul Kumar',
    email: 'rahul.k@gmail.com',
    phone: '9876543210',
    course_interest: 'Data Science with AI',
    source: 'Website',
    status: 'New',
    assigned_to: 'usr_sales',
    assignee_name: 'Sandeep',
    notes: 'Interested in Q3 batch',
    created_at: new Date().toISOString()
  },
  {
    id: 'lead_2',
    name: 'Priyanka Sharma',
    email: 'priyanka.s@gmail.com',
    phone: '9812345678',
    course_interest: 'AI & Generative AI',
    source: 'Instagram',
    status: 'Contacted',
    assigned_to: 'usr_sales',
    assignee_name: 'Sandeep',
    notes: 'Requested call back',
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'lead_3',
    name: 'Anish Reddy',
    email: 'anish.r@gmail.com',
    phone: '9988776655',
    course_interest: 'Full stack python',
    source: 'Referral',
    status: 'Demo Scheduled',
    assigned_to: 'usr_sales',
    assignee_name: 'Sandeep',
    notes: 'Demo scheduled for tomorrow',
    created_at: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: 'lead_4',
    name: 'Kavita Verma',
    email: 'kavita.v@gmail.com',
    phone: '9765432109',
    course_interest: 'SAP Fico',
    source: 'LinkedIn',
    status: 'Admission Completed',
    assigned_to: 'usr_sales',
    assignee_name: 'Sandeep',
    notes: 'Admission processing',
    created_at: new Date(Date.now() - 259200000).toISOString()
  }
];

export const getLeads = async (): Promise<Lead[]> => {
  if (isTursoConfigured && client && !dbConnectionFailed) {
    try {
      const result = await client.execute(`
        SELECT l.*, u.name as assignee_name,
        (SELECT content FROM crm_activities WHERE lead_id = l.id AND type = 'WhatsApp Sent' ORDER BY created_at DESC LIMIT 1) as last_whatsapp_msg
        FROM crm_leads l 
        LEFT JOIN users u ON l.assigned_to = u.id 
        ORDER BY l.created_at DESC
      `);
      if (result.rows && result.rows.length > 0) {
        return result.rows.map(row => ({
          id: row.id as string,
          name: row.name as string,
          email: row.email as string,
          phone: row.phone as string,
          course_interest: row.course_interest as string,
          source: row.source as string,
          status: row.status as LeadStatus,
          assigned_to: row.assigned_to as string,
          assignee_name: row.assignee_name as string,
          notes: row.notes as string,
          grad_year: row.grad_year as string,
          qualification: row.qualification as string,
          it_background: row.it_background as string,
          preferred_mode: row.preferred_mode as string,
          location: row.location as string,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          last_whatsapp_msg: row.last_whatsapp_msg as string,
          created_by: row.created_by as string
        }));
      }
    } catch (e) {
      console.error("Failed to fetch leads", e);
    }
  }
  return import.meta.env.DEV ? DEV_FALLBACK_LEADS : [];
};


export const getLeadById = async (id: string): Promise<Lead | null> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM crm_leads WHERE id = ?",
        args: [id]
      });
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id as string,
          name: row.name as string,
          email: row.email as string,
          phone: row.phone as string,
          course_interest: row.course_interest as string,
          source: row.source as string,
          status: row.status as LeadStatus,
          assigned_to: row.assigned_to as string,
          notes: row.notes as string,
          grad_year: row.grad_year as string,
          qualification: row.qualification as string,
          it_background: row.it_background as string,
          preferred_mode: row.preferred_mode as string,
          location: row.location as string,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          created_by: row.created_by as string
        };
      }
    } catch (e) {
      console.error("Failed to fetch lead", e);
    }
  }
  return null;
};

export const createLead = async (lead: Omit<Lead, 'id' | 'updated_at'> & { created_at?: string }) => {
  const id = 'lead_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const created_at = lead.created_at || new Date().toISOString();
  
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: `INSERT INTO crm_leads (id, name, email, phone, course_interest, source, status, assigned_to, notes, grad_year, qualification, it_background, preferred_mode, location, created_at, updated_at, created_by) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, lead.name, lead.email || null, lead.phone, lead.course_interest, lead.source, lead.status, 
          lead.assigned_to, lead.notes || null, lead.grad_year || null, lead.qualification || null,
          lead.it_background || null, lead.preferred_mode || null, lead.location || null,
          created_at, created_at, lead.created_by || null
        ]
      });
      return id;
    } catch (e) {
      console.error("Failed to create lead", e);
    }
  }
  return null;
};

export const getLeadActivities = async (leadId: string): Promise<CrmActivity[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM crm_activities WHERE lead_id = ? ORDER BY created_at DESC",
        args: [leadId]
      });
      return result.rows.map(row => ({
        id: row.id as string,
        lead_id: row.lead_id as string,
        user_id: row.user_id as string,
        type: row.type as any,
        content: row.content as string,
        created_at: row.created_at as string,
      }));
    } catch (e) {
      console.error("Failed to fetch activities", e);
    }
  }
  return [];
};

export const addActivity = async (leadId: string | null, userId: string, type: string, content: string, studentId?: string): Promise<string | null> => {
  const id = 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: "INSERT INTO crm_activities (id, lead_id, user_id, type, content, student_id) VALUES (?, ?, ?, ?, ?, ?)",
        args: [id, leadId || null, userId, type, content, studentId || null]
      });
      return id;
    } catch (e) {
      console.error("Failed to add activity", e);
    }
  }
  return null;
};

export const getStudentActivities = async (studentId: string): Promise<CrmActivity[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM crm_activities WHERE student_id = ? ORDER BY created_at DESC",
        args: [studentId]
      });
      return result.rows.map(row => ({
        id: row.id as string,
        lead_id: row.lead_id as string,
        student_id: row.student_id as string,
        user_id: row.user_id as string,
        type: row.type as any,
        content: row.content as string,
        created_at: row.created_at as string,
      }));
    } catch (e) {
      console.error("Failed to fetch activities", e);
    }
  }
  return [];
};

export const updateLeadStatus = async (id: string, newStatus: LeadStatus, userId: string): Promise<{ success: boolean, status?: number, error?: string }> => {
  if (!isTursoConfigured || !client) return { success: false, status: 500, error: 'Database not connected' };
  
  try {
    // 1. Fetch old status
    const lead = await getLeadById(id);
    const oldStatus = lead?.status;

    // Back to 'New' unassigns the lead. Otherwise the lead keeps its owner; only an UNASSIGNED lead is
    // taken by whoever moves it (moving someone else's lead must never steal it).
    await client.execute({
      sql: `UPDATE crm_leads SET status = ?,
              assigned_to = CASE
                WHEN ? = 'New' THEN ''
                WHEN assigned_to IS NULL OR assigned_to = '' THEN ?
                ELSE assigned_to
              END,
              updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [newStatus, newStatus, userId, id]
    });

    // 4. Log stage change history
    if (oldStatus && oldStatus !== newStatus) {
      await client.execute({
        sql: "INSERT INTO crm_stage_history (id, lead_id, old_stage, new_stage) VALUES (?, ?, ?, ?)",
        args: ['hist_' + Date.now().toString(36), id, oldStatus, newStatus]
      });
    }

    return { success: true };
  } catch (e) {
    console.error("Failed to update lead status", e);
    return { success: false, status: 500, error: 'Database error occurred' };
  }
};

export const claimLead = async (leadId: string, userId: string): Promise<{ success: boolean, alreadyClaimed?: boolean }> => {
  if (!isTursoConfigured || !client) return { success: false };
  try {
    const result = await client.execute({
      sql: `UPDATE crm_leads SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (assigned_to = '' OR assigned_to IS NULL)`,
      args: [userId, leadId]
    });
    
    if (result.rowsAffected === 0) {
      const lead = await getLeadById(leadId);
      if (lead && lead.assigned_to && lead.assigned_to !== userId) {
        return { success: false, alreadyClaimed: true };
      }
    }
    
    // Automatically log the claim
    await addActivity(leadId, userId, 'Note', 'Lead claimed manually');
    return { success: true };
  } catch (e) {
    console.error("Failed to claim lead", e);
    return { success: false };
  }
};

export const updateLeadDetails = async (id: string, updates: Partial<Lead>): Promise<{ success: boolean, error?: string }> => {
  if (!isTursoConfigured || !client) return { success: false, error: 'Database not connected' };
  try {
    const fields = ['name', 'email', 'phone', 'course_interest', 'grad_year', 'qualification', 'it_background', 'preferred_mode', 'location'];
    const sets: string[] = [];
    const args: any[] = [];
    fields.forEach(field => {
      if (updates[field as keyof Lead] !== undefined) {
        sets.push(`${field} = ?`);
        args.push(updates[field as keyof Lead] || null);
      }
    });

    if (sets.length === 0) return { success: true };

    sets.push('updated_at = CURRENT_TIMESTAMP');
    args.push(id);

    await client.execute({
      sql: `UPDATE crm_leads SET ${sets.join(', ')} WHERE id = ?`,
      args
    });
    return { success: true };
  } catch (e: any) {
    console.error("Failed to update lead details", e);
    return { success: false, error: e.message };
  }
};

export const deleteLead = async (id: string): Promise<{ success: boolean, error?: string }> => {
  if (!isTursoConfigured || !client) return { success: false, error: 'Database not connected' };
  try {
    // A lead that already has money attached must never be deleted (it would orphan the sale/approval).
    const sales = await client.execute({ sql: `SELECT COUNT(*) as c FROM sales WHERE lead_id = ?`, args: [id] });
    if (Number(sales.rows[0]?.c) > 0) {
      return { success: false, error: 'This lead has sales records and cannot be deleted.' };
    }
    await client.batch([
      { sql: `DELETE FROM crm_activities WHERE lead_id = ?`, args: [id] },
      { sql: `DELETE FROM crm_stage_history WHERE lead_id = ?`, args: [id] },
      { sql: `DELETE FROM crm_leads WHERE id = ?`, args: [id] },
    ], 'write');
    return { success: true };
  } catch (e: any) {
    console.error("Failed to delete lead", e);
    return { success: false, error: e.message };
  }
};

export const getCRMAnalytics = async (startDate?: string, endDate?: string, userId?: string) => {
  if (!isTursoConfigured || !client) {
    return { totalLeads: 0, activeAdmissions: 0, demoScheduled: 0, demoCompleted: 0, totalRevenue: 0, collectedRevenue: 0, monthlyData: [], leadSources: [], conversionRate: { overall: "0.0", demoToAdmission: "0.0" }, statusCounts: [], executivePerformance: [] };
  }
  
  try {
    // A date-only end value must include the whole last day.
    if (endDate && endDate.length === 10) endDate = endDate + 'T23:59:59.999Z';
    let dateFilter = '';
    const args: any[] = [];
    const conditions = [];
    
    if (startDate && endDate) {
      conditions.push('created_at >= ? AND created_at <= ?');
      args.push(startDate, endDate);
    } else if (startDate) {
      conditions.push('created_at >= ?');
      args.push(startDate);
    } else if (endDate) {
      conditions.push('created_at <= ?');
      args.push(endDate);
    }

    if (userId) {
      conditions.push('assigned_to = ?');
      args.push(userId);
    }

    if (conditions.length > 0) {
      dateFilter = 'WHERE ' + conditions.join(' AND ');
    }

    const leadsRes = await client.execute({
      sql: `SELECT COUNT(*) as total_leads, 
            SUM(CASE WHEN status = 'Closed Won' THEN 1 ELSE 0 END) as closed_won_count, 
            SUM(CASE WHEN status = 'Admission Completed' OR status = 'Admission' THEN 1 ELSE 0 END) as active_admissions, 
            SUM(CASE WHEN status = 'Demo Scheduled' THEN 1 ELSE 0 END) as demo_scheduled, 
            SUM(CASE WHEN status = 'Demo Completed' THEN 1 ELSE 0 END) as demo_completed 
            FROM crm_leads ${dateFilter}`,
      args
    });
    
    // Dynamic status counts
    const statusRes = await client.execute({
      sql: `SELECT status, COUNT(*) as count FROM crm_leads ${dateFilter} GROUP BY status`,
      args
    });
    const statusCounts = statusRes.rows.map(r => ({
      name: (r.status as string) || 'Unknown',
      value: Number(r.count) || 0
    }));

    // Executive Performance
    const execRes = await client.execute({
      sql: `
        SELECT u.name, COUNT(l.id) as leads_assigned, 
        SUM(CASE WHEN l.status = 'Closed Won' OR l.status = 'Sale Completed' OR l.status = 'Sale Partial Closed' THEN 1 ELSE 0 END) as sales_closed
        FROM users u
        LEFT JOIN crm_leads l ON u.id = l.assigned_to
        WHERE u.role = 'Sales/HR'
        ${startDate ? 'AND l.created_at >= ?' : ''} ${endDate ? 'AND l.created_at <= ?' : ''}
        GROUP BY u.id, u.name
      `,
      args: [...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])]
    });
    const executivePerformance = execRes.rows.map(r => ({
      name: (r.name as string) || 'Unknown',
      leadsAssigned: Number(r.leads_assigned) || 0,
      salesClosed: Number(r.sales_closed) || 0
    }));
    
    const sourceRes = await client.execute({
      sql: `SELECT source, COUNT(*) as count FROM crm_leads ${dateFilter} GROUP BY source`,
      args
    });
    const leadSources = sourceRes.rows.map(r => ({
      name: (r.source as string) || 'Unknown',
      value: Number(r.count) || 0
    }));

    const totalLeads = Number(leadsRes.rows[0]?.total_leads || 0);
    const closedWonCount = Number(leadsRes.rows[0]?.closed_won_count || 0);
    const activeAdmissions = Number(leadsRes.rows[0]?.active_admissions || 0);
    const demoCompleted = Number(leadsRes.rows[0]?.demo_completed || 0);
    const demoScheduled = Number(leadsRes.rows[0]?.demo_scheduled || 0);
    
    const overallConversion = totalLeads > 0 ? (closedWonCount / totalLeads * 100).toFixed(1) : "0.0";
    const demoToAdmissionConversion = demoCompleted > 0 ? (activeAdmissions / demoCompleted * 100).toFixed(1) : "0.0";

    let totalRevenue = 0;
    let collectedRevenue = 0;
    let monthlyData: any[] = [];
    try {
        let salesDateFilter = '';
        const salesArgs: any[] = [];
        const salesConditions = [];
        
        if (startDate) { salesConditions.push('timestamp >= ?'); salesArgs.push(startDate); }
        if (endDate) { salesConditions.push('timestamp <= ?'); salesArgs.push(endDate); }
        
        if (userId) {
          salesConditions.push('sales_exec_id = ?');
          salesArgs.push(userId);
        }
        
        if (salesConditions.length > 0) {
          salesDateFilter = 'WHERE ' + salesConditions.join(' AND ');
        }

        const salesRes = await client.execute({
          sql: `SELECT SUM(total_fee) as total_rev, SUM(amount_paid) as collected FROM sales ${salesDateFilter ? salesDateFilter + " AND" : 'WHERE'} id NOT IN (SELECT sale_id FROM manager_approvals WHERE status = 'Rejected')`,
          args: salesArgs
        });
        totalRevenue = Number(salesRes.rows[0]?.total_rev || 0);
        collectedRevenue = Number(salesRes.rows[0]?.collected || 0);

        // The LATEST six months (newest first from SQL, then reversed for the chart).
        const chartRes = await client.execute({
          sql: `SELECT strftime('%Y-%m', timestamp) as name, SUM(total_fee) as target, SUM(amount_paid) as collected
                FROM sales ${salesDateFilter ? salesDateFilter + " AND" : 'WHERE'} id NOT IN (SELECT sale_id FROM manager_approvals WHERE status = 'Rejected')
                GROUP BY name ORDER BY name DESC LIMIT 6`,
          args: salesArgs
        });
        monthlyData = chartRes.rows.reverse().map(r => ({
          name: r.name,
          target: Number(r.target) || 0,
          collected: Number(r.collected) || 0
        }));
    } catch (e) {
        console.warn("Failed to fetch sales analytics", e);
    }
    
    return {
      totalLeads,
      activeAdmissions,
      demoScheduled,
      demoCompleted,
      totalRevenue,
      collectedRevenue,
      monthlyData,
      leadSources,
      conversionRate: {
        overall: overallConversion,
        demoToAdmission: demoToAdmissionConversion
      },
      statusCounts,
      executivePerformance
    };
  } catch (e) {
    console.error("Failed to fetch CRM analytics", e);
    return { totalLeads: 0, activeAdmissions: 0, demoScheduled: 0, demoCompleted: 0, totalRevenue: 0, collectedRevenue: 0, monthlyData: [], leadSources: [], conversionRate: { overall: "0.0", demoToAdmission: "0.0" }, statusCounts: [], executivePerformance: [] };
  }
};

export const getMyPerformance = async (userId: string): Promise<{ calls: number; interested: number; admissions: number; tasksDone: number }> => {
  const empty = { calls: 0, interested: 0, admissions: 0, tasksDone: 0 };
  if (!isTursoConfigured || !client || !userId) return empty;
  const db = client;
  const count = async (sql: string): Promise<number> => {
    try {
      const r = await db.execute({ sql, args: [userId] });
      return Number(r.rows[0]?.c) || 0;
    } catch {
      return 0;
    }
  };
  const [calls, interested, admissions, tasksDone] = await Promise.all([
    count(`SELECT COUNT(*) as c FROM crm_activities WHERE user_id = ? AND LOWER(type) LIKE '%call%'`),
    count(`SELECT COUNT(*) as c FROM crm_leads WHERE assigned_to = ? AND status = 'Interested'`),
    count(`SELECT COUNT(*) as c FROM crm_leads WHERE assigned_to = ? AND status IN ('Admission', 'Admission Completed', 'Sale Partial Closed', 'Closed Won', 'Onboarded')`),
    count(`SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND status = 'Done'`),
  ]);
  return { calls, interested, admissions, tasksDone };
};

/** Stores a newsletter subscriber as a CRM lead (source "Newsletter"); duplicates are ignored. */
export const subscribeNewsletter = async (email: string): Promise<{ success: boolean; error?: string }> => {
  const clean = (email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { success: false, error: 'Please enter a valid email address.' };
  if (!isTursoConfigured || !client) return { success: false, error: 'Subscription is temporarily unavailable. Please try again later.' };
  try {
    const existing = await client.execute({ sql: 'SELECT id FROM crm_leads WHERE LOWER(email) = ? LIMIT 1', args: [clean] });
    if (existing.rows.length > 0) return { success: true };
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO crm_leads (id, name, email, phone, course_interest, source, status, assigned_to, created_at, updated_at)
            VALUES (?, ?, ?, '', '', 'Newsletter', 'New', '', ?, ?)`,
      args: ['lead_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), clean.split('@')[0], clean, now, now],
    });
    return { success: true };
  } catch (e) {
    console.error('Newsletter subscribe failed', e);
    return { success: false, error: 'Could not subscribe right now. Please try again.' };
  }
};

/** Looks for an existing lead with the same phone (last 10 digits) or email. */
export const findDuplicateLead = async (phone?: string, email?: string): Promise<{ id: string; name: string } | null> => {
  if (!isTursoConfigured || !client) return null;
  const digits = (phone || '').replace(/\D/g, '').slice(-10);
  const mail = (email || '').trim().toLowerCase();
  if (!digits && !mail) return null;
  try {
    const conds: string[] = [];
    const args: string[] = [];
    if (digits.length >= 7) { conds.push("REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?"); args.push('%' + digits); }
    if (mail) { conds.push('LOWER(TRIM(email)) = ?'); args.push(mail); }
    if (conds.length === 0) return null;
    const res = await client.execute({ sql: `SELECT id, name FROM crm_leads WHERE ${conds.join(' OR ')} LIMIT 1`, args });
    return res.rows.length > 0 ? { id: String(res.rows[0].id), name: String(res.rows[0].name) } : null;
  } catch {
    return null;
  }
};
