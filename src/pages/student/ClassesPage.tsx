import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../lib/auth';
import { getStudentDashboardData, StudentDashboardData } from '../../lib/api/student';
import { 
  BookOpen, CheckCircle2, ChevronRight, Search, Layers, 
  Play, Sparkles, TrendingUp, Clock, Cpu, Filter
} from 'lucide-react';

function ProgressBar({
  pct,
  color = 'bg-blue-600',
  height = 'h-2.5',
}: {
  pct: number;
  color?: string;
  height?: string;
}) {
  return (
    <div className={`w-full ${height} bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden`}>
      <div
        className={`h-full rounded-full ${color} transition-all duration-700`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export default function ClassesPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const studentId = user?.id || 'CAI-STU-001';

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<StudentDashboardData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    fetchData();
  }, [studentId]);

  async function fetchData() {
    setLoading(true);
    try {
      const data = await getStudentDashboardData(studentId);
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to fetch class modules data', err);
    } finally {
      setLoading(false);
    }
  }

  const modules = dashboardData?.modules || [];

  const filteredModules = useMemo(() => {
    return modules.filter((mod) => {
      const pct = mod.progressPct ?? 0;
      if (filterTab === 'completed' && pct < 100) return false;
      if (filterTab === 'in_progress' && (pct <= 0 || pct >= 100)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = mod.title?.toLowerCase().includes(q);
        const descMatch = mod.description?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [modules, filterTab, searchQuery]);

  const totalClassesCompleted = modules.reduce((acc, m) => acc + (m.completedClasses ?? m.completedCount ?? 0), 0);
  const totalClassCount = modules.reduce((acc, m) => acc + (m.totalClasses ?? m.totalCount ?? 0), 0);
  const completedModulesCount = modules.filter(m => (m.progressPct ?? 0) >= 100).length;
  const inProgressModulesCount = modules.filter(m => (m.progressPct ?? 0) > 0 && (m.progressPct ?? 0) < 100).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 candy-map-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-500 animate-spin">
            <Cpu className="w-6 h-6" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Class Modules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen candy-map-bg text-slate-900 dark:text-white p-4 md:p-8 pb-24 selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Hero Banner Header */}
        <div className="relative rounded-3xl p-6 md:p-10 bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-white">
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-black uppercase tracking-widest">
                <BookOpen className="w-3.5 h-3.5 text-blue-400" /> Class Curriculum Hub
              </div>
              <h1 className="text-3xl md:text-5xl font-black font-display tracking-tight text-white leading-tight">
                Class <span className="text-blue-400">Modules</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Access all curriculum modules, step-by-step video lessons, and interactive class progress.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  <Layers className="w-4 h-4 text-blue-400" /> Total Modules
                </div>
                <div className="text-3xl font-black text-white">{modules.length}</div>
                <div className="text-[10px] text-slate-400 font-bold mt-0.5">{dashboardData?.course?.title || 'Enrolled Course'}</div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Classes Done
                </div>
                <div className="text-3xl font-black text-emerald-400">{totalClassesCompleted}</div>
                <div className="text-[10px] text-slate-400 font-bold mt-0.5">Out of {totalClassCount}</div>
              </div>

              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center col-span-2 sm:col-span-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  <TrendingUp className="w-4 h-4 text-sky-400" /> Active Progress
                </div>
                <div className="text-3xl font-black text-sky-400">{inProgressModulesCount}</div>
                <div className="text-[10px] text-slate-400 font-bold mt-0.5">Modules in Progress</div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar: Search + Filter Tabs */}
        <div className="candy-panel p-4 space-y-4 !border-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search class modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-black/50 text-slate-900 dark:text-white placeholder:text-slate-400 font-bold text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-black/50 rounded-xl border border-slate-200/60 dark:border-zinc-800 text-xs font-semibold">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-2 rounded-lg transition-all ${
                filterTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({modules.length})
            </button>
            <button
              onClick={() => setFilterTab('in_progress')}
              className={`px-4 py-2 rounded-lg transition-all ${
                filterTab === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              In Progress ({inProgressModulesCount})
            </button>
            <button
              onClick={() => setFilterTab('completed')}
              className={`px-4 py-2 rounded-lg transition-all ${
                filterTab === 'completed'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Completed ({completedModulesCount})
            </button>
          </div>
        </div>

        {/* Modules List Grid */}
        <div className="space-y-4">
          {filteredModules.length === 0 ? (
            <div className="candy-panel p-12 text-center space-y-3 !border-2">
              <Layers className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No Class Modules Found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your search query or filter settings.</p>
            </div>
          ) : (
            filteredModules.map((mod, idx) => {
              const pct = mod.progressPct ?? 0;
              const isCompleted = pct >= 100;
              const isCurrent = (pct > 0 && pct < 100) || (idx === 0 && pct < 100);

              return (
                <div
                  key={mod.id || idx}
                  onClick={() => navigate(`/student/module/${mod.id}`)}
                  className="candy-panel p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 !border-2 hover:border-blue-500/50 cursor-pointer group transition-all duration-200"
                >
                  {/* Left Info: Number + Module Title + Stats */}
                  <div className="flex items-start md:items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-transform group-hover:scale-105 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                        : isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                    }`}>
                      {String(idx + 1).padStart(2, '0')}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-black text-base md:text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                            {mod.title}
                          </h3>
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
                              <CheckCircle2 className="w-3 h-3" /> Solved
                            </span>
                          )}
                        </div>

                        {/* Mobile Top Action Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/student/module/${mod.id}`);
                          }}
                          className={`md:hidden px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap transition-all shadow-md active:scale-95 flex-shrink-0 ${
                            isCompleted
                              ? 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                          }`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          {isCompleted ? 'Review' : 'Continue'}
                        </button>
                      </div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {mod.completedClasses ?? mod.completedCount ?? 0} of {mod.totalClasses ?? mod.totalCount ?? 0} classes completed
                      </p>
                    </div>
                  </div>

                  {/* Right Progress Bar & Continue Button */}
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="flex-1 md:w-48 space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-400 text-[10px] uppercase">Progress</span>
                        <span className="text-slate-900 dark:text-white">{Math.round(pct)}%</span>
                      </div>
                      <ProgressBar pct={pct} color={isCompleted ? 'bg-emerald-500' : 'bg-blue-600'} />
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/student/module/${mod.id}`);
                      }}
                      className={`hidden md:flex px-5 py-2.5 rounded-xl font-bold text-xs items-center justify-center gap-2 whitespace-nowrap transition-all shadow-md active:scale-95 ${
                        isCompleted
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isCompleted ? 'Review Classes' : 'Continue'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
