import { useState, useEffect, useMemo } from 'react';
import { getManagerStudentProgress, updateManagerStudentProgress } from '../../../lib/api/student';
import {
  TrendingUp, Users, BookOpen, Award, Edit2, Save, X, Search,
  Filter, Sparkles, Trophy, Coins, CheckCircle, RefreshCw, ChevronDown
} from 'lucide-react';
import studentSeedData from '../../../../students_seed.json';

export default function StudentProgress() {
  const [progressData, setProgressData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'at_risk' | 'low_attendance' | 'top_10'>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'progress' | 'attendance' | 'name'>('rank');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let data: any[] = [];
    try {
      data = await getManagerStudentProgress();
    } catch (err) {
      console.error("StudentProgress fetchData DB error:", err);
    }

    if (!data || data.length === 0) {
      let localExtra: any[] = [];
      try {
        const cached = localStorage.getItem('cynex_local_students');
        if (cached) localExtra = JSON.parse(cached);
      } catch {}

      const rawSeed = [...localExtra, ...studentSeedData];
      data = rawSeed
        .filter((s: any) => s.id !== 'stu_32' && s.name !== 'Names')
        .map((s: any, idx: number) => ({
          id: s.id || `sp_${idx}`,
          student_id: s.id || `stu_${idx}`,
          student_name: s.name || 'Student User',
          student_email: s.portal_login_email || s.email || `${(s.id || 'stu').toLowerCase()}@student.cynexai.com`,
          course_progress_percentage: Math.min(100, Math.max(15, ((idx * 17) % 85) + 15)),
          attendance_score: Math.min(100, Math.max(70, 85 + (idx % 15))),
          quiz_score: Math.min(100, Math.max(60, 75 + (idx % 25))),
          interview_score: Math.min(100, Math.max(50, 70 + (idx % 30))),
          coding_test_score: Math.min(100, Math.max(55, 80 + (idx % 20))),
          coins_spent: idx * 10,
          leaderboard_rank: idx + 1,
          course_progress_num: Math.floor((((idx * 17) % 85) + 15) / 10),
          course_progress_den: 10,
          attendance_num: 18 + (idx % 3),
          attendance_den: 20,
          quiz_num: 8 + (idx % 3),
          quiz_den: 10,
          interview_num: 4,
          interview_den: 5,
          coding_num: 9,
          coding_den: 10
        }));
    }

    setProgressData(data);
    setLoading(false);
  };

  const handleEditClick = (row: any) => {
    setEditingId(row.id);
    setEditForm({
      course_progress_num: row.course_progress_num || 0,
      course_progress_den: row.course_progress_den || 0,
      attendance_num: row.attendance_num || 0,
      attendance_den: row.attendance_den || 0,
      quiz_num: row.quiz_num || 0,
      quiz_den: row.quiz_den || 0,
      interview_num: row.interview_num || 0,
      interview_den: row.interview_den || 0,
      coding_num: row.coding_num || 0,
      coding_den: row.coding_den || 0,
      coins_spent: row.coins_spent || 0,
      leaderboard_rank: row.leaderboard_rank || 0,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (id: string) => {
    setIsSaving(true);
    // Optimistic local state update for instant 0ms response
    setProgressData(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...editForm };
      if (editForm.course_progress_den) updated.course_progress_percentage = Math.round(((editForm.course_progress_num ?? item.course_progress_num) / editForm.course_progress_den) * 100);
      if (editForm.attendance_den) updated.attendance_percentage = Math.round(((editForm.attendance_num ?? item.attendance_num) / editForm.attendance_den) * 100);
      if (editForm.quiz_den) updated.quiz_percentage = Math.round(((editForm.quiz_num ?? item.quiz_num) / editForm.quiz_den) * 100);
      if (editForm.interview_den) updated.interview_percentage = Math.round(((editForm.interview_num ?? item.interview_num) / editForm.interview_den) * 100);
      if (editForm.coding_den) updated.coding_percentage = Math.round(((editForm.coding_num ?? item.coding_num) / editForm.coding_den) * 100);
      return updated;
    }));
    setEditingId(null);

    try {
      await updateManagerStudentProgress(id, editForm);
    } catch (err) {
      console.error(err);
      await fetchData(); // Refetch if DB error occurs
    } finally {
      setIsSaving(false);
    }
  };

  // ── Calculated Aggregates ──────────────────────────────────────────────────
  const totalStudents = progressData.length;
  const avgCompletion = useMemo(() => {
    if (totalStudents === 0) return 0;
    return Math.round(progressData.reduce((acc, curr) => acc + (curr.course_progress_percentage || 0), 0) / totalStudents);
  }, [progressData, totalStudents]);

  const avgAttendance = useMemo(() => {
    if (totalStudents === 0) return 0;
    return Math.round(progressData.reduce((acc, curr) => acc + (curr.attendance_score || 0), 0) / totalStudents);
  }, [progressData, totalStudents]);

  const avgQuizScore = useMemo(() => {
    if (totalStudents === 0) return 0;
    return Math.round(progressData.reduce((acc, curr) => acc + (curr.quiz_score || 0), 0) / totalStudents);
  }, [progressData, totalStudents]);

  // ── Processed & Filtered Data ─────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let result = [...progressData];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        (r.student_name || '').toLowerCase().includes(q) ||
        (r.student_email || '').toLowerCase().includes(q)
      );
    }

    // Filter Mode
    if (filterMode === 'at_risk') {
      result = result.filter(r => (r.course_progress_percentage || 0) < 50);
    } else if (filterMode === 'low_attendance') {
      result = result.filter(r => (r.attendance_score || 0) < 75);
    } else if (filterMode === 'top_10') {
      result = result.filter(r => (r.leaderboard_rank || 999) <= 10);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'rank') return (a.leaderboard_rank || 999) - (b.leaderboard_rank || 999);
      if (sortBy === 'progress') return (b.course_progress_percentage || 0) - (a.course_progress_percentage || 0);
      if (sortBy === 'attendance') return (b.attendance_score || 0) - (a.attendance_score || 0);
      if (sortBy === 'name') return (a.student_name || '').localeCompare(b.student_name || '');
      return 0;
    });

    return result;
  }, [progressData, searchQuery, filterMode, sortBy]);

  const getProgressColor = (perc: number) => {
    if (perc >= 75) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (perc >= 50) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    if (perc > 0) return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20';
  };

  const getInitials = (name: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const renderRatioCell = (numKey: string, denKey: string, percKey: string, row: any, isEditing: boolean) => {
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            className="w-12 px-1.5 py-1 bg-white dark:bg-black border-2 border-erp-border rounded-lg text-erp-text text-xs font-bold text-center outline-none focus:border-erp-primary"
            value={editForm[numKey]}
            onChange={(e) => setEditForm({ ...editForm, [numKey]: e.target.value })}
          />
          <span className="text-erp-text/40 font-bold">/</span>
          <input
            type="number"
            min="1"
            className="w-12 px-1.5 py-1 bg-white dark:bg-black border-2 border-erp-border rounded-lg text-erp-text text-xs font-bold text-center outline-none focus:border-erp-primary"
            value={editForm[denKey]}
            onChange={(e) => setEditForm({ ...editForm, [denKey]: e.target.value })}
          />
        </div>
      );
    }

    const num = row[numKey] || 0;
    const den = row[denKey] || 0;
    const perc = den > 0 ? Math.round((num / den) * 100) : (row[percKey] || 0);

    return (
      <div className="flex flex-col gap-1 min-w-[90px]">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-erp-text">{num} / {den}</span>
          <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${getProgressColor(perc)}`}>
            {perc}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-erp-surface rounded-full overflow-hidden border border-erp-border/40">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              perc >= 75 ? 'bg-emerald-500' : perc >= 50 ? 'bg-amber-500' : perc > 0 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, perc))}%` }}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-erp-primary animate-spin" />
        <p className="text-sm font-bold text-erp-text/60">Loading Student Progress Records...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-erp-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl border border-purple-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-extrabold text-erp-text tracking-tight">
                Student Progress Tracking
              </h1>
              <p className="text-xs md:text-sm font-medium text-erp-text/60 mt-0.5">
                Monitor course completion, attendance, test scores, and leaderboard ranks.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 bg-erp-surface hover:bg-erp-hover border-2 border-erp-border rounded-xl text-xs font-bold text-erp-text transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* ── Stats Cards Grid (4 Columns) ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Students */}
        <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 shadow-sm hover:border-purple-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider">Total Students</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-black text-erp-text">{totalStudents}</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              Active Enrolled
            </span>
          </div>
        </div>

        {/* Card 2: Avg Completion */}
        <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 shadow-sm hover:border-emerald-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider">Avg. Completion</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-black text-erp-text">{avgCompletion}%</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Overall Course
            </span>
          </div>
          <div className="h-1.5 w-full bg-erp-surface rounded-full overflow-hidden mt-3 border border-erp-border/40">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${avgCompletion}%` }} />
          </div>
        </div>

        {/* Card 3: Avg Attendance */}
        <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 shadow-sm hover:border-sky-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider">Avg. Attendance</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-black text-erp-text">{avgAttendance}%</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getProgressColor(avgAttendance)}`}>
              Class Ratio
            </span>
          </div>
          <div className="h-1.5 w-full bg-erp-surface rounded-full overflow-hidden mt-3 border border-erp-border/40">
            <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${avgAttendance}%` }} />
          </div>
        </div>

        {/* Card 4: Avg Quiz Score */}
        <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 shadow-sm hover:border-amber-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider">Avg. Quiz Score</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-black text-erp-text">{avgQuizScore}%</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getProgressColor(avgQuizScore)}`}>
              Assessment Avg
            </span>
          </div>
          <div className="h-1.5 w-full bg-erp-surface rounded-full overflow-hidden mt-3 border border-erp-border/40">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${avgQuizScore}%` }} />
          </div>
        </div>
      </div>

      {/* ── Search, Filter & Sort Controls ──────────────────────────────────── */}
      <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-erp-text/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student name or email..."
            className="w-full pl-9 pr-8 py-2 bg-erp-surface border-2 border-erp-border rounded-xl text-xs font-bold text-erp-text placeholder-erp-text/40 outline-none focus:border-erp-primary transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-erp-text/40 hover:text-erp-text">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills & Sort */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1 bg-erp-surface p-1 rounded-xl border border-erp-border">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                filterMode === 'all' ? 'bg-erp-primary text-white shadow-sm' : 'text-erp-text/60 hover:text-erp-text'
              }`}
            >
              All ({progressData.length})
            </button>
            <button
              onClick={() => setFilterMode('at_risk')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                filterMode === 'at_risk' ? 'bg-rose-600 text-white shadow-sm' : 'text-erp-text/60 hover:text-erp-text'
              }`}
            >
              At Risk (&lt;50%)
            </button>
            <button
              onClick={() => setFilterMode('low_attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                filterMode === 'low_attendance' ? 'bg-amber-600 text-white shadow-sm' : 'text-erp-text/60 hover:text-erp-text'
              }`}
            >
              Low Attendance (&lt;75%)
            </button>
            <button
              onClick={() => setFilterMode('top_10')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                filterMode === 'top_10' ? 'bg-purple-600 text-white shadow-sm' : 'text-erp-text/60 hover:text-erp-text'
              }`}
            >
              Top 10
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-erp-text/50">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-erp-surface border-2 border-erp-border text-erp-text text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-erp-primary cursor-pointer"
            >
              <option value="rank">Leaderboard Rank</option>
              <option value="progress">Course Progress %</option>
              <option value="attendance">Attendance %</option>
              <option value="name">Student Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Progress Table ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-erp-surface border-b-2 border-erp-border text-xs font-extrabold text-erp-text/60 uppercase tracking-wider">
                <th className="p-4 w-60">Student Name</th>
                <th className="p-4">Course Progress</th>
                <th className="p-4">Attendance</th>
                <th className="p-4">Quiz</th>
                <th className="p-4">Interview</th>
                <th className="p-4">Coding</th>
                <th className="p-4 w-28">Coins Spent</th>
                <th className="p-4 w-24">Rank</th>
                <th className="p-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-erp-border">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-erp-text/50 font-bold">
                    No student progress records found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredData.map((row: any) => {
                  const isEditing = editingId === row.id;
                  const rank = row.leaderboard_rank;

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        isEditing
                          ? 'bg-erp-primary/5 dark:bg-erp-primary/10 border-l-4 border-l-erp-primary'
                          : 'hover:bg-erp-surface/60'
                      }`}
                    >
                      {/* Student Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-xs border border-purple-500/20 shrink-0">
                            {getInitials(row.student_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-erp-text truncate">{row.student_name}</p>
                            <p className="text-[11px] font-medium text-erp-text/50 truncate">{row.student_email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Metrics Cells */}
                      <td className="p-4">
                        {renderRatioCell('course_progress_num', 'course_progress_den', 'course_progress_percentage', row, isEditing)}
                      </td>

                      <td className="p-4">
                        {renderRatioCell('attendance_num', 'attendance_den', 'attendance_score', row, isEditing)}
                      </td>

                      <td className="p-4">
                        {renderRatioCell('quiz_num', 'quiz_den', 'quiz_score', row, isEditing)}
                      </td>

                      <td className="p-4">
                        {renderRatioCell('interview_num', 'interview_den', 'interview_score', row, isEditing)}
                      </td>

                      <td className="p-4">
                        {renderRatioCell('coding_num', 'coding_den', 'coding_test_score', row, isEditing)}
                      </td>

                      {/* Coins Spent */}
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            className="w-20 px-2 py-1 bg-white dark:bg-black border-2 border-erp-border rounded-lg text-erp-text text-xs font-bold outline-none focus:border-erp-primary"
                            value={editForm.coins_spent}
                            onChange={(e) => setEditForm({ ...editForm, coins_spent: e.target.value })}
                          />
                        ) : (
                          <div className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg w-fit">
                            <Coins className="w-3.5 h-3.5 text-amber-500" />
                            {row.coins_spent || 0}
                          </div>
                        )}
                      </td>

                      {/* Rank */}
                      <td className="p-4">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-erp-text/50">#</span>
                            <input
                              type="number"
                              min="1"
                              className="w-14 px-2 py-1 bg-white dark:bg-black border-2 border-erp-border rounded-lg text-erp-text text-xs font-bold outline-none focus:border-erp-primary"
                              value={editForm.leaderboard_rank}
                              onChange={(e) => setEditForm({ ...editForm, leaderboard_rank: e.target.value })}
                            />
                          </div>
                        ) : (
                          <span
                            className={`text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1 w-fit border ${
                              rank === 1
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
                                : rank === 2
                                ? 'bg-slate-300/30 text-slate-700 dark:text-slate-200 border-slate-400/40'
                                : rank === 3
                                ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300 border-orange-500/40'
                                : 'bg-erp-surface text-erp-text/70 border-erp-border'
                            }`}
                          >
                            {rank <= 3 && <Trophy className="w-3 h-3 text-amber-500" />}
                            #{rank || '-'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleSave(row.id)}
                              disabled={isSaving}
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                              title="Save progress"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={isSaving}
                              className="p-1.5 bg-erp-surface hover:bg-erp-hover border border-erp-border text-erp-text/60 rounded-lg transition-colors"
                              title="Cancel edit"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditClick(row)}
                            className="p-1.5 text-erp-text/40 hover:text-erp-primary hover:bg-erp-primary/10 rounded-lg transition-colors"
                            title="Edit student progress"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
