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
  { id: 'courses',       label: 'Courses & Curriculum CMS',  category: 'Academic',        description: 'Course builder, module/class editor, and sales pitches' },
  { id: 'timetable',     label: 'Timetable & Scheduling',    category: 'Academic',        description: 'Class schedules, timetable slots, and instructor timing' },
  { id: 'classes',       label: 'Live Classes & Attendance', category: 'Academic',        description: 'Live class streaming, QR check-ins, & student attendance' },
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

  // Live Classes & Attendance
  '/teacher/live': 'classes',
  '/teacher/attendance': 'classes',

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
