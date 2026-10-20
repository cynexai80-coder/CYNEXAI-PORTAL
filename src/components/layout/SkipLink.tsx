import React from 'react';

export const MAIN_CONTENT_ID = 'main-content';

/** First focusable element on every page: lets keyboard / screen-reader users jump past the navigation (WCAG 2.4.1). */
export const SkipLink: React.FC = () => (
  <a
    href={`#${MAIN_CONTENT_ID}`}
    onClick={(e) => {
      const target = document.getElementById(MAIN_CONTENT_ID);
      if (target) {
        // Avoid appending a #hash to the router URL; move focus directly instead.
        e.preventDefault();
        target.focus();
        target.scrollIntoView();
      }
    }}
    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[1000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-900 focus:shadow-xl focus:ring-2 focus:ring-blue-600"
  >
    Skip to main content
  </a>
);
