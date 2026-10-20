// Page titles for the logged-in portal. Without these every portal route shares the same <title>,
// so screen-reader users and browser history cannot tell pages apart (WCAG 2.4.2).

const EXACT: Record<string, string> = {
  '/login': 'Sign in',
  '/pay': 'Make a Payment',
  '/enroll': 'Enroll',
  '/profile': 'Profile & Settings',
  '/chat': 'WhatsApp Center',
  '/admin': 'Blog Management',
  '/admin/dashboard': 'Admin Dashboard',
  '/manager': 'Manager Hub',
  '/teacher': 'Teacher Portal',
  '/student': 'Student Dashboard',
  '/student/classes': 'Class Modules',
  '/student/quizzes': 'Quizzes & Code Studio',
  '/student/class-flow': 'Class',
  '/student/interview': 'AI Mock Interview',
  '/student/attendance': 'Attendance Check-in',
  '/student/career': 'Career Center',
  '/teacher/cms': 'Course CMS',
  '/teacher/live': 'Live Stream',
  '/teacher/presentation-view': 'Presentation',
  '/teacher/settings': 'AI Slide Settings',
  '/teacher/timetable': 'My Timetable',
  '/sales/pitch': 'Sales Pitch',
  '/sales/pipeline': 'CRM Pipeline',
  '/sales/leads/new': 'New Lead',
  '/sales/history': 'Master History & Audit Logs',
  '/sales/dashboard': 'Sales Dashboard',
  '/dm/dashboard': 'Marketing Hub',
  '/dm/planner': 'Content Planner',
  '/ceo/dashboard': 'CEO Dashboard',
  '/ceo/settings': 'Global Settings',
  '/ceo/ai-voice': 'AI Voice Settings',
  '/ceo/ai-settings': 'AI Slide Settings',
  '/ceo/reports': 'Performance Reports',
  '/manager/reports': 'Performance Reports',
  '/ceo/sales-dashboard': 'Sales Dashboard',
  '/ceo/sales-pipeline': 'CRM Pipeline',
  '/ceo/sales-pitch': 'Sales Pitch',
  '/ceo/history': 'Master History & Audit Logs',
  '/ceo/dm-dashboard': 'Marketing Hub',
  '/manager/users': 'Staff Management',
  '/ceo/users': 'Staff Management',
  '/manager/timetable': 'Global Scheduler',
  '/ceo/timetable': 'Global Scheduler',
  '/manager/student-settings': 'Student Portal Settings',
  '/ceo/student-settings': 'Student Portal Settings',
};

// Role-agnostic pages (/sales|manager|dm|ceo|teacher + suffix) and parameterised routes, most specific first.
const PATTERNS: Array<[RegExp, string]> = [
  [/^\/(?:sales|manager|dm|ceo|teacher)\/courses\/[^/]+\/modules\/[^/]+\/classes\/[^/]+$/, 'Class Editor'],
  [/^\/(?:sales|manager|dm|ceo|teacher)\/courses\/[^/]+\/modules\/[^/]+$/, 'Module Editor'],
  [/^\/(?:sales|manager|dm|ceo|teacher)\/courses$/, 'Course Management'],
  [/^\/(?:sales|manager|dm|ceo|teacher)\/tasks$/, 'My Tasks'],
  [/^\/(?:manager|ceo|teacher)\/gamification$/, 'Gamification Controls'],
  [/^\/(?:manager|ceo)\/students$/, 'Student Directory'],
  [/^\/(?:manager|ceo|teacher)\/student-progress$/, 'Student Progress'],
  [/^\/(?:manager|ceo)\/certificates$/, 'Certificate Management'],
  [/^\/(?:manager|ceo|teacher)\/attendance$/, 'Batch Attendance'],
  [/^\/manager\/approvals\/[^/]+$/, 'Sale Approval'],
  [/^\/manager\/assign-batch\/[^/]+$/, 'Assign Batch'],
  [/^\/sales\/leads\/[^/]+$/, 'Lead Profile'],
  [/^\/student\/assessment\/[^/]+$/, 'Assessment'],
  [/^\/student\/module\/[^/]+$/, 'Module'],
  [/^\/test(?:\/.*)?$/, 'Assessment Test'],
  [/^\/apply\/[^/]+$/, 'Apply for a Course'],
];

/** Title for a portal route, or null when the path is not a known portal page. */
export function portalTitleFor(pathname: string): string | null {
  const path = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  const exact = EXACT[path.toLowerCase()];
  if (exact) return exact;
  for (const [re, title] of PATTERNS) if (re.test(path)) return title;
  return null;
}
