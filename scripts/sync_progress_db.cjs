const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN
});

async function syncProgressDB() {
  console.log("=== SYNCING STUDENT PROGRESS DATABASE ===");

  try {
    // 1. Fetch completed classes
    const completedClasses = await client.execute(
      "SELECT id, module_id, title FROM classes WHERE status = 'completed' OR status = 'ended'"
    );
    console.log(`Found ${completedClasses.rows.length} completed classes in DB:`);
    completedClasses.rows.forEach(c => console.log(`  - ${c.id}: ${c.title}`));

    // 2. Fetch all student users and student records
    const studentsRes = await client.execute("SELECT id, portal_login_email FROM students");
    const usersRes = await client.execute("SELECT id, email FROM users WHERE LOWER(role) = 'student'");

    const studentMap = new Map(); // email -> { studentId, userId }

    studentsRes.rows.forEach((s) => {
      const email = (s.portal_login_email || '').toLowerCase().trim();
      if (email) {
        studentMap.set(email, { studentId: s.id, userId: null });
      }
    });

    usersRes.rows.forEach((u) => {
      const email = (u.email || '').toLowerCase().trim();
      if (studentMap.has(email)) {
        studentMap.get(email).userId = u.id;
      } else {
        studentMap.set(email, { studentId: u.id, userId: u.id });
      }
    });

    console.log(`\nFound ${studentMap.size} students to sync.`);

    let insertedCount = 0;
    const now = new Date().toISOString();

    for (const [email, ids] of studentMap.entries()) {
      const targetIds = [ids.studentId, ids.userId].filter(Boolean);
      const uniqueIds = Array.from(new Set(targetIds));

      for (const cls of completedClasses.rows) {
        for (const sId of uniqueIds) {
          try {
            const check = await client.execute({
              sql: "SELECT id FROM student_progress WHERE student_id = ? AND lesson_id = ? LIMIT 1",
              args: [sId, cls.id]
            });
            if (check.rows.length === 0) {
              const spId = `sp_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              await client.execute({
                sql: "INSERT INTO student_progress (id, student_id, lesson_id, completed, created_at) VALUES (?, ?, ?, 1, ?)",
                args: [spId, sId, cls.id, now]
              });
              insertedCount++;
            }
          } catch (e) {
            console.error(`Error inserting progress for ${sId} / ${cls.id}:`, e.message);
          }
        }
      }

      // Sync manager_student_progress for this student
      try {
        const totalClsRes = await client.execute("SELECT COUNT(*) as total FROM classes");
        const totalClassesCount = Number(totalClsRes.rows[0]?.total || 28);

        const doneRes = await client.execute({
          sql: "SELECT COUNT(DISTINCT lesson_id) as done FROM student_progress WHERE (student_id = ? OR student_id = ?) AND completed = 1",
          args: [ids.studentId, ids.userId || ids.studentId]
        });
        const doneCount = Number(doneRes.rows[0]?.done || 0);
        const pct = totalClassesCount > 0 ? Math.round((doneCount / totalClassesCount) * 100) : 0;

        for (const sId of uniqueIds) {
          const mgrCheck = await client.execute({
            sql: "SELECT id FROM manager_student_progress WHERE student_id = ? LIMIT 1",
            args: [sId]
          });

          if (mgrCheck.rows.length > 0) {
            await client.execute({
              sql: `UPDATE manager_student_progress SET 
                course_progress_num = ?, course_progress_den = ?, course_progress_percentage = ?, last_updated = ?
                WHERE student_id = ?`,
              args: [doneCount, totalClassesCount, pct, now, sId]
            });
          } else {
            const mspId = `msp_${sId}`;
            await client.execute({
              sql: `INSERT OR REPLACE INTO manager_student_progress 
                (id, student_id, course_progress_num, course_progress_den, course_progress_percentage, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)`,
              args: [mspId, sId, doneCount, totalClassesCount, pct, now]
            });
          }
        }
      } catch (e) {
        console.error(`Error updating manager_student_progress for ${email}:`, e.message);
      }
    }

    console.log(`\n✓ Sync complete! Created ${insertedCount} student_progress records.`);
  } catch (err) {
    console.error("syncProgressDB failed:", err);
  }
}

syncProgressDB();
