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
 *      given element is the moment the wipe's edge actually passes it — read
 *      off the same easing curve the wipe runs on — so things nearest the
 *      switch move first and the far corner of the page moves last.
 *
 * Browsers without startViewTransition still get the lift-and-settle and an
 * instant palette swap; they just miss the circular wipe.
 */

import { STORAGE_KEY, resolvedTheme, restoreTheme, systemTheme } from './theme-state';
import type { Theme } from './theme-state';

/** How long one wave takes, from the first press. */
const WAVE_MS = 700;

/**
 * A second press while the first wave is still running gets a shorter one, so
 * hammering the switch stays responsive instead of queueing up 700ms waves.
 */
const FAST_WAVE_MS = 380;

/** How long the lift-and-land keyframes run. Must match `.is-lifting`. */
const LIFT_MS = 620;

/**
 * The wipe's easing.
 *
 * The old curve — the site's standard glide — ended almost flat, so the last
 * few percent of the radius crawled: the wave visibly stalled just short of the
 * far corners and the remainder appeared all at once when the transition ended
 * and the pseudo-elements were torn down. This one still eases out of the
 * button, but it is still travelling at speed when it finishes.
 */
const WAVE_EASING = 'cubic-bezier(0.4, 0, 0.75, 0.9)';
const WAVE_BEZIER = [0.4, 0, 0.75, 0.9] as const;

/**
 * The circle is grown past the far corner rather than exactly to it. Reaching
 * the corner on the final frame means the corner is where the wipe is slowest,
 * which is precisely where a stall is most visible; overshooting puts the end
 * of the curve off screen, so what the visitor sees is a wave that sweeps out
 * and is simply gone.
 */
const WAVE_OVERSHOOT = 1.15;

/** One axis of a cubic Bézier with the endpoints fixed at 0 and 1. */
function bezierAxis(t: number, a: number, b: number): number {
  const inv = 1 - t;
  return 3 * inv * inv * t * a + 3 * inv * t * t * b + t * t * t;
}

/**
 * When the wipe's edge passes a given fraction of the full radius, as a
 * fraction of the animation's duration.
 *
 * The lift is meant to track the wave, so it has to be timed against the curve
 * the wave actually follows. Treating it as linear — which is what dividing a
 * distance by a speed does — had sections nearest the switch lifting well
 * before the wave reached them.
 */
function timeAtProgress(progress: number): number {
  const [x1, y1, x2, y2] = WAVE_BEZIER;
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;

  // Sample rather than solve: 24 steps is finer than a frame at these lengths.
  let previousT = 0;
  let previousY = 0;
  for (let i = 1; i <= 24; i += 1) {
    const t = i / 24;
    const y = bezierAxis(t, y1, y2);
    if (y >= progress) {
      const span = y - previousY || 1;
      const at = previousT + ((progress - previousY) / span) * (t - previousT);
      return bezierAxis(at, x1, x2);
    }
    previousT = t;
    previousY = y;
  }
  return 1;
}

/**
 * Repaints the browser's own chrome to match the page.
 *
 * Both meta tags are written, not just the matching one: their media queries
 * describe the *system* preference, and once the visitor has taken the switch
 * away from it neither query means anything useful any more. Setting both
 * makes whichever one the browser picks the right answer.
 */
function paintBrowserChrome(): void {
  const surface = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface')
    .trim();
  if (!surface) return;
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', surface));
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    /*
     * The override is deliberately session-scoped, and is dropped entirely
     * once it agrees with the system again.
     *
     * Stored in localStorage it outlived its usefulness: one press of the
     * switch pinned the site to that theme on every future visit, and it then
     * ignored the system setting for good — including someone whose machine
     * moves between light and dark through the day. The system is the default;
     * the switch is a departure from it, not a replacement for it.
     */
    if (theme === systemTheme()) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode. The choice just will not survive a reload.
  }
  document
    .querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')
    .forEach((b) => b.setAttribute('aria-pressed', String(theme === 'dark')));

  paintBrowserChrome();

  // chrome.ts recolours the nav and logo mark off the back of this.
  window.dispatchEvent(new CustomEvent('mh:themechange', { detail: theme }));
}

/**
 * Marks each animatable block with how long the wave takes to reach it, then
 * lets CSS run the lift. Distance is measured from the wave's origin to the
 * nearest point of the element, so a tall section starts moving when its edge
 * is hit rather than when its centre is.
 *
 * Returns the cleanup, and the latest moment at which anything is still
 * moving — the caller has to hold the class until then. Tearing it down early
 * cancels the animation mid-flight and every section still running snaps back
 * to where it started, which is the jolt that used to land right at the end of
 * the wave.
 */
