import React from 'react';
import { Button } from './Button';

/** Announced to screen readers; use instead of a bare "Loading..." div. */
export const LoadingNotice: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading…', className = '' }) => (
  <div role="status" aria-live="polite" className={`p-10 text-center font-bold text-erp-text/70 ${className}`}>
    {label}
  </div>
);

interface UnavailableNoticeProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

/** Shown when a record cannot be loaded, so the page never sits on "Loading…" forever. */
export const UnavailableNotice: React.FC<UnavailableNoticeProps> = ({
  title = 'Unable to load this page',
  message,
  onRetry,
  onBack,
  backLabel = 'Go back',
  className = '',
}) => (
  <div role="alert" className={`mx-auto max-w-md p-10 text-center ${className}`}>
    <h1 className="text-xl font-bold text-erp-text mb-2">{title}</h1>
    <p className="text-sm text-erp-text/70 mb-6">{message}</p>
    <div className="flex justify-center gap-3">
      {onRetry && <Button variant="primary" onClick={onRetry}>Try again</Button>}
      {onBack && <Button variant="outline" onClick={onBack}>{backLabel}</Button>}
    </div>
  </div>
);
