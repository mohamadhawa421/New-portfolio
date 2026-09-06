/**
 * A small consequence for an action the interface refused.
 *
 * The character behind designer mode is notionally watching, and when something
 * is submitted that cannot be accepted he takes it out on the pointer: a couple
 * of purple arcs, a shake of about a fifth of a second, and gone. It is a
 * personality layer and nothing else — the real error message, the field state
 * and everything a screen reader is told all happen exactly as before, and this
 * is on top.
 *
 * Only for a genuine refusal. Not a hover, not an ordinary press, not a
 * successful send, and not every keystroke that fails a check while it is still
 * being typed.
 */
import * as sound from './designer-sound';

/** How long the whole thing lasts, matched to the CSS below. */
export const PUNISH_MS = 380;

/*
 * Whether there is a drawn pointer to punish.
 *
 * The class the pointer sets on <html> when it takes over from the native
 * cursor, rather than the media query it consults before deciding to. They
 * usually agree, and when they do not it is the class that is true: a desktop
 * visitor whose pointer never started — reduced motion, or the script not
 * arriving — would otherwise be sent a punishment that nothing is listening
 * for, and get no answer at all to an action that was refused.
 */
const drawnPointer = () => document.documentElement.classList.contains('has-custom-cursor');
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Punishes the pointer, or the control that was pressed where there is none.
 *
 * The real cursor cannot be moved by a page, and should not be — so what shakes
 * is the pointer this site already draws, which is tracking the mouse anyway.
 * Nothing new is measured and nothing new runs between punishments.
 *
 * On a touch screen there is no pointer to punish, so the control that refused
 * takes it instead: the same arcs, the same shake, the same length.
 */
/** Whether this is something the visitor types into rather than presses. */
function isField(el: HTMLElement): boolean {
  return el.matches('input, textarea, select');
}

/** Runs the arcs on one element. */
function strike(el: HTMLElement): void {
  el.classList.remove('is-punished');
  // Flushed, so a second refusal restarts the animation rather than being
  // swallowed by the one still running.
  void el.offsetWidth;
  el.classList.add('is-punished');
  window.setTimeout(() => el.classList.remove('is-punished'), PUNISH_MS + 60);
}

/* ---------------------------------------------------------------------- */
/* The rage                                                                */
/* ---------------------------------------------------------------------- */

/** Which refusal in a row stops being a telling-off. */
const RAGE_AT = 6;

/**
 * How long two refusals can be apart and still count as in a row.
 *
 * A run is someone hammering the button, not someone who came back twenty
 * minutes later and got it wrong again. Ten seconds is long enough to read the
 * message, try something, and be refused a second time — and short enough that
 * a count never survives the visitor going away and doing something else.
 */
const RAGE_WINDOW_MS = 10_000;

/** How much of the page comes off its hooks. Enough to be felt. */
const RATTLE_REACH = 44;
const RATTLE_MAX = 52;
const RATTLE_MS = 1500;
/**
 * How long the pressed control stays hot before it is back to itself.
 *
 * Much longer than anything else here, and longer than the storm that caused
 * it. The flash, the thunder and the shaking are an event; this is what the
 * event left behind, and heat leaves slowly or it was never heat. Matched to
 * the animation in global.css.
 */
const OVERLOAD_MS = 2750;

let streak = 0;
let lastRefusal = 0;
/** True while a storm is running, so nothing small is drawn under it. */
let raging = false;

/**
 * Everything at once, and over in a second and a half.
 *
 * The order in the code is not an order in time: the flash, the thunder, the
 * pointer and the page all start on the same frame, because a temper is one
 * event. Staggering any of it turns it into a sequence, and a sequence reads
 * as a feature rather than as a reaction.
 */