function scheduleLift(
  originX: number,
  originY: number,
  radius: number,
  duration: number
): { done: () => void; settlesIn: number } {
  const reach = radius * WAVE_OVERSHOOT;
  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-lift]'));

  let lastDelay = 0;

  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue;

    const dx = Math.max(rect.left - originX, 0, originX - rect.right);
    const dy = Math.max(rect.top - originY, 0, originY - rect.bottom);
    const distance = Math.hypot(dx, dy);

    const delay = Math.round(timeAtProgress(distance / reach) * duration);
    lastDelay = Math.max(lastDelay, delay);

    el.style.setProperty('--lift-delay', `${delay}ms`);
    el.classList.add('is-lifting');
  }

  return {
    done: () => {
      for (const el of targets) {
        el.classList.remove('is-lifting');
        el.style.removeProperty('--lift-delay');
      }
    },
    settlesIn: lastDelay + LIFT_MS,
  };
}

/**
 * The wave in flight, if there is one.
 *
 * Every press supersedes the last: a second press starts a new transition,
 * which makes the browser skip the first, and the first's promises then resolve
 * out of order. The generation number is what stops a stale one tearing down
 * the wave that replaced it.
 */
let generation = 0;
let inFlight = false;
let clearLift: (() => void) | null = null;
let settleTimer = 0;

/** Ends whatever the previous press left running, right now. */
function settleNow(): void {
  window.clearTimeout(settleTimer);
  settleTimer = 0;
  if (clearLift) {
    clearLift();
    clearLift = null;
  }
  document.documentElement.classList.remove('theme-waving');
}

function toggle(button: HTMLElement): void {
  const next: Theme = resolvedTheme() === 'dark' ? 'light' : 'dark';

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
    settleNow();
    apply(next);
    return;
  }

  // Pressed again mid-wave: drop what the last one was doing rather than
  // layering a second lift on top of it, and run a shorter wave so a run of
  // presses keeps up with the finger instead of falling behind it.
  const duration = inFlight ? FAST_WAVE_MS : WAVE_MS;
  settleNow();

  /*
   * A morph left this on. It hides the outgoing snapshot, which is exactly what
   * the wipe needs to reveal the new theme over.
   */
  document.documentElement.classList.remove('morphing');

  const gen = ++generation;
  inFlight = true;

  const lift = scheduleLift(originX, originY, radius, duration);
  clearLift = lift.done;
  document.documentElement.classList.add('theme-waving');

  const transition = (document as any).startViewTransition(() => apply(next));

  transition.ready
    .then(() => {
      if (gen !== generation) return;
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${originX}px ${originY}px)`,
            `circle(${radius * WAVE_OVERSHOOT}px at ${originX}px ${originY}px)`,
          ],
        },
        {
          duration,
          easing: WAVE_EASING,
          // Clip the incoming snapshot, so the new theme is wiped in over the old.
          pseudoElement: '::view-transition-new(root)',
        }
      );
    })
    .catch(() => {
      /* Transition was skipped; the theme is applied either way. */
    });

  /*
   * The lift is cleared on its own clock, not the transition's.
   *
   * Hanging it off `finished` meant the far sections — whose delay can outlast
   * the wave itself — had the class pulled out from under them mid-animation
   * and snapped back to where they started. That is doubly true when the
   * browser skips the transition outright, which it does in a background tab:
   * `finished` then resolves immediately and every section jolted at once.
   */
  settleTimer = window.setTimeout(() => {
    if (gen !== generation) return;
    settleTimer = 0;
    clearLift = null;
    lift.done();
  }, lift.settlesIn + 40);

  transition.finished
    .finally(() => {
      if (gen !== generation) return;
      inFlight = false;
      document.documentElement.classList.remove('theme-waving');
    })
    /*
     * `finally` runs the callback but passes the rejection straight through, so
     * without this an aborted transition — which is what the browser does the
     * moment the tab is hidden — surfaced as an unhandled rejection in the
     * console. There is nothing to recover from: the theme is already applied.
     */
    .catch(() => {});
}

function setup(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = '1';
    button.setAttribute('aria-pressed', String(resolvedTheme() === 'dark'));
    button.addEventListener('click', () => toggle(button));
  });
}

document.addEventListener('astro:page-load', () => {
  setup();
  // The router swaps in the new document's <head>, which restores the static
  // meta tags — so an overridden theme has to re-state itself here.
  paintBrowserChrome();
});

/*
 * The client router swaps in the new document's <html> attributes, and
 * data-theme is only ever set at runtime — so it is not in the markup and gets
 * wiped on every navigation, dropping the page back to the system preference.
 *
 * Restoring it on `astro:after-swap` puts it back before the browser paints,
 * so the theme carries across pages with no flash.
 */
document.addEventListener('astro:after-swap', restoreTheme);

/*
 * Changing the system theme is a deliberate act, so it wins: the override is
 * dropped and the page follows. With no data-theme attribute the palette comes
 * straight from the prefers-color-scheme block in tokens.css.
 */
/*
 * The preference used to live in localStorage, where it pinned the theme
 * permanently. It is session-scoped now, so clear the old key rather than
 * leaving a value behind that nothing reads.
 */
try {
  localStorage.removeItem(STORAGE_KEY);
} catch {
  /* nothing to clear */
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing stored to clear */
  }

  delete document.documentElement.dataset.theme;
  paintBrowserChrome();

  document
    .querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')
    .forEach((b) => b.setAttribute('aria-pressed', String(systemTheme() === 'dark')));

  window.dispatchEvent(new CustomEvent('mh:themechange'));
});
