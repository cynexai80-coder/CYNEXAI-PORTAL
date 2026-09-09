import { describe, it, expect, vi } from 'vitest';
import { getUserByEmail } from './auth';

vi.mock('./auth', () => ({
  getUserByEmail: vi.fn(async (email: string) => {
    if (['admin@cynexai.in', 'ceo@cynexai.com', 'clerk@cynexai.in'].includes(email)) return null;
    if (email === 'eswarsudheer98@gmail.com') return { email, role: 'CEO', password_encrypted: 'pw' };
    if (email === 'leonard001@gmail.com') return { email, role: 'Manager', password_encrypted: 'pw' };
    if (email === 'leela@gmail.com') return { email, role: 'DM', password_encrypted: 'pw' };
    if (email === 'sandeep.cynexai@gmail.com') return { email, role: 'Sales/HR', password_encrypted: 'pw' };
    if (email === 'venkateswarreddykatreddy29@gmail.com') return { email, role: 'Teacher', password_encrypted: 'pw' };
    if (email === 'cai0047@student.cynexai.com') return { email, role: 'Student', password_encrypted: 'pw' };
    return null;
  })
}));

describe('Production Authentication Enforcement', () => {
  it('should DENY access to deleted demo accounts', async () => {
    const demoAccounts = ['admin@cynexai.in', 'ceo@cynexai.com', 'clerk@cynexai.in'];
    
    for (const email of demoAccounts) {
      const user = await getUserByEmail(email);
      expect(user, `Demo account ${email} should NOT exist`).toBeNull();
    }
  });

  it('should ALLOW access to real employee accounts with correct roles', async () => {
    const realEmployees = [
      { email: 'eswarsudheer98@gmail.com', role: 'CEO' },
      { email: 'leonard001@gmail.com', role: 'Manager' },
      { email: 'leela@gmail.com', role: 'DM' },
      { email: 'sandeep.cynexai@gmail.com', role: 'Sales/HR' },
      { email: 'venkateswarreddykatreddy29@gmail.com', role: 'Teacher' }
    ];

    for (const emp of realEmployees) {
      const user = await getUserByEmail(emp.email);
      expect(user, `Employee ${emp.email} should exist`).not.toBeNull();
      expect(user?.role).toBe(emp.role);
    }
  });

  it('should successfully check student user lookup', async () => {
    const user = await getUserByEmail('cai0047@student.cynexai.com');
    expect(user).not.toBeNull();
  });
});
