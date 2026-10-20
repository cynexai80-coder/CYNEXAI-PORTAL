import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, onKeyDown, role, tabIndex, ...props }) => {
  // A card with an onClick behaves like a button, so make it reachable and operable from the keyboard
  // (WCAG 2.1.1 / 4.1.2) without every call site having to remember to.
  const interactive = typeof onClick === 'function';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (!interactive || e.defaultPrevented) return;
    // Ignore keys pressed on controls nested inside the card (inputs, buttons, links).
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      e.currentTarget.click();
    }
  };

  return (
    <div
      className={`bg-erp-surface border-2 border-erp-border rounded-3xl p-5 shadow-erp-card ${interactive ? 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary' : ''} ${className}`}
      role={role ?? (interactive ? 'button' : undefined)}
      tabIndex={tabIndex ?? (interactive ? 0 : undefined)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
};
