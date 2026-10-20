/**
 * Safety net for form-control names (WCAG 1.3.1 / 3.3.2 / 4.1.2).
 *
 * Most forms in this app render `<label>Name</label><input/>` without `htmlFor`/`id`, or a bare
 * `<span>Batch:</span><select/>`, so screen readers announce "edit text" with no name. This module links
 * those pairs after render and keeps doing so for modals and lists that mount later. Anything that already
 * has a real label, `aria-label`, `aria-labelledby` or `title` is left untouched, so explicit labels always win.
 */

const CONTROL = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea';

let counter = 0;

function isControl(el: Element | null): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return !!el && el.matches(CONTROL);
}

function hasAccessibleName(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  if (el.getAttribute('aria-label')?.trim() || el.getAttribute('aria-labelledby')) return true;
  if (el.getAttribute('title')?.trim()) return true;
  return !!el.labels && el.labels.length > 0;
}

function onlyControlIn(container: Element | null): HTMLElement | null {
  if (!container) return null;
  const found = container.querySelectorAll(CONTROL);
  return found.length === 1 ? (found[0] as HTMLElement) : null;
}

/** Associate one `<label>` with the control it visually belongs to. */
function linkLabel(label: HTMLLabelElement) {
  if (label.htmlFor || label.querySelector(CONTROL)) return;

  const next = label.nextElementSibling;
  let target: HTMLElement | null = null;
  if (isControl(next)) {
    target = next;
  } else if (next && !next.querySelector('label')) {
    target = onlyControlIn(next); // <label/><div class="relative"><input/></div>
  }
  if (!target) {
    const parent = label.parentElement;
    if (parent && parent.querySelectorAll('label').length === 1) target = onlyControlIn(parent); // <div><label/>…<input/></div>
  }
  if (!target) return;

  const control = target as HTMLInputElement;
  if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return;
  if (!control.id) control.id = `auto-field-${++counter}`;
  label.htmlFor = control.id;
}

/** Name a control from a short text node that sits right before it, e.g. `<span>Batch:</span><select/>`. */
function nameFromNeighbour(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (hasAccessibleName(control)) return;
  const candidates = [control.previousElementSibling, control.parentElement?.previousElementSibling];
  for (const el of candidates) {
    if (!el || el.matches('label')) continue;
    if (el.querySelector(`${CONTROL}, button, a, [role=button]`) || el.matches(`${CONTROL}, button, a`)) continue;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().replace(/[:*]+$/, '').trim();
    if (text.length >= 2 && text.length <= 40) {
      control.setAttribute('aria-label', text);
      return;
    }
  }
  // Last resort: a placeholder-only field. Better than an unnamed "edit text".
  const placeholder = control.getAttribute('placeholder')?.replace(/\s+/g, ' ').trim();
  if (placeholder) control.setAttribute('aria-label', placeholder.replace(/(\.{3}|…)$/, '').trim());
}

/** Exported for tests. */
export function applyAutoLabels(root: ParentNode = document) {
  root.querySelectorAll('label').forEach(l => linkLabel(l as HTMLLabelElement));
  root.querySelectorAll(CONTROL).forEach(c => nameFromNeighbour(c as HTMLInputElement));
}

/** Start observing the document. Returns a function that stops observing. */
export function installAutoLabels(): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};

  const pending = new Set<Element>();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const roots = Array.from(pending);
    pending.clear();
    for (const root of roots) {
      if (!root.isConnected) continue;
      // A label or control can be the added node itself, so also look at its parent.
      applyAutoLabels(root.parentElement ?? root);
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    // A short timer rather than requestAnimationFrame: rAF never fires in a background tab, and this
    // work is not tied to painting.
    setTimeout(flush, 30);
  };

  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      m.addedNodes.forEach(n => { if (n.nodeType === 1) pending.add(n as Element); });
    }
    if (pending.size) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  applyAutoLabels(document);
  return () => observer.disconnect();
}
