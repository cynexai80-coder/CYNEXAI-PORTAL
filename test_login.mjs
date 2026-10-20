import { createClient } from '@libsql/client';
import CryptoJS from 'crypto-js';

const url = "libsql://cynex-ai-cynexai.aws-ap-south-1.turso.io";
const authToken = process.env.VITE_TURSO_AUTH_TOKEN;
const SECRET_KEY = process.env.VITE_APP_SECRET;

const client = createClient({ url, authToken });

async function test() {
  try {
    try { await client.execute("ALTER TABLE users ADD COLUMN password_encrypted TEXT"); } catch(e) {}
    try { await client.execute("ALTER TABLE users ADD COLUMN salary REAL"); } catch(e) {}
    try { await client.execute("ALTER TABLE users ADD COLUMN avatar TEXT"); } catch(e) {}

    const res = await client.execute("SELECT COUNT(*) as count FROM users");
    console.log("Users count:", res.rows[0].count);
    
    // Seed test
    const defaultUsers = [
        { id: 'usr_sales', name: 'Sandeep', email: 'sandeep.cynexai@gmail.com', password: 'Sandeep@142', role: 'Sales/HR', salary: 45000 },
        { id: 'usr_manager', name: 'Manager', email: 'manager@cynexai.com', password: 'admin123', role: 'Manager', salary: 85000 },
        { id: 'usr_ceo', name: 'CEO', email: 'ceo@cynexai.com', password: 'admin123', role: 'CEO', salary: 150000 },
        { id: 'usr_dm', name: 'Marketer', email: 'dm@cynexai.com', password: 'admin123', role: 'DM', salary: 60000 },
        { id: 'usr_teacher', name: 'Teacher', email: 'teacher@cynexai.com', password: 'admin123', role: 'Teacher', salary: 50000 },
        { id: 'usr_student', name: 'Student', email: 'student@cynexai.com', password: 'admin123', role: 'Student', salary: 0 }
    ];
    for (const u of defaultUsers) {
        // Only insert if email doesn't exist
        const check = await client.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [u.email] });
        if (check.rows.length === 0) {
            await client.execute({
                sql: `INSERT INTO users (id, name, email, password_encrypted, password_hash, role, salary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [u.id, u.name, u.email, CryptoJS.AES.encrypt(u.password, SECRET_KEY).toString(), 'hash', u.role, u.salary, new Date().toISOString()]
            });
            console.log("Seeded:", u.email);
        } else {
            await client.execute({
                sql: `UPDATE users SET password_encrypted = ?, salary = ? WHERE email = ?`,
                args: [CryptoJS.AES.encrypt(u.password, SECRET_KEY).toString(), u.salary, u.email]
            });
            console.log("Updated:", u.email);
        }
    }
    
    console.log("Database patch completed.");
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
