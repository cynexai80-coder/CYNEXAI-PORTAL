import { useState, useEffect, useMemo } from 'react';
import { 
  Search, History, Phone, CreditCard, RefreshCw, Loader2, 
  ArrowRight, Download, Plus, CheckCircle2, ListTodo, User, 
  Copy, Check, X 
} from 'lucide-react';
import { getMasterHistory, getHistoryUsersList, createCustomAuditLog, exportHistoryCSV, HistoryEvent, HistoryEventType } from '../../../lib/api/history';
import { getCurrentUser } from '../../../lib/auth';

export default function HistoryPage() {
  const currentUser = getCurrentUser();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Audit Log Modal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogDetails, setNewLogDetails] = useState('');
  const [newLogType, setNewLogType] = useState<HistoryEventType>('activity');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyData, usersData] = await Promise.all([
        getMasterHistory({ type: filterType, userId: filterUser, dateRange: filterDate, search }),
        getHistoryUsersList()
      ]);
      setEvents(historyData);
      setUsersList(usersData);
    } catch (e) {
      console.error("Failed to load master history", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const historyData = await getMasterHistory({
        type: filterType,
        userId: filterUser,
        dateRange: filterDate,
        search
      });
      setEvents(historyData);
    } catch (e) {
      console.error("Failed to refresh history", e);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when filters change
  useEffect(() => {
    let isMounted = true;
    const fetchFiltered = async () => {
      setLoading(true);
      const data = await getMasterHistory({
        type: filterType,
        userId: filterUser,
        dateRange: filterDate,
        search
      });
      if (isMounted) {
        setEvents(data);
        setLoading(false);
      }
    };
    fetchFiltered();
    return () => { isMounted = false; };
  }, [filterType, filterUser, filterDate, search]);

  const handleCreateLog = async () => {
    if (!newLogTitle.trim() || !newLogDetails.trim()) return;
    setIsSubmittingLog(true);
    try {
      const success = await createCustomAuditLog(
        newLogType,
        newLogTitle.trim(),
        newLogDetails.trim(),
        currentUser?.id || 'usr_ceo'
      );
      if (success) {
        setIsLogModalOpen(false);
        setNewLogTitle('');
        setNewLogDetails('');
        await handleRefresh();
      }
    } catch (e) {
      console.error("Error creating audit log", e);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metric counts
  const stats = useMemo(() => {
    const total = events.length;
    const sales = events.filter(e => e.type === 'sale').length;
    const activities = events.filter(e => e.type === 'activity').length;
    const stageChanges = events.filter(e => e.type === 'stage_change').length;
    const tasks = events.filter(e => e.type === 'task').length;
    return { total, sales, activities, stageChanges, tasks };
  }, [events]);

  const formatDate = (ds: string) => {
    try {
      const d = new Date(ds);
      if (isNaN(d.getTime())) return ds;
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch {
      return ds;
    }
  };

  const getEventIcon = (type: HistoryEventType) => {
    switch (type) {
      case 'sale':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'activity':
        return <Phone className="w-4 h-4 text-sky-400" />;
      case 'stage_change':
        return <ArrowRight className="w-4 h-4 text-amber-400" />;
      case 'approval':
        return <CheckCircle2 className="w-4 h-4 text-purple-400" />;
      case 'task':
        return <ListTodo className="w-4 h-4 text-indigo-400" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const getEventBadgeClass = (type: HistoryEventType) => {
    switch (type) {
      case 'sale':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'activity':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      case 'stage_change':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'approval':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'task':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-32 p-4 md:p-8 bg-erp-background subtle-watermark">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-erp-text flex items-center gap-3">
            <History className="w-8 h-8 text-indigo-500" /> Master History & Audit Logs
          </h1>
          <p className="text-sm font-medium text-erp-text/60 mt-1">
            Global audit log tracking all sales, customer activities, pipeline stage changes, and team tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => exportHistoryCSV(events)}
            disabled={events.length === 0}
            className="px-4 py-2.5 bg-erp-surface hover:bg-slate-800 text-erp-text font-semibold rounded-xl border border-erp-border flex items-center gap-2 transition-all text-xs cursor-pointer disabled:opacity-40"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export CSV
          </button>
          
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all text-xs cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Log Audit Note
          </button>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2.5 bg-erp-surface hover:bg-slate-800 text-erp-text font-semibold rounded-xl border border-erp-border flex items-center gap-2 transition-all text-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-erp-surface border border-erp-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Total Audit Logs</p>
            <h3 className="text-2xl font-bold font-display text-erp-text">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-erp-surface border border-erp-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Sales Records</p>
            <h3 className="text-2xl font-bold font-display text-emerald-400">{stats.sales}</h3>
          </div>
        </div>

        <div className="bg-erp-surface border border-erp-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Calls & Notes</p>
            <h3 className="text-2xl font-bold font-display text-sky-400">{stats.activities}</h3>
          </div>
        </div>

        <div className="bg-erp-surface border border-erp-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <ArrowRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-erp-text/50 uppercase tracking-wider">Stage Movements</p>
            <h3 className="text-2xl font-bold font-display text-amber-400">{stats.stageChanges}</h3>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-erp-surface border border-erp-border rounded-2xl p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-erp-text/40" />
            <input
              type="text"
              placeholder="Search history by keyword..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 w-full bg-erp-background border border-erp-border rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 text-erp-text"
            />
          </div>

          {/* Event Category Filter */}
          <div className="relative">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-4 py-2.5 w-full bg-erp-background border border-erp-border rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 text-erp-text appearance-none cursor-pointer"
            >
              <option value="all">All Audit Categories</option>
              <option value="sale">Sales & Payments</option>
              <option value="activity">Rep Activities & Calls</option>
              <option value="stage_change">Pipeline Stage Changes</option>
              <option value="task">Tasks & Operations</option>
              <option value="approval">Approvals & Discounts</option>
            </select>
          </div>

          {/* User / Team Member Filter */}
          <div className="relative">
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="px-4 py-2.5 w-full bg-erp-background border border-erp-border rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 text-erp-text appearance-none cursor-pointer"
            >
              <option value="all">All Team Members</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="relative">
            <select
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="px-4 py-2.5 w-full bg-erp-background border border-erp-border rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500 text-erp-text appearance-none cursor-pointer"
            >
              <option value="all">All Time History</option>
              <option value="today">Today Only</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>

        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="bg-erp-surface border border-erp-border rounded-2xl p-6 min-h-[400px] flex flex-col shadow-sm">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-erp-text/50 gap-3 py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="font-semibold text-sm">Querying database audit trail...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-erp-text/40 py-16">
            <History className="w-12 h-12 opacity-30 mb-3" />
            <p className="font-bold text-base text-erp-text/70">No history logs match your search filters</p>
            <p className="text-xs text-erp-text/40 mt-1">Try resetting search keywords or changing category filters.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-800 ml-4 space-y-6 py-2">
            {events.map(ev => (
              <div key={ev.id} className="relative pl-6 group">
                {/* Timeline Icon Node */}
                <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full border-2 border-erp-surface bg-slate-900 flex items-center justify-center shadow-md">
                  {getEventIcon(ev.type)}
                </div>

                <div className="bg-erp-surface border-2 border-erp-border rounded-2xl p-5 hover:border-indigo-500/40 transition-all shadow-sm">
                  
                  {/* Top Bar: Title, User, Timestamp */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getEventBadgeClass(ev.type)}`}>
                        {ev.type.replace('_', ' ')}
                      </span>
                      <span className="font-bold text-erp-text text-sm sm:text-base">{ev.title}</span>
                      {ev.category && (
                        <span className="text-[10px] text-erp-text/40 bg-erp-background px-2 py-0.5 rounded border border-erp-border">
                          {ev.category}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-erp-text/40 whitespace-nowrap">
                      {formatDate(ev.timestamp)}
                    </span>
                  </div>

                  {/* Lead / Student Information */}
                  {ev.lead_name && (
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-2">
                      <User className="w-3.5 h-3.5" />
                      <span>Associated Contact: {ev.lead_name}</span>
                    </div>
                  )}

                  {/* Details Output */}
                  <div className="text-xs sm:text-sm text-erp-text/80 leading-relaxed font-normal">
                    {ev.type === 'stage_change' ? (
                      <div className="inline-flex items-center gap-2 text-xs font-bold bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 my-1">
                        <span className="text-slate-400 line-through">{ev.old_val || 'New'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-emerald-400">{ev.new_val}</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{ev.details}</p>
                    )}
                  </div>

                  {/* Bottom Footer: Performed By & Quick Actions */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-erp-text/50">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-erp-text/60">Executed By:</span>
                      <span className="font-bold text-erp-text">{ev.user_name}</span>
                    </div>

                    <button
                      onClick={() => copyToClipboard(`${ev.title}: ${ev.details} (By ${ev.user_name} on ${ev.timestamp})`, ev.id)}
                      className="flex items-center gap-1 text-[11px] hover:text-indigo-400 transition-colors cursor-pointer"
                      title="Copy Log String"
                    >
                      {copiedId === ev.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === ev.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Executive Action Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-erp-surface border border-erp-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            
            <div className="flex justify-between items-center p-6 border-b border-erp-border bg-slate-900/50">
              <h2 className="text-xl font-bold text-erp-text font-display flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Log Executive Audit Note
              </h2>
              <button onClick={() => setIsLogModalOpen(false)} className="text-erp-text/50 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-erp-text/70 uppercase tracking-wider mb-2">Category / Type</label>
                <select
                  value={newLogType}
                  onChange={(e) => setNewLogType(e.target.value as HistoryEventType)}
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="activity">Rep / System Activity</option>
                  <option value="approval">Executive Approval / Policy Override</option>
                  <option value="task">Operational Task Note</option>
                  <option value="sale">Financial / Special Sale Override</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-erp-text/70 uppercase tracking-wider mb-2">Log Title</label>
                <input
                  type="text"
                  value={newLogTitle}
                  onChange={(e) => setNewLogTitle(e.target.value)}
                  placeholder="e.g. Executive Discount Approved or System Audit"
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text text-sm focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-erp-text/70 uppercase tracking-wider mb-2">Audit Details / Reason</label>
                <textarea
                  rows={4}
                  value={newLogDetails}
                  onChange={(e) => setNewLogDetails(e.target.value)}
                  placeholder="Describe the executive decision, policy change, or manual override details..."
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-4 py-3 text-erp-text text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-erp-border bg-slate-900/30 flex justify-end gap-3">
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="px-4 py-2.5 bg-erp-surface hover:bg-slate-800 text-erp-text font-bold rounded-xl text-xs border border-erp-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLog}
                disabled={isSubmittingLog || !newLogTitle.trim() || !newLogDetails.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
              >
                {isSubmittingLog ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Submit Audit Log
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
