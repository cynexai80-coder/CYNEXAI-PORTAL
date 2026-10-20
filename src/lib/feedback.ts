/**
 * Shared replacement for window.alert / confirm / prompt.
 *
 *   notify('Saved')                       // toast, kind guessed from the wording
 *   notify.error('Could not save')        // explicit kind
 *   if (await confirmDialog('Delete this?')) { ... }
 *   const name = await promptDialog('New file name');   // null when cancelled
 *
 * The UI lives in components/ui/FeedbackHost.tsx (mounted once in App). Native dialogs block the page, are
 * announced inconsistently by screen readers, cannot be styled, and are suppressed in some embedded browsers;
 * these are non-blocking, labelled, keyboard-operable and focus-managed.
 */

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red; use for deletes and other irreversible actions. */
  danger?: boolean;
}

export interface PromptOptions {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'number' | 'tel' | 'email';
  /** Return an error message to block submit, or null/undefined when the value is fine. */
  validate?: (value: string) => string | null | undefined;
}

export type DialogRequest =
  | { type: 'confirm'; id: number; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { type: 'prompt'; id: number; options: PromptOptions; resolve: (value: string | null) => void };

interface Host {
  showToast: (t: ToastItem) => void;
  showDialog: (d: DialogRequest) => void;
}

let host: Host | null = null;
let nextId = 1;

/** Called by FeedbackHost on mount/unmount. */
export function registerFeedbackHost(h: Host | null) {
  host = h;
}

/** Guess a toast kind from legacy alert() wording so existing messages keep a sensible style. */
export function inferKind(message: string): ToastKind {
  const m = message.toLowerCase();
  if (/\b(fail(ed|ure|s)?|error|could not|couldn't|can't|cannot|unable|denied|invalid|not found|already exists?|wrong|incorrect|expired|rejected|offline|unavailable|not allowed|too (large|big|long)|doesn't|does not|didn't|did not)\b|^❌|^⚠/.test(m)) return 'error';
  if (/^please\b|\b(must|required|select|enter|fill|choose|provide|at least|no \w+ (selected|found|available))\b/.test(m)) return 'warning';
  if (/\b(success(fully)?|saved|created|updated|deleted|removed|added|assigned|sent|copied|approved|completed|imported|generated|published|scheduled|done|enrolled|unlocked|granted|recorded|submitted|verified)\b|^✅|^✓/.test(m)) return 'success';
  return 'info';
}

function toText(message: unknown): string {
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;
  try { return String(message); } catch { return ''; }
}

function show(message: unknown, kind?: ToastKind) {
  const text = toText(message).trim();
  if (!text) return;
  const k = kind ?? inferKind(text);
  if (!host) {
    // No UI mounted (tests, scripts): never fall back to a blocking native alert.
    if (k === 'error') console.error('[notify]', text); else console.info('[notify]', text);
    return;
  }
  host.showToast({ id: nextId++, kind: k, message: text });
}

/** Non-blocking message. Kind is guessed from the wording unless one of the helpers is used. */
export const notify = Object.assign((message: unknown) => show(message), {
  success: (message: unknown) => show(message, 'success'),
  error: (message: unknown) => show(message, 'error'),
  warning: (message: unknown) => show(message, 'warning'),
  info: (message: unknown) => show(message, 'info'),
});

/** Resolves true when the user confirms, false on cancel / Escape / backdrop click. */
export function confirmDialog(options: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  if (!host) {
    // Without a UI the safe answer for an irreversible action is "no".
    return Promise.resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(opts.message) : false);
  }
  return new Promise<boolean>(resolve => host!.showDialog({ type: 'confirm', id: nextId++, options: opts, resolve }));
}

/** Resolves with the entered text, or null when cancelled. */
export function promptDialog(options: string | PromptOptions): Promise<string | null> {
  const opts: PromptOptions = typeof options === 'string' ? { message: options } : options;
  if (!host) {
    return Promise.resolve(typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt(opts.message, opts.defaultValue) : null);
  }
  return new Promise<string | null>(resolve => host!.showDialog({ type: 'prompt', id: nextId++, options: opts, resolve }));
}
