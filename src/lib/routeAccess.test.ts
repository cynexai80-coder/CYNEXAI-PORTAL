import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getModuleAccess } from './auth';
import type { User } from './auth';
import {
  ROUTE_MODULE_MAP, SYSTEM_MODULES, decideRouteAccess, getModuleRoute, hasExplicitPermissions, normalisePath,
} from './permissionsRegistry';

const user = (role: User['role'], permissions_json?: string): User => ({ id: `u_${role}`, name: role, email: `${role}@x.test`, role, permissions_json });

/** Same call RequireAuth makes. `allowedRoles` is what the route's wrapper in App.tsx declares. */
const can = (u: User, pathname: string, allowedRoles?: string[], extraPortals: string[] = []) =>
  decideRouteAccess({
    role: u.role,
    pathname,
    allowedRoles,
    accessLevels: [u.role, ...extraPortals],
    explicitPermissions: hasExplicitPermissions(u.permissions_json),
    moduleAccess: id => getModuleAccess(u, id),
  });

const MANAGER = ['Manager', 'CEO'];
const CEO_ONLY = ['CEO'];
const TEACHER_AREA = ['Teacher', 'Manager', 'CEO'];
const SALES_AREA = ['Sales/HR', 'Manager', 'CEO'];
const DM_AREA = ['DM', 'Manager', 'CEO'];

describe('normalisePath', () => {
  it('lower-cases and drops trailing slashes, query and hash', () => {
    expect(normalisePath('/Manager/Certificates/')).toBe('/manager/certificates');
    expect(normalisePath('/manager/certificates//')).toBe('/manager/certificates');
    expect(normalisePath('/ceo/users?tab=1#x')).toBe('/ceo/users');
    expect(normalisePath('/')).toBe('/');
    expect(normalisePath('')).toBe('/');
  });
});

describe('decideRouteAccess with role defaults (no permissions_json)', () => {
  it('lets each role open its own pages', () => {
    expect(can(user('Teacher'), '/teacher', TEACHER_AREA)).toBe(true);
    expect(can(user('Teacher'), '/teacher/tasks', TEACHER_AREA)).toBe(true);
    expect(can(user('Manager'), '/manager/users', MANAGER)).toBe(true);
    expect(can(user('Manager'), '/manager/reports', MANAGER)).toBe(true);
    expect(can(user('Sales/HR'), '/sales/pipeline', SALES_AREA)).toBe(true);
    expect(can(user('DM'), '/dm/planner', DM_AREA)).toBe(true);
  });

  it('does NOT let a staff role open another role\'s dashboard or task pages (the 66-page leak)', () => {
    const teacher = user('Teacher'), sales = user('Sales/HR'), dm = user('DM'), manager = user('Manager');
    for (const [u, pages] of [
      [teacher, [['/ceo/dashboard', CEO_ONLY], ['/manager', MANAGER], ['/sales/dashboard', SALES_AREA], ['/dm/dashboard', DM_AREA], ['/ceo/tasks', CEO_ONLY], ['/ceo/ai-voice', CEO_ONLY]]],
      [sales, [['/ceo/dashboard', CEO_ONLY], ['/manager', MANAGER], ['/teacher', TEACHER_AREA], ['/ceo/history', CEO_ONLY], ['/ceo/sales-dashboard', CEO_ONLY]]],
      [dm, [['/manager', MANAGER], ['/teacher', TEACHER_AREA], ['/ceo/dm-dashboard', CEO_ONLY], ['/sales/dashboard', SALES_AREA]]],
      [manager, [['/ceo/users', CEO_ONLY], ['/ceo/settings', CEO_ONLY], ['/ceo/students', CEO_ONLY], ['/ceo/history', CEO_ONLY], ['/ceo/sales-pipeline', CEO_ONLY], ['/ceo/reports', CEO_ONLY]]],
    ] as [User, [string, string[]][]][]) {
      for (const [p, roles] of pages) expect(can(u, p, roles), `${u.role} -> ${p}`).toBe(false);
    }
  });

  it('keeps a module that is off for the role closed, also with a trailing slash or other capitalisation', () => {
    const manager = user('Manager'); // default modules do not include certificates / marketing / ai_voice
    for (const p of ['/manager/certificates', '/manager/certificates/', '/Manager/Certificates', '/MANAGER/CERTIFICATES/']) {
      expect(can(manager, p, MANAGER), p).toBe(false);
    }
    expect(can(manager, '/dm/planner/', DM_AREA)).toBe(false);
    expect(can(manager, '/DM/planner', DM_AREA)).toBe(false);
    expect(can(manager, '/teacher/settings/', TEACHER_AREA)).toBe(false);
    for (const p of ['/teacher/student-progress', '/teacher/student-progress/', '/Teacher/Student-Progress']) {
      expect(can(user('Teacher'), p, TEACHER_AREA), p).toBe(false);
    }
  });

  it('applies the route\'s role list to pages without a module, whatever the spelling', () => {
    expect(can(user('Sales/HR'), '/manager/approvals/sal_1', MANAGER)).toBe(false);
    expect(can(user('Teacher'), '/Manager/Approvals/sal_1/', MANAGER)).toBe(false);
    expect(can(user('Manager'), '/manager/approvals/sal_1', MANAGER)).toBe(true);
  });

  it('refuses Student and Admin everywhere in the staff areas', () => {
    for (const u of [user('Student'), user('Admin')]) {
      for (const [p, roles] of [['/manager', MANAGER], ['/ceo/dashboard', CEO_ONLY], ['/teacher', TEACHER_AREA], ['/sales/pipeline', SALES_AREA], ['/dm/dashboard', DM_AREA]] as [string, string[]][]) {
        expect(can(u, p, roles), `${u.role} -> ${p}`).toBe(false);
      }
    }
    expect(can(user('Student'), '/student/classes', ['Student'])).toBe(true);
    expect(can(user('Admin'), '/admin', ['Admin', 'CEO'])).toBe(true);
    expect(can(user('Student'), '/admin', ['Admin', 'CEO'])).toBe(false);
  });

  it('gives the CEO everything', () => {
    for (const p of ['/ceo/settings', '/manager/certificates/', '/student/classes', '/teacher']) expect(can(user('CEO'), p, ['Nobody'])).toBe(true);
  });

  it('opens Teacher-area pages for a non-teacher role that has the Teacher portal', () => {
    expect(can(user('Sales/HR'), '/teacher/presentation-view', TEACHER_AREA)).toBe(false);
    expect(can(user('Sales/HR'), '/teacher/presentation-view', TEACHER_AREA, ['Teacher'])).toBe(true);
  });
});

