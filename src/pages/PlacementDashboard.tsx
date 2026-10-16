import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Briefcase,
  Users,
  Building2,
  Cpu,
  Laptop,
  Compass,
  Search,
  Download,
  ExternalLink,
  MapPin,
  Calendar,
  CheckCircle2,
  ArrowUpDown,
  ChevronRight,
  TrendingUp,
  Award,
  Share2,
  X,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Building,
  BadgeCheck,
  ChevronDown,
  Layers,
  ArrowUpRight,
  Check,
  Lock,
  User,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  COLLABORATED_COLLEGES,
  STREAM_OPPORTUNITIES,
  PLACED_STUDENTS,
  PLACEMENT_STATS,
  PlacedStudent,
  StreamOpportunity,
  CollaboratedCollege,
} from '../data/placementData';

interface PlacementDashboardProps {
  initialAuth?: boolean;
}

export default function PlacementDashboard({ initialAuth }: PlacementDashboardProps = {}) {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (initialAuth !== undefined) return initialAuth;
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('cynexai_placement_auth') === 'true';
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError(null);

    const cleanUser = usernameInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();

    if (cleanUser === 'cynexai800' && cleanPass === 'admin123') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('cynexai_placement_auth', 'true');
      }
      setIsAuthenticated(true);
      showToast('Welcome cynexai800! Placement Dashboard unlocked.');
    } else {
      setLoginError('Invalid username or password. Please verify your credentials.');
    }
    setIsSubmitting(false);
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cynexai_placement_auth');
    }
    setIsAuthenticated(false);
    setUsernameInput('');
    setPasswordInput('');
    showToast('Signed out successfully. Placement portal is locked.');
  };

  // Filters & State for Placed Students Table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStream, setSelectedStream] = useState<'All' | 'CEC' | 'ECE' | 'Non-IT'>('All');
  const [sortBy, setSortBy] = useState<'date-desc' | 'package-desc' | 'name-asc'>('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Selected Student for Detail Modal
  const [selectedStudent, setSelectedStudent] = useState<PlacedStudent | null>(null);

  // College Directory Modal / View All
  const [showCollegesModal, setShowCollegesModal] = useState(false);
  const [collegeSearch, setCollegeSearch] = useState('');

  // Toast / Copy notification
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return PLACED_STUDENTS.filter((student) => {
      const matchesStream = selectedStream === 'All' || student.stream === selectedStream;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        student.studentName.toLowerCase().includes(q) ||
        student.studentCode.toLowerCase().includes(q) ||
        student.company.toLowerCase().includes(q) ||
        student.college.toLowerCase().includes(q) ||
        student.role.toLowerCase().includes(q) ||
        student.branch.toLowerCase().includes(q) ||
        student.location.toLowerCase().includes(q);
      return matchesStream && matchesSearch;
    }).sort((a, b) => {
      if (sortBy === 'package-desc') return b.packageLpa - a.packageLpa;
      if (sortBy === 'name-asc') return a.studentName.localeCompare(b.studentName);
      // default: date desc
      return new Date(b.placementDate).getTime() - new Date(a.placementDate).getTime();
    });
  }, [searchQuery, selectedStream, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredStudents.length / rowsPerPage) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredStudents.slice(start, start + rowsPerPage);
  }, [filteredStudents, currentPage]);


  // Filtered Colleges for Modal
  const filteredColleges = useMemo(() => {
    if (!collegeSearch.trim()) return COLLABORATED_COLLEGES;
    const q = collegeSearch.toLowerCase();
    return COLLABORATED_COLLEGES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q)
    );
  }, [collegeSearch]);

  // Export to CSV Handler
  const handleExportCSV = () => {
    const headers = [
      'Student ID',
      'Student Name',
      'Gender',
      'Stream',
      'Branch',
      'Collaborated College',
      'Placed Company',
      'Designation / Role',
      'Package (LPA)',
      'Location',
      'Placement Date',
      'CynexAI Course',
      'Offer Status',
      'Verification Code',
    ];

    const rows = filteredStudents.map((s) => [
      `"${s.studentCode}"`,
      `"${s.studentName}"`,
      `"${s.gender}"`,
      `"${s.stream}"`,
      `"${s.branch}"`,
      `"${s.college}"`,
      `"${s.company}"`,
      `"${s.role}"`,
      `"${s.packageFormatted}"`,
      `"${s.location}"`,
      `"${s.placementDate}"`,
      `"${s.cynexCourse}"`,
      `"${s.offerStatus}"`,
      `"${s.verifiedOfferId}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CynexAI_Placement_Report_${selectedStream}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Placement directory exported as CSV!');
  };

  const showToast = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'CynexAI Placement & Campus Intelligence Dashboard',
        text: 'Explore verified student placements, collaborated colleges, and active career opportunities with CynexAI.',
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Dashboard URL copied to clipboard!');
    }
  };

  // ── Login Gate for Unauthenticated Users ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAFAFC] text-slate-900 font-sans relative overflow-x-hidden selection:bg-slate-900 selection:text-white pt-24 pb-24 flex items-center justify-center">
        {/* Subtle Architectural Grid Background */}
        <div 
          className="fixed inset-0 pointer-events-none z-0 opacity-[0.25]"
          style={{
            backgroundImage: `linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Floating Toast Notification */}
        <AnimatePresence>
          {copiedNotification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-24 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{copiedNotification}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-md w-full mx-auto px-4 relative z-10">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/50">
            {/* Header / Lock badge */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-white shadow-md mb-3">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Protected Dashboard
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Placement Command Portal
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Sign in with authorized administrator credentials to access verified placement records and partner metrics.
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Authentication Failed</div>
                  <div className="text-rose-600/90 text-[11px]">{loginError}</div>
                </div>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="admin-username" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Admin Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-username"
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:bg-white transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-xl py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Unlock Placement Dashboard</span>
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <Link
                to="/"
                className="text-xs text-slate-500 hover:text-slate-900 font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <span>← Back to CynexAI Home</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFC] text-slate-900 font-sans relative overflow-x-hidden selection:bg-slate-900 selection:text-white pt-20 pb-24">
      {/* ── Subtitle Architectural Grid Background ── */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.25]"
        style={{
          backgroundImage: `linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {copiedNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{copiedNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* ── Top Header & Utilities ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-slate-200 mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Link to="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-900 font-semibold">Placement Dashboard</span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin: cynexai800</span>
            </span>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 text-xs font-semibold transition-all shadow-xs"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Share</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Sign out & lock dashboard"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* ── Hero Title Strip ── */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified Placement Intelligence
                </span>
                <span className="text-xs font-medium text-slate-400">AY 2025–2026</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
                Institutional Placement & Opportunities Command
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-2xl">
                Real-time career impact index for partnered autonomous institutions, verified alumni placements, and live recruitment pipelines across academic streams.
              </p>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-xs">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Placement Rate</div>
                <div className="text-xl font-bold text-slate-900">{PLACEMENT_STATS.placementRatePercentage}%</div>
              </div>
              <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-xs">
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Highest Package</div>
                <div className="text-xl font-bold text-slate-900">₹{PLACEMENT_STATS.highestPackageLpa} LPA</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ANTI-SLOP BENTO METRICS ARCHITECTURE
            Clean, structured, data-dense executive layout:
            Top 3 primary indicators + Bottom 3 stream specializations
        ───────────────────────────────────────────────────────────── */}
        <div className="mb-12">
          
          {/* Top 3 Core Institutional KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            
            {/* KPI 1: Collaborated Colleges */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span className="uppercase tracking-wider font-semibold text-[11px] text-slate-400">Institutional MoUs</span>
                  <button 
                    onClick={() => setShowCollegesModal(true)}
                    className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-0.5 text-[11px]"
                  >
                    Directory ({PLACEMENT_STATS.totalCollegesCollaborated}) <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
                    {PLACEMENT_STATS.totalCollegesCollaborated}
                  </div>
                  <span className="text-sm font-semibold text-slate-400">+</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 mt-1">Colleges Collaborated</h3>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Autonomous & University Tie-ups</span>
                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">Tier-1 Drives</span>
              </div>
            </div>

            {/* KPI 2: Students Placed by CynexAI */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span className="uppercase tracking-wider font-semibold text-[11px] text-slate-400">Verified Alumni</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    <BadgeCheck className="w-3 h-3 text-emerald-600" /> 96.4% Success
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
                    {PLACEMENT_STATS.totalStudentsPlaced.toLocaleString()}
                  </div>
                  <span className="text-sm font-semibold text-slate-400">+</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 mt-1">Students Placed by CynexAI</h3>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Avg: <strong className="text-slate-800">₹{PLACEMENT_STATS.averagePackageLpa} LPA</strong></span>
                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{PLACEMENT_STATS.hiringPartnersCount}+ Hiring MNCs</span>
              </div>
            </div>

            {/* KPI 3: Opportunities Currently Available */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span className="uppercase tracking-wider font-semibold text-[11px] text-slate-400">Active Recruitment</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" /> Live Drives
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
                    {PLACEMENT_STATS.totalOpportunities}
                  </div>
                  <span className="text-sm font-semibold text-slate-400">+</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800 mt-1">Opportunities Currently Available</h3>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Eligible: <strong className="text-slate-800">2025 & 2026 Batch</strong></span>
                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">Weekly Updates</span>
              </div>
            </div>

          </div>

          {/* ─────────────────────────────────────────────────────────────
              Stream Specialization Matrix (Items 4, 5, 6: CEC, ECE, Non-IT)
              Rendered as an integrated Stream Allocation Bar
          ───────────────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span>Stream-Wise Available Opportunities Matrix</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct job openings categorized by undergraduate discipline and CynexAI skill specialization tracks.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-sky-500" /> CEC: 39%
                <span className="mx-1 text-slate-300">•</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500" /> ECE: 31%
                <span className="mx-1 text-slate-300">•</span>
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Non-IT: 30%
              </div>
            </div>

            {/* Proportion Bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 flex overflow-hidden mb-5">
              <div style={{ width: '38.7%' }} className="bg-sky-500 h-full" title="CEC Opportunities (96)" />
              <div style={{ width: '31.4%' }} className="bg-indigo-500 h-full" title="ECE Opportunities (78)" />
              <div style={{ width: '29.9%' }} className="bg-amber-500 h-full" title="Non-IT Opportunities (74)" />
            </div>

            {/* 3 Stream Detailed Bento Panels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Stream 1: CEC Available Opportunities */}
              <div 
                onClick={() => {
                  setSelectedStream('CEC');
                  document.getElementById('placed-students-table')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`cursor-pointer rounded-xl p-4 border transition-all ${
                  selectedStream === 'CEC'
                    ? 'border-sky-500 bg-sky-50/40 ring-1 ring-sky-500/20'
                    : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-sky-800 bg-sky-100/70 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                    CSE • IT • AI/DS
                  </span>
                  <span className="text-xs font-semibold text-slate-500">₹5 - ₹14 LPA</span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1">
                  <span className="text-2xl font-black font-mono text-slate-900">{PLACEMENT_STATS.cecOpportunities}</span>
                  <span className="text-xs font-bold text-slate-400">Openings</span>
                </div>

                <h4 className="text-xs font-bold text-slate-800">CEC Available Opportunities</h4>
                <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-1">
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">Java Full Stack</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">AI/ML</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">Cloud DevOps</span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-sky-700">
                  <span>View Placed CEC Students</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Stream 2: ECE Available Opportunities */}
              <div 
                onClick={() => {
                  setSelectedStream('ECE');
                  document.getElementById('placed-students-table')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`cursor-pointer rounded-xl p-4 border transition-all ${
                  selectedStream === 'ECE'
                    ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-indigo-800 bg-indigo-100/70 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                    ECE • EEE • Circuits
                  </span>
                  <span className="text-xs font-semibold text-slate-500">₹4.5 - ₹11.5 LPA</span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1">
                  <span className="text-2xl font-black font-mono text-slate-900">{PLACEMENT_STATS.eceOpportunities}</span>
                  <span className="text-xs font-bold text-slate-400">Openings</span>
                </div>

                <h4 className="text-xs font-bold text-slate-800">ECE Available Opportunities</h4>
                <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-1">
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">Embedded C</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">IoT Firmware</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">VLSI Trainee</span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-indigo-700">
                  <span>View Placed ECE Students</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Stream 3: Other NON IT Available Opportunities */}
              <div 
                onClick={() => {
                  setSelectedStream('Non-IT');
                  document.getElementById('placed-students-table')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`cursor-pointer rounded-xl p-4 border transition-all ${
                  selectedStream === 'Non-IT'
                    ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500/20'
                    : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                    Mech • Civil • Commerce • B.Sc
                  </span>
                  <span className="text-xs font-semibold text-slate-500">₹4 - ₹7.5 LPA</span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1">
                  <span className="text-2xl font-black font-mono text-slate-900">{PLACEMENT_STATS.nonItOpportunities}</span>
                  <span className="text-xs font-bold text-slate-400">Openings</span>
                </div>

                <h4 className="text-xs font-bold text-slate-800">Other Non-IT Opportunities</h4>
                <div className="mt-2 text-[11px] text-slate-500 flex flex-wrap gap-1">
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">QA Automation</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">Power BI</span>
                  <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">SAP Data</span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-semibold text-amber-800">
                  <span>View Placed Non-IT Students</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

            </div>
          </div>
        </div>


        {/* ─────────────────────────────────────────────────────────────
            PARTNER COLLEGES STRIP
        ───────────────────────────────────────────────────────────── */}
        <div className="mb-14">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Collaborated University & College Network
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                54+ Autonomous institutions and state universities partnering for on-campus technology enablement.
              </p>
            </div>
            <button
              onClick={() => setShowCollegesModal(true)}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs hover:bg-slate-50"
            >
              All 54 Colleges &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {COLLABORATED_COLLEGES.slice(0, 6).map((col) => (
              <div
                key={col.id}
                onClick={() => {
                  setCollegeSearch(col.shortName);
                  setShowCollegesModal(true);
                }}
                className="cursor-pointer bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 text-center transition-all shadow-2xs hover:shadow-xs"
              >
                <div className="w-8 h-8 mx-auto rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs mb-1.5">
                  {col.shortName.slice(0, 3)}
                </div>
                <h4 className="font-bold text-slate-900 text-xs line-clamp-1">
                  {col.shortName}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{col.location}</p>
                <div className="mt-2 text-[10px] font-semibold text-slate-700 bg-slate-100 rounded py-0.5 px-1">
                  {col.studentsPlaced} Placed
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            BELOW IT: PLACED STUDENTS COMPREHENSIVE DATA TABLE
        ───────────────────────────────────────────────────────────── */}
        <div id="placed-students-table" className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
          
          {/* Table Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1">
                <BadgeCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Alumni Placement Records</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                Who Got Placed, Where, When & CTC Package
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect authentic student placements, hiring companies, designations, and packages.
              </p>
            </div>

            {/* Stream Filter Toggle Pills */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {(['All', 'CEC', 'ECE', 'Non-IT'] as const).map((stream) => (
                <button
                  key={stream}
                  onClick={() => {
                    setSelectedStream(stream);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedStream === stream
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {stream === 'All' ? 'All Streams' : `${stream} Stream`}
                </button>
              ))}
            </div>
          </div>

          {/* Search and Sort Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by student name, college, company, role, or ID..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-slate-400 cursor-pointer appearance-none"
                >
                  <option value="date-desc">Newest Placements</option>
                  <option value="package-desc">Highest Package (CTC)</option>
                  <option value="name-asc">Student Name (A-Z)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 pointer-events-none" />
              </div>

              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-all"
                title="Export filtered records as CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Stream / Branch</th>
                  <th className="py-3 px-4">Collaborated College</th>
                  <th className="py-3 px-4">Placed Company</th>
                  <th className="py-3 px-4">Role / Designation</th>
                  <th className="py-3 px-4">Package (CTC)</th>
                  <th className="py-3 px-4">Placed Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <p className="text-xs font-medium">No placement records found matching your filters.</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedStream('All');
                        }}
                        className="mt-1 text-xs text-slate-700 underline font-semibold"
                      >
                        Reset filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => setSelectedStudent(s)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      {/* Student */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full ${s.avatarBg} text-white font-bold text-[11px] flex items-center justify-center shrink-0`}
                          >
                            {s.studentName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                              {s.studentName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{s.studentCode}</div>
                          </div>
                        </div>
                      </td>

                      {/* Stream & Branch */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex items-center w-fit text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              s.stream === 'CEC'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                : s.stream === 'ECE'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {s.stream}
                          </span>
                          <span className="text-[11px] text-slate-600 line-clamp-1">{s.branch}</span>
                        </div>
                      </td>

                      {/* College */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 line-clamp-1">{s.college}</div>
                        <div className="text-[10px] text-slate-400">{s.collegeShort}</div>
                      </td>

                      {/* Company */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{s.company}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{s.location}</span>
                        </div>
                      </td>

                      {/* Role & CynexAI Course */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{s.role}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Course: {s.cynexCourse}
                        </div>
                      </td>

                      {/* Package */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {s.packageFormatted}
                        </span>
                      </td>

                      {/* Placed Date */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                        {new Date(s.placementDate).toLocaleDateString('en-IN', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-2.5 h-2.5" />
                          <span>{s.offerStatus}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <div>
              Showing <strong className="text-slate-800">{paginatedStudents.length}</strong> of{' '}
              <strong className="text-slate-800">{filteredStudents.length}</strong> students
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700"
              >
                Previous
              </button>

              <span className="px-2 font-medium text-slate-600">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            CAMPUS COLLABORATION CTA (CLEAN EDITORIAL STRIP)
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-14 bg-slate-900 text-white rounded-2xl p-7 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400 mb-1">
              For University Deans & Placement Cells
            </div>
            <h3 className="text-xl font-bold text-white">
              Partner with CynexAI for Industry 4.0 Center of Excellence
            </h3>
            <p className="mt-1 text-xs text-slate-300 max-w-xl">
              Equip your undergraduate batches across CEC, ECE, and Non-IT departments with verified tech internships and campus placement drives.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/#contact"
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition-all shadow-xs"
            >
              Request Campus MoU
            </Link>
            <Link
              to="/student/career"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 font-bold text-xs transition-all"
            >
              Career Portal
            </Link>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────
          STUDENT DETAIL & OFFER VERIFICATION MODAL
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl relative"
            >
              <button
                onClick={() => setSelectedStudent(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div
                  className={`w-11 h-11 rounded-full ${selectedStudent.avatarBg} text-white font-bold text-base flex items-center justify-center`}
                >
                  {selectedStudent.studentName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{selectedStudent.studentName}</h3>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {selectedStudent.stream}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{selectedStudent.studentCode}</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 text-xs space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Company</span>
                  <span className="font-bold text-slate-900">{selectedStudent.company}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Package (CTC)</span>
                  <span className="font-bold text-slate-900 font-mono">{selectedStudent.packageFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Role</span>
                  <span className="font-medium text-slate-800">{selectedStudent.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location</span>
                  <span className="font-medium text-slate-800">{selectedStudent.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">College</span>
                  <span className="font-medium text-slate-800 text-right">{selectedStudent.college}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Branch</span>
                  <span className="font-medium text-slate-800">{selectedStudent.branch}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between">
                  <span className="text-slate-500">CynexAI Program</span>
                  <span className="font-semibold text-slate-900">{selectedStudent.cynexCourse}</span>
                </div>
              </div>

              {selectedStudent.quote && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-slate-600 italic">
                    &ldquo;{selectedStudent.quote}&rdquo;
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ID: {selectedStudent.verifiedOfferId}</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  VERIFIED OFFER
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────
          ALL COLLABORATED COLLEGES MODAL
      ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCollegesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-slate-600" />
                    <span>Collaborated Colleges Directory ({COLLABORATED_COLLEGES.length}+)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Autonomous and university partner institutions with active campus engagement.
                  </p>
                </div>
                <button
                  onClick={() => setShowCollegesModal(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={collegeSearch}
                  onChange={(e) => setCollegeSearch(e.target.value)}
                  placeholder="Filter colleges by name or location..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div className="overflow-y-auto pr-1 space-y-2 flex-1">
                {filteredColleges.map((col) => (
                  <div
                    key={col.id}
                    className="bg-slate-50/70 border border-slate-200/80 p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{col.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                          {col.accreditation}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {col.location}, {col.district} • MoU: {col.mouYear} • {col.type}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-slate-900">{col.studentsPlaced} Placed</span>
                      <button
                        onClick={() => {
                          setSearchQuery(col.shortName);
                          setShowCollegesModal(false);
                          const el = document.getElementById('placed-students-table');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold"
                      >
                        View Students
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
