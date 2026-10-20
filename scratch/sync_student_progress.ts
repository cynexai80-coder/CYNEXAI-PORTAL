import xlsx from 'xlsx';
import { createClient } from '@libsql/client';

async function syncProgress() {
  const client = createClient({
    url: 'libsql://cynex-ai-cynexai.aws-ap-south-1.turso.io',
    authToken: process.env.VITE_TURSO_AUTH_TOKEN
  });

  const workbook = xlsx.readFile('Student_Data.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} students in Excel. Syncing progress...`);

  // Map courses to IDs (Based on known course names)
  const courseMap: Record<string, string> = {
    'Data Science with AI': 'course_ds_ai',
    'Data Science Masterclass': 'course_ds_101'
  };

  let mappedCount = 0;

  for (const row of data as any[]) {
    const email = row['Gmails']?.toString().trim();
    const courseName = row['Course']?.toString().trim();
    const numCompleted = parseInt(row['Class Number (Modules Data)']) || parseInt(row['Classes completed']) || 0;
    
    if (!email) continue;
    
    const courseId = courseMap[courseName] || 'course_ds_ai';

    // 1. Get user ID
    const userRes = await client.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email]
    });
    
    if (userRes.rows.length === 0) {
      console.log(`User not found for email: ${email}, skipping progress.`);
      continue;
    }
    const userId = userRes.rows[0].id as string;

    // 2. Ensure they are in students table
    const stuRes = await client.execute({
      sql: "SELECT id FROM students WHERE id = ? OR portal_login_email = ?",
      args: [userId, email]
    });
    
    if (stuRes.rows.length === 0) {
      // Create student record to link them properly
      const onbId = `onb_sync_${userId.substring(0, 8)}`;
      await client.execute({
        sql: "INSERT INTO students (id, onboarding_id, student_code, portal_login_email, status, streak, coins) VALUES (?, ?, ?, ?, 'Active', 0, 100)",
        args: [userId, onbId, row['ID'] || `CNX-${Date.now()}`, email]
      });
      // Also need a mock onboarding and sale to link them to the course
      const saleId = `sale_sync_${userId.substring(0, 8)}`;
      await client.execute({
        sql: "INSERT INTO sales (id, lead_id, course_id, total_fee, amount_paid, status, timestamp) VALUES (?, ?, ?, 0, 0, 'Sale Completed', CURRENT_TIMESTAMP)",
        args: [saleId, `lead_sync_${userId.substring(0, 8)}`, courseId]
      });
      await client.execute({
        sql: "INSERT INTO onboardings (id, sale_id, batch_id, teacher_id, mode, joining_date, remarks) VALUES (?, ?, ?, 'usr_teacher', 'Online', CURRENT_DATE, 'Synced from Excel')",
        args: [onbId, saleId, row['Batch']?.toString() || 'Batch_Sync']
      });
    }

    // 3. Map Progress per Module
    const moduleName = row['Modules']?.toString().trim();
    if (numCompleted > 0 && moduleName) {
      // Find the module ID by name
      const modRes = await client.execute({
        sql: `SELECT id FROM modules WHERE title LIKE ? LIMIT 1`,
        args: [`%${moduleName}%`]
      });

      if (modRes.rows.length > 0) {
        const moduleId = modRes.rows[0].id;
        
        // Get classes for this specific module
        const classesRes = await client.execute({
          sql: `
            SELECT id 
            FROM classes 
            WHERE module_id = ?
            ORDER BY order_index ASC
            LIMIT ?
          `,
          args: [moduleId, numCompleted]
        });

        for (const cls of classesRes.rows) {
          const classId = cls.id as string;
          const progId = `prog_${userId}_${classId}`.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40); // ensure it's not too long and safe
          await client.execute({
            sql: `
              INSERT INTO student_progress (id, student_id, lesson_id, completed) 
              VALUES (?, ?, ?, 1)
              ON CONFLICT(id) DO UPDATE SET completed = 1
            `,
            args: [progId, userId, classId]
          });
        }
        console.log(`Synced ${classesRes.rows.length} classes for ${email} in module ${moduleName}`);
      } else {
        console.log(`Module '${moduleName}' not found for ${email}, skipping progress.`);
      }
    } else {
      console.log(`0 classes completed for ${email} in module ${moduleName || 'Unknown'}`);
    }
    mappedCount++;
  }

  console.log(`\nSuccessfully synced ${mappedCount} students!`);
}

syncProgress().catch(console.error);
