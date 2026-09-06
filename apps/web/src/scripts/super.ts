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
 * makes it worth finding once.
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
 * There is no matching unlock: the only way out of this mode is a reload, and
 * a reload brings back a document that never had this run on it.
 */
function lockTheme(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    button.setAttribute('aria-label', 'Theme locked — super designer mode');
    button.title = 'Locked while super designer mode is on';
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
}
