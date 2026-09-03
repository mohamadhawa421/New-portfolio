/**
 * Theme switching, and the wave that carries it across the page.
 *
 * The colour change itself is instant — one attribute on <html> swaps the
 * palette. Everything below is about *revealing* that change:
 *
 *   1. A circular wipe expanding from the button, done with the View
 *      Transitions API. The browser snapshots the old and new renderings, and
 *      we animate a clip-path circle on the new one. Because it is a snapshot
 *      rather than live DOM, it costs nothing per frame no matter how much is
 *      on screen.
 *
 *   2. Each section lifts and settles as the wave reaches it. The delay for a
 *      given element is its distance from the button divided by the wave's
 *      speed, so things nearest the switch move first and the far corner of
 *      the page moves last.
 *
 * Browsers without startViewTransition still get the lift-and-settle and an
 * instant palette swap; they just miss the circular wipe.
 */

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mh-theme';
const WAVE_MS = 780;

/** Pixels per millisecond, derived so the wave crosses the viewport in WAVE_MS. */
function waveSpeed(radius: number): number {
  return radius / WAVE_MS;
}

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === 'dark' || set === 'light') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode. The choice just will not survive a reload.
  }
  document
    .querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')
    .forEach((b) => b.setAttribute('aria-pressed', String(theme === 'dark')));

  // chrome.ts recolours the nav and logo mark off the back of this.
  window.dispatchEvent(new CustomEvent('mh:themechange', { detail: theme }));
}

/**
 * Marks each animatable block with how long the wave takes to reach it, then
 * lets CSS run the lift. Distance is measured from the wave's origin to the
 * nearest point of the element, so a tall section starts moving when its edge
 * is hit rather than when its centre is.
 */
function scheduleLift(originX: number, originY: number, radius: number): () => void {
  const speed = waveSpeed(radius);
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-lift]')
  );

  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;

    const dx = Math.max(rect.left - originX, 0, originX - rect.right);
    const dy = Math.max(rect.top - originY, 0, originY - rect.bottom);
    const distance = Math.hypot(dx, dy);

    el.style.setProperty('--lift-delay', `${Math.round(distance / speed)}ms`);
    el.classList.add('is-lifting');
  }

  return () => {
    for (const el of targets) {
      el.classList.remove('is-lifting');
      el.style.removeProperty('--lift-delay');
    }
  };
}

function toggle(button: HTMLElement): void {
  const next: Theme = current() === 'dark' ? 'light' : 'dark';

  const rect = button.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  // Far corner of the viewport — how far the circle must grow to cover it.
  const radius = Math.hypot(
    Math.max(originX, window.innerWidth - originX),
    Math.max(originY, window.innerHeight - originY)
  );

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canWipe =
    'startViewTransition' in document &&
    typeof (document as any).startViewTransition === 'function';

  if (reduced || !canWipe) {
    apply(next);
    return;
  }

  const cleanup = scheduleLift(originX, originY, radius);
  document.documentElement.classList.add('theme-waving');

  const transition = (document as any).startViewTransition(() => apply(next));

  transition.ready
    .then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${originX}px ${originY}px)`,
            `circle(${radius}px at ${originX}px ${originY}px)`,
          ],
        },
        {
          duration: WAVE_MS,
          easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)',
          // Clip the incoming snapshot, so the new theme is wiped in over the old.
          pseudoElement: '::view-transition-new(root)',
        }
      );
    })
    .catch(() => {
      /* Transition was skipped; the theme is applied either way. */
    });

  transition.finished.finally(() => {
    document.documentElement.classList.remove('theme-waving');
    // Held until the last element has landed.
    window.setTimeout(cleanup, 420);
  });
}

function setup(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.setAttribute('aria-pressed', String(current() === 'dark'));
    button.addEventListener('click', () => toggle(button));
  });
}

document.addEventListener('astro:page-load', setup);

/*
 * The client router swaps in the new document's <html> attributes, and
 * data-theme is only ever set at runtime — so it is not in the markup and gets
 * wiped on every navigation, dropping the page back to the system preference.
 *
 * Restoring it on `astro:after-swap` puts it back before the browser paints,
 * so the theme carries across pages with no flash.
 */
document.addEventListener('astro:after-swap', () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.dataset.theme = saved;
    }
  } catch {
    /* private mode — falls back to the system preference */
  }
});
