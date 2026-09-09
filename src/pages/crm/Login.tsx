import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../../lib/auth';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { CynexLogo } from '../../components/ui/CynexLogo';

export default function CrmLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      if (user) {
        if (user.role === 'Manager') navigate('/manager');
        else if (user.role === 'CEO') navigate('/ceo/dashboard');
        else if (user.role === 'DM') navigate('/dm/dashboard');
        else if (user.role === 'Teacher') navigate('/teacher');
        else if (user.role === 'Student') navigate('/student');
        else navigate('/sales/dashboard');
      } else {
        setError('Invalid email or password.');
      }
    } catch {
      setError('Login failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/90 dark:bg-[#0a0a14] p-4 transition-colors duration-300 no-watermark">
      
      {/* Brand Header */}
      <div className="text-center mb-8 flex flex-col items-center justify-center">
        <CynexLogo size="xl" showText={true} />
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-1">
          Learning Management System
        </p>
      </div>

      {/* Main login card */}
      <div className="w-full max-w-[400px] bg-white dark:bg-[#12121a] border border-slate-200/80 dark:border-white/10 shadow-2xl rounded-2xl p-7 sm:p-8 relative overflow-hidden">
        
        {/* Top bar accent gradient */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>

        <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white mb-6">Sign in to your portal</h2>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          
          <div>
            <input
              type="email"
              placeholder="Email address"
              autoComplete="email"
              required
              className="w-full bg-[#F3F4F6]/80 dark:bg-black/30 border border-slate-200/80 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-sm outline-none focus:bg-white dark:focus:bg-black/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400 font-medium"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              required
              className="w-full bg-[#F3F4F6]/80 dark:bg-black/30 border border-slate-200/80 dark:border-white/10 rounded-xl px-4 py-3 pr-10 text-slate-900 dark:text-white text-sm outline-none focus:bg-white dark:focus:bg-black/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400 font-medium"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button 
              type="button" 
              onClick={() => setShowPw(!showPw)} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {error && (
            <p className="text-red-500 dark:text-red-400 text-xs font-semibold bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3.5 py-2.5 rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 active:scale-[0.99] disabled:opacity-70 disabled:shadow-none mt-1"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
      
      {/* Footer */}
      <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500 font-normal">
        &copy; {new Date().getFullYear()} CynexAI. All rights reserved.
      </div>
    </div>
  );
}
