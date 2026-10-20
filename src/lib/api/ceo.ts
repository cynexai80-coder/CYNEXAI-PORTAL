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

export async function getReferrals(): Promise<any[]> {
  try {
    const res = await executeWithRetry("SELECT id, referred_by_student_id, amount_paid FROM sales WHERE referred_by_student_id IS NOT NULL AND status != 'Pending'");
    return res.rows;
  } catch (e) {
    console.error("Failed to get referrals", e);
    return [];
  }
}

export async function getTotalPayroll(): Promise<number> {
  try {
    const res = await executeWithRetry("SELECT SUM(salary) as total_salary FROM users WHERE salary IS NOT NULL AND COALESCE(status, 'Active') = 'Active' AND role != 'Student'");
    return Number(res.rows[0]?.total_salary) || 0;
  } catch (e) {
    console.error("Failed to get payroll", e);
    return 0;
  }
}
