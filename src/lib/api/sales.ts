import { client, isTursoConfigured } from '../turso';

export const recordAdmission = async (leadId: string, amount: number, discountLocked: string, expiry: string, expectedSaleDate: string, referredBy: string | null = null) => {
  if (isTursoConfigured && client) {
    const id = 'adm_' + Date.now().toString(36);
    try {
      await client.execute({
        sql: `INSERT INTO admissions (id, lead_id, amount, discount_locked, offer_expiry_date, expected_sale_date, status, referred_by_student_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, leadId, amount, discountLocked, expiry, expectedSaleDate, 'Active', referredBy]
      });
      // Move lead to Admission status
      await client.execute({
        sql: `UPDATE crm_leads SET status = 'Admission' WHERE id = ?`,
        args: [leadId]
      });
      return id;
    } catch (e) { console.error(e); }
  }
  return null;
};

export const getAdmissionForLead = async (leadId: string): Promise<any | null> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM admissions WHERE lead_id = ? AND status = 'Active' ORDER BY rowid DESC LIMIT 1",
        args: [leadId]
      });
      if (result.rows.length > 0) return result.rows[0];
    } catch (e) { console.error(e); }
  }
  return null;
};

export const getSaleForLead = async (leadId: string): Promise<any | null> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute({
        sql: "SELECT * FROM sales WHERE lead_id = ? ORDER BY timestamp DESC LIMIT 1",
        args: [leadId]
      });
      if (result.rows.length > 0) return result.rows[0];
    } catch (e) { console.error(e); }
  }
  return null;
};

export const recordSale = async (leadId: string, courseId: string, totalFee: number, amountPaid: number, admissionId: string | null, salesExecId: string, referredBy: string | null = null, paymentMode: string = 'UPI') => {
  if (isTursoConfigured && client) {
    const id = 'sal_' + Date.now().toString(36);
    const status = amountPaid >= totalFee ? 'Sale Completed' : 'Sale Partial Closed';
    try {
      await client.execute({
        sql: `INSERT INTO sales (id, lead_id, admission_id, course_id, total_fee, amount_paid, status, sales_exec_id, referred_by_student_id, payment_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, leadId, admissionId, courseId, totalFee, amountPaid, status, salesExecId, referredBy, paymentMode]
      });
      // Move lead to Closed Won status
      await client.execute({
        sql: `UPDATE crm_leads SET status = 'Closed Won' WHERE id = ?`,
        args: [leadId]
      });
      
      // Create Manager Approval task automatically upon sale
      const apprId = 'appr_' + Date.now().toString(36);
      await client.execute({
        sql: `INSERT INTO manager_approvals (id, sale_id, checklist_json, status, notes, approver_id, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [apprId, id, JSON.stringify({
          payment_verified: false,
          course_confirmed: false,
          docs_received: false
        }), 'Pending', '', null, null]
      });

      return id;
    } catch (e) { console.error(e); }
  }
  return null;
};
export interface Sale {
  id: string;
  lead_id: string;
  admission_id: string | null;
  course_id: string;
  total_fee: number;
  amount_paid: number;
  status: string;
  sales_exec_id: string;
  referred_by_student_id: string | null;
  created_at?: string;
  lead_name?: string;
  executive_name?: string;
  course_name?: string;
}

export const getSales = async (): Promise<Sale[]> => {
  if (isTursoConfigured && client) {
    try {
      const result = await client.execute(`
        SELECT s.*, l.name as lead_name, u.name as executive_name, c.title as course_name
        FROM sales s 
        LEFT JOIN crm_leads l ON s.lead_id = l.id 
        LEFT JOIN erp_users u ON s.sales_exec_id = u.id 
        LEFT JOIN courses c ON s.course_id = c.id
        ORDER BY s.timestamp DESC
      `);
      return result.rows.map(row => ({
        id: row.id as string,
        lead_id: row.lead_id as string,
        admission_id: row.admission_id as string | null,
        course_id: row.course_id as string,
        total_fee: row.total_fee as number,
        amount_paid: row.amount_paid as number,
        status: row.status as string,
        sales_exec_id: row.sales_exec_id as string,
        referred_by_student_id: row.referred_by_student_id as string | null,
        created_at: row.timestamp as string,
        lead_name: row.lead_name as string,
        executive_name: row.executive_name as string,
        course_name: row.course_name as string
      }));
    } catch (e) {
      console.error(e);
    }
  }

  return [];
};

import { cachedQuery, cacheInvalidate } from '../cache';

export const getCoursesForPitch = async () => {
  return cachedQuery('courses_for_pitch', async () => {
    if (isTursoConfigured && client) {
      try {
        const result = await client.execute("SELECT id, title, description, price, sales_pitch_summary, sales_pitch_script FROM courses ORDER BY created_at ASC");
        return result.rows;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  }, 5 * 60 * 1000);
};

export const updateCoursePitch = async (id: string, summary: string, script: string) => {
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: "UPDATE courses SET sales_pitch_summary = ?, sales_pitch_script = ? WHERE id = ?",
        args: [summary, script, id]
      });
      cacheInvalidate('courses_for_pitch');
      cacheInvalidate('cms_courses');
      return true;
    } catch (e) {
      console.error("Failed to update course pitch", e);
    }
  }
  return false;
};

export const getCourseModules = async (courseId: string) => {
  return cachedQuery(`course_modules_${courseId}`, async () => {
    if (isTursoConfigured && client) {
      try {
        const result = await client.execute({
          sql: `
            SELECT m.title 
            FROM course_module_mapping cmm
            JOIN modules m ON cmm.module_id = m.id
            WHERE cmm.course_id = ? 
            ORDER BY cmm.order_index ASC
          `,
          args: [courseId]
        });
        return result.rows.map(r => r.title as string);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  }, 5 * 60 * 1000);
};

export const createLead = async (id: string, name: string, phone: string, courseInterest: string, userId: string) => {
  if (isTursoConfigured && client) {
    try {
      await client.execute({
        sql: 'INSERT INTO crm_leads (id, name, phone, course_interest, source, status, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, name, phone, courseInterest, 'Agent Entry', 'New', userId]
      });
    } catch (e) {
      console.error(e);
    }
  }
};
