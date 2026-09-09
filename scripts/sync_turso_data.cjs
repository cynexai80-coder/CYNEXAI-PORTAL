/**
 * Cross-Turso Account Sync Script
 * 
 * Safely migrates missing tables, curriculum questions, timetable slots,
 * batches, and settings from Virinchi development DB to Production DB.
 * 
 * Safe: Uses CREATE TABLE IF NOT EXISTS and INSERT OR IGNORE / INSERT OR REPLACE
 * to ensure zero loss or corruption of existing production data.
 */

const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const virinchiUrl = 'libsql://cynexai-virinchi-2003.aws-ap-south-1.turso.io';
const virinchiToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODY3MDAzNzgsImlkIjoiMDE5ZmZmYTQtMGMwMS03ZTM5LWE0MGQtNGQ1NjQzY2FlMmI2Iiwia2lkIjoiYzdhbkp0dS1RNE1rRUtCYlNEMlJ5TjI0X2ZsT3lZSE5qSmZHeS1PWTRfayIsInJpZCI6IjBkYTAxZTJmLWZjNTEtNDMzOC1iNjNkLTMyMmJlM2NmNmVhZCJ9.ddP_1AXyt2gTchobZh8CBrTFOrIBZGpa0y7uIAx7eMgG13rDhTM2YOjYOYGWNq5CkZl52dmtHXaAwpLp1zF4Bg';

const targetUrl = process.env.VITE_TURSO_DATABASE_URL;
const targetToken = process.env.VITE_TURSO_AUTH_TOKEN;

if (!targetUrl || !targetToken) {
  console.error("Target database URL or token missing from .env!");
  process.exit(1);
}

const source = createClient({ url: virinchiUrl, authToken: virinchiToken });
const dest = createClient({ url: targetUrl, authToken: targetToken });

async function executeBatchChunks(client, statements, chunkSize = 100) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    await client.batch(chunk, 'write');
  }
}

