/**
 * Super designer mode. The third theme, and the one with no switch.
 *
 * Light and dark are a choice the visitor makes. This one is found: press and
 * hold the theme control — the place a third mode would live if there were a
 * third mode — and the site drops into the room the character actually works
 * in. Deep violet ground, purple accents, his purple-eyed portrait, and a
 * five percent discount he does not advertise.
 *
 * Three rules hold it together, and all three are deliberate:
 *
 * It changes state rather than being destroyed. The Ultimate Control egg takes
 * the page apart because that egg is about power; this one is about somewhere
 * you have arrived, so it is a cross-fade and a flicker and nothing else.
 *
 * It does not survive a reload. There is no storage anywhere in this file: the
 * flag below is a module variable, so it lives exactly as long as the document
 * does. Someone who wants it back has to find it again — which is most of what
 * makes it worth finding once. There is a second way out further down, held
 * back for the one person who has to leave this mode a hundred times.
 *
 * It locks the theme toggle. Half of this mode is its ground, and letting the
 * visitor put the light theme back underneath it would leave them looking at
 * something neither mode was designed as.
 */
import * as sound from './designer-sound';

/** Set on <html>. Everything visual keys off it; nothing else does. */
const FLAG = 'data-super';

/** How long the press has to be held. */
export const HOLD_MS = 1400;

/** In memory, and nowhere else. See the note above. */
let on = false;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function isSuper(): boolean {
  return on;
}

/**
 * Turns the light/dark control off, quietly.
 *
 * `disabled` rather than a class, because the button has to stop working as
 * well as stop looking available — and it is what a screen reader reads out.
 */
function lockTheme(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('aria-label', 'Theme locked — super designer mode');
    button.title = 'Locked while super designer mode is on';
  }
}

/** Gives the light/dark control back, exactly as the markup had it. */
function unlockTheme(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    button.disabled = false;
    button.removeAttribute('aria-disabled');
    button.setAttribute('aria-label', 'Switch theme');
    button.title = 'Switch theme';
  }
}

/**
 * Re-states everything the router's swap knocks off.
 *
 * The client router replaces <html>'s attributes wholesale with the incoming
 * document's, and the incoming document has never heard of this mode — so
 * without this, following any link would drop the visitor back into the normal
 * theme with no way to tell why. The buttons are new after a swap too, so the
 * lock has to be re-applied to them rather than to the ones it locked before.
 */
export function restoreSuper(): void {
  if (!on) return;
  document.documentElement.setAttribute(FLAG, '');
  lockTheme();
}

/** Puts the mode on, once the flicker has been seen. */
function commit(): void {
  document.documentElement.setAttribute(FLAG, '');
  lockTheme();
  document.dispatchEvent(new CustomEvent('mh:super'));
}

/**
 * The arrival.
 *
 * A flicker, a spark, and then every colour on the page crossing to the new
 * palette at once. The cross-fade is a view transition because that is the
 * only way to move tokens that are not registered as colours — surfaces, ink,
 * lines — without them snapping one frame ahead of the accents, which are.
 *
 * The flicker comes first and is over before the fade starts. That order is
 * the whole feeling: something happens *to* the page, and then the page is
 * different. Reversed, it reads as a loading state.
 */
export function enterSuper(): void {
  if (on) return;
  on = true;

  const root = document.documentElement;
  root.classList.add('super-arriving');
  window.setTimeout(() => root.classList.remove('super-arriving'), 620);

  if (!sound.isMuted()) sound.spark(0.12);

  const start = () => {
    const canFade =
      !reduced() &&
      typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition ===
        'function';

    if (!canFade) {
      commit();
      return;
    }

    root.classList.add('super-fading');
    const transition = (
      document as unknown as { startViewTransition: (cb: () => void) => { finished: Promise<void> } }
    ).startViewTransition(commit);

    transition.finished
      .finally(() => root.classList.remove('super-fading'))
      // An aborted transition — which is what a backgrounded tab does — is not
      // something to recover from. The mode is on either way.
      .catch(() => {});
  };

  // Long enough for the flicker to be a separate event, short enough that it
  // is one gesture. Reduced motion gets no flicker and so waits for nothing.
  if (reduced()) start();
  else window.setTimeout(start, 190);
}

/**
 * The way out, for the one person who knows there is one.
 *
 * A reload has always ended this mode and still does — that is the documented
 * exit and the one every visitor has. This is the other one: the same shape as
 * the arrival, run backwards, so that testing the mode does not mean losing
 * the page you were looking at every time.
 */
export function exitSuper(): void {
  if (!on) return;
  on = false;

  const root = document.documentElement;
  root.classList.add('super-arriving');
  window.setTimeout(() => root.classList.remove('super-arriving'), 620);

  if (!sound.isMuted()) sound.spark(0.12);

  const leave = () => {
    root.removeAttribute(FLAG);
    unlockTheme();
    document.dispatchEvent(new CustomEvent('mh:super'));
  };

  const canFade =
    !reduced() &&
    typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition ===
      'function';

  if (!canFade) {
    leave();
    return;
  }

  root.classList.add('super-fading');
  const transition = (
    document as unknown as { startViewTransition: (cb: () => void) => { finished: Promise<void> } }
  ).startViewTransition(leave);

  transition.finished
    .finally(() => root.classList.remove('super-fading'))
    .catch(() => {});
}

