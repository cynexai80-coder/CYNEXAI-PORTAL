import { useEffect, useState } from 'react';
import { getTodayAttendance, logOfficeAttendance } from '../../lib/api/reports';
import { getCurrentUser } from '../../lib/auth';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

export function AttendanceButton() {
  const user = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginTime, setLoginTime] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role === 'CEO') {
      setLoading(false);
      return;
    }
    const checkStatus = async () => {
      const att = await getTodayAttendance(user.id);
      if (att && att.login_time && !att.logout_time) {
        setIsLoggedIn(true);
        setLoginTime(att.login_time);
      } else {
        setIsLoggedIn(false);
      }
      setLoading(false);
    };
    checkStatus();
  }, [user?.id, user?.role]);

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
      <button disabled className="w-full mb-6 p-4 rounded-2xl flex items-center justify-center gap-2 bg-erp-surface border-2 border-erp-border text-erp-text/50">
        <Loader2 className="w-5 h-5 animate-spin" /> Checking Attendance...
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`w-full mb-6 p-4 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-sm border-2 ${
        isLoggedIn 
          ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700 dark:text-white'
          : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
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
  );
}
