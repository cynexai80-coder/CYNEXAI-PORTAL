import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { client } from '../../lib/turso';
import {
  Home, BookOpen, ClipboardCheck, Mic2, Briefcase,
  GraduationCap, LogOut, Moon, Sun,
  Menu, X, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';
import { CynexLogo } from '../ui/CynexLogo';

interface GamificationData {
  streak: number;
  coins: number;
  completedClasses: number;
  level: number;
  xpPct: number;
  badgeCount: number;
  notifications: number;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  short: string;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/student',             icon: Home,           label: 'Dashboard',      short: 'Home'      },
  { to: '/student/classes',     icon: BookOpen,        label: 'Class',          short: 'Class'     },
  { to: '/student/quizzes',     icon: GraduationCap,  label: 'Quizzes & Code', short: 'Quizzes'   },
  { to: '/student/attendance',  icon: ClipboardCheck, label: 'Attendance',     short: 'Attend'    },
  { to: '/student/interview',   icon: Mic2,           label: 'AI Interview',   short: 'Interview' },
  { to: '/student/career',      icon: Briefcase,      label: 'Career',         short: 'Career'    },
];

const BOTTOM_NAV = NAV_ITEMS;

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = getCurrentUser();
  const { isDark, toggleTheme } = useTheme();

  const [data, setData] = useState<GamificationData>({
    streak: 0, coins: 0, completedClasses: 0,
    level: 1, xpPct: 0, badgeCount: 0, notifications: 0,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchGamification();
  }, [user?.id]);

  const fetchGamification = async () => {
    if (!client) return;
    try {
      const [studRow, progRow, badgeRow, notifRow] = await Promise.all([
        client.execute({ sql: 'SELECT streak, coins FROM students WHERE id = ? OR portal_login_email = (SELECT email FROM users WHERE id = ?) LIMIT 1', args: [user!.id, user!.id] })
          .catch(() => ({ rows: [] })),
        client.execute({ sql: 'SELECT COUNT(*) as done FROM student_progress WHERE student_id = ? AND completed = 1', args: [user!.id] })
          .catch(() => ({ rows: [] })),
        client.execute({ sql: 'SELECT COUNT(*) as cnt FROM badges WHERE student_id = ?', args: [user!.id] })
          .catch(() => ({ rows: [] })),
        client.execute({ sql: 'SELECT COUNT(*) as cnt FROM announcements WHERE is_active = 1', args: [] })
          .catch(() => ({ rows: [] })),
      ]);
      const streak = Number((studRow.rows[0] as any)?.streak ?? 0);
      const coins  = Number((studRow.rows[0] as any)?.coins  ?? 0);
      const done   = Number((progRow.rows[0] as any)?.done   ?? 0);
      const badges = Number((badgeRow.rows[0] as any)?.cnt   ?? 0);
      const notifs = Number((notifRow.rows[0] as any)?.cnt   ?? 0);
      const level  = Math.floor(done / 10) + 1;
      const xpPct  = ((done % 10) / 10) * 100;
      setData({ streak, coins, completedClasses: done, level, xpPct, badgeCount: badges, notifications: notifs });
    } catch { /* silent */ }
  };

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'ST';
  const isActive = (to: string) => to === '/student' ? location.pathname === '/student' : location.pathname.startsWith(to);

  // ── Theme-aware palette ────────────────────────────────────────────────────
  const T = isDark ? {
    pageBg:      '#000000',
    sidebarBg:   '#000000',
    border:      '#27272a',
    tabBarBg:    '#09090b',
    profileCard: 'rgba(255,255,255,0.04)',
    profileBorder: '#27272a',
    navSectionLabel: '#a1a1aa',
    navMuted:    '#cbd5e1',
    navActive:   '#60a5fa',
    navActiveBg: 'rgba(37,99,235,0.15)',
    text:        '#fafafa',
    textMuted:   '#a1a1aa',
    avatarBorder: '#000000',
    xpTrack:     'rgba(255,255,255,0.08)',
    closeBtn:    'rgba(255,255,255,0.1)',
    closeBtnTxt: '#fafafa',
    inactiveTab: 'rgba(255,255,255,0.6)',
  } : {
    pageBg:      '#f8fafc',
    sidebarBg:   '#ffffff',
    border:      '#e2e8f0',
    tabBarBg:    'rgba(255,255,255,0.97)',
    profileCard: 'rgba(37,99,235,0.04)',
    profileBorder: 'rgba(37,99,235,0.12)',
    navSectionLabel: '#94a3b8',
    navMuted:    '#475569',
    navActive:   '#2563eb',
    navActiveBg: 'rgba(37,99,235,0.08)',
    text:        '#0f172a',
    textMuted:   '#64748b',
    avatarBorder: '#ffffff',
    xpTrack:     '#e2e8f0',
    closeBtn:    'rgba(0,0,0,0.05)',
    closeBtnTxt: '#475569',
    inactiveTab: '#94a3b8',
  };

  // ── Sidebar content (shared between desktop + mobile overlay) ─────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-black border-r border-slate-200/80 dark:border-zinc-800">

      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
        <CynexLogo size="md" badge="Student Portal" />
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-3 py-4 space-y-4 min-h-0">
        <nav className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-2 text-slate-400">Navigation</p>
          {NAV_ITEMS.map(({ to, icon: Icon, label, comingSoon }) => {
            const active = isActive(to);
            return (
              <button key={to}
                onClick={() => { navigate(to); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  active 
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border-l-4 border-blue-600 dark:border-blue-400 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} strokeWidth={active ? 2.5 : 2} />
                <span className="flex-1 text-left flex items-center justify-between">
                  <span>{label}</span>
                  {comingSoon && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold uppercase tracking-wider text-slate-500">Soon</span>
                  )}
                </span>
                {active && !comingSoon && <ChevronRight className="w-3.5 h-3.5 opacity-60 text-blue-600 dark:text-blue-400" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Movin-style Pinned User Profile (Bottom Left) */}
      <div className="p-3 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 shadow-sm">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 relative shadow-sm"
            style={{ background: 'linear-gradient(135deg, #2563eb, #0284c7)' }}>
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs truncate text-slate-900 dark:text-white leading-tight">{user?.name ?? 'Student'}</p>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email ?? 'student@cynexai.com'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors">
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-600" />}
            {isDark ? 'Light' : 'Dark'}
          </button>
          <button
            onClick={() => { localStorage.removeItem('cynexai_user'); navigate('/login'); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden portal-dot-bg" style={{ background: T.pageBg, color: T.text }}>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-black z-20 overflow-hidden">
        <SidebarContent />
      </aside>

      {/* Mobile overlay menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-72 flex flex-col z-10 candy-panel !rounded-l-none !border-y-0 !border-l-0 bg-white dark:bg-black shadow-2xl">
            <button onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 candy-btn !min-h-[40px] px-3 py-2 rounded-xl flex items-center justify-center z-50 shadow-md">
              <X className="w-5 h-5 text-white" strokeWidth={3} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

        {/* Mobile top sticky header */}
        <div className="md:hidden flex flex-col flex-shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-200 active:scale-95 text-xs font-bold"
            >
              <Menu className="w-4 h-4" />
              <span>Menu</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {data.completedClasses} Classes Done
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable content container with bottom padding for constant fixed navbar */}
        <div className="flex-1 overflow-y-auto pb-28 md:pb-8">
          {children}
        </div>

        {/* Mobile Constant Fixed Bottom Navigation Bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-zinc-800 shadow-[0_-10px_30px_rgba(0,0,0,0.35)] flex items-center justify-around px-1 py-1.5"
          style={{
            height: '66px',
            paddingBottom: 'env(safe-area-inset-bottom, 6px)',
          }}
        >
          {BOTTOM_NAV.map(({ to, icon: Icon, short, label, comingSoon }) => {
            const active = isActive(to);
            return (
              <button
                key={to}
                onClick={() => { if (!comingSoon) navigate(to); }}
                disabled={comingSoon}
                aria-label={label}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 rounded-xl transition-all relative ${
                  comingSoon 
                    ? 'opacity-40 cursor-not-allowed' 
                    : active 
                    ? 'text-blue-600 dark:text-blue-400 font-bold' 
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white active:scale-90'
                }`}
              >
                <div className={`w-9 h-7 flex items-center justify-center rounded-xl transition-all duration-200 ${
                  active && !comingSoon ? 'bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-500/30' : ''
                }`}>
                  <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[9px] font-bold tracking-tight mt-0.5 ${
                  active ? 'text-blue-600 dark:text-blue-400 font-black' : 'text-slate-500 dark:text-zinc-400'
                }`}>
                  {short}
                </span>
              </button>
            );
          })}
        </nav>

      </div>
    </div>
  );
}
