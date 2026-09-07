import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Users, DollarSign, CheckSquare, User, LayoutDashboard, Sun, Moon, Menu, X } from 'lucide-react';
import { getCurrentUser } from '../../lib/auth';
import { useTheme } from '../../lib/ThemeContext';
import { Sidebar } from './Sidebar';
import { CynexLogo } from '../ui/CynexLogo';

export const MobileNavigation: React.FC = () => {
  const user = getCurrentUser();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  let navItems = [
    { to: '/sales/dashboard', icon: LayoutDashboard, label: 'Dash' },
    { to: '/sales/pipeline', icon: Users, label: 'Leads' },
    { to: '/sales/tasks', icon: CheckSquare, label: 'Tasks' },
    { to: '/profile', icon: User, label: 'Profile' }
  ];

  if (user.role === 'Manager') {
    navItems = [
      { to: '/manager', icon: LayoutDashboard, label: 'Hub' },
      { to: '/sales/pipeline', icon: Users, label: 'Leads' },
      { to: '/manager/tasks', icon: CheckSquare, label: 'Tasks' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];
  } else if (user.role === 'CEO') {
    navItems = [
      { to: '/ceo/dashboard', icon: LayoutDashboard, label: 'CEO' },
      { to: '/ceo/sales-pipeline', icon: Users, label: 'CRM' },
      { to: '/ceo/tasks', icon: CheckSquare, label: 'Tasks' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];
  } else if (user.role === 'DM') {
    navItems = [
      { to: '/dm/dashboard', icon: LayoutDashboard, label: 'Hub' },
      { to: '/dm/tasks', icon: CheckSquare, label: 'Tasks' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];
  } else if (user.role === 'Teacher') {
    navItems = [
      { to: '/teacher', icon: LayoutDashboard, label: 'Hub' },
      { to: '/teacher/tasks', icon: CheckSquare, label: 'Tasks' },
      { to: '/profile', icon: User, label: 'Profile' },
    ];
  }

  return (
    <>
      {/* Bottom nav bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Safe area background with candy-panel style */}
        <div className="bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-zinc-800 shadow-[0_-10px_30px_rgba(0,0,0,0.35)]">
          <div
            className="flex items-center h-[66px] px-1 py-1"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 6px)' }}
          >
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 h-full py-2 gap-1 transition-all duration-300 rounded-xl mx-0.5 min-h-[44px]
                  ${isActive
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/80 active:scale-95'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`
                      w-12 h-10 flex items-center justify-center rounded-2xl transition-all duration-300
                      ${isActive ? 'candy-btn-blue shadow-lg !min-h-[40px] !border' : ''}
                    `}>
                      <item.icon className="w-5 h-5" strokeWidth={isActive ? 3 : 2} />
                    </div>
                    <span className={`text-[10px] font-black leading-none ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}

            {/* Menu Button */}
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex flex-col items-center justify-center flex-1 h-full py-2 gap-1 text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/80 transition-all active:scale-95 min-h-[44px]"
            >
              <div className="w-12 h-10 flex items-center justify-center rounded-2xl">
                <Menu className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black leading-none">Menu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Sidebar) */}
      <div 
        className={`fixed inset-0 z-[100] md:hidden transition-opacity duration-300 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
        
        {/* Drawer */}
        <div 
          className={`absolute top-0 left-0 bottom-0 w-[80%] max-w-sm bg-white dark:bg-zinc-950 flex flex-col transform transition-transform duration-300 ease-in-out shadow-2xl ${
            menuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
            <CynexLogo size="md" badge="Menu" />
            <button 
              onClick={() => setMenuOpen(false)}
              className="p-2 rounded-full bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable nav links */}
          <div className="flex-1 overflow-y-auto overscroll-contain -webkit-overflow-scrolling-touch py-4 px-3">
            <Sidebar onNavClick={() => setMenuOpen(false)} isMobile={true} />
          </div>
        </div>
      </div>

      {/* Spacer to prevent content being hidden behind fixed nav */}
      <div className="h-28 md:hidden" aria-hidden="true" />
    </>
  );
};
