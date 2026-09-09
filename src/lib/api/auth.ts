import { client, isTursoConfigured, dbConnectionFailed, setDbConnectionFailed } from '../turso';
import { encryptPassword } from '../crypto';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  password_encrypted: string;
  salary: number;
  permissions_json?: string;
}

const FALLBACK_USERS: UserRow[] = [
  { id: 'usr_ceo', name: 'CEO', email: 'ceo@cynexai.com', role: 'CEO', password_encrypted: encryptPassword('admin123'), salary: 150000 },
  { id: 'usr_ceo_eswar', name: 'Eswar Sudheer', email: 'eswarsudheer98@gmail.com', role: 'CEO', password_encrypted: encryptPassword('admin123'), salary: 150000 },
  { id: 'usr_admin', name: 'Admin', email: 'admin@cynexai.com', role: 'Admin', password_encrypted: encryptPassword('admin123'), salary: 100000 },
  { id: 'usr_admin_in', name: 'Admin IN', email: 'admin@cynexai.in', role: 'Admin', password_encrypted: encryptPassword('admin123'), salary: 100000 },
  { id: 'usr_manager', name: 'Manager', email: 'manager@cynexai.com', role: 'Manager', password_encrypted: encryptPassword('admin123'), salary: 85000 },
  { id: 'usr_manager_leonard', name: 'Leonard', email: 'leonard001@gmail.com', role: 'Manager', password_encrypted: encryptPassword('admin123'), salary: 85000 },
  { id: 'usr_sales', name: 'Sandeep', email: 'sandeep.cynexai@gmail.com', role: 'Sales/HR', password_encrypted: encryptPassword('Sandeep@142'), salary: 45000 },
  { id: 'usr_sales_default', name: 'Sales Exec', email: 'sales@cynexai.com', role: 'Sales/HR', password_encrypted: encryptPassword('admin123'), salary: 45000 },
  { id: 'usr_teacher', name: 'Teacher', email: 'teacher@cynexai.com', role: 'Teacher', password_encrypted: encryptPassword('admin123'), salary: 50000 },
  { id: 'usr_teacher_venkat', name: 'Venkateswar Reddy', email: 'venkateswarreddykatreddy29@gmail.com', role: 'Teacher', password_encrypted: encryptPassword('admin123'), salary: 50000 },
  { id: 'usr_student', name: 'Student', email: 'student@cynexai.com', role: 'Student', password_encrypted: encryptPassword('admin123'), salary: 0 },
  { id: 'usr_student_demo', name: 'Demo Student', email: 'demo@student.cynexai.com', role: 'Student', password_encrypted: encryptPassword('admin123'), salary: 0 },
  { id: 'usr_student_cai', name: 'CAI Student', email: 'cai0047@student.cynexai.com', role: 'Student', password_encrypted: encryptPassword('admin123'), salary: 0 },
  { id: 'usr_dm', name: 'Marketer', email: 'dm@cynexai.com', role: 'DM', password_encrypted: encryptPassword('admin123'), salary: 60000 },
  { id: 'usr_dm_leela', name: 'Leela', email: 'leela@gmail.com', role: 'DM', password_encrypted: encryptPassword('admin123'), salary: 60000 }
];

export const getUserByEmail = async (email: string) => {
  const normEmail = (email || '').trim().toLowerCase();
  
  if (isTursoConfigured && client && !dbConnectionFailed) {
    try {
      const result = await client.execute({
        sql: "SELECT id, name, email, role, password_encrypted, salary, permissions_json FROM users WHERE LOWER(email) = ?",
        args: [normEmail]
      });
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
    } catch (error: any) {
      console.warn("getUserByEmail: Turso Cloud query failed. Switching to local fallback mode.", error?.message || error);
      setDbConnectionFailed(true);
    }
  }
  
  // Fallback to local system accounts
  const fallback = FALLBACK_USERS.find(u => u.email.toLowerCase() === normEmail);
  if (fallback) {
    return fallback;
  }
  
  return null;
};
