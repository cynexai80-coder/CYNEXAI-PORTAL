import React from 'react';

interface CynexLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  badge?: string;
  className?: string;
  showText?: boolean;
}

export const CynexLogo: React.FC<CynexLogoProps> = ({ 
  size = 'md', 
  badge, 
  className = '',
}) => {
  let logoHeight = 'h-7 sm:h-8';
  let maxW = 'max-w-[140px] sm:max-w-[160px]';

  if (size === 'sm') {
    logoHeight = 'h-5 sm:h-6';
    maxW = 'max-w-[120px]';
  } else if (size === 'lg') {
    logoHeight = 'h-8 sm:h-9';
    maxW = 'max-w-[180px]';
  } else if (size === 'xl') {
    logoHeight = 'h-10 sm:h-12';
    maxW = 'max-w-[220px]';
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Light Mode Image Logo (Black text/icon for light backgrounds) */}
      <img
        src="/cynex_logo_light.png"
        alt="CynexAI"
        className={`dark:hidden block ${logoHeight} ${maxW} object-contain select-none flex-shrink-0`}
      />

      {/* Dark Mode Image Logo (White text/icon for dark backgrounds) */}
      <img
        src="/cynex_logo_dark.png"
        alt="CynexAI"
        className={`dark:block hidden ${logoHeight} ${maxW} object-contain select-none flex-shrink-0`}
      />

      {badge && (
        <span className="text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 whitespace-nowrap flex-shrink-0 shadow-2xs">
          {badge}
        </span>
      )}
    </div>
  );
};
