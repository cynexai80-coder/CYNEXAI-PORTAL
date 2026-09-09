import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, DollarSign, CheckSquare, MessageCircle, User, LogOut, LayoutDashboard, Settings, BookOpen, Calendar, Video, Zap, Bot, Loader2, BarChart2, History, GraduationCap, TrendingUp, ChevronLeft } from 'lucide-react';
import { getCurrentUser, logout, getModuleAccess } from '../../lib/auth';
import { checkTeacherAssignment } from '../../lib/api/manager';
import { computeAccessiblePortals } from '../../lib/authUtils';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ALL_PAGES } from '../../lib/pageRegistry';
import { getRolePages } from '../../lib/api/rolePageAccess';

import { ROUTE_MODULE_MAP } from '../../lib/permissionsRegistry';

import { CynexLogo } from '../ui/CynexLogo';

type NavItem = { to: string, icon: any, label: string, section: string };

export const Sidebar: React.FC<{ onNavClick?: () => void, isMobile?: boolean, onToggleSidebar?: () => void }> = ({ onNavClick, isMobile, onToggleSidebar }) => {
  const user = getCurrentUser();
  const [accessLevels, setAccessLevels] = useState<string[]>(() => {
    if (!user) return [];
    if (user.role === 'CEO') return ['CEO', 'Manager', 'Teacher', 'Sales/HR', 'DM', 'Student'];
    return computeAccessiblePortals(user.role, false);
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!user) return false;
    if (user.role === 'CEO' || user.role === 'Manager') return false;
    return true;
  });
  const [extraNavItems, setExtraNavItems] = useState<NavItem[]>([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchAccess = async () => {
      const isTeacher = await checkTeacherAssignment(user.id);
      const levels = computeAccessiblePortals(user.role, isTeacher);
      setAccessLevels(levels);

      // Load extra pages granted via Role Page Access manager (additive only)
      const grantedKeys = new Set<string>(getRolePages(user.role));
      const extras: NavItem[] = ALL_PAGES
        .filter(p => grantedKeys.has(p.key))
        .map(p => ({ to: p.to, icon: p.icon, label: p.label, section: 'Extra Access' }));
      setExtraNavItems(extras);

      setLoading(false);
    };
    fetchAccess();
  }, [user?.id, user?.role]);

  if (!user) return null;

  // ── Hardcoded base nav per role (original logic, no duplicates) ──────────
  let allNavItems: NavItem[] = [];

  if (accessLevels.includes('Manager') && !accessLevels.includes('CEO')) {
    allNavItems.push(
      { to: '/manager',                  icon: LayoutDashboard, label: 'Manager Hub',      section: 'Manager' },
      { to: '/manager/courses',          icon: BookOpen,        label: 'Course CMS',       section: 'Manager' },
      { to: '/sales/pitch',              icon: BookOpen,        label: 'Sales Pitch',      section: 'Manager' },
      { to: '/sales/pipeline',           icon: Users,           label: 'CRM Pipeline',     section: 'Manager' },
      { to: '/sales/history',            icon: DollarSign,      label: 'Sales History',    section: 'Manager' },
      { to: '/manager/timetable',        icon: Calendar,        label: 'Timetable',        section: 'Manager' },
      { to: '/manager/students',         icon: GraduationCap,   label: 'Students',         section: 'Manager' },
      { to: '/manager/student-progress', icon: TrendingUp,      label: 'Student Progress', section: 'Manager' },
      { to: '/manager/users',            icon: Users,           label: 'Staff Mgmt',       section: 'Manager' },
      { to: '/manager/student-settings', icon: Settings,        label: 'Student Portal',   section: 'Manager' },
      { to: '/manager/gamification',     icon: Zap,             label: 'Game Config',      section: 'Manager' },
      { to: '/manager/reports',          icon: BarChart2,       label: 'Reports',          section: 'Manager' },
      { to: '/manager/tasks',            icon: CheckSquare,     label: 'Assign Tasks',     section: 'Manager' }
    );
  }

  if (accessLevels.includes('Teacher') && !accessLevels.includes('CEO')) {
    allNavItems.push(
      { to: '/teacher',             icon: LayoutDashboard, label: 'Teacher Hub', section: 'Teacher' },
      { to: '/teacher/courses',     icon: BookOpen,        label: 'Course CMS',  section: 'Teacher' },
      { to: '/teacher/timetable',   icon: Calendar,        label: 'Timetable',   section: 'Teacher' },
      { to: '/teacher/live',        icon: Video,           label: 'Live Stream', section: 'Teacher' },
      { to: '/teacher/cms',         icon: BookOpen,        label: 'AI Material Gen', section: 'Teacher' },
      { to: '/teacher/attendance',  icon: Users,           label: 'Attendance',  section: 'Teacher' },
      { to: '/teacher/student-progress', icon: TrendingUp, label: 'Student Progress', section: 'Teacher' },
      { to: '/teacher/tasks',       icon: CheckSquare,     label: 'Tasks',       section: 'Teacher' },
      { to: '/teacher/settings',    icon: Settings,        label: 'AI Settings', section: 'Teacher' }
    );
  }

  if (accessLevels.includes('DM') && !accessLevels.includes('CEO')) {
    allNavItems.push(
      { to: '/dm/dashboard', icon: LayoutDashboard, label: 'DM Hub',          section: 'Marketing' },
      { to: '/dm/courses',   icon: BookOpen,        label: 'Course CMS',      section: 'Marketing' },
      { to: '/dm/planner',   icon: Calendar,        label: 'Content Planner', section: 'Marketing' },
      { to: '/dm/tasks',     icon: CheckSquare,     label: 'Tasks',           section: 'Marketing' }
    );
  }

  if (accessLevels.includes('Sales/HR') && !accessLevels.includes('CEO')) {
    allNavItems.push(
      { to: '/sales/dashboard', icon: LayoutDashboard, label: 'Dashboard',    section: 'Sales & HR' },
      { to: '/sales/courses',   icon: BookOpen,        label: 'Course CMS',   section: 'Sales & HR' },
      { to: '/sales/pitch',     icon: BookOpen,        label: 'Sales Pitch',  section: 'Sales & HR' },
      { to: '/sales/pipeline',  icon: Users,           label: 'Pipeline',     section: 'Sales & HR' },
      { to: '/sales/tasks',     icon: CheckSquare,     label: 'Tasks',        section: 'Sales & HR' }
    );
  }

  if (accessLevels.includes('CEO')) {
    allNavItems.push(
      { to: '/ceo/dashboard',        icon: LayoutDashboard, label: 'Master View',       section: 'CEO' },
      { to: '/ceo/tasks',            icon: CheckSquare,     label: 'Tasks',             section: 'CEO' },
      { to: '/ceo/users',            icon: Users,           label: 'User Admin',        section: 'CEO' },
      { to: '/ceo/students',         icon: GraduationCap,   label: 'Students',          section: 'CEO' },
      { to: '/ceo/student-progress', icon: TrendingUp,      label: 'Student Progress',  section: 'CEO' },
      { to: '/ceo/courses',          icon: BookOpen,        label: 'Course CMS',        section: 'CEO' },
      { to: '/ceo/timetable',        icon: Calendar,        label: 'Timetable',         section: 'CEO' },
      { to: '/ceo/sales-dashboard',  icon: DollarSign,      label: 'Sales Hub',         section: 'CEO' },
      { to: '/ceo/sales-pipeline',   icon: Users,           label: 'CRM Pipeline',      section: 'CEO' },
      { to: '/ceo/history',          icon: History,         label: 'Master History',    section: 'CEO' },
      { to: '/ceo/sales-pitch',      icon: BookOpen,        label: 'Sales Pitch',       section: 'CEO' },
      { to: '/ceo/dm-dashboard',     icon: LayoutDashboard, label: 'Marketing Hub',     section: 'CEO' },
      { to: '/ceo/ai-voice',         icon: Bot,             label: 'AI Voice Gen',      section: 'CEO' },
      { to: '/ceo/ai-settings',      icon: Settings,        label: 'AI Settings',       section: 'CEO' },
      { to: '/ceo/gamification',     icon: Zap,             label: 'Game Config',       section: 'CEO' },
      { to: '/ceo/student-settings', icon: Settings,        label: 'Student Portal',    section: 'CEO' },
      { to: '/ceo/reports',          icon: BarChart2,       label: 'Reports',           section: 'CEO' },
      { to: '/ceo/settings',         icon: Settings,        label: 'ERP Config',        section: 'CEO' }
    );
  }

  // Helper for dynamic module routes
  const SYSTEM_MODULE_NAV: Record<string, { label: string; icon: any; section: string; getRoute: (role: string) => string }> = {
    dashboard: { label: 'Dashboard & Master View', icon: LayoutDashboard, section: 'Core Navigation', getRoute: (r) => r === 'Manager' ? '/manager' : r === 'Teacher' ? '/teacher' : r === 'DM' ? '/dm/dashboard' : r === 'Sales/HR' ? '/sales/dashboard' : '/ceo/dashboard' },
    tasks: { label: 'Tasks & Task Center', icon: CheckSquare, section: 'Core Navigation', getRoute: (r) => r === 'Manager' ? '/manager/tasks' : r === 'Teacher' ? '/teacher/tasks' : r === 'DM' ? '/dm/tasks' : r === 'Sales/HR' ? '/sales/tasks' : '/ceo/tasks' },
    reports: { label: 'Performance Reports', icon: BarChart2, section: 'Analytics', getRoute: (r) => r === 'Manager' ? '/manager/reports' : '/ceo/reports' },
    sales: { label: 'Sales Hub & CRM Pipeline', icon: DollarSign, section: 'Sales & Growth', getRoute: (r) => r === 'Sales/HR' ? '/sales/pipeline' : '/ceo/sales-pipeline' },
    sales_history: { label: 'Sales & Master History', icon: History, section: 'Sales & Growth', getRoute: (r) => r === 'Sales/HR' ? '/sales/history' : '/ceo/history' },
    users: { label: 'User Admin & Staff Mgmt', icon: Users, section: 'Administration', getRoute: (r) => r === 'Manager' ? '/manager/users' : '/ceo/users' },
    students: { label: 'Students & Progress', icon: GraduationCap, section: 'Academic', getRoute: (r) => r === 'Manager' ? '/manager/students' : '/ceo/students' },
    courses: { label: 'Courses & Curriculum CMS', icon: BookOpen, section: 'Academic', getRoute: (r) => r === 'Manager' ? '/manager/courses' : r === 'Teacher' ? '/teacher/courses' : r === 'DM' ? '/dm/courses' : r === 'Sales/HR' ? '/sales/courses' : '/ceo/courses' },
    timetable: { label: 'Timetable & Scheduling', icon: Calendar, section: 'Academic', getRoute: (r) => r === 'Manager' ? '/manager/timetable' : r === 'Teacher' ? '/teacher/timetable' : '/ceo/timetable' },
    classes: { label: 'Live Classes & Attendance', icon: Video, section: 'Academic', getRoute: () => '/teacher/live' },
    marketing: { label: 'Marketing Hub & Planner', icon: Calendar, section: 'Marketing', getRoute: (r) => r === 'DM' ? '/dm/planner' : '/ceo/dm-dashboard' },
    ai_voice: { label: 'AI Voice & Settings', icon: Bot, section: 'AI Tools', getRoute: (r) => r === 'Teacher' ? '/teacher/settings' : '/ceo/ai-voice' },
    gamification: { label: 'Game Config & Rewards', icon: Zap, section: 'Engagement', getRoute: (r) => r === 'Manager' ? '/manager/gamification' : '/ceo/gamification' },
    settings: { label: 'System & ERP Settings', icon: Settings, section: 'Administration', getRoute: (r) => r === 'Manager' ? '/manager/student-settings' : '/ceo/student-settings' },
  };

  // Dynamically add any granted system modules not already present in allNavItems
  if (user.role !== 'CEO') {
    Object.entries(SYSTEM_MODULE_NAV).forEach(([modId, def]) => {
      const access = getModuleAccess(user, modId);
      if (access !== 'none') {
        const route = def.getRoute(user.role);
        if (!allNavItems.some(i => i.to === route)) {
          allNavItems.push({
            to: route,
            icon: def.icon,
            label: def.label,
            section: def.section
          });
        }
      }
    });
  }

  // Common elements for internal staff
  if (user.role !== 'Student') {
    allNavItems.push({ to: '/chat', icon: MessageCircle, label: 'Chat Center', section: 'Shared' });
  }

  // Append extra granted pages (deduplicated by route)
  const existingRoutes = new Set(allNavItems.map(i => i.to));
  const dedupedExtras = extraNavItems.filter(e => !existingRoutes.has(e.to));
  allNavItems = [...allNavItems, ...dedupedExtras];

  // Apply Advanced Access Control permission filtering for non-CEO users
  if (user.role !== 'CEO') {
    allNavItems = allNavItems.filter(item => {
      const moduleId = ROUTE_MODULE_MAP[item.to];
      if (!moduleId) return true;
      const access = getModuleAccess(user, moduleId);
      return access !== 'none';
    });
  }

  let portalName = "CynexAI CRM";
  if (accessLevels.includes('CEO')) portalName = "CEO Portal";
  else if (accessLevels.includes('Manager')) portalName = "Manager Hub";
  else if (accessLevels.includes('Teacher') && accessLevels.length === 1) portalName = "Teacher Portal";
  else if (accessLevels.includes('Student')) portalName = "Student Portal";
  else if (accessLevels.length > 1) portalName = "Staff Portal";

  // Group by section
  const groupedNavs = allNavItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <div className={`h-full flex flex-col ${isMobile ? '' : 'bg-erp-surface'}`}>
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between flex-shrink-0">
        <CynexLogo size="md" badge={portalName} />
        {onToggleSidebar && !isMobile && (
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex p-1.5 rounded-xl text-erp-text/50 hover:text-erp-text hover:bg-erp-surface transition-all border border-erp-border cursor-pointer shadow-sm"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className={isMobile ? '' : 'flex-1 overflow-y-auto py-4 px-4 space-y-6'}>
        {loading ? (
          <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-erp-primary" /></div>
        ) : (
          Object.entries(groupedNavs).map(([section, items]) => (
            <div key={section} className="space-y-2 mb-6">
              <div className="text-xs font-bold text-erp-text/50 uppercase mb-2 px-2 tracking-wider">
                {section}
              </div>
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavClick}
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black min-h-[44px] ${
                      isActive 
                        ? 'candy-btn-blue shadow-md' 
                        : 'text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-black/5 active:scale-95'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" strokeWidth={2.5} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))
        )}
      </div>

      <div className={`${isMobile ? 'mt-4 pt-4 border-t border-slate-200 dark:border-white/10' : 'p-4 border-t-2 border-erp-border'} space-y-1`}>
        <ThemeToggle variant="sidebar" />
        <NavLink
          to="/profile"
          onClick={onNavClick}
          className={({ isActive }) => 
            `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black min-h-[44px] ${
              isActive 
                ? 'candy-btn-blue shadow-md' 
                : 'text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-black/5 active:scale-95'
            }`
          }
        >
          <User className="w-5 h-5" strokeWidth={2.5} />
          Profile
        </NavLink>
        <button
          onClick={() => { logout(); onNavClick?.(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 min-h-[44px]"
        >
          <LogOut className="w-5 h-5" strokeWidth={2.5} />
          Log Out
        </button>
      </div>
    </div>
  );
};
