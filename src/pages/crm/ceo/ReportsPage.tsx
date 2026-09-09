import React, { useState, useEffect } from 'react';
import { getEmployeeReports, getProjectHierarchyReport, EmployeeReport } from '../../../lib/api/reports';
import { getAllTasks, Task } from '../../../lib/api/tasks';
import {
  Users, Phone, CheckSquare, TrendingUp, Award,
  ChevronDown, ChevronRight, Calendar, Filter, RefreshCw,
  Shield, User, Star, Briefcase, CheckCircle2, Circle,
  Loader2, BarChart2
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtMin = (mins: number) => {
  if (!mins || mins === 0) return '0m';
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
};

const PRIORITY_PILL: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-700 dark:text-white border border-red-200',
  High: 'bg-orange-100 text-orange-700 border border-orange-200',
  Medium: 'bg-blue-100 text-blue-700 dark:text-white border border-blue-200',
  Low: 'bg-slate-100 dark:bg-zinc-900/50 text-slate-600 border border-slate-200 dark:border-white/10',
};

const STATUS_PILL: Record<string, string> = {
  'To Do': 'bg-slate-100 dark:bg-zinc-900/50 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700 dark:text-white',
  'Review': 'bg-purple-100 text-purple-700',
  'Done': 'bg-emerald-100 text-emerald-700',
};

const ROLE_BADGE: Record<string, string> = {
  CEO: 'bg-amber-100 text-amber-700 border border-amber-200',
  Manager: 'bg-blue-100 text-blue-700 dark:text-white border border-blue-200',
  'Sales/HR': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  Teacher: 'bg-purple-100 text-purple-700 border border-purple-200',
  DM: 'bg-pink-100 text-pink-700 border border-pink-200',
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-erp-surface border-2 border-erp-border rounded-2xl p-4 flex gap-3 items-center shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-erp-text/50 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-black text-erp-text">{value}</p>
      </div>
    </div>
  );
}

