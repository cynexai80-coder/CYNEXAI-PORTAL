const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN
});

async function migrate() {
  const cols = [
    ['timing', 'TEXT'],
    ['schedule_pattern', 'TEXT'],
    ['max_students', 'INTEGER DEFAULT 30'],
    ['current_enrolled', 'INTEGER DEFAULT 0'],
    ['status', "TEXT DEFAULT 'Active'"],
    ['mode', "TEXT DEFAULT 'Hybrid'"],
    ['subject_progress_json', 'TEXT'],
    ['completion_percentage', 'INTEGER DEFAULT 0']
  ];

  for (const [col, def] of cols) {
    try {
      await client.execute(`ALTER TABLE batches ADD COLUMN ${col} ${def}`);
      console.log('✅ Added column to batches:', col);
    } catch (e) {
      console.log('ℹ️ Column check:', col, e.message);
    }
  }

  // Update existing batches with defaults if null
  await client.execute(`UPDATE batches SET status = 'Active' WHERE status IS NULL`);
  await client.execute(`UPDATE batches SET max_students = 30 WHERE max_students IS NULL`);
  console.log('Migration complete!');
}

migrate().catch(console.error);
