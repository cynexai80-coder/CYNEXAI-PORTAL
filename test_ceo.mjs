import { createClient } from '@libsql/client';

const url = "libsql://cynex-ai-cynexai.aws-ap-south-1.turso.io";
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function test() {
  try {
      console.log("referrals query...");
      const res = await client.execute("SELECT id, referred_by_student_id, amount_paid FROM sales WHERE referred_by_student_id IS NOT NULL AND status != 'Pending'");
      console.log(res.rows);
  } catch(e) {
      console.error("FAIL 1:", e);
  }
  
  try {
      console.log("payroll query...");
      const res2 = await client.execute("SELECT SUM(salary) as total_salary FROM users WHERE salary IS NOT NULL");
      console.log(res2.rows);
  } catch(e) {
      console.error("FAIL 2:", e);
  }
}
test();