/* ---------------------------------------------------------------------- */
/* The way in                                                              */
/* ---------------------------------------------------------------------- */

/**
 * Press and hold the theme control.
 *
 * One place, one gesture, and no combination to remember. It is hidden by
 * being ordinary: everyone presses that button, nobody holds it. And it is the
 * right button — a third mode belongs in the mode switch, which is the part
 * that should make someone say *of course* rather than *how was I meant to
 * know that*.
 *
 * Bound on the document rather than the buttons, so one registration covers
 * every page, both copies of the control, and every swap the router makes.
 */
export function bindSuperTrigger(): void {
  let timer = 0;
  let held: HTMLElement | null = null;
  /* Set the moment the hold completes, and read by the click that always
     follows a press: without it, letting go would also toggle the theme. */
  let swallowClick = false;

  const stop = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    held?.classList.remove('theme-toggle--charging');
    held = null;
  };

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (on) return;
      const button = (event.target as Element | null)?.closest<HTMLElement>('[data-theme-toggle]');
      // The secondary button is a menu, not a press.
      if (!button || (event as PointerEvent).button !== 0) return;

      held = button;
      button.classList.add('theme-toggle--charging');
      timer = window.setTimeout(() => {
        stop();
        swallowClick = true;
        enterSuper();
      }, HOLD_MS);
    },
    { passive: true }
  );

  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    document.addEventListener(type, stop, { passive: true });
  }

  // A touch hold would otherwise raise the platform's own callout over the
  // button halfway through, which cancels the gesture and looks like a fault.
  document.addEventListener('contextmenu', (event) => {
    if (held) event.preventDefault();
  });

  document.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true }
  );

  // Scrolling away mid-hold is a cancel, not a press.
  window.addEventListener('scroll', stop, { passive: true });

  bindSuperExit();
}

/* ---------------------------------------------------------------------- */
/* The way out                                                             */
/* ---------------------------------------------------------------------- */

/** How long the key is held, matched to the way in. */
const EXIT_HOLD_MS = 1200;

/**
 * Hold M, or shake the phone.
 *
 * Neither is discoverable and neither is meant to be: the exit every visitor
 * has is a reload, and this is for the one person who needs to leave the mode
 * a hundred times without losing his place. Nothing hints at either, and both
 * only listen while the mode is actually on.
 *
 * A shake rather than a tap on mobile for the same reason M is a hold: it
 * cannot happen while someone is reading.
 */
function bindSuperExit(): void {
  let keyTimer = 0;

  const cancelKey = () => {
    if (keyTimer) window.clearTimeout(keyTimer);
    keyTimer = 0;
  };

  document.addEventListener('keydown', (event) => {
    if (!on || keyTimer) return;
    if (event.key !== 'm' && event.key !== 'M') return;
    // Held, not typed: a repeat is the OS reporting the same press.
    if (event.repeat) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    /*
     * Never while the visitor is writing. The enquiry form has an M in most
     * of what anyone would type into it, and a mode that vanished halfway
     * through a sentence would read as the site breaking.
     */
    const el = event.target;
    if (el instanceof Element && el.closest('input, textarea, select, [contenteditable]')) return;

    keyTimer = window.setTimeout(() => {
      cancelKey();
      exitSuper();
    }, EXIT_HOLD_MS);
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === 'm' || event.key === 'M') cancelKey();
  });
  // Letting go outside the window never sends a keyup.
  window.addEventListener('blur', cancelKey);

  bindShake();
}

/**
 * A shake, for the phone.
 *
 * Three jolts inside a second, measured as the change in acceleration between
 * samples rather than its magnitude — gravity is in that reading, so the
 * magnitude alone is about 9.8 whether the phone is being shaken or lying on a
 * table. It is the difference that means someone moved it.
 *
 * No permission is asked for. iOS gates motion behind a prompt that has to
 * follow a tap, and a system dialog appearing after a secret is found would
 * both give the secret away and be impossible to explain. Where the browser
 * hands motion over without asking — Android, and iOS where the visitor has
 * already allowed it — this works; where it does not, a reload still ends the
 * mode, which is what everyone else uses anyway.
 */
function bindShake(): void {
  if (typeof window.DeviceMotionEvent === 'undefined') return;
  if (
    typeof (window.DeviceMotionEvent as unknown as { requestPermission?: unknown })
      .requestPermission === 'function'
  ) {
    return;
  }

  /** Hard enough that carrying the phone cannot do it. */
  const JOLT = 16;
  /** And enough of them that one knock cannot either. */
  const JOLTS = 3;
  const WINDOW_MS = 1000;

  let last: { x: number; y: number; z: number } | null = null;
  let jolts: number[] = [];

  window.addEventListener(
    'devicemotion',
    (event) => {
      if (!on) return;
      const a = event.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;

      const next = { x: a.x, y: a.y, z: a.z };
      if (last) {
        const delta =
          Math.abs(next.x - last.x) + Math.abs(next.y - last.y) + Math.abs(next.z - last.z);
        if (delta > JOLT) {
          const now = Date.now();
          jolts = jolts.filter((t) => now - t < WINDOW_MS);
          jolts.push(now);
          if (jolts.length >= JOLTS) {
            jolts = [];
            exitSuper();
          }
        }
      }
      last = next;
    },
    { passive: true }
  );
}
