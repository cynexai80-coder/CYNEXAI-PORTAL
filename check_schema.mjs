import { createClient } from '@libsql/client';

const url = "libsql://cynex-ai-cynexai.aws-ap-south-1.turso.io";
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function check() {
  try {
    const res = await client.execute("PRAGMA table_info(classes)");
    console.log("classes:", res.rows);
    const res2 = await client.execute("PRAGMA table_info(sales)");
    console.log("sales:", res2.rows);
  } catch(e) {
    console.error(e);
  }
}
check();
