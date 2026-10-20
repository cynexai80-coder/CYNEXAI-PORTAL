import { createClient } from '@libsql/client';

async function run() {
  const client = createClient({
    url: 'libsql://cynex-ai-cynexai.aws-ap-south-1.turso.io',
    authToken: process.env.VITE_TURSO_AUTH_TOKEN
  });

  const user = await client.execute("SELECT id FROM users WHERE email = 'Jyothikap0201@gmail.com'");
  console.log("User ID:", user.rows);

  const student = await client.execute("SELECT id, portal_login_email FROM students WHERE portal_login_email = 'Jyothikap0201@gmail.com'");
  console.log("Student ID:", student.rows);

  const courses = await client.execute("SELECT * FROM courses");
  console.log("Courses Table:", courses.rows);
}

run();
