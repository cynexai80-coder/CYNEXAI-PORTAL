const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

const url = process.env.VITE_TURSO_DATABASE_URL || 'libsql://cynexai-virinchi-2003.aws-ap-south-1.turso.io';
const authToken = process.env.VITE_TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODY3MDAzNzgsImlkIjoiMDE5ZmZmYTQtMGMwMS03ZTM5LWE0MGQtNGQ1NjQzY2FlMmI2Iiwia2lkIjoiYzdhbkp0dS1RNE1rRUtCYlNEMlJ5TjI0X2ZsT3lZSE5qSmZHeS1PWTRfayIsInJpZCI6IjBkYTAxZTJmLWZjNTEtNDMzOC1iNjNkLTMyMmJlM2NmNmVhZCJ9.ddP_1AXyt2gTchobZh8CBrTFOrIBZGpa0y7uIAx7eMgG13rDhTM2YOjYOYGWNq5CkZl52dmtHXaAwpLp1zF4Bg';

const client = createClient({ url, authToken });

async function safeAddColumn(table, colDef) {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  } catch (e) {}
}

async function main() {
  console.log("=== Seeding Modules & Classes from Modules Data.xlsx into Turso Database ===");
  
  const excelPath = path.join(__dirname, '../Modules Data.xlsx');
  if (!require('fs').existsSync(excelPath)) {
    console.error("❌ Modules Data.xlsx file not found at", excelPath);
    process.exit(1);
  }

  const wb = XLSX.readFile(excelPath);

  // 1. Create tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      instructor_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS course_module_mapping (
      course_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      PRIMARY KEY (course_id, module_id)
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      youtube_video_id TEXT,
      meet_link TEXT,
      type TEXT DEFAULT 'video',
      ai_ppt_markdown TEXT,
      ai_script TEXT,
      ai_keypoints TEXT,
      ai_summary TEXT,
      status TEXT DEFAULT 'draft',
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeAddColumn('classes', 'description TEXT');
  await safeAddColumn('classes', 'youtube_video_id TEXT');
  await safeAddColumn('classes', 'meet_link TEXT');
  await safeAddColumn('classes', 'type TEXT DEFAULT \'video\'');
  await safeAddColumn('classes', 'ai_ppt_markdown TEXT');
  await safeAddColumn('classes', 'ai_script TEXT');
  await safeAddColumn('classes', 'ai_keypoints TEXT');
  await safeAddColumn('classes', 'ai_summary TEXT');
  await safeAddColumn('classes', 'status TEXT DEFAULT \'draft\'');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS course_modules (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS course_classes (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      youtube_video_id TEXT,
      type TEXT DEFAULT 'video',
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeAddColumn('course_classes', 'description TEXT');
  await safeAddColumn('course_classes', 'youtube_video_id TEXT');
  await safeAddColumn('course_classes', 'type TEXT DEFAULT \'video\'');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS class_questions (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT,
      correct_answer_idx INTEGER,
      boilerplate_json TEXT,
      test_cases_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Seed Master Courses
  const courseDs = "course_ds_mastery";
  await client.execute({
    sql: `INSERT OR REPLACE INTO courses (id, title, description, instructor_id, status) VALUES (?, ?, ?, ?, 'published')`,
    args: [courseDs, "Data Science Mastery", "Master Python, SQL, ML, AI, Excel, Power BI, SDLC and Softskills.", "usr_teacher"]
  });

  const courseAider = "course_aider_ai";
  await client.execute({
    sql: `INSERT OR REPLACE INTO courses (id, title, description, instructor_id, status) VALUES (?, ?, ?, ?, 'published')`,
    args: [courseAider, "Aider AI Mastery", "Learn how to use Aider, the leading AI pair programming tool.", "usr_teacher"]
  });

  const courseCaveman = "course_caveman";
  await client.execute({
    sql: `INSERT OR REPLACE INTO courses (id, title, description, instructor_id, status) VALUES (?, ?, ?, ?, 'published')`,
    args: [courseCaveman, "Caveman Developer Skill", "Go back to basics and master low-level programming and offline dev tools.", "usr_teacher"]
  });

  console.log("✅ Seeded master courses.");

  // 3. Process excel sheets
  const moduleNames = ['Python', 'SQL', 'ML', 'AI', 'Excel', 'Power BI', 'SDLC', 'Softskills'];

  let totalClassesSeeded = 0;

  for (let idx = 0; idx < moduleNames.length; idx++) {
    const modName = moduleNames[idx];
    const moduleId = `mod_${modName.toLowerCase().replace(/\s+/g, '_')}`;

    // Insert Global Module
    await client.execute({
      sql: `INSERT OR REPLACE INTO modules (id, title, description) VALUES (?, ?, ?)`,
      args: [moduleId, modName, `Comprehensive guide to ${modName}`]
    });

    await client.execute({
      sql: `INSERT OR REPLACE INTO course_modules (id, course_id, title, order_index) VALUES (?, ?, ?, ?)`,
      args: [moduleId, courseDs, modName, idx]
    });

    // Map Module to Data Science Course
    await client.execute({
      sql: `INSERT OR REPLACE INTO course_module_mapping (course_id, module_id, order_index) VALUES (?, ?, ?)`,
      args: [courseDs, moduleId, idx]
    });

    if (['Python', 'SQL', 'SDLC', 'AI'].includes(modName)) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO course_module_mapping (course_id, module_id, order_index) VALUES (?, ?, ?)`,
        args: [courseAider, moduleId, idx]
      });
    }

    if (['Python', 'SDLC', 'Softskills'].includes(modName)) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO course_module_mapping (course_id, module_id, order_index) VALUES (?, ?, ?)`,
        args: [courseCaveman, moduleId, idx]
      });
    }

    if (wb.SheetNames.includes(modName)) {
      const sheet = wb.Sheets[modName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const classLabel = row.Class || row.class || `Class ${rIdx + 1}`;
        const topics = row.Topics || row.topics || row.Description || row.description || 'Core concepts training.';
        const classId = `class_${modName.toLowerCase().replace(/\s+/g, '_')}_${rIdx + 1}`;
        const classType = (modName === 'Python' && rIdx === 0) ? 'live' : 'video';
        const meetLink = "https://meet.jit.si/CynexAI";

        await client.execute({
          sql: `INSERT OR REPLACE INTO classes (id, module_id, title, description, meet_link, type, order_index, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')`,
          args: [classId, moduleId, `${modName} - ${classLabel}`, String(topics), meetLink, classType, rIdx]
        });

        await client.execute({
          sql: `INSERT OR REPLACE INTO course_classes (id, module_id, title, description, type, order_index)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [classId, moduleId, `${modName} - ${classLabel}`, String(topics), classType, rIdx]
        });

        totalClassesSeeded++;
      }
      console.log(`  -> Seeded ${rows.length} classes for Module: ${modName}`);
    }
  }

  console.log(`\n🎉 Seeded ${moduleNames.length} modules and ${totalClassesSeeded} classes into Turso database!`);
}

main().catch(err => {
  console.error("❌ Excel seeding failed:", err);
  process.exit(1);
});
