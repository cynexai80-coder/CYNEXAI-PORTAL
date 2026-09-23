import { useState, useEffect, useMemo } from 'react';
import { getManagerStudentProgress, updateManagerStudentProgress } from '../../../lib/api/student';
import { getAllBatches, BatchItem } from '../../../lib/api/batches';
import {
  TrendingUp, Users, BookOpen, Award, Edit2, Save, X, Search,
  Filter, Sparkles, Trophy, Coins, CheckCircle, RefreshCw, ChevronDown,
  Layers, Check, AlertCircle, ArrowUpDown, GraduationCap, LayoutGrid
} from 'lucide-react';
import studentSeedData from '../../../../students_seed.json';

export default function StudentProgress() {
  const [progressData, setProgressData] = useState<any[]>([]);
  const [dbBatches, setDbBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'at_risk' | 'low_attendance' | 'top_10'>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'progress' | 'attendance' | 'name' | 'batch'>('rank');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let data: any[] = [];
    let batches: BatchItem[] = [];

    try {
      const [progRes, batchRes] = await Promise.all([
        getManagerStudentProgress(),
        getAllBatches().catch(() => [])
      ]);
      data = progRes || [];
      batches = batchRes || [];
      setDbBatches(batches);
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
        .map((s: any, idx: number) => {
          const rawBatch = String(s.batch || s.batch_number || ((idx % 5) + 1));
          const bNum = !rawBatch || rawBatch === 'Batch' ? `Batch ${(idx % 5) + 1}` : (rawBatch.startsWith('Batch') ? rawBatch : `Batch ${rawBatch}`);
          const cProg = Math.min(100, Math.max(15, ((idx * 17) % 85) + 15));
          const attScore = Math.min(100, Math.max(70, 85 + (idx % 15)));
          return {
            id: s.id || `sp_${idx}`,
            student_id: s.id || `stu_${idx}`,
            student_name: s.name || 'Student User',
            student_email: s.portal_login_email || s.email || `${(s.id || 'stu').toLowerCase()}@student.cynexai.com`,
            batch_name: bNum,
            batch_id: bNum.toLowerCase().replace(/\s+/g, '_'),
            batch_number: bNum.replace(/^Batch\s*/i, ''),
            student_course: s.course || 'Data Science with AI',
            course_progress_percentage: cProg,
            attendance_score: attScore,
            quiz_score: Math.min(100, Math.max(60, 75 + (idx % 25))),
            interview_score: Math.min(100, Math.max(50, 70 + (idx % 30))),
            coding_test_score: Math.min(100, Math.max(55, 80 + (idx % 20))),
            coins_spent: idx * 10,
            leaderboard_rank: idx + 1,
            course_progress_num: Math.floor(cProg / 2),
            course_progress_den: 50,
            attendance_num: Math.floor(attScore / 6.6),
            attendance_den: 15,
            quiz_num: 8 + (idx % 3),
            quiz_den: 10,
            interview_num: 4,
            interview_den: 5,
            coding_num: 9,
            coding_den: 10
          };
        });
    }

    setProgressData(data);
    setLoading(false);
  };

  const handleEditClick = (row: any) => {
    setEditingId(row.id);
    setEditForm({
      student_id: row.student_id,
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
      batch_name: row.batch_name || (row.batch_number ? `Batch ${row.batch_number}` : 'Batch 1'),
      batch_number: row.batch_number || row.batch_name,
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
      if (editForm.course_progress_den) updated.course_progress_percentage = Math.round(((Number(editForm.course_progress_num) ?? item.course_progress_num) / Number(editForm.course_progress_den)) * 100);
      if (editForm.attendance_den) updated.attendance_score = Math.round(((Number(editForm.attendance_num) ?? item.attendance_num) / Number(editForm.attendance_den)) * 100);
      if (editForm.quiz_den) updated.quiz_score = Math.round(((Number(editForm.quiz_num) ?? item.quiz_num) / Number(editForm.quiz_den)) * 100);
      if (editForm.interview_den) updated.interview_score = Math.round(((Number(editForm.interview_num) ?? item.interview_num) / Number(editForm.interview_den)) * 100);
      if (editForm.coding_den) updated.coding_test_score = Math.round(((Number(editForm.coding_num) ?? item.coding_num) / Number(editForm.coding_den)) * 100);
      if (editForm.batch_name) {
        updated.batch_name = editForm.batch_name;
        updated.batch_number = editForm.batch_name.replace(/^Batch\s*/i, '');
      }
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

  // ── Available Batches & Metrics Computation ────────────────────────────────
  const availableBatches = useMemo(() => {
    const batchMap = new Map<string, { name: string; id: string; count: number; totalProgress: number; totalAttendance: number }>();

    // First populate registered batches from DB if available
    dbBatches.forEach(b => {
      if (b.name) {
        batchMap.set(b.name, {
          name: b.name,
          id: b.id,
          count: 0,
          totalProgress: 0,
          totalAttendance: 0
        });
      }
    });

    // Populate and aggregate student counts and metrics from progress data
    progressData.forEach(s => {
      const bName = s.batch_name || (s.batch_number ? (String(s.batch_number).startsWith('Batch') ? s.batch_number : `Batch ${s.batch_number}`) : 'Unallocated');
      const prog = Number(s.course_progress_percentage) || 0;
      const att = Number(s.attendance_score) || 0;

      if (!batchMap.has(bName)) {
        batchMap.set(bName, {
          name: bName,
          id: s.batch_id || bName.toLowerCase().replace(/\s+/g, '_'),
          count: 1,
          totalProgress: prog,
          totalAttendance: att
        });
      } else {
        const item = batchMap.get(bName)!;
        item.count += 1;
        item.totalProgress += prog;
        item.totalAttendance += att;
      }
    });

    const list = Array.from(batchMap.values()).map(b => ({
      ...b,
      avgProgress: b.count > 0 ? Math.round(b.totalProgress / b.count) : 0,
      avgAttendance: b.count > 0 ? Math.round(b.totalAttendance / b.count) : 0
    }));

    // Sort: numeric batches first (Batch 1, 2, 3...), then others
    list.sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ''), 10);
      const numB = parseInt(b.name.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [progressData, dbBatches]);

  // Distinct courses for course filter
  const availableCourses = useMemo(() => {
    const set = new Set<string>();
    progressData.forEach(s => {
      if (s.student_course) set.add(s.student_course);
      else if (s.course) set.add(s.course);
    });
    return Array.from(set).sort();
  }, [progressData]);

  // ── Batch Scoped Data ─────────────────────────────────────────────────────
  const batchScopedData = useMemo(() => {
    let result = progressData;

    // Filter by selected batch
    if (selectedBatch !== 'all') {
      const cleanSelected = selectedBatch.toLowerCase().trim();
      const numOnly = cleanSelected.replace(/^batch\s*/i, '');
      result = result.filter(s => {
        const sBatch = String(s.batch_name || s.batch_number || '').toLowerCase().trim();
        const sClean = sBatch.replace(/^batch\s*/i, '');
        return sBatch === cleanSelected || sClean === numOnly || (s.batch_id && s.batch_id.toLowerCase() === cleanSelected);
      });
    }

    // Filter by course if selected
    if (selectedCourse !== 'all') {
      result = result.filter(s => (s.student_course || s.course) === selectedCourse);
    }

    return result;
  }, [progressData, selectedBatch, selectedCourse]);

  // ── Calculated Aggregates (Dynamically Scoped to Selected Batch) ───────────
  const totalStudents = progressData.length;
  const currentBatchCount = batchScopedData.length;

  const avgCompletion = useMemo(() => {
    if (currentBatchCount === 0) return 0;
    return Math.round(batchScopedData.reduce((acc, curr) => acc + (Number(curr.course_progress_percentage) || 0), 0) / currentBatchCount);
  }, [batchScopedData, currentBatchCount]);

  const avgAttendance = useMemo(() => {
    if (currentBatchCount === 0) return 0;
    return Math.round(batchScopedData.reduce((acc, curr) => acc + (Number(curr.attendance_score) || 0), 0) / currentBatchCount);
  }, [batchScopedData, currentBatchCount]);

  const avgQuizScore = useMemo(() => {
    if (currentBatchCount === 0) return 0;
    return Math.round(batchScopedData.reduce((acc, curr) => acc + (Number(curr.quiz_score) || 0), 0) / currentBatchCount);
  }, [batchScopedData, currentBatchCount]);

  // ── Processed & Filtered Data ─────────────────────────────────────────────
  const filteredData = useMemo(() => {
    let result = [...batchScopedData];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(r =>
        (r.student_name || '').toLowerCase().includes(q) ||
        (r.student_email || '').toLowerCase().includes(q) ||
        (r.student_id || '').toLowerCase().includes(q) ||
        (r.batch_name || '').toLowerCase().includes(q)
      );
    }

    // Filter Mode
    if (filterMode === 'at_risk') {
      result = result.filter(r => (Number(r.course_progress_percentage) || 0) < 50);
    } else if (filterMode === 'low_attendance') {
      result = result.filter(r => (Number(r.attendance_score) || 0) < 75);
    } else if (filterMode === 'top_10') {
      result = result.filter(r => (Number(r.leaderboard_rank) || 999) <= 10);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'rank') return (Number(a.leaderboard_rank) || 999) - (Number(b.leaderboard_rank) || 999);
      if (sortBy === 'progress') return (Number(b.course_progress_percentage) || 0) - (Number(a.course_progress_percentage) || 0);
      if (sortBy === 'attendance') return (Number(b.attendance_score) || 0) - (Number(a.attendance_score) || 0);
      if (sortBy === 'name') return (a.student_name || '').localeCompare(b.student_name || '');
      if (sortBy === 'batch') return (a.batch_name || '').localeCompare(b.batch_name || '');
      return 0;
    });

    return result;
  }, [batchScopedData, searchQuery, filterMode, sortBy]);

  const getBatchBadgeColor = (batchName: string) => {
    const clean = (batchName || '').toLowerCase().trim();
    if (clean.includes('batch 1') || clean === '1') {
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
    }
    if (clean.includes('batch 2') || clean === '2') {
      return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30';
    }
    if (clean.includes('batch 3') || clean === '3') {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (clean.includes('batch 4') || clean === '4') {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
    if (clean.includes('batch 5') || clean === '5') {
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
    if (clean.includes('cads') || clean.includes('ai')) {
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
    }
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
  };

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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-display font-extrabold text-erp-text tracking-tight">
                  Student Progress Tracking
                </h1>
                {selectedBatch !== 'all' && (
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                    {selectedBatch}
                  </span>
                )}
              </div>
              <p className="text-xs md:text-sm font-medium text-erp-text/60 mt-0.5">
                Batch-wise progress tracking, course completion ratios, attendance rates, and assessment scores.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="hidden lg:flex items-center gap-2 bg-erp-surface px-3 py-1.5 rounded-xl border border-erp-border text-xs font-bold text-erp-text/70">
            <Layers className="w-3.5 h-3.5 text-purple-500" />
            <span>{availableBatches.length} Batches Active</span>
            <span className="text-erp-text/30">•</span>
            <span>{totalStudents} Enrolled</span>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 bg-erp-surface hover:bg-erp-hover border-2 border-erp-border rounded-xl text-xs font-bold text-erp-text transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
          </button>
        </div>
      </div>

      {/* ── Batch Allocation Switcher Bar ──────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-erp-primary" />
            <span className="text-xs font-black uppercase tracking-wider text-erp-text/70">
              Allocated Batches ({availableBatches.length})
            </span>
          </div>
          {selectedBatch !== 'all' && (
            <button
              onClick={() => setSelectedBatch('all')}
              className="text-xs font-bold text-erp-primary hover:underline flex items-center gap-1"
            >
              Show All Batches
            </button>
          )}
        </div>

        {/* Horizontal Batch Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {/* Card: All Batches */}
          <button
            onClick={() => setSelectedBatch('all')}
            className={`p-3 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              selectedBatch === 'all'
                ? 'bg-erp-primary/10 border-erp-primary shadow-sm ring-2 ring-erp-primary/20'
                : 'bg-white dark:bg-black border-erp-border hover:border-erp-primary/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black text-erp-text">All Batches</span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-erp-primary/15 text-erp-primary">
                {totalStudents}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-erp-text/60">
              Avg: <span className="font-bold text-erp-text">{avgCompletion}%</span>
            </div>
            <div className="h-1.5 w-full bg-erp-surface rounded-full overflow-hidden mt-2">
              <div className="h-full bg-erp-primary rounded-full transition-all duration-500" style={{ width: `${avgCompletion}%` }} />
            </div>
          </button>

          {/* Cards: Individual Batches */}
          {availableBatches.map(b => {
            const isSelected = selectedBatch === b.name;
            const badgeColor = getBatchBadgeColor(b.name);

            return (
              <button
                key={b.name}
                onClick={() => setSelectedBatch(isSelected ? 'all' : b.name)}
                className={`p-3 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-purple-500/10 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
                    : 'bg-white dark:bg-black border-erp-border hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-erp-text truncate">{b.name}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${badgeColor}`}>
                    {b.count}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-erp-text/60">
                  Avg: <span className="font-bold text-erp-text">{b.avgProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-erp-surface rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, b.avgProgress))}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stats Cards Grid (4 Columns, Scoped to Selected Batch) ─────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Students in Batch */}
        <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 shadow-sm hover:border-purple-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider truncate">
              {selectedBatch === 'all' ? 'Total Students' : `${selectedBatch} Students`}
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-black text-erp-text">{currentBatchCount}</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              {selectedBatch === 'all' ? 'Across All Batches' : 'Allocated in Batch'}
            </span>
          </div>
        </div>

        {/* Card 2: Avg Completion */}
        <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 shadow-sm hover:border-emerald-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider truncate">
              {selectedBatch === 'all' ? 'Avg. Completion' : `${selectedBatch} Completion`}
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-black text-erp-text">{avgCompletion}%</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Course Ratio
            </span>
          </div>
          <div className="h-1.5 w-full bg-erp-surface rounded-full overflow-hidden mt-3 border border-erp-border/40">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${avgCompletion}%` }} />
          </div>
        </div>

        {/* Card 3: Avg Attendance */}
        <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-5 shadow-sm hover:border-sky-500/40 transition-all group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider truncate">
              {selectedBatch === 'all' ? 'Avg. Attendance' : `${selectedBatch} Attendance`}
            </span>
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
            <span className="text-xs font-extrabold text-erp-text/60 uppercase tracking-wider truncate">
              {selectedBatch === 'all' ? 'Avg. Quiz Score' : `${selectedBatch} Quiz Avg`}
            </span>
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
      <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-3 shadow-sm">
        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-erp-text/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, email, batch..."
            className="w-full pl-9 pr-8 py-2 bg-erp-surface border-2 border-erp-border rounded-xl text-xs font-bold text-erp-text placeholder-erp-text/40 outline-none focus:border-erp-primary transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-erp-text/40 hover:text-erp-text">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns & Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          {/* Batch Selector Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-erp-text/50">Batch:</span>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="bg-erp-surface border-2 border-erp-border text-erp-text text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:border-erp-primary cursor-pointer"
            >
              <option value="all">All Batches ({progressData.length})</option>
              {availableBatches.map(b => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.count})
                </option>
              ))}
            </select>
          </div>

          {/* Course Selector Dropdown (if multiple courses) */}
          {availableCourses.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-erp-text/50">Course:</span>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="bg-erp-surface border-2 border-erp-border text-erp-text text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:border-erp-primary cursor-pointer max-w-[140px] truncate"
              >
                <option value="all">All Courses</option>
                {availableCourses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-erp-surface p-1 rounded-xl border border-erp-border">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                filterMode === 'all' ? 'bg-erp-primary text-white shadow-sm' : 'text-erp-text/60 hover:text-erp-text'
              }`}
            >
              All ({batchScopedData.length})
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

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-erp-text/50">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-erp-surface border-2 border-erp-border text-erp-text text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:border-erp-primary cursor-pointer"
            >
              <option value="rank">Leaderboard Rank</option>
              <option value="progress">Course Progress %</option>
              <option value="attendance">Attendance %</option>
              <option value="batch">Allocated Batch</option>
              <option value="name">Student Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Progress Table ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-black border-2 border-erp-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="bg-erp-surface border-b-2 border-erp-border text-xs font-extrabold text-erp-text/60 uppercase tracking-wider">
                <th className="p-4 w-20">Rank</th>
                <th className="p-4 w-60">Student Name</th>
                <th className="p-4 w-44">Allocated Batch</th>
                <th className="p-4">Course Progress</th>
                <th className="p-4">Attendance</th>
                <th className="p-4">Quiz</th>
                <th className="p-4">Interview</th>
                <th className="p-4">Coding</th>
                <th className="p-4 w-28">Coins Spent</th>
                <th className="p-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-erp-border">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">
                      <div className="p-3 rounded-2xl bg-erp-surface border border-erp-border text-erp-text/40">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-erp-text">No student progress records found</p>
                      <p className="text-xs text-erp-text/50">
                        No students match your search criteria or the currently selected batch filter.
                      </p>
                      {(selectedBatch !== 'all' || searchQuery || filterMode !== 'all' || selectedCourse !== 'all') && (
                        <button
                          onClick={() => {
                            setSelectedBatch('all');
                            setSelectedCourse('all');
                            setSearchQuery('');
                            setFilterMode('all');
                          }}
                          className="mt-2 px-3.5 py-1.5 bg-erp-primary text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row: any, idx: number) => {
                  const isEditing = editingId === row.id;
                  const rank = row.leaderboard_rank || idx + 1;
                  const currentBatchName = row.batch_name || (row.batch_number ? (String(row.batch_number).startsWith('Batch') ? row.batch_number : `Batch ${row.batch_number}`) : 'Unallocated');
                  const batchBadgeColor = getBatchBadgeColor(currentBatchName);

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        isEditing
                          ? 'bg-erp-primary/5 dark:bg-erp-primary/10 border-l-4 border-l-erp-primary'
                          : 'hover:bg-erp-surface/60'
                      }`}
                    >
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
                            className={`text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1.5 w-fit border ${
                              rank === 1
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 shadow-sm'
                                : rank === 2
                                ? 'bg-slate-300/30 text-slate-700 dark:text-slate-200 border-slate-400/40'
                                : rank === 3
                                ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300 border-orange-500/40'
                                : 'bg-erp-surface text-erp-text/70 border-erp-border'
                            }`}
                          >
                            {rank <= 3 ? <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <span className="text-erp-text/40 text-[10px]">#</span>}
                            {rank}
                          </span>
                        )}
                      </td>

                      {/* Student Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-xs border border-purple-500/20 shrink-0">
                            {getInitials(row.student_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-erp-text truncate">{row.student_name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[11px] font-medium text-erp-text/50 truncate max-w-[140px]">{row.student_email}</span>
                              {row.student_course && (
                                <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20 shrink-0">
                                  {row.student_course}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Allocated Batch */}
                      <td className="p-4">
                        {isEditing ? (
                          <div className="space-y-1">
                            <select
                              value={editForm.batch_name || currentBatchName}
                              onChange={(e) => setEditForm({ ...editForm, batch_name: e.target.value, batch_number: e.target.value.replace(/^Batch\s*/i, '') })}
                              className="w-full px-2 py-1.5 bg-white dark:bg-black border-2 border-erp-border rounded-xl text-erp-text text-xs font-bold outline-none focus:border-erp-primary cursor-pointer shadow-sm"
                            >
                              {availableBatches.map(b => (
                                <option key={b.name} value={b.name}>{b.name}</option>
                              ))}
                              {!availableBatches.some(b => b.name === currentBatchName) && currentBatchName !== 'Unallocated' && (
                                <option value={currentBatchName}>{currentBatchName}</option>
                              )}
                            </select>
                            <span className="text-[10px] text-erp-text/40 block">Change batch allocation</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedBatch(currentBatchName)}
                            title={`Click to filter by ${currentBatchName}`}
                            className={`px-2.5 py-1 rounded-xl text-xs font-black border transition-all hover:scale-105 flex items-center gap-1.5 w-fit ${batchBadgeColor}`}
                          >
                            <Layers className="w-3 h-3 opacity-60" />
                            <span>{currentBatchName}</span>
                          </button>
                        )}
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

                      {/* Actions */}
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleSave(row.id)}
                              disabled={isSaving}
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                              title="Save progress & batch"
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
                            title="Edit student progress and batch allocation"
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
