import React, { useState, useEffect, useRef } from 'react';
import { Timer, Play, Square, Clock, Plus, X } from 'lucide-react';
import { startTimeLog, stopTimeLog, getTimeLogsByTask, getActiveTimeLog, TimeLog } from '../../../lib/api/reports';
import { client, isTursoConfigured } from '../../../lib/turso';
import { getCurrentUser } from '../../../lib/auth';

interface Props {
  taskId: string;
}

// Manual log entry to DB
const logManualTime = async (taskId: string, userId: string, hours: number, minutes: number, notes: string) => {
  if (!isTursoConfigured || !client) return false;
  const id = 'tl_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const totalMins = hours * 60 + minutes;
  if (totalMins <= 0) return false;
  const now = new Date().toISOString();
  try {
    await client.execute({
      sql: `INSERT INTO time_logs (id, task_id, user_id, started_at, ended_at, duration_minutes, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, taskId, userId, now, now, totalMins, notes || null]
    });
    return true;
  } catch (e) {
    console.error('Failed to log manual time', e);
    return false;
  }
};

export const TimeTracker: React.FC<Props> = ({ taskId }) => {
  const user = getCurrentUser();
  const [activeLog, setActiveLog] = useState<TimeLog | null>(null);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualHours, setManualHours] = useState('');
  const [manualMins, setManualMins] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = async () => {
    if (!user) return;
    const [active, history] = await Promise.all([
      getActiveTimeLog(user.id),
      getTimeLogsByTask(taskId),
    ]);
    if (active && active.task_id === taskId) {
      setActiveLog(active);
      const secs = Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000);
      setElapsed(secs);
    } else {
      setActiveLog(null);
      setElapsed(0);
    }
    setLogs(history.filter(l => l.ended_at !== null));
  };

  useEffect(() => {
    loadData();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [taskId]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activeLog) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeLog]);

  const handleStart = async () => {
    if (!user) return;
    setLoading(true);
    const id = await startTimeLog(taskId, user.id);
    if (id) await loadData();
    setLoading(false);
  };

  const handleStop = async () => {
    if (!activeLog) return;
    setLoading(true);
    await stopTimeLog(activeLog.id);
    setActiveLog(null);
    setElapsed(0);
    await loadData();
    setLoading(false);
  };

  const handleManualSubmit = async () => {
    if (!user) return;
    const h = parseInt(manualHours || '0') || 0;
    const m = parseInt(manualMins || '0') || 0;
    if (h === 0 && m === 0) return;
    setSubmitting(true);
    const ok = await logManualTime(taskId, user.id, h, m, manualNotes);
    if (ok) {
      setManualHours('');
      setManualMins('');
      setManualNotes('');
      setShowManual(false);
      await loadData();
    }
    setSubmitting(false);
  };

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const fmtMin = (mins: number | null | undefined) => {
    if (!mins || mins === 0) return '—';
    const m = Number(mins);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const totalLogged = logs.reduce((s, l) => s + (Number(l.duration_minutes) || 0), 0);

  return (
    <div className="pt-4 border-t border-erp-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-erp-text/70 font-bold text-sm">
          <Clock className="w-4 h-4" /> Time Tracking
          {totalLogged > 0 && (
            <span className="text-xs font-bold text-erp-primary bg-erp-primary/10 px-2 py-0.5 rounded-full">
              Total: {fmtMin(totalLogged)}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowManual(v => !v)}
          className="flex items-center gap-1 text-xs font-bold text-erp-primary hover:text-erp-primary/80"
        >
          <Plus className="w-3.5 h-3.5" /> Log manually
        </button>
      </div>

      {/* Live Timer */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border-2 mb-3 transition-all ${activeLog ? 'bg-emerald-50 border-emerald-300' : 'bg-erp-background border-erp-border'}`}>
        <Timer className={`w-4 h-4 flex-shrink-0 ${activeLog ? 'text-emerald-600 animate-pulse' : 'text-erp-text/30'}`} />
        <div className="flex-1">
          <p className={`font-mono font-bold text-sm ${activeLog ? 'text-emerald-700' : 'text-erp-text/40'}`}>
            {activeLog ? fmt(elapsed) : 'Timer not running'}
          </p>
          {activeLog && <p className="text-xs text-emerald-600/70">Click Stop to save</p>}
        </div>
        {activeLog ? (
          <button
            onClick={handleStop}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            <Square className="w-3 h-3" /> Stop
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
          >
            <Play className="w-3 h-3" /> Start
          </button>
        )}
      </div>

      {/* Manual Entry Form */}
      {showManual && (
        <div className="bg-erp-background border border-erp-border rounded-xl p-3 mb-3 space-y-2">
          <p className="text-xs font-bold text-erp-text/60 mb-2">Log time manually</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min="0"
                max="24"
                value={manualHours}
                onChange={e => setManualHours(e.target.value)}
                placeholder="0"
                className="w-16 bg-white dark:bg-black border border-erp-border rounded-lg px-2 py-1.5 text-sm font-bold text-erp-text outline-none focus:border-erp-primary text-center"
              />
              <span className="text-xs font-bold text-erp-text/50">hrs</span>
            </div>
            <div className="flex items-center gap-1 flex-1">
              <input
                type="number"
                min="0"
                max="59"
                value={manualMins}
                onChange={e => setManualMins(e.target.value)}
                placeholder="0"
                className="w-16 bg-white dark:bg-black border border-erp-border rounded-lg px-2 py-1.5 text-sm font-bold text-erp-text outline-none focus:border-erp-primary text-center"
              />
              <span className="text-xs font-bold text-erp-text/50">mins</span>
            </div>
          </div>
          <input
            type="text"
            value={manualNotes}
            onChange={e => setManualNotes(e.target.value)}
            placeholder="Notes (optional)..."
            className="w-full bg-white dark:bg-black border border-erp-border rounded-lg px-2 py-1.5 text-xs text-erp-text outline-none focus:border-erp-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleManualSubmit}
              disabled={submitting || (!manualHours && !manualMins)}
              className="flex-1 py-1.5 bg-erp-primary hover:bg-erp-primary/90 text-white rounded-lg text-xs font-bold disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
            <button
              onClick={() => setShowManual(false)}
              className="px-3 py-1.5 border border-erp-border rounded-lg text-xs font-bold text-erp-text/60 hover:bg-erp-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Log History */}
      {logs.length > 0 && (
        <div className="space-y-1 max-h-36 overflow-y-auto">
          <p className="text-xs font-bold text-erp-text/40 uppercase tracking-wider px-1 mb-1">Recent entries</p>
          {logs.map(log => (
            <div key={log.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-erp-background rounded-lg">
              <span className="font-medium text-erp-text/70">{log.user_name || 'You'}</span>
              <span className="text-erp-text/40">{new Date(log.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              {log.notes && <span className="text-erp-text/40 truncate max-w-[80px]">{log.notes}</span>}
              <span className="font-bold text-erp-primary">{fmtMin(Number(log.duration_minutes))}</span>
            </div>
          ))}
        </div>
      )}

      {logs.length === 0 && !showManual && !activeLog && (
        <p className="text-xs text-erp-text/30 text-center py-2">No time logged yet. Start the timer or log manually.</p>
      )}
    </div>
  );
};
