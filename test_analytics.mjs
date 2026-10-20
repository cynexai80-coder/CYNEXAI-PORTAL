import { createClient } from '@libsql/client';

const url = "libsql://cynex-ai-cynexai.aws-ap-south-1.turso.io";
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function test() {
  try {
      const stats = { totalStudents: 0, totalLeads: 0, totalRevenue: 0, classesCompleted: 0 };
      
      console.log("students...");
      const stdRes = await client.execute("SELECT COUNT(*) as c FROM students");
      if(stdRes.rows.length) stats.totalStudents = Number(stdRes.rows[0].c);
      
      console.log("leads...");
      const leadRes = await client.execute("SELECT COUNT(*) as c FROM leads");
      if(leadRes.rows.length) stats.totalLeads = Number(leadRes.rows[0].c);
      
      console.log("sales...");
      const revRes = await client.execute("SELECT SUM(amount_paid) as sum FROM sales");
      if(revRes.rows.length) stats.totalRevenue = Number(revRes.rows[0].sum) || 0;
      
      console.log("classes...");
      const clsRes = await client.execute("SELECT COUNT(*) as c FROM classes WHERE status = 'completed'");
      if(clsRes.rows.length) stats.classesCompleted = Number(clsRes.rows[0].c);

      console.log("STATS:", stats);
  } catch(e) {
      console.error("FAIL:", e);
  }
}
test();
