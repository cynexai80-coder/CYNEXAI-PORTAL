import { client } from '../turso';

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

export async function getAdminStats() {
  try {
    const leadsRes = await executeWithRetry('SELECT COUNT(*) as count FROM crm_leads');
    const salesRes = await executeWithRetry("SELECT COUNT(*) as count, SUM(amount_paid) as revenue FROM sales WHERE id NOT IN (SELECT sale_id FROM manager_approvals WHERE status = 'Rejected')");
    const studentsRes = await executeWithRetry("SELECT COUNT(*) as count FROM students WHERE status = 'Active'");
    
    return {
      totalLeads: Number(leadsRes.rows[0].count) || 0,
      totalSales: Number(salesRes.rows[0].count) || 0,
      totalRevenue: Number(salesRes.rows[0].revenue) || 0,
      activeStudents: Number(studentsRes.rows[0].count) || 0
    };
  } catch (e) {
    console.error("Failed to fetch admin stats", e);
    return {
      totalLeads: 0,
      totalSales: 0,
      totalRevenue: 0,
      activeStudents: 0
    };
  }
}
