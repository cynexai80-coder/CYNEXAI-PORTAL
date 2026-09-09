import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Bell,
  Video,
  Loader2,
  AlertCircle,
  Play,
  Lock,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Clock,
  X,
  AlarmClock,
  ArrowUpRight,
} from 'lucide-react';
import { getCurrentUser } from '../../lib/auth';
import {
  getStudentDashboardData,
  getAnnouncements,
  StudentDashboardData,
  Announcement,
} from '../../lib/api/student';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAnnouncementExpired(ann: Announcement): boolean {
  if (!ann.title?.startsWith('⏰')) return false;
  
  const timeMatch = ann.body?.match(/🕐 New Time: ([\d:]+)/);
  const dateMatch = ann.body?.match(/📆 New Date: ([\d-]+)/);
  
  if (timeMatch) {
    const classTime = timeMatch[1];
    let classDateStr = dateMatch ? dateMatch[1] : ann.created_at?.split('T')[0];
    if (!classDateStr) classDateStr = new Date().toISOString().split('T')[0];
    
    const classDate = new Date(`${classDateStr}T${classTime}:00`);
    if (!isNaN(classDate.getTime())) {
      return classDate < new Date();
    }
  }
  return false;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayH = hour % 12 || 12;
  return `${displayH}:${m} ${ampm}`;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  pct,
  color = 'bg-blue-600',
  height = 'h-2',
}: {
  pct: number;
  color?: string;
  height?: string;
}) {
  return (
    <div className={`w-full ${height} bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden`}>
      <div
        className={`h-full rounded-full ${color} transition-all duration-700`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

// ─── Announcements Banner ─────────────────────────────────────────────────────

function AnnouncementsBanner({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) return null;
  const text = announcements.map((a) => a.title).join('   •   ');

  return (
    <div className="flex items-center overflow-hidden bg-slate-900 text-white rounded-2xl px-4.5 py-3 gap-3 border border-slate-800 shadow-md">
      <div className="flex-shrink-0 flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg">
        <Bell className="w-3.5 h-3.5" strokeWidth={2.5} />
        <span className="font-bold text-[10px] uppercase tracking-widest">
          Announcements
        </span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="whitespace-nowrap animate-marquee inline-block text-xs font-medium text-slate-300">
          {text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}
        </div>
      </div>
    </div>
  );
}

// ─── Reschedule Notification Popup ───────────────────────────────────────────

function ReschedulePopup({ announcements, onDismiss }: { announcements: Announcement[]; onDismiss: (id: string) => void }) {
  const rescheduleAnns = announcements.filter(a => a.title?.startsWith('⏰'));
  const [currentIdx, setCurrentIdx] = React.useState(0);
  if (rescheduleAnns.length === 0) return null;
  const ann = rescheduleAnns[currentIdx];
  if (!ann) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl overflow-hidden animate-slide-down">
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20">
          <AlarmClock className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span className="flex-1 font-bold text-amber-300 text-sm">{ann.title}</span>
          <button
            onClick={() => {
              onDismiss(ann.id);
              if (currentIdx < rescheduleAnns.length - 1) setCurrentIdx(i => i + 1);
            }}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-amber-400" />
          </button>
        </div>
        <div className="px-4 py-3">
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{ann.body}</pre>
        </div>
        {rescheduleAnns.length > 1 && (
          <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-400 text-center">
            {currentIdx + 1} of {rescheduleAnns.length} notifications
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Movin-style Top KPI Cards ───────────────────────────────────────────────

function MovinKpiCard({
  title,
  value,
  sublabel,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  title: string;
  value: string | number;
  sublabel: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-tight truncate">
          {title}
        </span>
        <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
      </div>
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
            {value}
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
            {sublabel}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Total Activity Breakdown Card (Left Card) ────────────────────────────────

function ActivityBreakdownCard({
  completedClasses,
  totalClasses,
  inProgressCount,
  lockedCount,
  totalModules,
}: {
  completedClasses: number;
  totalClasses: number;
  inProgressCount: number;
  lockedCount: number;
  totalModules: number;
}) {
  const compPct = totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0;
  const inProgPct = totalModules > 0 ? Math.round((inProgressCount / totalModules) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Total Learning Activity
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Overall course module status breakdown
          </p>
        </div>
        <ArrowUpRight className="w-5 h-5 text-slate-400" />
      </div>

      <div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {completedClasses}
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            / {totalClasses} classes completed
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${Math.max(5, compPct)}%` }}
            title="Completed"
          />
          <div
            className="h-full bg-blue-600 transition-all duration-700"
            style={{ width: `${Math.max(5, inProgPct)}%` }}
            title="In Progress"
          />
          <div
            className="h-full bg-slate-200 dark:bg-slate-700 transition-all duration-700 flex-1"
            title="Upcoming / Locked"
          />
        </div>
      </div>

      {/* Legend pills */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-md bg-blue-600 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">In Progress</p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{inProgressCount} Modules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-md bg-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Completed</p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{completedClasses} Classes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-md bg-slate-300 dark:bg-slate-700 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Upcoming</p>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{lockedCount} Modules</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Performance Chart Card (Right Card) ─────────────────────────────────────

function ActivityChartCard() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Weekly Learning Performance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Class attendance and active session trend
          </p>
        </div>
        <div className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer">
          <span>This Week</span>
          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
        </div>
      </div>

      {/* SVG Smooth Curve Area Chart */}
      <div className="w-full h-44 relative">
        <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="movinCurveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          <line x1="0" y1="30" x2="500" y2="30" className="stroke-slate-100 dark:stroke-slate-800/60" strokeDasharray="4 4" />
          <line x1="0" y1="75" x2="500" y2="75" className="stroke-slate-100 dark:stroke-slate-800/60" strokeDasharray="4 4" />
          <line x1="0" y1="120" x2="500" y2="120" className="stroke-slate-100 dark:stroke-slate-800/60" strokeDasharray="4 4" />

          {/* Area Fill */}
          <path
            d="M 20,130 C 80,100 120,40 180,65 C 240,90 300,30 360,45 C 420,60 460,90 480,75 L 480,140 L 20,140 Z"
            fill="url(#movinCurveGrad)"
          />

          {/* Smooth Curve Line */}
          <path
            d="M 20,130 C 80,100 120,40 180,65 C 240,90 300,30 360,45 C 420,60 460,90 480,75"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Data Points */}
          {[
            { x: 20, y: 130 },
            { x: 100, y: 88 },
            { x: 180, y: 65 },
            { x: 260, y: 78 },
            { x: 360, y: 45 },
            { x: 440, y: 70 },
            { x: 480, y: 75 },
          ].map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r="4.5"
              className="fill-blue-600 stroke-white dark:stroke-slate-900"
              strokeWidth="2.5"
            />
          ))}
        </svg>

        {/* Day X-Axis Labels */}
        <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mt-2 px-1">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
      </div>
    </div>
  );
}

// ─── Upcoming Class Card ──────────────────────────────────────────────────────

function UpcomingClassCard({ cls }: { cls: any }) {
  const navigate = useNavigate();
  const status = (cls.status || '').toLowerCase();
  const isLiveNow = status === 'in_progress' || status === 'live';
  const isEnded = status === 'completed' || !!cls.youtube_video_id;

  const handleJoin = () => {
    if (isLiveNow && cls.meet_link) {
      window.open(cls.meet_link, '_blank', 'noopener,noreferrer');
    } else if (cls.id) {
      navigate(`/student/class-flow?classId=${cls.id}&step=video`);
    } else if (cls.module_id) {
      navigate(`/student/module/${cls.module_id}`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-slate-900 dark:text-white font-bold text-xs uppercase tracking-wider">Scheduled Session</h3>
        </div>
        {isLiveNow ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE NOW
          </span>
        ) : isEnded ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
            Class ended
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full">
            Waiting for Access
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-slate-900 dark:text-white font-bold text-sm line-clamp-2 mb-2 leading-snug">
            {cls.title || 'Upcoming Live Session'}
          </p>
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-xs font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {formatDate(cls.date)}
            </span>
            {cls.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatTime(cls.start_time)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleJoin}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            isLiveNow
              ? 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/20'
              : isEnded
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/20'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20'
          }`}
        >
          {isLiveNow ? (
            <Video className="w-3.5 h-3.5" />
          ) : isEnded ? (
            <Play className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          {isLiveNow ? 'Join Live Class' : isEnded ? 'Watch Class' : 'View Session'}
        </button>
      </div>
    </div>
  );
}

// ─── Loading / Empty / Error States ──────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center mb-5 shadow-sm">
        <BookOpen className="w-9 h-9 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-slate-900 dark:text-white font-bold text-xl mb-2">No Course Enrolled</h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs leading-relaxed">
        Your course schedule has not been assigned yet. Contact your program coordinator.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
      </div>
      <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Failed to load</h3>
      <p className="text-slate-600 dark:text-slate-400 text-sm mb-5">Could not fetch your dashboard data.</p>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-all shadow-md"
      >
        Retry
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Loading your student dashboard…</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentPortal() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [dashData, setDashData] = useState<StudentDashboardData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dismissedAnnIds, setDismissedAnnIds] = useState<Set<string>>(new Set());
  const portalContainer = React.useRef<HTMLDivElement>(null);

  const handleDismiss = (id: string) => setDismissedAnnIds(prev => new Set([...prev, id]));

  const loadData = async () => {
    setLoading(true);
    setError(false);
    try {
      const u = getCurrentUser();
      if (!u) {
        navigate('/login');
        return;
      }
      const [dashResult, annsResult] = await Promise.all([
        getStudentDashboardData(u.id).catch(() => ({
          course: null,
          gamification: { streak: 0, coins: 0 },
          modules: [],
          upcomingClass: null,
        })),
        getAnnouncements().catch(() => []),
      ]);
      const activeAnns = annsResult.filter((a: Announcement) => !isAnnouncementExpired(a));
      setDashData(dashResult as StudentDashboardData);
      setAnnouncements(activeAnns);
    } catch (e) {
      console.error('StudentPortal load error:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div className="p-6">
        <ErrorState onRetry={loadData} />
      </div>
    );
  }

  if (!dashData?.course) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <AnnouncementsBanner announcements={announcements} />
        <EmptyState />
      </div>
    );
  }

  const { course, modules, upcomingClass } = dashData;
  const firstName = user?.name?.split(' ')[0] ?? 'Student';
  const totalClasses = modules.reduce((s, m) => s + (m.totalClasses || 0), 0);
  const completedClasses = modules.reduce((s, m) => s + (m.completedClasses || 0), 0);
  const overallPct = totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0;
  const inProgressCount = modules.filter(m => (m.progressPct ?? 0) > 0 && (m.progressPct ?? 0) < 100).length;
  const lockedCount = modules.filter(m => (m.progressPct ?? 0) === 0).length;

  return (
    <div className="w-full bg-slate-100/70 dark:bg-slate-950 p-3 sm:p-4 md:p-6 lg:p-8 pb-20 sm:pb-24" ref={portalContainer}>
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        
        {/* Reschedule Notifications Popup */}
        <ReschedulePopup
          announcements={announcements.filter(a => !dismissedAnnIds.has(a.id))}
          onDismiss={handleDismiss}
        />

        {/* Announcements Banner */}
        {announcements.length > 0 && (
          <AnnouncementsBanner announcements={announcements} />
        )}

        {/* Top Header / Greeting */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400">
                Student Portal
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Welcome back, <span className="text-blue-600 dark:text-blue-400">{firstName}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
              {course.title || course.name || 'Masterclass Program'}
            </span>
          </div>
        </div>

        {/* ══ ROW 1: MOVIN 4 KPI METRIC CARDS (2x2 Compact Grid on Mobile) ══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <MovinKpiCard
            title="Total Modules"
            value={modules.length}
            sublabel="Enrolled course"
            icon={BookOpen}
            iconBg="bg-blue-50 dark:bg-blue-950/50"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <MovinKpiCard
            title="Classes Completed"
            value={completedClasses}
            sublabel={`out of ${totalClasses}`}
            icon={CheckCircle2}
            iconBg="bg-emerald-50 dark:bg-emerald-950/50"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <MovinKpiCard
            title="Attendance Rate"
            value="98%"
            sublabel="Live attendance"
            icon={Calendar}
            iconBg="bg-cyan-50 dark:bg-cyan-950/50"
            iconColor="text-cyan-600 dark:text-cyan-400"
          />
          <MovinKpiCard
            title="Overall Progress"
            value={`${overallPct}%`}
            sublabel="Program completion"
            icon={TrendingUp}
            iconBg="bg-sky-50 dark:bg-sky-950/50"
            iconColor="text-sky-600 dark:text-sky-400"
          />
        </div>

        {/* ══ ROW 2: UPCOMING CLASS & ACADEMIC GUIDANCE ══ */}
        {upcomingClass && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2">
              <UpcomingClassCard cls={upcomingClass} />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/25 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" strokeWidth={2} />
              </div>
              <div>
                <p className="text-slate-900 dark:text-white text-sm font-bold mb-1">Academic Guidance</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                  Review your upcoming class schedules and complete interactive module assessments regularly.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══ ROW 4: ACTIVITY BREAKDOWN & WEEKLY PERFORMANCE CHART ══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <ActivityBreakdownCard
            completedClasses={completedClasses}
            totalClasses={totalClasses}
            inProgressCount={inProgressCount}
            lockedCount={lockedCount}
            totalModules={modules.length}
          />
          <ActivityChartCard />
        </div>

      </div>
    </div>
  );
}
