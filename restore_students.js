import { createClient } from '@libsql/client';
import xlsx from 'xlsx';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const db = createClient({ 
  url: process.env.VITE_TURSO_DATABASE_URL,
  authToken: process.env.VITE_TURSO_AUTH_TOKEN
});

const workbook = xlsx.readFile('Student_Data.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);

// function to encrypt password, matching our logic
function encryptPassword(password) {
  try {
    const SECRET_KEY = process.env.VITE_APP_SECRET;
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(String(SECRET_KEY)).digest('base64').substring(0, 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    return password;
  }
}

async function run() {
  let restored = 0;
  for (const row of data) {
    if (!row['ID'] || !row['Names'] || !row['Gmails']) continue;
    if (row['ID'] === 'ID') continue;

    const email = row['Gmails'].trim();
    const name = row['Names'].trim();
    
    // skip geethanjali and venkat if they exist
    if (email.toLowerCase().includes('geethanjali') || email.toLowerCase().includes('venkat')) {
        continue;
    }

    const userId = `usr_${row['ID']}`;
    const encPw = encryptPassword('cynex123');

    try {
      // Check if user exists
      const userRes = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
      if (userRes.rows.length === 0) {
        // Insert user
        await db.execute({
          sql: "INSERT INTO users (id, name, email, phone, role, status, password_hash, password_encrypted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          args: [userId, name, email, row['Phone number'] ? String(row['Phone number']) : '', 'Student', 'Active', encPw, encPw]
        });
        
        // Insert student
        const preferredMode = row['Timing'] && row['Timing'].toLowerCase().includes('offline') ? 'Offline' : 'Online';
        await db.execute({
          sql: "INSERT INTO students (id, onboarding_id, student_code, portal_login_email, status, preferred_mode) VALUES (?, ?, ?, ?, ?, ?)",
          args: [`stu_${row['ID']}`, `onb_${row['ID']}`, row['ID'], email, 'Onboarded', preferredMode]
        });
        restored++;
        console.log(`Restored ${name} (${email})`);
      }
    } catch (e) {
      console.error(`Failed to restore ${name}:`, e);
    }
  }
  
  console.log(`Done. Restored ${restored} students.`);
}

run().catch(console.error);
