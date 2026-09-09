const { createClient } = require('@libsql/client');
require('dotenv').config();

async function checkDB() {
  const client = createClient({
    url: process.env.VITE_TURSO_DATABASE_URL,
    authToken: process.env.VITE_TURSO_AUTH_TOKEN
  });

  try {
    // Check courses
    const courses = await client.execute("SELECT id, title FROM courses LIMIT 5");
    console.log("=== COURSES ===");
    courses.rows.forEach(r => console.log(`  ${r.id}: ${r.title}`));

    // Check modules schema
    const modSchema = await client.execute("PRAGMA table_info(modules)");
    console.log("\n=== MODULES SCHEMA ===");
    modSchema.rows.forEach(r => console.log(`  ${r.name} (${r.type})`));

    // Check modules
    const modules = await client.execute("SELECT id, title, instructor_id FROM modules");
    console.log("\n=== MODULES ===");
    modules.rows.forEach(r => console.log(`  ${r.id}: ${r.title} (instructor_id: ${r.instructor_id})`));

    // Check teacher users
    const teachers = await client.execute("SELECT id, name, email, role FROM users WHERE role = 'Teacher' OR role = 'Faculty' OR email LIKE '%teacher%' OR name LIKE '%venkat%'");
    console.log("\n=== TEACHERS IN DB ===");
    teachers.rows.forEach(r => console.log(`  ${r.id}: ${r.name} (${r.email}, role: ${r.role})`));

    // Check timetable slots
    const tt = await client.execute("SELECT id, teacher_id, course_name FROM timetable_slots LIMIT 10");
    console.log("\n=== TIMETABLE SLOTS ===");
    tt.rows.forEach(r => console.log(`  ${r.id}: teacher_id=${r.teacher_id}, course_name=${r.course_name}`));

    // Check first few classes
    const cls = await client.execute("SELECT id, title, module_id, status FROM classes LIMIT 10");
    console.log("\n=== FIRST 10 CLASSES ===");
    cls.rows.forEach(r => console.log(`  ${r.id}: ${r.title} (module: ${r.module_id}, status: ${r.status})`));

    // Check students
    const students = await client.execute("SELECT id, name, email FROM users WHERE LOWER(role) = 'student' LIMIT 10");
    console.log("\n=== FIRST 10 STUDENTS ===");
    students.rows.forEach(r => console.log(`  ${r.id}: ${r.name} (${r.email})`));

    // Check student_progress schema
    try {
      const progSchema = await client.execute("PRAGMA table_info(student_progress)");
      console.log("\n=== STUDENT_PROGRESS SCHEMA ===");
      progSchema.rows.forEach(r => console.log(`  ${r.name} (${r.type})`));

      const progCount = await client.execute("SELECT COUNT(*) as count FROM student_progress");
      console.log("STUDENT_PROGRESS ROWS:", progCount.rows[0].count);
    } catch(e) {
      console.log("student_progress table doesn't exist or error:", e.message);
    }

    // Check course_module_mapping
    try {
      const cmm = await client.execute("SELECT * FROM course_module_mapping LIMIT 10");
      console.log("\n=== COURSE_MODULE_MAPPING ===");
      cmm.rows.forEach(r => console.log(`  course: ${r.course_id} -> module: ${r.module_id} (order: ${r.order_index})`));
    } catch(e) {
      console.log("course_module_mapping error:", e.message);
    }

  } catch (e) {
    console.error(e);
  }
}

checkDB();