describe('decideRouteAccess with explicit permissions (set by the CEO)', () => {
  it('adds only the module\'s own page for the role, not the whole area', () => {
    const sales = user('Sales/HR', JSON.stringify({ users: 'full', dashboard: 'full' }));
    expect(can(sales, '/ceo/users', CEO_ONLY)).toBe(true);
    expect(can(sales, '/ceo/users/', CEO_ONLY)).toBe(true);
    expect(can(sales, '/manager/users', MANAGER)).toBe(false); // not the menu page for this role
    expect(can(sales, '/ceo/settings', CEO_ONLY)).toBe(false); // settings module not granted
    expect(can(sales, '/ceo/dashboard', CEO_ONLY)).toBe(false); // its dashboard is /sales/dashboard
    expect(can(sales, '/sales/dashboard', SALES_AREA)).toBe(true);
  });

  it('lets an explicit "none" close a page the role would otherwise reach', () => {
    const manager = user('Manager', JSON.stringify({ dashboard: 'full', users: 'none' }));
    expect(can(manager, '/manager/users', MANAGER)).toBe(false);
    expect(can(manager, '/manager/users/', MANAGER)).toBe(false);
    expect(can(manager, '/Manager', MANAGER)).toBe(true);
  });

  it('treats unparsable permissions as role defaults', () => {
    expect(hasExplicitPermissions('{not json')).toBe(false);
    expect(hasExplicitPermissions('')).toBe(false);
    expect(hasExplicitPermissions(undefined)).toBe(false);
    expect(hasExplicitPermissions('{"users":"full"}')).toBe(true);
  });
});

describe('route table consistency (App.tsx)', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');
  const routes = new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map(m => normalisePath(m[1])));

  it('has a page for every route the permission map names', () => {
    const missing = Object.keys(ROUTE_MODULE_MAP).filter(r => !routes.has(normalisePath(r)));
    expect(missing).toEqual([]);
  });

  it('has a page for every menu link a module can produce (this caught "Reports" -> /manager/reports)', () => {
    const missing: string[] = [];
    for (const m of SYSTEM_MODULES) for (const role of ['CEO', 'Manager', 'Teacher', 'DM', 'Sales/HR']) {
      const r = getModuleRoute(m.id, role);
      if (r && !routes.has(normalisePath(r))) missing.push(`${m.id}/${role} -> ${r}`);
    }
    expect(missing).toEqual([]);
  });

  it('keeps the module-route table lower-case (lookups are normalised)', () => {
    expect(Object.keys(ROUTE_MODULE_MAP).filter(k => k !== k.toLowerCase())).toEqual([]);
  });

  it('keeps the Chat Center staff-only', () => {
    const chatRoute = app.split('\n').find(l => l.includes('path="/chat"')) || '';
    expect(chatRoute).toContain('ChatLayout');
    const layout = (app.match(/const ChatLayout[\s\S]*?\n\);/) || [''])[0];
    expect(layout).toContain('allowedRoles');
    expect(layout).not.toMatch(/'Student'|'Admin'/);
  });
});
