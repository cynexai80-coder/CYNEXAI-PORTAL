export type AccessLevel = 'none' | 'view' | 'full';

export interface ModuleDefinition {
  id: string;
  label: string;
  category: string;
  description: string;
}

export const SYSTEM_MODULES: ModuleDefinition[] = [
  { id: 'dashboard',     label: 'Dashboard & Master View',   category: 'Core Navigation', description: 'Executive dashboard, master view, and hub overviews' },
  { id: 'tasks',         label: 'Tasks & Task Center',       category: 'Core Navigation', description: 'Daily task auto-repeat, task assignment, and Asana board' },
  { id: 'reports',       label: 'Performance Reports',      category: 'Analytics',       description: 'Staff performance reports, project hierarchy, & metrics' },
  { id: 'sales',         label: 'Sales Hub & CRM Pipeline',  category: 'Sales & Growth',  description: 'Sales dashboard, lead pipeline, deal stages & conversions' },
  { id: 'sales_history', label: 'Sales & Master History',    category: 'Sales & Growth',  description: 'Sales transactions, payment history, and master logs' },
  { id: 'users',         label: 'User Admin & Staff Mgmt',   category: 'Administration',  description: 'Manage staff, roles, salaries, and access controls' },
  { id: 'students',      label: 'Students & Progress',       category: 'Academic',        description: 'Student directory, batch management, and progress logs' },
  { id: 'certificates',  label: 'Certificates & QR Engine',  category: 'Academic',        description: 'Issue certificates, permanent non-expiring QR code stamping & registry' },
  { id: 'attendance',    label: 'Attendance & Matrix System', category: 'Academic',       description: 'Batch attendance matrix, QR check-ins, and student attendance logs' },
  { id: 'courses',       label: 'Courses & Curriculum CMS',  category: 'Academic',        description: 'Course builder, module/class editor, and sales pitches' },
  { id: 'timetable',     label: 'Timetable & Scheduling',    category: 'Academic',        description: 'Class schedules, timetable slots, and instructor timing' },
  { id: 'classes',       label: 'Live Classes & Streaming',  category: 'Academic',        description: 'Live classroom streaming, video lectures, and sessions' },
  { id: 'marketing',     label: 'Marketing Hub & Planner',   category: 'Marketing',       description: 'Digital marketing dashboard and content planner' },
  { id: 'ai_voice',      label: 'AI Voice & Mock Interview', category: 'AI Tools',        description: 'Voice AI interviewer settings, TTS, and AI prompts' },
  { id: 'gamification',  label: 'Game Config & Rewards',     category: 'Engagement',      description: 'Coins, streaks, badges, and leaderboard settings' },
  { id: 'settings',      label: 'System & ERP Settings',     category: 'Administration',  description: 'Global portal settings, student portal config, & ERP rules' },
];

export const ROUTE_MODULE_MAP: Record<string, string> = {
  // Dashboard
  '/ceo/dashboard': 'dashboard',
  '/manager': 'dashboard',
  '/teacher': 'dashboard',
  '/sales/dashboard': 'dashboard',
  '/dm/dashboard': 'dashboard',

  // Tasks
  '/ceo/tasks': 'tasks',
  '/manager/tasks': 'tasks',
  '/teacher/tasks': 'tasks',
  '/dm/tasks': 'tasks',
  '/sales/tasks': 'tasks',

  // Reports
  '/ceo/reports': 'reports',
  '/manager/reports': 'reports',

  // Sales Hub & CRM Pipeline
  '/ceo/sales-dashboard': 'sales',
  '/ceo/sales-pipeline': 'sales',
  '/sales/pipeline': 'sales',

  // Sales History & Master History
  '/ceo/history': 'sales_history',
  '/sales/history': 'sales_history',

  // User Admin
  '/ceo/users': 'users',
  '/manager/users': 'users',

  // Students & Progress
  '/ceo/students': 'students',
  '/ceo/student-progress': 'students',
  '/manager/students': 'students',
  '/manager/student-progress': 'students',
  '/teacher/student-progress': 'students',

  // Certificates
  '/ceo/certificates': 'certificates',
  '/manager/certificates': 'certificates',

  // Courses & Curriculum CMS
  '/ceo/courses': 'courses',
  '/manager/courses': 'courses',
  '/teacher/courses': 'courses',
  '/teacher/cms': 'courses',
  '/sales/courses': 'courses',
  '/dm/courses': 'courses',
  '/sales/pitch': 'courses',
  '/ceo/sales-pitch': 'courses',

  // Timetable
  '/ceo/timetable': 'timetable',
  '/manager/timetable': 'timetable',
  '/teacher/timetable': 'timetable',

  // Live Classes & Streaming
  '/teacher/live': 'classes',

  // Attendance & Matrix System
  '/teacher/attendance': 'attendance',
  '/ceo/attendance': 'attendance',
  '/manager/attendance': 'attendance',

  // Marketing
  '/ceo/dm-dashboard': 'marketing',
  '/dm/planner': 'marketing',

  // AI Voice Settings
  '/ceo/ai-voice': 'ai_voice',
  '/ceo/ai-settings': 'ai_voice',
  '/teacher/settings': 'ai_voice',

  // Gamification
  '/ceo/gamification': 'gamification',
  '/manager/gamification': 'gamification',

  // Settings
  '/ceo/student-settings': 'settings',
  '/manager/student-settings': 'settings',
  '/ceo/settings': 'settings'
};