function rage(at: { x: number; y: number }, pressed?: HTMLElement): void {
  const root = document.documentElement;
  raging = true;

  /*
   * The control that asked for this takes the current.
   *
   * The field turns it purple and then lets it cool back to whatever colour it
   * was, which is the same thing the refused input does with its focus ring —
   * one language for "he has touched this", used on the thing that was pressed
   * as well as on the thing that was wrong. Its own colour is read here rather
   * than named, because the two buttons are not the same colour and neither is
   * the one on a dark panel: the animation ends on `--was-bg` and lands
   * wherever it started.
   */
  if (pressed) {
    const was = window.getComputedStyle(pressed).backgroundColor;
    pressed.style.setProperty('--was-bg', was);
    pressed.classList.remove('is-overloaded');
    void pressed.offsetWidth;
    pressed.classList.add('is-overloaded');
    window.setTimeout(() => {
      pressed.classList.remove('is-overloaded');
      pressed.style.removeProperty('--was-bg');
    }, OVERLOAD_MS + 60);
  }

  root.style.setProperty('--rage-x', `${Math.round((at.x / window.innerWidth) * 100)}%`);
  root.style.setProperty('--rage-y', `${Math.round((at.y / window.innerHeight) * 100)}%`);
  root.classList.remove('is-raged');
  void root.offsetWidth;
  root.classList.add('is-raged');

  document.dispatchEvent(new CustomEvent('mh:rage'));
  if (!sound.isMuted()) sound.thunder();

  // And something visibly arrives on the control itself, which is the thing
  // the visitor is looking at and the thing that asked for this.
  if (pressed && !reduced()) strikeDown(pressed);

  if (!reduced()) rattle();

  window.setTimeout(() => {
    raging = false;
    root.classList.remove('is-raged');
    root.style.removeProperty('--rage-x');
    root.style.removeProperty('--rage-y');
  }, RATTLE_MS);
}

/** How long the strike keeps flickering on the thing it hit. */
const STRIKE_MS = 620;

/**
 * A bolt out of the top of the screen, onto the thing that was pressed.
 *
 * The pointer already gets one, and on a desktop it is over the button anyway
 * — but a bolt that lands on the drawn cursor is a bolt that lands on a
 * twenty-pixel ring, and on a touch screen there is no drawn cursor for it to
 * land on at all, so the loudest moment in the sequence had nothing visibly
 * arriving. This one is aimed at the control's own centre and is the width of
 * the page.
 *
 * Built and thrown away rather than living in the markup: it exists for six
 * hundred milliseconds roughly once in the life of a visit, and the alternative
 * is three empty SVG nodes on every page for everyone who never earns it.
 */
function strikeDown(el: HTMLElement): void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'rage-bolt');
  svg.setAttribute('aria-hidden', 'true');

  const paths = ['rage-bolt__glow', 'rage-bolt__fork', 'rage-bolt__core'].map((name) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', name);
    svg.appendChild(path);
    return path;
  });

  document.body.appendChild(svg);

  /*
   * The bends are taken along the normal of the line and scaled by sin(pi·t),
   * which is zero at both ends — so the bolt is wild in the middle and its last
   * point is exactly on the control, however far across the page it has come.
   */
  const draw = (x0: number, y0: number, x1: number, y1: number, spread: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
    for (let i = 1; i <= 10; i += 1) {
      const t = i / 10;
      const o = (Math.random() * 2 - 1) * Math.sin(Math.PI * t) * spread;
      d += ` L${(x0 + dx * t + nx * o).toFixed(1)} ${(y0 + dy * t + ny * o).toFixed(1)}`;
    }
    return d;
  };

  // Where in the sky it comes from, fixed for the length of the strike.
  const start = el.getBoundingClientRect();
  const from = start.left + start.width / 2 + (Math.random() * 2 - 1) * window.innerWidth * 0.28;

  let timer = 0;
  const flicker = () => {
    /*
     * Re-aimed on every flash, because the thing it hit does not stay still.
     *
     * The same strike knocks the page loose, so the control is thrown about
     * for the whole of the six hundred milliseconds this is on screen — and a
     * bolt drawn once to where it used to be ends up pointing at nothing. A
     * hundred and forty pixels of nothing, measured. It holds on instead.
     */
    const box = el.getBoundingClientRect();
    const tx = box.left + box.width / 2;
    const ty = box.top + box.height / 2;

    // Wandering a little between flashes: a real one does not come down the
    // same channel twice.
    const head = from + (Math.random() * 2 - 1) * 70;
    const main = draw(head, -40, tx, ty, 46);
    paths[0].setAttribute('d', main);
    paths[2].setAttribute('d', main);

    const t = 0.35 + Math.random() * 0.3;
    const bx = head + (tx - head) * t;
    const by = -40 + (ty + 40) * t;
    paths[1].setAttribute(
      'd',
      draw(bx, by, bx + (Math.random() * 2 - 1) * 200, by + 70 + Math.random() * 150, 30)
    );

    timer = window.setTimeout(flicker, 46);
  };

  flicker();

  window.setTimeout(() => {
    window.clearTimeout(timer);
    svg.remove();
  }, STRIKE_MS);
}

