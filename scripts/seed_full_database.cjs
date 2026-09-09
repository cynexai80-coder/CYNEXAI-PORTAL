const { createClient } = require('@libsql/client');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const url = process.env.VITE_TURSO_DATABASE_URL || 'libsql://cynexai-virinchi-2003.aws-ap-south-1.turso.io';
const authToken = process.env.VITE_TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODY3MDAzNzgsImlkIjoiMDE5ZmZmYTQtMGMwMS03ZTM5LWE0MGQtNGQ1NjQzY2FlMmI2Iiwia2lkIjoiYzdhbkp0dS1RNE1rRUtCYlNEMlJ5TjI0X2ZsT3lZSE5qSmZHeS1PWTRfayIsInJpZCI6IjBkYTAxZTJmLWZjNTEtNDMzOC1iNjNkLTMyMmJlM2NmNmVhZCJ9.ddP_1AXyt2gTchobZh8CBrTFOrIBZGpa0y7uIAx7eMgG13rDhTM2YOjYOYGWNq5CkZl52dmtHXaAwpLp1zF4Bg';
const secretKey = process.env.VITE_APP_SECRET || 'cynex-ai-secure-erp-key-2026';

const client = createClient({ url, authToken });

const encryptPassword = (password) => {
  if (!password) return '';
  return CryptoJS.AES.encrypt(password, secretKey).toString();
};

async function safeAddColumn(table, colDef) {
  try {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  } catch (e) {}
}

