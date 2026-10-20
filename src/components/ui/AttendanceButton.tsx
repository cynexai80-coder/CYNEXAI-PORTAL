import { useEffect, useState, useCallback } from 'react';
import { getTodayAttendance, logOfficeAttendance } from '../../lib/api/reports';
import { getCurrentUser } from '../../lib/auth';
import { LogIn, LogOut, Loader2, Calendar } from 'lucide-react';
import { StaffAttendanceModal } from '../crm/attendance/StaffAttendanceModal';

export function AttendanceButton() {
  const user = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginTime, setLoginTime] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!user || user.role === 'CEO') {
      setLoading(false);
      return;
    }
    const att = await getTodayAttendance(user.id);
    if (att && att.login_time && !att.logout_time) {
      setIsLoggedIn(true);
      setLoginTime(att.login_time);
    } else {
      setIsLoggedIn(false);
      setLoginTime(null);
    }
    setLoading(false);
  }, [user?.id, user?.role]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleToggle = async () => {
    if (!user) return;
    setLoading(true);
    if (isLoggedIn) {
      await logOfficeAttendance(user.id, 'logout');
      setIsLoggedIn(false);
    } else {
      await logOfficeAttendance(user.id, 'login');
      setIsLoggedIn(true);
      const att = await getTodayAttendance(user.id);
      if (att) setLoginTime(att.login_time);
    }
    setLoading(false);
  };

  if (!user || user.role === 'CEO') return null;

  if (loading) {
    return (
      <div className="w-full mb-6">
        <button disabled className="w-full p-4 rounded-2xl flex items-center justify-center gap-2 bg-erp-surface border-2 border-erp-border text-erp-text/50">
          <Loader2 className="w-5 h-5 animate-spin" /> Checking Attendance...
        </button>
      </div>
    );
  }

  return (
    <div className="w-full mb-6">
      <button
        onClick={handleToggle}
        className={`w-full p-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-sm border-2 cursor-pointer ${
          isLoggedIn 
            ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700 dark:bg-red-950 dark:hover:bg-red-900 dark:border-red-500/40 dark:text-red-100'
            : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:border-emerald-500/40 dark:text-emerald-100'
        }`}
      >
        <div className="flex items-center gap-2 font-black text-lg">
          {isLoggedIn ? <LogOut className="w-6 h-6" /> : <LogIn className="w-6 h-6" />}
          {isLoggedIn ? 'Log Out of Office' : 'Log In to Office'}
        </div>
        {isLoggedIn && loginTime && (
          <span className="text-sm font-bold opacity-80">
            Logged in since {new Date(loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </button>

      {/* Button to open Staff Attendance Calendar */}
      <button
        type="button"
        onClick={() => setShowCalendar(true)}
        className="w-full mt-2 py-2 px-3 rounded-xl flex items-center justify-center gap-2 bg-erp-surface hover:bg-erp-background border border-erp-border text-xs font-bold text-erp-text hover:text-blue-500 transition-all shadow-xs cursor-pointer group"
      >
        <Calendar className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition-transform" />
        <span>Open Attendance Calendar</span>
        <span className="text-[10px] text-erp-text/50 font-normal ml-auto group-hover:text-erp-text">Click dates to edit</span>
      </button>

      {/* Attendance Calendar Modal */}
      {showCalendar && (
        <StaffAttendanceModal
          isOpen={showCalendar}
          onClose={() => setShowCalendar(false)}
          onAttendanceUpdated={checkStatus}
        />
      )}
    </div>
  );
}
