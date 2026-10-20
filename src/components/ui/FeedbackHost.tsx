import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { registerFeedbackHost, DialogRequest, ToastItem, ToastKind } from '../../lib/feedback';

const MAX_TOASTS = 4;
const DURATION_MS: Record<ToastKind, number> = { success: 4500, info: 5000, warning: 7000, error: 9000 };

const TOAST_STYLE: Record<ToastKind, { box: string; icon: React.ElementType; iconColor: string; label: string }> = {
  success: { box: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-50', icon: CheckCircle2, iconColor: 'text-emerald-700 dark:text-emerald-400', label: 'Success' },
  error: { box: 'border-red-300 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-950 dark:text-red-50', icon: AlertCircle, iconColor: 'text-red-700 dark:text-red-400', label: 'Error' },
  warning: { box: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-50', icon: AlertTriangle, iconColor: 'text-amber-800 dark:text-amber-400', label: 'Warning' },
  info: { box: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-500/40 dark:bg-sky-950 dark:text-sky-50', icon: Info, iconColor: 'text-sky-700 dark:text-sky-400', label: 'Notice' },
};

// ── Toast ───────────────────────────────────────────────────────────────────

const ToastView: React.FC<{ toast: ToastItem; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const [paused, setPaused] = useState(false);
  const style = TOAST_STYLE[toast.kind];
  const Icon = style.icon;

  // Auto-dismiss, but never while the pointer or keyboard focus is on the toast (WCAG 2.2.1).
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => onDismiss(toast.id), DURATION_MS[toast.kind]);
    return () => clearTimeout(t);
  }, [paused, toast.id, toast.kind, onDismiss]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${style.box}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 whitespace-pre-line break-words font-medium leading-snug">
        <span className="sr-only">{style.label}: </span>
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-mr-1 rounded-md p-1 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};

// ── Confirm / prompt dialog ──────────────────────────────────────────────────

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const DialogView: React.FC<{ request: DialogRequest; onClose: () => void }> = ({ request, onClose }) => {
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const isPrompt = request.type === 'prompt';
  const options = request.options;
  const danger = request.type === 'confirm' && !!request.options.danger;
  const [value, setValue] = useState(request.type === 'prompt' ? request.options.defaultValue ?? '' : '');
  const [error, setError] = useState<string | null>(null);
  const settled = useRef(false);

  const finish = useCallback((result: boolean | string | null) => {
    if (settled.current) return;
    settled.current = true;
    if (request.type === 'confirm') request.resolve(result === true);
    else request.resolve(typeof result === 'string' ? result : null);
    onClose();
  }, [request, onClose]);

  // Move focus into the dialog, and give it back to the opener when the dialog closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const target = isPrompt ? inputRef.current : danger ? cancelRef.current : confirmRef.current;
    target?.focus();
    if (isPrompt) inputRef.current?.select();
    return () => { opener?.focus?.(); };
  }, [isPrompt, danger]);

  const submitPrompt = () => {
    if (request.type !== 'prompt') return;
    const problem = request.options.validate?.(value);
    if (problem) { setError(problem); inputRef.current?.focus(); return; }
    finish(value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      finish(isPrompt ? null : false);
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const title = options.title ?? (isPrompt ? 'Enter a value' : danger ? 'Are you sure?' : 'Please confirm');
  const confirmLabel = options.confirmLabel ?? (isPrompt ? 'OK' : danger ? 'Delete' : 'Confirm');

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => finish(isPrompt ? null : false)}
      />
      <div
        ref={panelRef}
        role={isPrompt ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 outline-none text-slate-900 shadow-2xl dark:border-white/10 dark:bg-zinc-900 dark:text-white"
      >
        <h2 id={titleId} className="mb-2 text-lg font-bold">{title}</h2>
        <p id={descId} className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{options.message}</p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (isPrompt) submitPrompt(); else finish(true); }}
          noValidate
        >
          {request.type === 'prompt' && (
            <div className="mt-4">
              <input
                ref={inputRef}
                type={request.options.inputType ?? 'text'}
                value={value}
                onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
                placeholder={request.options.placeholder}
                aria-labelledby={descId}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-white/15 dark:bg-black dark:text-white"
              />
              {error && <p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={() => finish(isPrompt ? null : false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
            >
              {options.cancelLabel ?? 'Cancel'}
            </button>
            <button
              ref={confirmRef}
              type="submit"
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
                danger ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500' : 'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Host ─────────────────────────────────────────────────────────────────────

export const FeedbackHost: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialogs, setDialogs] = useState<DialogRequest[]>([]);

  const pending = useRef<DialogRequest[]>([]);

  const dismissToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  const closeDialog = useCallback((id: number) => {
    pending.current = pending.current.filter(d => d.id !== id);
    setDialogs(prev => prev.filter(d => d.id !== id));
  }, []);

  useEffect(() => {
    registerFeedbackHost({
      showToast: (t) => setToasts(prev => [...prev.filter(x => !(x.kind === t.kind && x.message === t.message)), t].slice(-MAX_TOASTS)),
      showDialog: (d) => { pending.current.push(d); setDialogs(prev => [...prev, d]); },
    });
    return () => {
      registerFeedbackHost(null);
      // Anything still open when the host goes away must not leave its caller waiting forever.
      for (const d of pending.current) { if (d.type === 'confirm') d.resolve(false); else d.resolve(null); }
      pending.current = [];
    };
  }, []);

  if (typeof document === 'undefined') return null;
  const current = dialogs[0];

  return createPortal(
    <>
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-4 top-4 z-[1100] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-96"
      >
        {toasts.map(t => <ToastView key={t.id} toast={t} onDismiss={dismissToast} />)}
      </div>
      {current && <DialogView key={current.id} request={current} onClose={() => closeDialog(current.id)} />}
    </>,
    document.body
  );
};

export default FeedbackHost;