async function main() {
  console.log("=== Starting Full Database Setup & Seeding ===");
  console.log("Turso URL:", url);

  // 1. Create Tables & Add Columns
  console.log("\n[1/6] Creating database tables & adding missing columns...");
  
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      password_encrypted TEXT,
      role TEXT NOT NULL,
      phone TEXT,
      status TEXT DEFAULT 'Active',
      permissions_json TEXT,
      avatar TEXT,
      salary REAL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await safeAddColumn('users', 'password_encrypted TEXT');
  await safeAddColumn('users', 'password_hash TEXT');
  await safeAddColumn('users', 'phone TEXT');
  await safeAddColumn('users', 'status TEXT DEFAULT \'Active\'');
  await safeAddColumn('users', 'salary REAL');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS erp_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      student_code TEXT,
      name TEXT,
      portal_login_email TEXT UNIQUE,
      status TEXT DEFAULT 'Active',
      approval_status TEXT DEFAULT 'Approved',
      phone TEXT,
      course TEXT,
      batch_number TEXT,
      joining_date TEXT,
      training_start_date TEXT,
      gender TEXT,
      dob TEXT,
      address TEXT,
      blood_group TEXT,
      emergency_contact TEXT,
      father_name TEXT,
      mother_name TEXT,
      fees_total REAL DEFAULT 0,
      fees_paid REAL DEFAULT 0,
      fees_pending REAL DEFAULT 0,
      documents_submitted INTEGER DEFAULT 0,
      classes_attended_json TEXT DEFAULT '[]',
      preferred_mode TEXT,
      topic_completed TEXT,
      streak INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await safeAddColumn('students', 'student_code TEXT');
  await safeAddColumn('students', 'approval_status TEXT DEFAULT \'Approved\'');
  await safeAddColumn('students', 'phone TEXT');
  await safeAddColumn('students', 'course TEXT');
  await safeAddColumn('students', 'batch_number TEXT');
  await safeAddColumn('students', 'joining_date TEXT');
  await safeAddColumn('students', 'training_start_date TEXT');
  await safeAddColumn('students', 'gender TEXT');
  await safeAddColumn('students', 'dob TEXT');
  await safeAddColumn('students', 'address TEXT');
  await safeAddColumn('students', 'blood_group TEXT');
  await safeAddColumn('students', 'emergency_contact TEXT');
  await safeAddColumn('students', 'father_name TEXT');
  await safeAddColumn('students', 'mother_name TEXT');
  await safeAddColumn('students', 'fees_total REAL DEFAULT 0');
  await safeAddColumn('students', 'fees_paid REAL DEFAULT 0');
  await safeAddColumn('students', 'fees_pending REAL DEFAULT 0');
  await safeAddColumn('students', 'documents_submitted INTEGER DEFAULT 0');
  await safeAddColumn('students', 'classes_attended_json TEXT DEFAULT \'[]\'');
  await safeAddColumn('students', 'preferred_mode TEXT');
  await safeAddColumn('students', 'topic_completed TEXT');
  await safeAddColumn('students', 'streak INTEGER DEFAULT 0');
  await safeAddColumn('students', 'coins INTEGER DEFAULT 0');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS student_documents (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      doc_type TEXT,
      file_name TEXT,
      file_data TEXT,
      uploaded_by TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      instructor_id TEXT,
      price REAL,
      status TEXT DEFAULT 'published',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeAddColumn('courses', 'price REAL');
  await safeAddColumn('courses', 'status TEXT DEFAULT \'published\'');
  await safeAddColumn('courses', 'instructor_id TEXT');
  await safeAddColumn('courses', 'description TEXT');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      course_id TEXT,
      primary_teacher_id TEXT,
      start_date TEXT,
      timing TEXT,
      schedule_pattern TEXT,
      max_students INTEGER DEFAULT 30,
      current_enrolled INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeAddColumn('batches', 'course_id TEXT');
  await safeAddColumn('batches', 'primary_teacher_id TEXT');
  await safeAddColumn('batches', 'start_date TEXT');
  await safeAddColumn('batches', 'timing TEXT');
  await safeAddColumn('batches', 'schedule_pattern TEXT');
  await safeAddColumn('batches', 'max_students INTEGER DEFAULT 30');
  await safeAddColumn('batches', 'current_enrolled INTEGER DEFAULT 0');
  await safeAddColumn('batches', 'status TEXT DEFAULT \'Active\'');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS crm_leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      status TEXT NOT NULL,
      source TEXT,
      course_interest TEXT,
      assigned_to TEXT,
      notes TEXT,
      grad_year TEXT,
      qualification TEXT,
      it_background TEXT,
      preferred_mode TEXT,
      location TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await safeAddColumn('crm_leads', 'notes TEXT');
  await safeAddColumn('crm_leads', 'grad_year TEXT');
  await safeAddColumn('crm_leads', 'qualification TEXT');
  await safeAddColumn('crm_leads', 'it_background TEXT');
  await safeAddColumn('crm_leads', 'preferred_mode TEXT');
  await safeAddColumn('crm_leads', 'location TEXT');
  await safeAddColumn('crm_leads', 'created_by TEXT');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS admissions (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      amount REAL NOT NULL,
      discount_locked TEXT,
      offer_expiry TEXT,
      expected_sale_date TEXT,
      status TEXT DEFAULT 'Active',
      created_by TEXT,
      referred_by_student_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      admission_id TEXT,
      course_id TEXT NOT NULL,
      total_fee REAL NOT NULL,
      amount_paid REAL NOT NULL,
      payment_mode TEXT,
      status TEXT NOT NULL,
      sales_exec_id TEXT,
      referred_by_student_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS manager_approvals (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      checklist_json TEXT,
      status TEXT DEFAULT 'Pending',
      notes TEXT,
      approver_id TEXT,
      decided_at TEXT
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS onboardings (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      batch_id TEXT,
      teacher_id TEXT,
      mode TEXT,
      joining_date TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      assignee_id TEXT,
      created_by TEXT,
      priority TEXT DEFAULT 'Medium',
      due_date TEXT,
      status TEXT DEFAULT 'To Do',
      task_type TEXT DEFAULT 'One-Time',
      target_number REAL,
      current_number REAL DEFAULT 0,
      related_entity TEXT,
      lead_id TEXT,
      student_id TEXT,
      start_date TEXT,
      tags TEXT,
      recurrence_rule TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS student_progress (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      lesson_id TEXT,
      attendance_score REAL DEFAULT 0,
      course_progress_percentage REAL DEFAULT 0,
      quiz_scores TEXT DEFAULT '[]',
      coins_spent INTEGER DEFAULT 0,
      leaderboard_rank INTEGER,
      completed INTEGER DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS manager_student_progress (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL UNIQUE,
      course_progress_num INTEGER DEFAULT 0,
      course_progress_den INTEGER DEFAULT 10,
      course_progress_percentage REAL DEFAULT 0,
      attendance_num INTEGER DEFAULT 0,
      attendance_den INTEGER DEFAULT 20,
      attendance_score REAL DEFAULT 0,
      quiz_num INTEGER DEFAULT 0,
      quiz_den INTEGER DEFAULT 10,
      quiz_score REAL DEFAULT 0,
      interview_num INTEGER DEFAULT 0,
      interview_den INTEGER DEFAULT 5,
      interview_score REAL DEFAULT 0,
      coding_num INTEGER DEFAULT 0,
      coding_den INTEGER DEFAULT 10,
      coding_test_score REAL DEFAULT 0,
      coins_spent INTEGER DEFAULT 0,
      leaderboard_rank INTEGER DEFAULT 1,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS portal_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image TEXT,
      video TEXT,
      category TEXT,
      isVisible INTEGER DEFAULT 1,
      date TEXT
    )
  `);

  console.log("✅ Tables and columns verified.");

  // 2. Seed System Users
  console.log("\n[2/6] Seeding System Users...");
  const systemUsers = [
    { id: 'usr_ceo', name: 'CEO', email: 'ceo@cynexai.com', password: 'admin123', role: 'CEO', salary: 150000 },
    { id: 'usr_ceo_eswar', name: 'Eswar Sudheer', email: 'eswarsudheer98@gmail.com', password: 'admin123', role: 'CEO', salary: 150000 },
    { id: 'usr_admin', name: 'Admin', email: 'admin@cynexai.com', password: 'admin123', role: 'Admin', salary: 100000 },
    { id: 'usr_admin_in', name: 'Admin IN', email: 'admin@cynexai.in', password: 'admin123', role: 'Admin', salary: 100000 },
    { id: 'usr_manager', name: 'Manager', email: 'manager@cynexai.com', password: 'admin123', role: 'Manager', salary: 85000 },
    { id: 'usr_manager_leonard', name: 'Leonard', email: 'leonard001@gmail.com', password: 'admin123', role: 'Manager', salary: 85000 },
    { id: 'usr_sales', name: 'Sandeep', email: 'sandeep.cynexai@gmail.com', password: 'Sandeep@142', role: 'Sales/HR', salary: 45000 },
    { id: 'usr_sales_default', name: 'Sales Exec', email: 'sales@cynexai.com', password: 'admin123', role: 'Sales/HR', salary: 45000 },
    { id: 'usr_teacher', name: 'Teacher', email: 'teacher@cynexai.com', password: 'admin123', role: 'Teacher', salary: 50000 },
    { id: 'usr_teacher_venkat', name: 'Venkateswar Reddy', email: 'venkateswarreddykatreddy29@gmail.com', password: 'admin123', role: 'Teacher', salary: 50000 },
    { id: 'usr_student', name: 'Student', email: 'student@cynexai.com', password: 'admin123', role: 'Student', salary: 0 },
    { id: 'usr_student_demo', name: 'Demo Student', email: 'demo@student.cynexai.com', password: 'admin123', role: 'Student', salary: 0 },
    { id: 'usr_student_cai', name: 'CAI Student', email: 'cai0047@student.cynexai.com', password: 'admin123', role: 'Student', salary: 0 },
    { id: 'usr_dm', name: 'Marketer', email: 'dm@cynexai.com', password: 'admin123', role: 'DM', salary: 60000 },
    { id: 'usr_dm_leela', name: 'Leela', email: 'leela@gmail.com', password: 'admin123', role: 'DM', salary: 60000 }
  ];

  for (const u of systemUsers) {
    const encPw = encryptPassword(u.password);
    await client.execute({
      sql: `INSERT OR REPLACE INTO users (id, name, email, password_encrypted, password_hash, role, salary, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')`,
      args: [u.id, u.name, u.email, encPw, encPw, u.role, u.salary]
    });
    await client.execute({
      sql: `INSERT OR REPLACE INTO erp_users (id, name, email, password_hash, role) 
            VALUES (?, ?, ?, ?, ?)`,
      args: [u.id, u.name, u.email, encPw, u.role]
    });
  }
  console.log(`✅ Seeded ${systemUsers.length} system users.`);

  // 3. Seed Courses & Batches
  console.log("\n[3/6] Seeding Courses & Batches...");
  const coursesList = [
    { id: 'crs_ds', title: 'Data Science with AI', price: 45000 },
    { id: 'crs_aigen', title: 'AI & Generative AI', price: 50000 },
    { id: 'crs_python', title: 'Full stack python', price: 35000 },
    { id: 'crs_sap', title: 'SAP Fico', price: 40000 },
    { id: 'crs_dm', title: 'Digital marketing', price: 30000 }
  ];
  for (const c of coursesList) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO courses (id, title, price, status) VALUES (?, ?, ?, 'published')`,
      args: [c.id, c.title, c.price]
    });
  }

  const batchesList = [
    { id: 'batch_1', name: 'Batch 1', course_id: 'crs_ds', primary_teacher_id: 'usr_teacher_venkat' },
    { id: 'batch_2', name: 'Batch 2', course_id: 'crs_ds', primary_teacher_id: 'usr_teacher_venkat' },
    { id: 'batch_3', name: 'Batch 3', course_id: 'crs_aigen', primary_teacher_id: 'usr_teacher_venkat' },
    { id: 'batch_4', name: 'Batch 4', course_id: 'crs_python', primary_teacher_id: 'usr_teacher' },
    { id: 'batch_5', name: 'Batch 5', course_id: 'crs_sap', primary_teacher_id: 'usr_teacher' }
  ];
  for (const b of batchesList) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO batches (id, name, course_id, primary_teacher_id, status) VALUES (?, ?, ?, ?, 'Active')`,
      args: [b.id, b.name, b.course_id, b.primary_teacher_id]
    });
  }
  console.log("✅ Seeded courses and batches.");

  // 4. Seed Real Students from students_seed.json
  console.log("\n[4/6] Seeding 28+ Enrolled Students from students_seed.json...");
  const seedFile = path.join(__dirname, '../students_seed.json');
  if (fs.existsSync(seedFile)) {
    const rawData = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    const defaultEncPw = encryptPassword('admin123');

    let count = 0;
    for (const r of rawData) {
      if (r.id === 'stu_32' || r.name === 'Names') continue;

      const stuId = r.id || `stu_${count + 1}`;
      const name = r.name || 'Student User';
      const email = `${stuId.toLowerCase()}@student.cynexai.com`;
      const course = !r.course || r.course === 'Course' ? 'Data Science with AI' : r.course;
      const rawBatch = String(r.batch || '1');
      const batchNum = !rawBatch || rawBatch === 'Batch' ? 'Batch 1' : (rawBatch.startsWith('Batch') ? rawBatch : `Batch ${rawBatch}`);
      const joiningDate = r.joining_date ? String(r.joining_date).split(' ')[0] : '2026-06-01';
      const feesTotal = Number(r.total_fee) || 25000;
      const feesPaid = Number(r.amount_paid) || 20000;
      const feesPending = Math.max(0, feesTotal - feesPaid);

      // Insert into users table for login
      await client.execute({
        sql: `INSERT OR REPLACE INTO users (id, name, email, password_encrypted, password_hash, role, status)
              VALUES (?, ?, ?, ?, ?, 'Student', 'Active')`,
        args: [`usr_${stuId}`, name, email, defaultEncPw, defaultEncPw]
      });

      // Insert into students table
      await client.execute({
        sql: `INSERT OR REPLACE INTO students (
                id, student_code, name, portal_login_email, status, approval_status,
                phone, course, batch_number, joining_date, fees_total, fees_paid, fees_pending,
                streak, coins
              ) VALUES (?, ?, ?, ?, 'Active', 'Approved', '9876543210', ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          stuId, stuId, name, email,
          course, batchNum, joiningDate, feesTotal, feesPaid, feesPending,
          (count * 3) % 14 + 1, (count * 50) % 500 + 100
        ]
      });

      // Insert into manager_student_progress table
      const courseProgressPct = Math.min(100, Math.max(15, ((count * 17) % 85) + 15));
      await client.execute({
        sql: `INSERT OR REPLACE INTO manager_student_progress (
                id, student_id, course_progress_percentage, attendance_score, quiz_score,
                interview_score, coding_test_score, coins_spent, leaderboard_rank,
                course_progress_num, course_progress_den, attendance_num, attendance_den
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 10, ?, 20)`,
        args: [
          `sp_${stuId}`, stuId, courseProgressPct,
          Math.min(100, 85 + (count % 15)),
          Math.min(100, 75 + (count % 25)),
          Math.min(100, 70 + (count % 30)),
          Math.min(100, 80 + (count % 20)),
          count * 10, count + 1,
          Math.floor(courseProgressPct / 10),
          18 + (count % 3)
        ]
      });

      count++;
    }
    console.log(`✅ Seeded ${count} enrolled students with progress into Turso database.`);
  }

  // 5. Seed CRM Leads, Admissions, Sales, Tasks
  console.log("\n[5/6] Seeding CRM Demo Leads, Sales, and Tasks...");
  const leadId = 'lead_demo_1';
  await client.execute({
    sql: `INSERT OR REPLACE INTO crm_leads (id, name, email, phone, course_interest, source, status, assigned_to, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [leadId, 'Rahul Demo Lead', 'rahul.demo@gmail.com', '9876543210', 'Data Science with AI', 'Website', 'New', 'usr_sales', new Date().toISOString()]
  });

  const admId = 'adm_demo_1';
  await client.execute({
    sql: `INSERT OR REPLACE INTO admissions (id, lead_id, amount, discount_locked, offer_expiry, expected_sale_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [admId, leadId, 45000, '10%', '2026-08-30', '2026-08-20', 'Active']
  });

  const saleId = 'sal_demo_1';
  await client.execute({
    sql: `INSERT OR REPLACE INTO sales (id, lead_id, admission_id, course_id, total_fee, amount_paid, status, sales_exec_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [saleId, leadId, admId, 'crs_ds', 45000, 25000, 'Sale Partial Closed', 'usr_sales']
  });

  await client.execute({
    sql: `INSERT OR REPLACE INTO manager_approvals (id, sale_id, checklist_json, status)
          VALUES (?, ?, ?, ?)`,
    args: ['appr_demo_1', saleId, JSON.stringify({ payment_verified: true, course_confirmed: true }), 'Pending']
  });

  await client.execute({
    sql: `INSERT OR REPLACE INTO tasks (id, title, description, assignee_id, priority, due_date, status, task_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['tsk_demo_1', 'Review Q3 Sales Targets', 'Conduct a review of Q3 sales and admissions', 'usr_sales', 'High', '2026-08-20', 'Pending', 'Daily']
  });
  console.log("✅ Seeded CRM demo leads, sales, and tasks.");

  // 6. Seed Portal Settings & Blog Posts
  console.log("\n[6/6] Seeding Portal Settings & Sample Blog Posts...");
  const defaultPortalSettings = [
    ['show_referrals', '1'],
    ['show_career', '1'],
    ['show_leaderboard', '1'],
    ['show_mock_interview', '1'],
    ['show_attendance', '1'],
    ['show_gamification', '1'],
  ];
  for (const [k, v] of defaultPortalSettings) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO portal_settings (key, value) VALUES (?, ?)`,
      args: [k, v]
    });
  }

  await client.execute({
    sql: `INSERT OR REPLACE INTO blog_posts (id, title, content, category, isVisible, date)
          VALUES (?, ?, ?, ?, 1, ?)`,
    args: [
      'post_demo_1',
      'Welcome to CynexAI Learning Portal',
      'We are excited to launch our upgraded ERP and LMS platform for all students and faculty.',
      'Announcements',
      new Date().toISOString()
    ]
  });

  console.log("\n🎉 ALL SEEDING COMPLETED SUCCESSFULLY INTO NEW TURSO DATABASE!");
}

main().catch(err => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
