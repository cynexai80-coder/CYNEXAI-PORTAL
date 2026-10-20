import { createClient } from '@libsql/client';

const url = "libsql://cynex-ai-cynexai.aws-ap-south-1.turso.io";
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function patch() {
  try {
    try { await client.execute("ALTER TABLE sales ADD COLUMN status TEXT"); } catch(e) {}
    try { await client.execute("ALTER TABLE sales ADD COLUMN admission_id TEXT"); } catch(e) {}
    try { await client.execute("ALTER TABLE sales ADD COLUMN sales_exec_id TEXT"); } catch(e) {}
    console.log("Sales table patched.");
  } catch(e) {
    console.error(e);
  }
}
patch();