async function syncAll() {
  console.log("=================================================");
  console.log("   TURSO CROSS-ACCOUNT DATA SYNCHRONIZATION      ");
  console.log("=================================================");
  console.log("Source: ", virinchiUrl);
  console.log("Target: ", targetUrl);
  console.log("");

  // 1. Create missing tables in Target DB
  console.log("[1/7] Creating missing tables in target DB...");
  
  await dest.execute(`
    CREATE TABLE IF NOT EXISTS class_reschedules (
      id TEXT PRIMARY KEY,
      slot_id TEXT,
      slot_title TEXT,
      original_time TEXT,
      new_time TEXT,
      new_date TEXT,
      reason TEXT,
      created_by TEXT,
      batch_id TEXT,
      course_id TEXT,
      created_at TEXT
    )
  `);
  console.log("  -> class_reschedules table verified/created.");

  await dest.execute(`
    CREATE TABLE IF NOT EXISTS course_modules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("  -> course_modules table verified/created.");

  await dest.execute(`
    CREATE TABLE IF NOT EXISTS course_classes (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      youtube_video_id TEXT,
      type TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("  -> course_classes table verified/created.");

  // 2. Sync course_modules and course_classes
  console.log("\n[2/7] Syncing course_modules and course_classes...");
  const cmRes = await source.execute("SELECT * FROM course_modules");
  const cmStatements = cmRes.rows.map(row => ({
    sql: `INSERT OR IGNORE INTO course_modules (id, course_id, title, order_index, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [row.id, row.course_id, row.title, row.order_index, row.created_at]
  }));
  await executeBatchChunks(dest, cmStatements, 50);
  console.log(`  -> Synced ${cmRes.rows.length} course_modules.`);

  const ccRes = await source.execute("SELECT * FROM course_classes");
  const ccStatements = ccRes.rows.map(row => ({
    sql: `INSERT OR IGNORE INTO course_classes (id, module_id, title, description, youtube_video_id, type, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [row.id, row.module_id, row.title, row.description, row.youtube_video_id, row.type, row.order_index, row.created_at]
  }));
  await executeBatchChunks(dest, ccStatements, 50);
  console.log(`  -> Synced ${ccRes.rows.length} course_classes.`);

  // 3. Sync Batches (Batches 1 to 5)
  console.log("\n[3/7] Ensuring all Batches (1-5) exist in Target DB...");
  const defaultBatches = [
    { id: 'batch_1', name: 'Batch 1', course_id: 'course_ds_ai', capacity: 30 },
    { id: 'batch_2', name: 'Batch 2', course_id: 'course_ds_ai', capacity: 30 },
    { id: 'batch_3', name: 'Batch 3', course_id: 'course_ds_ai', capacity: 30 },
    { id: 'batch_4', name: 'Batch 4', course_id: 'course_ds_ai', capacity: 30 },
    { id: 'batch_5', name: 'Batch 5', course_id: 'course_ds_ai', capacity: 30 }
  ];

  for (const b of defaultBatches) {
    await dest.execute({
      sql: `INSERT OR IGNORE INTO batches (id, name, course_id, capacity) VALUES (?, ?, ?, ?)`,
      args: [b.id, b.name, b.course_id, b.capacity]
    });
  }
  console.log("  -> Batches 1 to 5 verified/seeded in Target DB.");

  // 4. Sync Timetable Slots & Reschedules
  console.log("\n[4/7] Syncing timetable slots and class reschedules...");
  const tsRes = await source.execute("SELECT * FROM timetable_slots");
  const tsStatements = [];
  for (const row of tsRes.rows) {
    tsStatements.push({
      sql: `INSERT OR IGNORE INTO timetable_slots (id, batch_id, day_of_week, start_time, end_time, course_name, teacher_id, timing, status, week_start)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [row.id, row.batch_id, row.day_of_week, row.start_time, row.end_time, row.course_name, row.teacher_id, row.timing, row.status, row.week_start]
    });
  }
  await executeBatchChunks(dest, tsStatements, 50);
  console.log(`  -> Synced ${tsRes.rows.length} timetable slots.`);

  const crRes = await source.execute("SELECT * FROM class_reschedules");
  for (const row of crRes.rows) {
    await dest.execute({
      sql: `INSERT OR IGNORE INTO class_reschedules (id, slot_id, slot_title, original_time, new_time, new_date, reason, created_by, batch_id, course_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [row.id, row.slot_id, row.slot_title, row.original_time, row.new_time, row.new_date, row.reason, row.created_by, row.batch_id, row.course_id, row.created_at]
    });
  }
  console.log(`  -> Synced ${crRes.rows.length} class_reschedules.`);

  // 5. Sync Portal Settings (including Groq API keys)
  console.log("\n[5/7] Syncing portal settings & AI configurations...");
  const psRes = await source.execute("SELECT key, value FROM portal_settings");
  for (const row of psRes.rows) {
    await dest.execute({
      sql: `INSERT OR IGNORE INTO portal_settings (key, value) VALUES (?, ?)`,
      args: [row.key, row.value]
    });
  }
  console.log(`  -> Synced ${psRes.rows.length} portal_settings.`);

  // 6. Sync Announcements & Mock Interviews
  console.log("\n[6/7] Syncing announcements and mock interviews...");
  const annRes = await source.execute("SELECT * FROM announcements");
  for (const row of annRes.rows) {
    await dest.execute({
      sql: `INSERT OR IGNORE INTO announcements (id, title, message, target_audience, course_id, created_by, created_at, isActive, batch_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [row.id, row.title, row.message || row.body || '', row.target_audience || 'all', row.course_id, row.created_by, row.created_at, row.is_active || row.isActive || 1, row.batch_id]
    });
  }
  console.log(`  -> Synced ${annRes.rows.length} announcements.`);

  const miRes = await source.execute("SELECT * FROM mock_interviews");
  for (const row of miRes.rows) {
    await dest.execute({
      sql: `INSERT OR IGNORE INTO mock_interviews (id, student_id, transcript, feedback, score, coins_awarded, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [row.id, row.student_id, row.transcript, row.feedback, row.score, row.coins_awarded, row.created_at]
    });
  }
  console.log(`  -> Synced ${miRes.rows.length} mock_interviews.`);

  // 7. Sync Class Questions (MCQs & Coding Challenges)
  console.log("\n[7/7] Syncing 1,278 class questions to match Target class IDs...");
  const tClassesRes = await dest.execute("SELECT id FROM classes");
  const validClassIds = new Set(tClassesRes.rows.map(r => r.id));

  const qRes = await source.execute("SELECT * FROM class_questions");
  const qStatements = [];

  let skippedCount = 0;
  for (const q of qRes.rows) {
    let targetClassId = q.class_id;
    const match = q.class_id ? q.class_id.match(/^class_(.*)_(\d+)$/) : null;
    if (match) {
      targetClassId = `mod_${match[1]}_class_${match[2]}`;
    }

    if (!validClassIds.has(targetClassId)) {
      skippedCount++;
      continue;
    }

    // Normalize type: 'code' -> 'coding' to satisfy CHECK(type IN ('mcq', 'coding'))
    const normalizedType = (q.type === 'code') ? 'coding' : q.type;

    qStatements.push({
      sql: `INSERT OR IGNORE INTO class_questions (id, class_id, type, question_text, options_json, correct_answer_idx, boilerplate_json, test_cases_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [q.id, targetClassId, normalizedType, q.question_text, q.options_json, q.correct_answer_idx, q.boilerplate_json, q.test_cases_json, q.created_at]
    });
  }

  console.log(`  -> Prepared ${qStatements.length} questions matching Target classes (skipped ${skippedCount} non-matching).`);
  console.log(`  -> Executing batch insert in chunks of 50...`);
  await executeBatchChunks(dest, qStatements, 50);
  console.log(`  -> Successfully synced ${qStatements.length} questions into Target class_questions!`);

  // Final verification
  console.log("\n=== SYNC COMPLETE: Target DB Verification ===");
  const destTables = [
    'class_questions',
    'batches',
    'timetable_slots',
    'class_reschedules',
    'course_classes',
    'course_modules',
    'portal_settings',
    'announcements',
    'mock_interviews'
  ];
  for (const t of destTables) {
    const countRes = await dest.execute(`SELECT count(*) as c FROM ${t}`);
    console.log(`  ${t.padEnd(20)}: ${countRes.rows[0].c} rows`);
  }
}

syncAll().catch(err => {
  console.error("Sync failed:", err);
  process.exit(1);
});
