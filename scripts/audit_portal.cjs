const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN
});

async function main() {
  console.log('=== Step 1: Auditing Production Turso Database ===');
  const tableRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const tables = tableRes.rows.map(r => r.name);
  console.log(`Found ${tables.length} tables in production Turso:\n`);

  const tableStats = [];
  for (const t of tables) {
    try {
      const countRes = await client.execute(`SELECT count(*) as c FROM "${t}"`);
      const colRes = await client.execute(`PRAGMA table_info("${t}")`);
      const cols = colRes.rows.map(c => c.name);
      tableStats.push({ table: t, count: Number(countRes.rows[0].c), columns: cols });
    } catch (e) {
      tableStats.push({ table: t, count: 'ERROR: ' + e.message, columns: [] });
    }
  }

  for (const stat of tableStats) {
    console.log(`- ${stat.table.padEnd(26)} : ${String(stat.count).padStart(6)} rows (${stat.columns.length} columns)`);
  }

  console.log('\n=== Step 2: Scanning Codebase for Table References ===');
  const srcDir = path.resolve(__dirname, '../src');
  const tablePattern = /\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+([a-zA-Z0-9_]+)\b/gi;
  const referencedTables = new Set();

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scanDir(full);
      } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) {
        const content = fs.readFileSync(full, 'utf8');
        let match;
        while ((match = tablePattern.exec(content)) !== null) {
          const t = match[1].toLowerCase();
          // Filter out SQL keywords and common types
          if (!['select', 'where', 'order', 'group', 'set', 'values', 'if', 'exists', 'default', 'null', 'text', 'integer', 'real', 'boolean', 'primary', 'key', 'not', 'and', 'or', 'table', 'as'].includes(t)) {
            referencedTables.add(t);
          }
        }
      }
    }
  }
  scanDir(srcDir);

  console.log(`Found ${referencedTables.size} potential table names referenced in src/:`);
  const existingSet = new Set(tables.map(t => t.toLowerCase()));
  const missing = [];
  for (const ref of referencedTables) {
    if (!existingSet.has(ref)) {
      // Check if it's truly a table by checking context in code
      missing.push(ref);
    }
  }
  console.log('Unmatched table keywords:', missing);

  console.log('\n=== Step 3: Verifying Key Columns across Vital Tables ===');
  const checkColumns = {
    'students': ['id', 'name', 'portal_login_email', 'batch_number', 'course', 'status', 'approval_status', 'phone', 'fees_total', 'fees_paid', 'fees_pending', 'student_code'],
    'batches': ['id', 'name', 'course_id', 'status', 'max_students', 'current_enrolled', 'timing', 'schedule_pattern', 'subject_progress_json', 'completion_percentage'],
    'users': ['id', 'name', 'email', 'role', 'status', 'salary', 'permissions_json', 'phone'],
    'payments': ['id', 'order_id', 'amount', 'currency', 'status', 'student_id'],
    'sales': ['id', 'lead_id', 'admission_id', 'course_id', 'amount_paid', 'total_fee', 'status'],
    'leads': ['id', 'name', 'phone', 'course_interest', 'source', 'bucket_stage', 'assigned_to'],
    'timetable_slots': ['id', 'batch_id', 'day_of_week', 'start_time', 'end_time', 'course_name', 'teacher_id'],
    'class_questions': ['id', 'class_id', 'question', 'question_type', 'options_json', 'correct_answer']
  };

  for (const [tbl, expectedCols] of Object.entries(checkColumns)) {
    const stat = tableStats.find(s => s.table.toLowerCase() === tbl.toLowerCase());
    if (!stat) {
      console.log(`❌ Table "${tbl}" is MISSING!`);
    } else {
      const missingInTable = expectedCols.filter(c => !stat.columns.includes(c));
      if (missingInTable.length > 0) {
        console.log(`⚠️ Table "${tbl}" missing expected columns: ${missingInTable.join(', ')}`);
      } else {
        console.log(`✅ Table "${tbl}" has all required columns (${stat.count} rows)`);
      }
    }
  }
}

main().catch(console.error);
