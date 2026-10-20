import type { KeyboardEvent } from 'react';

/**
 * Spread onto a non-button element that already has an onClick (a table row, a card made of divs) so it can
 * be focused and activated with Enter / Space (WCAG 2.1.1). Keys pressed on controls nested inside the
 * element are ignored so inner buttons, inputs and links keep working.
 *
 *   <tr onClick={open} {...keyboardActivate(open)}>
 *
 * Pass `asButton` for stand-alone clickable elements so assistive tech announces them as buttons; leave it
 * off for table rows, where role="button" would break the table semantics.
 */
export function keyboardActivate(onActivate: () => void, options: { asButton?: boolean; label?: string } = {}) {
  return {
    tabIndex: 0,
    ...(options.asButton ? { role: 'button' as const } : {}),
    ...(options.label ? { 'aria-label': options.label } : {}),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

/** Shared focus ring for elements made focusable with keyboardActivate. */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary';
