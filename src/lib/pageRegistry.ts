import {
  LayoutDashboard, BookOpen, Users, DollarSign, Calendar, GraduationCap,
  TrendingUp, Settings, Zap, BarChart2, CheckSquare, Video, MessageCircle,
  Bot, History, type LucideIcon
} from 'lucide-react';

export interface PageDef {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
  section: string;
  defaultRoles: string[];
}

export const ALL_PAGES: PageDef[] = [
  // Manager pages
  { key: 'manager/hub',       to: '/manager',                  label: 'Manager Hub',       icon: LayoutDashboard, section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/courses',   to: '/manager/courses',          label: 'Course CMS',        icon: BookOpen,        section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/timetable', to: '/manager/timetable',        label: 'Timetable',         icon: Calendar,        section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/students',  to: '/manager/students',         label: 'Students',          icon: GraduationCap,   section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/progress',  to: '/manager/student-progress', label: 'Student Progress',  icon: TrendingUp,      section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/users',     to: '/manager/users',            label: 'Staff Mgmt',        icon: Users,           section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/portal',    to: '/manager/student-settings', label: 'Student Portal',    icon: Settings,        section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/game',      to: '/manager/gamification',     label: 'Game Config',       icon: Zap,             section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/reports',   to: '/manager/reports',          label: 'Reports',           icon: BarChart2,       section: 'Manager',    defaultRoles: ['Manager'] },
  { key: 'manager/tasks',     to: '/manager/tasks',            label: 'Assign Tasks',      icon: CheckSquare,     section: 'Manager',    defaultRoles: ['Manager'] },

  // Teacher pages
  { key: 'teacher/hub',       to: '/teacher',             label: 'Teacher Hub',   icon: LayoutDashboard, section: 'Teacher',    defaultRoles: ['Teacher'] },
  { key: 'teacher/timetable', to: '/teacher/timetable',   label: 'Timetable',     icon: Calendar,        section: 'Teacher',    defaultRoles: ['Teacher'] },
  { key: 'teacher/live',      to: '/teacher/live',        label: 'Live Stream',   icon: Video,           section: 'Teacher',    defaultRoles: ['Teacher'] },
  { key: 'teacher/cms',       to: '/teacher/cms',         label: 'Course CMS',    icon: BookOpen,        section: 'Teacher',    defaultRoles: ['Teacher'] },
  { key: 'teacher/attendance',to: '/teacher/attendance',  label: 'Attendance',    icon: Users,           section: 'Teacher',    defaultRoles: ['Teacher'] },
  { key: 'teacher/progress',  to: '/teacher/student-progress', label: 'Student Progress', icon: TrendingUp, section: 'Teacher', defaultRoles: ['Teacher', 'Manager', 'CEO'] },
  { key: 'teacher/tasks',     to: '/teacher/tasks',       label: 'Tasks',         icon: CheckSquare,     section: 'Teacher',    defaultRoles: ['Teacher'] },
  { key: 'teacher/settings',  to: '/teacher/settings',    label: 'AI Settings',   icon: Settings,        section: 'Teacher',    defaultRoles: ['Teacher'] },

  // DM pages
  { key: 'dm/hub',            to: '/dm/dashboard',        label: 'DM Hub',            icon: LayoutDashboard, section: 'Marketing', defaultRoles: ['DM'] },
  { key: 'dm/planner',        to: '/dm/planner',          label: 'Content Planner',   icon: Calendar,        section: 'Marketing', defaultRoles: ['DM'] },
  { key: 'dm/tasks',          to: '/dm/tasks',            label: 'Tasks',             icon: CheckSquare,     section: 'Marketing', defaultRoles: ['DM'] },

  // Sales/HR pages
  { key: 'sales/hub',         to: '/sales/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, section: 'Sales & HR', defaultRoles: ['Sales/HR'] },
  { key: 'sales/pitch',       to: '/sales/pitch',         label: 'Sales Pitch',   icon: BookOpen,        section: 'Sales & HR', defaultRoles: ['Sales/HR', 'Manager', 'CEO'] },
  { key: 'sales/pipeline',    to: '/sales/pipeline',      label: 'CRM Pipeline',  icon: Users,           section: 'Sales & HR', defaultRoles: ['Sales/HR', 'Manager', 'CEO'] },
  { key: 'sales/history',     to: '/sales/history',       label: 'Sales History', icon: DollarSign,      section: 'Sales & HR', defaultRoles: ['Sales/HR', 'Manager', 'CEO'] },
  { key: 'sales/tasks',       to: '/sales/tasks',         label: 'Tasks',         icon: CheckSquare,     section: 'Sales & HR', defaultRoles: ['Sales/HR'] },

  // CEO pages
  { key: 'ceo/hub',           to: '/ceo/dashboard',        label: 'Master View',       icon: LayoutDashboard, section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/tasks',         to: '/ceo/tasks',            label: 'Tasks',             icon: CheckSquare,     section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/users',         to: '/ceo/users',            label: 'User Admin',        icon: Users,           section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/students',      to: '/ceo/students',         label: 'Students',          icon: GraduationCap,   section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/progress',      to: '/ceo/student-progress', label: 'Student Progress',  icon: TrendingUp,      section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/courses',       to: '/ceo/courses',          label: 'Course CMS',        icon: BookOpen,        section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/timetable',     to: '/ceo/timetable',        label: 'Timetable',         icon: Calendar,        section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/sales-hub',     to: '/ceo/sales-dashboard',  label: 'Sales Hub',         icon: DollarSign,      section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/crm',           to: '/ceo/sales-pipeline',   label: 'CRM Pipeline',      icon: Users,           section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/history',       to: '/ceo/history',          label: 'Master History',    icon: History,         section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/dm',            to: '/ceo/dm-dashboard',     label: 'Marketing Hub',     icon: LayoutDashboard, section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/ai-voice',      to: '/ceo/ai-voice',         label: 'AI Voice Gen',      icon: Bot,             section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/portal',        to: '/ceo/student-settings', label: 'Student Portal',    icon: Settings,        section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/reports',       to: '/ceo/reports',          label: 'Reports',           icon: BarChart2,       section: 'CEO', defaultRoles: ['CEO'] },
  { key: 'ceo/settings',      to: '/ceo/settings',         label: 'ERP Config',        icon: Settings,        section: 'CEO', defaultRoles: ['CEO'] },

  // Shared
  { key: 'shared/chat',       to: '/chat',                 label: 'Chat Center',       icon: MessageCircle,   section: 'Shared', defaultRoles: ['CEO', 'Manager', 'Teacher', 'Sales/HR', 'DM'] },
];

// Returns the default page keys for a given role
export const getDefaultPagesForRole = (role: string): string[] =>
  ALL_PAGES.filter(p => p.defaultRoles.includes(role)).map(p => p.key);