// ── Task Mini Card ─────────────────────────────────────────────────────────────
function TaskMiniCard({ task }: { task: Task }) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'Done';

  return (
    <div className="flex items-start gap-3 p-2.5 bg-erp-background rounded-xl border border-erp-border/60 group">
      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${task.status === 'Done' ? 'bg-emerald-500' : task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${task.status === 'Done' ? 'line-through text-erp-text/40' : 'text-erp-text'}`}>{task.title}</p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {task.due_date && (
            <span className={`text-[10px] font-bold ${isOverdue ? 'text-red-500' : 'text-erp-text/40'}`}>
              {isOverdue ? '⚠ ' : ''}{new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {task.tags && <span className="text-[10px] text-erp-text/40 truncate">{task.tags}</span>}
          {(task as any).created_by_name && (
            <span className="text-[10px] font-bold text-erp-text/50 bg-erp-border/40 px-1.5 py-0.5 rounded">
              By: {(task as any).created_by_name}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_PILL[task.priority] || 'bg-slate-100 dark:bg-zinc-900/50 text-slate-500'}`}>{task.priority}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_PILL[task.status] || ''}`}>{task.status}</span>
      </div>
    </div>
  );
}

// ── Employee Row ───────────────────────────────────────────────────────────────
function EmployeeRow({ report, rank, allTasks, dateFrom, dateTo }: { report: EmployeeReport; rank: number; allTasks: Task[]; dateFrom: string; dateTo: string; }) {
  const [expanded, setExpanded] = useState(false);

  // Filter tasks to match the date range (same as the report stats)
  const myTasks = allTasks.filter(t => {
    if (t.assignee_id !== report.user_id) return false;
    if (t.created_at) {
      const taskDate = t.created_at.split('T')[0];
      if (dateFrom && taskDate < dateFrom) return false;
      if (dateTo && taskDate > dateTo) return false;
    }
    return true;
  });
  const doneTasks = myTasks.filter(t => t.status === 'Done');
  const activeTasks = myTasks.filter(t => t.status !== 'Done');

  const rankColor = rank === 1 ? 'text-amber-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-amber-700' : 'text-erp-text/30';

  return (
    <>
      <tr
        className="border-b border-erp-border/40 hover:bg-erp-primary/5 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3.5">
          <span className={`font-black text-sm ${rankColor}`}>#{rank}</span>
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-erp-primary/15 border-2 border-erp-primary/20 flex items-center justify-center text-xs font-black text-erp-primary flex-shrink-0">
              {report.user_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-erp-text text-sm">{report.user_name}</p>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[report.user_role] || 'bg-slate-100 dark:bg-zinc-900/50 text-slate-500'}`}>
                {report.user_role}
              </span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5 text-center">
          <span className="font-bold text-erp-text">{report.total_calls}</span>
        </td>
        <td className="px-4 py-3.5 text-center">
          <div className="flex flex-col items-center">
            <span className="font-bold text-erp-text">{report.tasks_completed}</span>
            {report.subtasks_completed > 0 && (
              <span className="text-[9px] font-bold text-erp-primary">+{report.subtasks_completed} subtasks</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3.5 text-center">
          <div className="flex flex-col items-center justify-center text-xs font-bold text-erp-text/60">
            <span>{report.login_time ? new Date(report.login_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}</span>
            {report.logout_time ? (
              <span className="text-[10px] text-erp-text/40">{new Date(report.logout_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            ) : report.login_time ? (
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full mt-0.5 inline-block">Active</span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3.5 text-center">
          <span className={`font-bold text-sm ${report.tasks_overdue > 0 ? 'text-red-500' : 'text-erp-text/30'}`}>
            {report.tasks_overdue > 0 ? report.tasks_overdue : '—'}
          </span>
        </td>
        <td className="px-4 py-3.5 text-center">
          <span className={`font-bold text-sm ${report.conversions > 0 ? 'text-emerald-600' : 'text-erp-text/30'}`}>
            {report.conversions > 0 ? report.conversions : '—'}
          </span>
        </td>
        <td className="px-4 py-3.5 text-center">
          <span className="font-bold text-sm text-erp-primary">{fmtMin(report.total_time_minutes)}</span>
        </td>
        <td className="px-4 py-3.5 text-right">
          <div className="flex items-center justify-end gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              report.completion_rate >= 80 ? 'bg-emerald-100 text-emerald-700' :
              report.completion_rate >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-600'
            }`}>{report.completion_rate}%</span>
            {expanded ? <ChevronDown className="w-4 h-4 text-erp-text/40" /> : <ChevronRight className="w-4 h-4 text-erp-text/40" />}
          </div>
        </td>
      </tr>

      {/* Expanded Task List */}
      {expanded && (
        <tr className="bg-erp-surface/50 border-b border-erp-border/40">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4">
              <div className="bg-erp-surface border border-erp-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-erp-text/40 font-bold uppercase mb-1">In Progress</p>
                <p className="text-lg font-black text-blue-600">{report.tasks_in_progress}</p>
              </div>
              <div className="bg-erp-surface border border-erp-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-erp-text/40 font-bold uppercase mb-1">Overdue</p>
                <p className={`text-lg font-black ${report.tasks_overdue > 0 ? 'text-red-500' : 'text-erp-text/30'}`}>{report.tasks_overdue}</p>
              </div>
              <div className="bg-erp-surface border border-erp-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-erp-text/40 font-bold uppercase mb-1">Time Logged</p>
                <p className="text-lg font-black text-erp-primary">{fmtMin(report.total_time_minutes)}</p>
              </div>
              <div className="bg-erp-surface border border-erp-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-erp-text/40 font-bold uppercase mb-1">Conversions</p>
                <p className="text-lg font-black text-emerald-600">{report.conversions}</p>
              </div>
              <div className="bg-erp-surface border border-erp-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-erp-text/40 font-bold uppercase mb-1">Subtasks Done</p>
                <p className="text-lg font-black text-erp-primary">{report.subtasks_completed}</p>
              </div>
              <div className="bg-erp-surface border border-erp-border rounded-xl p-3 text-center">
                <p className="text-[10px] text-erp-text/40 font-bold uppercase mb-1">Missed Daily</p>
                <p className={`text-lg font-black ${report.daily_tasks_missed > 0 ? 'text-red-500' : 'text-erp-text/30'}`}>{report.daily_tasks_missed}</p>
              </div>
            </div>

            {myTasks.length === 0 ? (
              <p className="text-xs text-erp-text/40 text-center py-3">No tasks assigned to this employee</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Tasks */}
                {activeTasks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-erp-text/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Circle className="w-3 h-3 text-blue-500" /> Active Tasks ({activeTasks.length})
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {activeTasks.map(t => <TaskMiniCard key={t.id} task={t} />)}
                    </div>
                  </div>
                )}
                {/* Completed Tasks */}
                {doneTasks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-erp-text/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Completed ({doneTasks.length})
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {doneTasks.map(t => <TaskMiniCard key={t.id} task={t} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Project Hierarchy Card ─────────────────────────────────────────────────────
interface ProjectGroup {
  project_id: string;
  project_name: string;
  project_status: string;
  project_color: string;
  general_managers: any[];
  managers: any[];
  members: any[];
}

function ProjectHierarchyCard({ group }: { group: ProjectGroup }) {
  const [open, setOpen] = useState(true);
  const MemberBadge = ({ m, role }: { m: any; role: string }) => {
    const colors: Record<string, string> = {
      general_manager: 'bg-orange-50 text-orange-700 border-orange-200',
      manager: 'bg-sky-50 text-sky-700 border-sky-200',
      member: 'bg-slate-50 dark:bg-zinc-900/50 text-slate-600 border-slate-200 dark:border-white/10',
    };
    const icons: Record<string, React.ReactNode> = {
      general_manager: <Star className="w-3 h-3" />,
      manager: <Shield className="w-3 h-3" />,
      member: <User className="w-3 h-3" />,
    };
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${colors[role]}`}>
        {icons[role]}
        <span>{m.user_name || 'Unknown'}</span>
        <span className="text-[10px] opacity-60">({m.task_count || 0})</span>
      </div>
    );
  };

  return (
    <div className="bg-erp-surface border-2 border-erp-border rounded-2xl overflow-hidden shadow-sm">
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-erp-background/60 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.project_color || '#6366f1' }} />
        <span className="font-bold text-erp-text flex-1">{group.project_name}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${group.project_status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 dark:bg-zinc-900/50 text-slate-500 border-slate-200 dark:border-white/10'}`}>
          {group.project_status}
        </span>
        <div className="flex items-center gap-1 text-erp-text/40 text-xs">
          <Users className="w-3 h-3" />
          <span>{group.general_managers.length + group.managers.length + group.members.length}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-erp-text/40" /> : <ChevronRight className="w-4 h-4 text-erp-text/40" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-erp-border/40 pt-3">
          {group.general_managers.length > 0 && (
            <div>
              <p className="text-[10px] text-erp-text/40 uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1">
                <Star className="w-3 h-3 text-orange-500" /> General Manager
              </p>
              <div className="flex flex-wrap gap-1.5">{group.general_managers.map((m, i) => <MemberBadge key={i} m={m} role="general_manager" />)}</div>
            </div>
          )}
          {group.managers.length > 0 && (
            <div>
              <p className="text-[10px] text-erp-text/40 uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1">
                <Shield className="w-3 h-3 text-sky-500" /> Managers
              </p>
              <div className="flex flex-wrap gap-1.5">{group.managers.map((m, i) => <MemberBadge key={i} m={m} role="manager" />)}</div>
            </div>
          )}
          {group.members.length > 0 && (
            <div>
              <p className="text-[10px] text-erp-text/40 uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1">
                <Users className="w-3 h-3 text-slate-400" /> Team Members
              </p>
              <div className="flex flex-wrap gap-1.5">{group.members.map((m, i) => <MemberBadge key={i} m={m} role="member" />)}</div>
            </div>
          )}
          {group.general_managers.length === 0 && group.managers.length === 0 && group.members.length === 0 && (
            <p className="text-xs text-erp-text/40 text-center py-2">No hierarchy assigned — assign via Task Manager → Project → Hierarchy</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
type TabType = 'employees' | 'projects';

export default function ReportsPage() {
  const [tab, setTab] = useState<TabType>('employees');
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [projectData, setProjectData] = useState<ProjectGroup[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<keyof EmployeeReport>('completion_rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [roleFilter, setRoleFilter] = useState('');

  const loadReports = async () => {
    setLoading(true);
    const [data, tasks] = await Promise.all([
      getEmployeeReports(dateFrom || undefined, dateTo || undefined),
      getAllTasks(),
    ]);
    setReports(data);
    setAllTasks(tasks);
    setLoading(false);
  };

  const loadProjectHierarchy = async () => {
    setLoading(true);
    const rows = await getProjectHierarchyReport();
    const grouped: Record<string, ProjectGroup> = {};
    for (const row of rows) {
      if (!row.project_id) continue;
      if (!grouped[row.project_id]) {
        grouped[row.project_id] = {
          project_id: row.project_id,
          project_name: row.project_name,
          project_status: row.project_status,
          project_color: row.project_color,
          general_managers: [], managers: [], members: []
        };
      }
      if (!row.user_id) continue;
      if (row.member_role === 'general_manager') grouped[row.project_id].general_managers.push(row);
      else if (row.member_role === 'manager') grouped[row.project_id].managers.push(row);
      else if (row.member_role === 'member') grouped[row.project_id].members.push(row);
    }
    setProjectData(Object.values(grouped));
    setLoading(false);
  };

  useEffect(() => {
    if (tab === 'employees') loadReports();
    else loadProjectHierarchy();
  }, [tab]);

  const filteredReports = reports
    .filter(r => !roleFilter || r.user_role === roleFilter)
    .sort((a, b) => {
      const av = a[sortBy] as number;
      const bv = b[sortBy] as number;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const roles = Array.from(new Set(reports.map(r => r.user_role)));
  const totalCalls = reports.reduce((s, r) => s + r.total_calls, 0);
  const totalTasks = reports.reduce((s, r) => s + r.total_tasks, 0);
  const totalConversions = reports.reduce((s, r) => s + r.conversions, 0);
  const avgCompletion = reports.length > 0 ? Math.round(reports.reduce((s, r) => s + r.completion_rate, 0) / reports.length) : 0;

  const tabClass = (t: TabType) =>
    `px-4 py-2 rounded-xl font-bold text-sm transition-all ${tab === t ? 'bg-erp-primary text-white shadow-sm' : 'text-erp-text/60 hover:text-erp-text hover:bg-erp-background'}`;

  return (
    <div className="h-full bg-erp-background overflow-y-auto">
      <div className="p-4 md:p-8 space-y-5 max-w-[1400px] pb-20 md:pb-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-black text-erp-text">Performance Reports</h1>
            <p className="text-sm text-erp-text/50 font-medium mt-0.5">Employee analytics, task breakdowns & project hierarchy</p>
          </div>
          <button
            onClick={() => tab === 'employees' ? loadReports() : loadProjectHierarchy()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-erp-surface border-2 border-erp-border text-erp-text text-sm font-bold hover:bg-erp-surface transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-erp-surface p-1 rounded-2xl w-fit border-2 border-erp-border">
          <button className={tabClass('employees')} onClick={() => setTab('employees')}>
            <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Employee Reports</div>
          </button>
          <button className={tabClass('projects')} onClick={() => setTab('projects')}>
            <div className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Project Hierarchy</div>
          </button>
        </div>

        {tab === 'employees' ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Calls" value={totalCalls} icon={<Phone className="w-5 h-5 text-sky-600" />} color="bg-sky-50 border-2 border-sky-100" />
              <StatCard label="Total Tasks" value={totalTasks} icon={<CheckSquare className="w-5 h-5 text-indigo-600" />} color="bg-indigo-50 border-2 border-indigo-100" />
              <StatCard label="Conversions" value={totalConversions} icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} color="bg-emerald-50 border-2 border-emerald-100" />
              <StatCard label="Avg Completion" value={`${avgCompletion}%`} icon={<Award className="w-5 h-5 text-amber-600" />} color="bg-amber-50 border-2 border-amber-100" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center bg-erp-surface border-2 border-erp-border rounded-2xl p-3 shadow-sm">
              <div className="flex gap-1 mr-2 bg-erp-background p-1 rounded-xl">
                <button onClick={() => {
                  setDateFrom(''); setDateTo('');
                }} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-erp-surface hover:bg-erp-primary/10">All Time</button>
                <button onClick={() => {
                  const t = new Date().toISOString().split('T')[0];
                  setDateFrom(t); setDateTo(t);
                }} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-erp-surface hover:bg-erp-primary/10">Today</button>
                <button onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 1);
                  const t = d.toISOString().split('T')[0];
                  setDateFrom(t); setDateTo(t);
                }} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-erp-surface hover:bg-erp-primary/10">Yesterday</button>
              </div>
              <Calendar className="w-4 h-4 text-erp-text/40 flex-shrink-0" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-erp-surface border border-erp-border rounded-xl px-3 py-1.5 text-sm text-erp-text outline-none font-medium" />
              <span className="text-erp-text/30 font-bold">—</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-erp-surface border border-erp-border rounded-xl px-3 py-1.5 text-sm text-erp-text outline-none font-medium" />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="bg-erp-surface border border-erp-border rounded-xl px-3 py-1.5 text-sm text-erp-text outline-none font-medium">
                <option value="">All Roles</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={sortBy as string} onChange={e => setSortBy(e.target.value as any)}
                className="bg-erp-surface border border-erp-border rounded-xl px-3 py-1.5 text-sm text-erp-text outline-none font-medium">
                <option value="completion_rate">Sort: Completion Rate</option>
                <option value="total_calls">Sort: Calls</option>
                <option value="tasks_completed">Sort: Tasks Done</option>
                <option value="conversions">Sort: Conversions</option>
                <option value="total_time_minutes">Sort: Time Spent</option>
              </select>
              <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                className="bg-erp-surface border border-erp-border rounded-xl px-3 py-1.5 text-sm font-bold text-erp-text">
                {sortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
              </button>
              <button onClick={loadReports}
                className="bg-erp-primary hover:bg-erp-primary/90 rounded-xl px-4 py-1.5 text-white text-sm font-bold flex items-center gap-1.5 transition-all">
                <Filter className="w-3.5 h-3.5" /> Apply
              </button>
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-erp-text/40">
                <Loader2 className="w-6 h-6 animate-spin" /> Loading employee data...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="bg-erp-surface border-2 border-erp-border rounded-2xl p-12 text-center shadow-sm">
                <BarChart2 className="w-12 h-12 text-erp-text/20 mx-auto mb-3" />
                <p className="text-erp-text/40 font-bold">No employee data found</p>
                <p className="text-erp-text/30 text-sm mt-1">Add staff via User Management to see reports here</p>
              </div>
            ) : (
              <div className="bg-erp-surface border-2 border-erp-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-erp-border bg-erp-surface/80">
                        <th className="px-4 py-3 text-left text-erp-text/50 font-bold text-[10px] uppercase tracking-wider w-10">#</th>
                        <th className="px-4 py-3 text-left text-erp-text/50 font-bold text-[10px] uppercase tracking-wider">Employee</th>
                        <th className="px-4 py-3 text-center text-erp-text/50 font-bold text-[10px] uppercase tracking-wider">Calls</th>
                        <th className="px-4 py-3 text-center text-erp-text/50 font-bold text-[10px] uppercase tracking-wider">Tasks Done</th>
                        <th className="px-4 py-3 text-center text-erp-text/50 font-bold text-[10px] uppercase tracking-wider">Login / Out</th>
                        <th className="px-4 py-3 text-center text-erp-text/50 font-bold text-[10px] uppercase tracking-wider">Overdue</th>
                        <th className="px-4 py-3 text-center text-erp-text/50 font-bold text-[10px] uppercase tracking-wider">Conversions</th>
                        <th className="px-4 py-3 text-center text-erp-text/50 font-bold text-[10px] uppercase tracking-wider">Time Spent</th>
                        <th className="px-4 py-3 text-right text-erp-text/50 font-bold text-[10px] uppercase tracking-wider">Completion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.map((r, i) => (
                        <EmployeeRow key={r.user_id} report={r} rank={i + 1} allTasks={allTasks} dateFrom={dateFrom} dateTo={dateTo} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-erp-border/40 bg-erp-surface/40">
                  <p className="text-[10px] text-erp-text/40 font-medium">Click any row to see that employee's full task breakdown</p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Project Hierarchy */
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-erp-text/40">
                <Loader2 className="w-6 h-6 animate-spin" /> Loading hierarchy...
              </div>
            ) : projectData.length === 0 ? (
              <div className="bg-erp-surface border-2 border-erp-border rounded-2xl p-12 text-center shadow-sm">
                <Briefcase className="w-12 h-12 text-erp-text/20 mx-auto mb-3" />
                <p className="text-erp-text/40 font-bold">No project hierarchy set up yet</p>
                <p className="text-erp-text/30 text-sm mt-1">Go to Tasks → open a project → click "Hierarchy" to assign roles</p>
              </div>
            ) : (
              projectData.map(g => <ProjectHierarchyCard key={g.project_id} group={g} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
