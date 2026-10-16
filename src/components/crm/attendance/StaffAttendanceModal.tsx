import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Clock, CheckCircle, AlertCircle, Home, Briefcase, 
  Trash2, Save, UserCheck, UserX, Loader2, Sparkles
} from 'lucide-react';
import { 
  EmployeeAttendance, 
  getEmployeeMonthlyAttendance, 
  saveManualStaffAttendance, 
  deleteStaffAttendance 
} from '../../../lib/api/reports';
import { getCurrentUser } from '../../../lib/auth';

interface StaffAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: {
    id: string;
    name: string;
    role?: string;
    email?: string;
  };
  onAttendanceUpdated?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string; icon: any }> = {
  'Present': { 
    label: 'Present (Office)', 
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle
  },
  'Work From Home': { 
    label: 'Work From Home', 
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
    dotClass: 'bg-sky-500',
    icon: Home
  },
  'Half-day': { 
    label: 'Half Day', 
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-500',
    icon: Clock
  },
  'Official Duty': { 
    label: 'Official Duty / Field', 
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    dotClass: 'bg-purple-500',
    icon: Briefcase
  },
  'Leave': { 
    label: 'On Leave', 
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    dotClass: 'bg-rose-500',
    icon: UserX
  },
  'Absent': { 
    label: 'Absent', 
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    dotClass: 'bg-red-500',
    icon: UserX
  },
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StaffAttendanceModal({ isOpen, onClose, targetUser, onAttendanceUpdated }: StaffAttendanceModalProps) {
  const currentUser = getCurrentUser();
  const effectiveUser = targetUser || currentUser;
  
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12
  
  const [attendanceRecords, setAttendanceRecords] = useState<EmployeeAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Selected date editor state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('Present');
  const [editLoginTime, setEditLoginTime] = useState<string>('09:30');
  const [editLogoutTime, setEditLogoutTime] = useState<string>('18:30');
  const [editNotes, setEditNotes] = useState<string>('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!effectiveUser?.id) return;
    setLoading(true);
    try {
      const records = await getEmployeeMonthlyAttendance(effectiveUser.id, currentYear, currentMonth);
      setAttendanceRecords(records);
    } catch (e) {
      console.error('Failed to load employee attendance records', e);
    } finally {
      setLoading(false);
    }
  }, [effectiveUser?.id, currentYear, currentMonth]);

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
    }
  }, [isOpen, fetchRecords]);

  // Map of date string YYYY-MM-DD -> EmployeeAttendance
  const attendanceMap = useMemo(() => {
    const map = new Map<string, EmployeeAttendance>();
    attendanceRecords.forEach(rec => {
      map.set(rec.date, rec);
    });
    return map;
  }, [attendanceRecords]);

  // Compute monthly stats
  const stats = useMemo(() => {
    let presentCount = 0;
    let wfhCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let totalMinutes = 0;

    attendanceRecords.forEach(rec => {
      const st = rec.status || 'Present';
      if (st === 'Present' || st === 'Official Duty') presentCount++;
      else if (st === 'Work From Home') wfhCount++;
      else if (st === 'Half-day') halfDayCount++;
      else if (st === 'Leave' || st === 'Absent') leaveCount++;

      if (rec.duration_minutes) {
        totalMinutes += rec.duration_minutes;
      }
    });

    const totalDaysWorked = presentCount + wfhCount + halfDayCount;
    const avgMinutesPerDay = totalDaysWorked > 0 ? Math.round(totalMinutes / totalDaysWorked) : 0;

    return {
      presentCount,
      wfhCount,
      halfDayCount,
      leaveCount,
      totalHours: (totalMinutes / 60).toFixed(1),
      avgHours: (avgMinutesPerDay / 60).toFixed(1)
    };
  }, [attendanceRecords]);

  // Days in current month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 is Sun

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
      isFuture: boolean;
      record?: EmployeeAttendance;
    }> = [];

    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    // Previous month padding
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dStr = `${prevY}-${pad(prevM)}-${pad(dNum)}`;
      days.push({
        dateStr: dStr,
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isWeekend: false,
        isFuture: dStr > todayStr
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${currentYear}-${pad(currentMonth)}-${pad(d)}`;
      const dayOfWeek = new Date(currentYear, currentMonth - 1, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      days.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isWeekend,
        isFuture: dStr > todayStr,
        record: attendanceMap.get(dStr)
      });
    }

    // Next month padding to fill out grid (42 cells total)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dStr = `${nextY}-${pad(nextM)}-${pad(d)}`;
      days.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        isWeekend: false,
        isFuture: dStr > todayStr
      });
    }

    return days;
  }, [currentYear, currentMonth, today, attendanceMap]);

  // When a day is clicked on the calendar
  const handleSelectDay = (dateStr: string) => {
    setSelectedDate(dateStr);
    const existing = attendanceMap.get(dateStr);
    if (existing) {
      setEditStatus(existing.status || 'Present');
      if (existing.login_time) {
        const timePart = existing.login_time.includes('T') 
          ? existing.login_time.split('T')[1].substring(0, 5) 
          : '09:30';
        setEditLoginTime(timePart);
      } else {
        setEditLoginTime('09:30');
      }
      if (existing.logout_time) {
        const timePart = existing.logout_time.includes('T') 
          ? existing.logout_time.split('T')[1].substring(0, 5) 
          : '18:30';
        setEditLogoutTime(timePart);
      } else {
        setEditLogoutTime('18:30');
      }
      setEditNotes(existing.notes || '');
    } else {
      setEditStatus('Present');
      setEditLoginTime('09:30');
      setEditLogoutTime('18:30');
      setEditNotes('');
    }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    handleSelectDay(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
  };

  // Save manual attendance
  const handleSaveAttendance = async () => {
    if (!selectedDate || !effectiveUser?.id) return;
    setSaving(true);
    setNotification(null);
    try {
      const isLeaveOrAbsent = editStatus === 'Leave' || editStatus === 'Absent';
      const loginIso = isLeaveOrAbsent ? null : `${selectedDate}T${editLoginTime}:00.000Z`;
      const logoutIso = isLeaveOrAbsent ? null : `${selectedDate}T${editLogoutTime}:00.000Z`;

      let durationMins: number | null = null;
      if (!isLeaveOrAbsent && editLoginTime && editLogoutTime) {
        const [lh, lm] = editLoginTime.split(':').map(Number);
        const [oh, om] = editLogoutTime.split(':').map(Number);
        const startM = lh * 60 + lm;
        const endM = oh * 60 + om;
        if (endM >= startM) {
          durationMins = endM - startM;
        }
      }

      const ok = await saveManualStaffAttendance({
        userId: effectiveUser.id,
        date: selectedDate,
        loginTime: loginIso,
        logoutTime: logoutIso,
        durationMinutes: durationMins,
        status: editStatus,
        notes: editNotes,
        markedBy: currentUser?.id || 'manual'
      });

      if (ok) {
        setNotification({ message: `Attendance for ${selectedDate} saved successfully!`, type: 'success' });
        await fetchRecords();
        if (onAttendanceUpdated) onAttendanceUpdated();
      } else {
        setNotification({ message: 'Failed to record attendance. Please try again.', type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setNotification({ message: 'An unexpected error occurred.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Delete attendance log for selected date
  const handleDeleteAttendance = async () => {
    if (!selectedDate || !effectiveUser?.id) return;
    if (!window.confirm(`Delete attendance record for ${selectedDate}?`)) return;
    setSaving(true);
    try {
      const ok = await deleteStaffAttendance(effectiveUser.id, selectedDate);
      if (ok) {
        setNotification({ message: `Attendance for ${selectedDate} cleared.`, type: 'success' });
        await fetchRecords();
        if (onAttendanceUpdated) onAttendanceUpdated();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div 
        className="bg-erp-surface border-2 border-erp-border rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 sm:p-6 border-b border-erp-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-erp-surface">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xl shrink-0 shadow-inner">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black font-display text-erp-text">
                  Staff Attendance Calendar
                </h2>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  {effectiveUser?.role || 'Staff'}
                </span>
              </div>
              <p className="text-xs text-erp-text/60 mt-0.5">
                Viewing record for <strong className="text-erp-text">{effectiveUser?.name || 'Staff Member'}</strong>. Click on any date to manually log or edit office attendance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Month Navigation */}
            <div className="flex items-center bg-erp-background border border-erp-border rounded-2xl p-1 shadow-xs">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-erp-surface text-erp-text/70 hover:text-erp-text transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-black text-erp-text px-3 py-1 min-w-[130px] text-center">
                {MONTH_NAMES[currentMonth - 1]} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl hover:bg-erp-surface text-erp-text/70 hover:text-erp-text transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleGoToday}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-erp-background border border-erp-border hover:bg-erp-surface text-erp-text transition-colors shadow-xs"
            >
              Today
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-erp-background border border-erp-border text-erp-text/60 hover:text-erp-text hover:bg-rose-500/10 hover:border-rose-500/20 transition-all"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Monthly KPI Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 sm:px-6 bg-slate-50/50 dark:bg-zinc-900/40 border-b border-erp-border">
          <div className="bg-erp-surface border border-erp-border rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-erp-text/50 uppercase">Present Days</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{stats.presentCount} Days</p>
            </div>
          </div>

          <div className="bg-erp-surface border border-erp-border rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xs shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-erp-text/50 uppercase">Work From Home</p>
              <p className="text-base font-black text-sky-600 dark:text-sky-400">{stats.wfhCount} Days</p>
            </div>
          </div>

          <div className="bg-erp-surface border border-erp-border rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-erp-text/50 uppercase">Half Days</p>
              <p className="text-base font-black text-amber-600 dark:text-amber-400">{stats.halfDayCount} Days</p>
            </div>
          </div>

          <div className="bg-erp-surface border border-erp-border rounded-xl p-2.5 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xs shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-erp-text/50 uppercase">Leaves / Absent</p>
              <p className="text-base font-black text-rose-600 dark:text-rose-400">{stats.leaveCount} Days</p>
            </div>
          </div>

          <div className="bg-erp-surface border border-erp-border rounded-xl p-2.5 flex items-center gap-2.5 col-span-2 sm:col-span-1 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold text-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-erp-text/50 uppercase">Total Hours Logged</p>
              <p className="text-base font-black text-purple-600 dark:text-purple-400">{stats.totalHours} hrs</p>
            </div>
          </div>
        </div>

        {/* Body Area: Split layout between Calendar Grid and Day Editor */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-erp-background">
          
          {/* Calendar Grid Container (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-erp-text flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-500" />
                Select any date to log/edit
              </h3>
              <div className="flex items-center gap-3 text-[11px] font-medium text-erp-text/60">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500" /> WFH</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Half-day</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Leave</span>
              </div>
            </div>

            {/* Calendar Table */}
            <div className="bg-erp-surface border border-erp-border rounded-2xl overflow-hidden shadow-xs">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 border-b border-erp-border bg-slate-100 dark:bg-zinc-900/80 text-center font-bold text-xs text-erp-text/70 py-2.5">
                {WEEKDAY_NAMES.map(w => (
                  <div key={w} className={w === 'Sun' || w === 'Sat' ? 'text-amber-600 dark:text-amber-400' : ''}>
                    {w}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-erp-border">
                {calendarDays.map((day, idx) => {
                  const isSelected = selectedDate === day.dateStr;
                  const cfg = day.record?.status ? STATUS_CONFIG[day.record.status] : null;

                  return (
                    <div
                      key={day.dateStr + '_' + idx}
                      onClick={() => handleSelectDay(day.dateStr)}
                      className={`min-h-[76px] p-2 flex flex-col justify-between cursor-pointer transition-all relative group select-none ${
                        !day.isCurrentMonth 
                          ? 'bg-slate-50/50 dark:bg-zinc-950/30 opacity-40 hover:opacity-70' 
                          : day.isWeekend 
                          ? 'bg-slate-50/20 dark:bg-zinc-900/20' 
                          : 'bg-erp-surface hover:bg-erp-background'
                      } ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 bg-blue-500/10 z-10' 
                          : ''
                      } ${
                        day.isToday 
                          ? 'border-2 border-blue-500' 
                          : ''
                      }`}
                    >
                      {/* Top Day row */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black rounded-full w-5 h-5 flex items-center justify-center ${
                          day.isToday 
                            ? 'bg-blue-600 text-white' 
                            : isSelected
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : 'text-erp-text'
                        }`}>
                          {day.dayNum}
                        </span>

                        {day.record && cfg && (
                          <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} title={cfg.label} />
                        )}
                      </div>

                      {/* Bottom status badge */}
                      <div className="mt-1">
                        {day.record ? (
                          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border truncate flex flex-col ${
                            cfg?.badgeClass || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <span className="truncate">{day.record.status || 'Present'}</span>
                            {day.record.duration_minutes ? (
                              <span className="text-[9px] opacity-75 font-mono">
                                {Math.floor(day.record.duration_minutes / 60)}h {day.record.duration_minutes % 60}m
                              </span>
                            ) : null}
                          </div>
                        ) : day.isCurrentMonth && !day.isWeekend && !day.isFuture ? (
                          <div className="text-[9px] font-bold text-erp-text/30 group-hover:text-blue-500 group-hover:font-extrabold transition-colors">
                            + Click to Log
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Day Editor Panel (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
            <div className="bg-erp-surface border-2 border-erp-border rounded-2xl p-5 shadow-sm sticky top-0 flex flex-col gap-4">
              
              <div className="flex items-center justify-between border-b border-erp-border pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-erp-text/50">
                    Day Details
                  </span>
                  <h4 className="text-base font-black text-erp-text mt-0.5">
                    {selectedDate 
                      ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) 
                      : 'Select a Date'}
                  </h4>
                </div>
                {selectedDate && attendanceMap.has(selectedDate) && (
                  <button
                    onClick={handleDeleteAttendance}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Delete Record"
                    disabled={saving}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {notification && (
                <div className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                  notification.type === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                }`}>
                  {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{notification.message}</span>
                </div>
              )}

              {selectedDate ? (
                <div className="space-y-4">
                  {/* Status Selection Chips */}
                  <div>
                    <label className="text-xs font-black text-erp-text/70 block mb-2">
                      Attendance Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(STATUS_CONFIG).map(([stKey, info]) => {
                        const IconComponent = info.icon;
                        const isChosen = editStatus === stKey;
                        return (
                          <button
                            key={stKey}
                            type="button"
                            onClick={() => setEditStatus(stKey)}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                              isChosen
                                ? `${info.badgeClass} ring-2 ring-blue-500 font-black shadow-xs`
                                : 'bg-erp-background border-erp-border text-erp-text/70 hover:bg-erp-surface'
                            }`}
                          >
                            <IconComponent className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{info.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Inputs (Only for work statuses) */}
                  {editStatus !== 'Leave' && editStatus !== 'Absent' && (
                    <div className="grid grid-cols-2 gap-3 bg-erp-background p-3 rounded-xl border border-erp-border">
                      <div>
                        <label className="text-[10px] font-bold text-erp-text/60 uppercase block mb-1">
                          Log In Time
                        </label>
                        <input
                          type="time"
                          value={editLoginTime}
                          onChange={e => setEditLoginTime(e.target.value)}
                          className="w-full bg-erp-surface border border-erp-border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-erp-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-erp-text/60 uppercase block mb-1">
                          Log Out Time
                        </label>
                        <input
                          type="time"
                          value={editLogoutTime}
                          onChange={e => setEditLogoutTime(e.target.value)}
                          className="w-full bg-erp-surface border border-erp-border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-erp-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Notes / Remarks */}
                  <div>
                    <label className="text-xs font-black text-erp-text/70 block mb-1">
                      Notes / Remarks (Optional)
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder="e.g. Regular office shift, client meeting, emergency leave..."
                      rows={2}
                      className="w-full bg-erp-background border border-erp-border rounded-xl p-2.5 text-xs text-erp-text focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSaveAttendance}
                    disabled={saving}
                    className="w-full py-3 px-4 rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving Attendance...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Attendance for {selectedDate}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-10 text-center text-erp-text/50 flex flex-col items-center">
                  <CalendarIcon className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-xs font-bold">Click any date in the calendar to log or edit attendance.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-erp-border bg-erp-surface flex items-center justify-between text-xs text-erp-text/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Synced with CynexAI Office Attendance Database (`employee_attendance`)</span>
          </div>
          <button
            onClick={onClose}
            className="font-bold text-xs px-4 py-1.5 rounded-xl border border-erp-border hover:bg-erp-background text-erp-text transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