export const DEFAULT_PERMISSIONS: Record<string, AccessLevel> = SYSTEM_MODULES.reduce((acc, mod) => {
  acc[mod.id] = 'full';
  return acc;
}, {} as Record<string, AccessLevel>);

/** "/Manager/Certificates/" -> "/manager/certificates". The router matches paths case-insensitively and ignores a
 *  trailing slash, so every lookup keyed by path must be normalised the same way. */
export function normalisePath(pathname: string): string {
  const p = String(pathname || '/').toLowerCase().split(/[?#]/)[0];
  return p.length > 1 ? p.replace(/\/+$/, '') || '/' : p;
}

/** The page a module opens for a role: the link the sidebar shows when the user has that module. */
const MODULE_ROUTE: Record<string, (role: string) => string> = {
  dashboard:     r => r === 'Manager' ? '/manager' : r === 'Teacher' ? '/teacher' : r === 'DM' ? '/dm/dashboard' : r === 'Sales/HR' ? '/sales/dashboard' : '/ceo/dashboard',
  tasks:         r => r === 'Manager' ? '/manager/tasks' : r === 'Teacher' ? '/teacher/tasks' : r === 'DM' ? '/dm/tasks' : r === 'Sales/HR' ? '/sales/tasks' : '/ceo/tasks',
  reports:       r => r === 'Manager' ? '/manager/reports' : '/ceo/reports',
  sales:         r => r === 'Sales/HR' ? '/sales/pipeline' : '/ceo/sales-pipeline',
  sales_history: r => r === 'Sales/HR' ? '/sales/history' : '/ceo/history',
  users:         r => r === 'Manager' ? '/manager/users' : '/ceo/users',
  students:      r => r === 'Manager' ? '/manager/students' : '/ceo/students',
  certificates:  r => r === 'Manager' ? '/manager/certificates' : '/ceo/certificates',
  attendance:    r => r === 'CEO' ? '/ceo/attendance' : r === 'Manager' ? '/manager/attendance' : '/teacher/attendance',
  courses:       r => r === 'Manager' ? '/manager/courses' : r === 'Teacher' ? '/teacher/courses' : r === 'DM' ? '/dm/courses' : r === 'Sales/HR' ? '/sales/courses' : '/ceo/courses',
  timetable:     r => r === 'Manager' ? '/manager/timetable' : r === 'Teacher' ? '/teacher/timetable' : '/ceo/timetable',
  classes:       () => '/teacher/live',
  marketing:     r => r === 'DM' ? '/dm/planner' : '/ceo/dm-dashboard',
  ai_voice:      r => r === 'Teacher' ? '/teacher/settings' : '/ceo/ai-voice',
  gamification:  r => r === 'Manager' ? '/manager/gamification' : '/ceo/gamification',
  settings:      r => r === 'Manager' ? '/manager/student-settings' : '/ceo/student-settings',
};

export function getModuleRoute(moduleId: string, role: string): string | undefined {
  return MODULE_ROUTE[moduleId]?.(role);
}

/** True when the user carries a permissions_json the CEO set (as opposed to the role defaults). */
export function hasExplicitPermissions(permissionsJson?: string | null): boolean {
  if (!permissionsJson) return false;
  try { const v = JSON.parse(permissionsJson); return !!v && typeof v === 'object'; } catch { return false; }
}

/**
 * Decides whether a logged-in user may open a page. Rules:
 *  1. The CEO may open everything.
 *  2. Pages with no module are decided by the route's allowed roles alone.
 *  3. A module that is off for the user closes its pages, whatever the role list says.
 *  4. A role listed on the route may open it (module on).
 *  5. A module grant ADDS access only when the CEO set it explicitly (permissions_json), and only to that module's
 *     own page for the role (the sidebar link). Role defaults never open another role's pages.
 * The path is normalised first, so "/Manager/Certificates/" cannot slip past a lookup that "/manager/certificates" fails.
 */
export function decideRouteAccess(o: {
  role: string;
  pathname: string;
  allowedRoles?: string[];
  accessLevels: string[];
  explicitPermissions: boolean;
  moduleAccess: (moduleId: string) => AccessLevel;
}): boolean {
  if (o.role === 'CEO') return true;
  const path = normalisePath(o.pathname);
  const roleAllowed = o.allowedRoles ? o.allowedRoles.some(r => o.accessLevels.includes(r)) : true;
  const moduleId = ROUTE_MODULE_MAP[path];
  if (!moduleId) return roleAllowed;
  if (o.moduleAccess(moduleId) === 'none') return false;
  if (roleAllowed) return true;
  return o.explicitPermissions && getModuleRoute(moduleId, o.role) === path;
}
