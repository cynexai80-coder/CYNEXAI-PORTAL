import { client, isTursoConfigured, dbConnectionFailed } from '../turso';
import { Lead, LeadStatus, CrmActivity } from '../types';

const FALLBACK_LEADS: Lead[] = [
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
  return FALLBACK_LEADS;
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
  const id = 'lead_' + Date.now().toString(36);
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
  const id = 'act_' + Date.now().toString(36);
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

    // If moved back to 'New', unassign it. Otherwise, assign it to the user who moved it.
    const assignTo = newStatus === 'New' ? '' : userId;

    // 3. Update status and assignment
    await client.execute({
      sql: `UPDATE crm_leads SET status = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [newStatus, assignTo, id]
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
    await client.execute({
      sql: `DELETE FROM crm_leads WHERE id = ?`,
      args: [id]
    });
    // Also delete associated activities (optional, assuming CASCADE or cleanup)
    await client.execute({
      sql: `DELETE FROM crm_activities WHERE lead_id = ?`,
      args: [id]
    });
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
        GROUP BY u.id, u.name
      `,
      args: []
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
        
        if (startDate && endDate) {
          salesConditions.push('timestamp >= ? AND timestamp <= ?');
          salesArgs.push(startDate, endDate);
        }
        
        if (userId) {
          salesConditions.push('sales_exec_id = ?');
          salesArgs.push(userId);
        }
        
        if (salesConditions.length > 0) {
          salesDateFilter = 'WHERE ' + salesConditions.join(' AND ');
        }

        const salesRes = await client.execute({
          sql: `SELECT SUM(total_fee) as total_rev, SUM(amount_paid) as collected FROM sales ${salesDateFilter}`,
          args: salesArgs
        });
        totalRevenue = Number(salesRes.rows[0]?.total_rev || 0);
        collectedRevenue = Number(salesRes.rows[0]?.collected || 0);

        const chartRes = await client.execute("SELECT strftime('%Y-%m', timestamp) as name, SUM(total_fee) as target, SUM(amount_paid) as collected FROM sales GROUP BY name ORDER BY name ASC LIMIT 6");
        monthlyData = chartRes.rows.map(r => ({
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