/**
 * Knocks the visible page loose and lets it fall back.
 *
 * Only what is on screen, and only as much of it as will still be on screen
 * when it moves — an element half out of the viewport that jumps is a scrollbar
 * flicker, not a shock. Everything is handed its own direction and its own
 * delay here and then left alone: the animation puts each one back where it
 * started, so nothing has to be undone afterwards and a visitor who navigates
 * mid-rage leaves nothing behind.
 */
function rattle(): void {
  const seen = document.querySelectorAll<HTMLElement>(
    'main h1, main h2, main h3, main p, main img, main label, main input, main textarea, main select, main .btn, main .row, main .chip, main .eyebrow, main .featured, main .card, main li'
  );

  let taken = 0;
  for (const el of seen) {
    if (taken >= RATTLE_MAX) break;
    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || !rect.width) continue;
    // Something already animating for another reason is left out of it rather
    // than fought over.
    if (el.classList.contains('is-rattled') || el.classList.contains('is-punished')) continue;

    const angle = Math.random() * Math.PI * 2;
    const reach = RATTLE_REACH * (0.55 + Math.random() * 0.45);
    el.style.setProperty('--rx', `${(Math.cos(angle) * reach).toFixed(1)}px`);
    el.style.setProperty('--ry', `${(Math.sin(angle) * reach).toFixed(1)}px`);
    el.style.setProperty('--rr', `${((Math.random() * 2 - 1) * 6.5).toFixed(2)}deg`);
    el.style.setProperty('--rd', `${Math.round(Math.random() * 70)}ms`);
    el.classList.add('is-rattled');
    taken += 1;

    window.setTimeout(() => {
      el.classList.remove('is-rattled');
      for (const prop of ['--rx', '--ry', '--rr', '--rd']) el.style.removeProperty(prop);
      if (!el.getAttribute('style')) el.removeAttribute('style');
    }, RATTLE_MS);
  }
}

export function punish(target?: Element | null): void {
  const shakes = !reduced();

  /*
   * Patience, and the end of it.
   *
   * Five refusals get the arcs. The sixth in a row gets the storm — he has
   * said the same thing five times and is not going to say it a sixth. The
   * count resets either way, so the next run has to be earned again rather
   * than every press from here on being a thunderclap.
   */
  const now = performance.now();

  /*
   * One refusal can call this more than once — the form punishes the button
   * that was pressed and the field that was wrong — and counting each of those
   * would have him losing his temper on the third press rather than the sixth.
   * Calls this close together are the same refusal arriving in pieces.
   */
  const again = now - lastRefusal < 60;
  if (!again) {
    streak = now - lastRefusal < RAGE_WINDOW_MS ? streak + 1 : 1;
    lastRefusal = now;
  }

  // The rest of a refusal he has already lost his temper over is dropped: the
  // storm is the answer, and the small arcs underneath it are noise.
  if (raging) return;

  if (streak >= RAGE_AT) {
    streak = 0;
    const box = target instanceof HTMLElement ? target.getBoundingClientRect() : null;
    rage(
      {
        x: box ? box.left + box.width / 2 : window.innerWidth / 2,
        y: box ? box.top + box.height / 2 : window.innerHeight / 2,
      },
      target instanceof HTMLElement && !isField(target) ? target : undefined
    );
    return;
  }

  /*
   * The pointer is punished once; anything handed in is punished as well.
   *
   * The form passes both the button that was pressed and the field that was
   * refused, so on a desktop the pointer takes the arcs and the field is
   * electrified with it, and on a touch screen — where there is no pointer —
   * the control that was pressed takes them instead. Passing the same element
   * twice is harmless: the class is removed and re-added.
   */
  if (drawnPointer()) {
    document.dispatchEvent(new CustomEvent('mh:punish', { detail: { shakes } }));
    if (target instanceof HTMLElement && isField(target)) strike(target);
  } else if (target instanceof HTMLElement) {
    strike(target);
  }

  /*
   * The sound is the storm's own strike, at a fraction of its level.
   *
   * Only when the page is already making sound: opening an audio device
   * because someone left a field empty would be a strange thing to do, and the
   * autoplay policy would refuse it as often as not. And never when the storm
   * has been muted — the mute is about this site's electricity, and this is
   * some of it.
   */
  if (!sound.isMuted()) sound.spark(0.1);
}
