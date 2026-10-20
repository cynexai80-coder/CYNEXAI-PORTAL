import React, { useState } from 'react';
import { Calendar, Clock, X, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { postponeClass } from '../../../lib/api/teacher';
import { getCurrentUser } from '../../../lib/auth';

interface RescheduleModalProps {
  slot: {
    id: string;
    title: string;           // batch/course name
    start_time: string;
    batch_id?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function RescheduleModal({ slot, onClose, onSuccess }: RescheduleModalProps) {
  const user = getCurrentUser();
  const [newTime, setNewTime] = useState(slot.start_time || '09:00');
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please provide a reason for rescheduling.'); return; }
    if (!newTime) { setError('Please set the new time.'); return; }
    setSaving(true);
    setError('');

    // Parse batch info from slot
    let batchId: string | undefined;
    try {
      const bMap = JSON.parse(slot.batch_id || '{}');
      // Get first batch id from the map
      const firstCourse = Object.keys(bMap)[0];
      if (firstCourse && bMap[firstCourse]?.length) batchId = bMap[firstCourse][0];
    } catch { batchId = slot.batch_id; }

    const result = await postponeClass({
      slotId: slot.id,
      slotTitle: slot.title || 'Class',
      originalTime: slot.start_time,
      newTime,
      newDate: newDate || undefined,
      reason: reason.trim(),
      createdBy: user?.id || 'unknown',
      batchId,
    });

    setSaving(false);
    if (result.success) {
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-erp-surface border-2 border-erp-border rounded-2xl w-full max-w-md shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-erp-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="font-bold text-erp-text">Postpone / Reschedule</h2>
              <p className="text-xs text-erp-text/50 mt-0.5">{slot.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-erp-text/40 hover:text-erp-text hover:bg-erp-background flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {done ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <p className="font-bold text-erp-text">Class rescheduled successfully!</p>
              <p className="text-sm text-erp-text/60">Students in this batch have been notified via announcement popup.</p>
            </div>
          ) : (
            <>
              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700 font-medium">
                  All students enrolled in this batch will receive a notification about this schedule change.
                </p>
              </div>

              {/* Original time */}
              <div>
                <label className="block text-xs font-bold text-erp-text/60 mb-1">Current Scheduled Time</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-erp-background border border-erp-border rounded-xl text-sm text-erp-text/60 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  {slot.start_time}
                </div>
              </div>

              {/* New time */}
              <div>
                <label className="block text-xs font-bold text-erp-text/60 mb-1">New Time <span className="text-red-500">*</span></label>
                <div className="flex items-center gap-2 px-3 py-2 bg-erp-background border border-erp-border rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-erp-primary" />
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-erp-text outline-none font-mono"
                  />
                </div>
              </div>

              {/* New date (optional) */}
              <div>
                <label className="block text-xs font-bold text-erp-text/60 mb-1">New Date (optional — leave blank if same day)</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-erp-background border border-erp-border rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-erp-primary" />
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-erp-text outline-none"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-erp-text/60 mb-1">Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Teacher unavailable, technical issue, holiday adjustment..."
                  rows={3}
                  className="w-full bg-erp-background border border-erp-border rounded-xl px-3 py-2 text-sm text-erp-text outline-none focus:border-erp-primary resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 font-medium">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="flex gap-3 p-5 border-t border-erp-border">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-erp-border text-erp-text/70 text-sm font-bold hover:bg-erp-background transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-orange-700 hover:bg-orange-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Calendar className="w-4 h-4" /> Reschedule</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
