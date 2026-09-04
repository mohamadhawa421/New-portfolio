/**
 * Which theme is in force, and where the visitor's override is kept.
 *
 * This exists because two modules need the answer and the order they happen to
 * run in must not change it.
 *
 * The client router replaces every attribute on <html> during a swap, including
 * the `data-theme` that carries an override. Restoring it was theme.ts's job,
 * on `astro:after-swap` — but chrome.ts listens for the same event, is imported
 * first, and so ran first: it read a `data-theme` that had just been wiped,
 * fell through to the system preference, and painted the nav ink for the wrong
 * theme. On a machine set to dark with the site switched to light, that is a
 * white logo and a white burger on a white page, invisible until the next
 * scroll repainted them.
 *
 * Reading through to storage removes the race rather than reordering it.
 */

export type Theme = 'light' | 'dark';

/**
 * Session-scoped on purpose: the switch is a departure from the system setting,
 * not a replacement for it, so a new visit starts from the system again.
 */
export const STORAGE_KEY = 'mh-theme';

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The visitor's override, or null when they are following the system. */
export function storedTheme(): Theme | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved === 'dark' || saved === 'light' ? saved : null;
  } catch {
    // Private mode. The choice just will not survive a navigation.
    return null;
  }
}

/**
 * The theme actually in force.
 *
 * The attribute first, because during a switch it is ahead of storage; then the
 * stored override, which is what the attribute will be restored to; then the
 * system.
 */
export function resolvedTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'dark' || set === 'light') return set;
  return storedTheme() ?? systemTheme();
}

/**
 * Puts the override back on <html> after the router has wiped it.
 *
 * Idempotent, and safe to call from whichever module gets there first.
 */
export function restoreTheme(): void {
  const saved = storedTheme();
  if (saved) document.documentElement.dataset.theme = saved;
}
