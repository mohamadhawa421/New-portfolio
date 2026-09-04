/**
 * Designer mode — the takeover sequence behind the portrait.
 *
 * A shock leaves the character, crosses the viewport, and takes the interface
 * apart as it passes: components are shoved off their marks, headings come
 * apart into letters, the nav loses its pill and its items hang separately.
 * Then everything stops at once and is held in a purple field — arcs between
 * neighbours, sparks running out from the character — before the power drops
 * and the page reassembles exactly as it was.
 *
 * Three rules shape all of it.
 *
 * Nothing moves that is not transformed. Every displacement is a `transform` on
 * an element that already existed; no wrappers, no clones, no layout is read
 * once the sequence is running. The one exception is the letters, which have to
 * be real elements to move apart — those are wrapped from a saved copy of the
 * markup and the copy is put straight back at the end.
 *
 * The character does not move. It is the thing doing this, so it stays exactly
 * where it is while everything around it does not, and the arcs run out of it.
 *
 * Everything is undone by a list, not by inference. Every mutation pushes its
 * own reversal onto `restorers`, and teardown runs the list backwards — so the
 * page cannot be left holding a transform, a class, a wrapped heading or a
 * running oscillator, whether the sequence ended on time, was interrupted by
 * Escape, or was abandoned mid-flight by a navigation.
 */

/* ---------------------------------------------------------------------- */
/* Palette                                                                  */
/* ---------------------------------------------------------------------- */

/**
 * The hot end of the palette, and only the hot end.
 *
 * The mass of the effect — the wash, the held glow, the blooms behind the
 * arcs — is the deeper purples, and those live in global.css where the rest of
 * the site's colour does. What is drawn here is thin and bright by definition:
 * an arc, a spark, a mote. `FIELD` is the one deep colour, used to give every
 * arc something to sit in rather than to draw anything of its own.
 */
const ARC = '#c084fc';
const CORE = '#a855f7';
const GLOW = '#8b5cf6';
const FIELD = '#6d28d9';

/* ---------------------------------------------------------------------- */
/* Timing                                                                   */
/* ---------------------------------------------------------------------- */

/** The sequence, in milliseconds from the click. */
interface Beat {
  /** The shock lands and pieces start being shoved. */
  impact: number;
  /** Mobile only: the sidebar is grabbed and starts resisting. */
  fight?: number;
  /** Everything stops at once. */
  freeze: number;
  /** The field comes up. */
  hold: number;
  /**
   * The power starts running out. Nothing moves yet — the storm has to be
   * visibly weakening before anything is allowed to fall out of it.
   */
  decay: number;
  /** The purple starts leaving the character. */
  avatar: number;
  /** Pieces begin drifting home, each on its own clock. */
  drift: number;
  /** Letters begin finding each other again. */
  letters: number;
  /** Nothing is left. */
  done: number;
}

/*
 * The takeover is fast and the recovery is not.
 *
 * Two and a half seconds of storm, five of it passing — the ratio is the point.
 * The destruction has to impress and the restoration has to satisfy, and those
 * are not the same speed. Nothing in the second half is a reversal of anything
 * in the first: the pieces come home on their own trajectories, their own
 * timings and their own curves, because debris settling and debris being thrown
 * look nothing alike.
 */
const BEAT: Beat = {
  /*
   * Almost immediately, because the delay that matters is per piece, not
   * global: each one waits exactly as long as the ring takes to reach it, so
   * the throw and the shatter happen under the leading edge rather than behind
   * it.
   */
  impact: 70,
  freeze: 1080,
  hold: 1080,
  decay: 2400,
  drift: 3000,
  avatar: 3100,
  letters: 3300,
  done: 7700,
};

/*
 * Mobile runs the same shape with one extra act — the sidebar is dragged out of
 * hiding and fights before it is taken — and that fight is the only reason the
 * phone's version is longer at all.
 */
const MOBILE_BEAT: Beat = {
  impact: 80,
  fight: 300,
  freeze: 1450,
  hold: 1450,
  decay: 2800,
  drift: 3400,
  avatar: 3500,
  letters: 3700,
  done: 8100,
};

/** How long the field takes to exhaust itself once it starts. */
const DECAY_MS = 3000;

/** How long the leading edge takes to cross the viewport. Matches the CSS. */
const WAVE_MS = 420;

/* ---------------------------------------------------------------------- */
/* What gets taken apart                                                    */
/* ---------------------------------------------------------------------- */

/**
 * Components, not nodes.
 *
 * Anything matching is a candidate; anything inside another candidate is
 * dropped, so a card moves as a card rather than a card and its cover and its
 * title all fighting each other. The list is deliberately about meaningful
 * pieces of interface — the things a visitor would name if asked what is on
 * the screen.
 */
const PIECES = [
  '.nav__link',
  '.theme-toggle',
  '.burger',
  '.site-logo',
  '.btn',
  '.text-link',
  '.chip',
  '.card',
  '.row',
  '.service',
  '.featured',
  '.process__step',
  '.stat',
  '.skill',
  '.experience',
  '.work__rule',
  '.services__rule',
  '.footer__logo',
  '.footer__links a',
  '.footer__location',
  '.contact-block__dot',
  '.contact-block__line',
  '.eyebrow',
  '.eyebrow--small',
  '.h2',
  'h1',
  'h2',
  'h3',
  '.hero__intro',
  '.lead',
].join(',');

/** Headings and labels short enough to come apart without becoming soup. */
const SHATTER = [
  'h1',
  '.h2',
  '.eyebrow',
  '.nav__link',
  '.card__title',
  '.row__title',
  '.service__title',
  '.hero__subtitle',
  '.footer__location',
].join(',');

/** Ceilings, so a long page cannot ask a weak GPU for hundreds of layers. */
const MAX_PIECES_WIDE = 84;
const MAX_PIECES_NARROW = 34;
const MAX_LETTERS = 190;

/* ---------------------------------------------------------------------- */
/* State                                                                    */
/* ---------------------------------------------------------------------- */

interface Anchor {
  x: number;
  y: number;
}

/** How one piece comes home: when it is let go, and the shape of its path. */
interface Settle {
  delay: number;
  duration: number;
  /** How far it bows off the straight line, and which way. */
  bow: number;
}

let running = false;
let restorers: Array<() => void> = [];
let timers: number[] = [];
let frame = 0;

/** Where the arcs reach to, in viewport space, fixed at the freeze. */
let anchors: Anchor[] = [];
let source: Anchor = { x: 0, y: 0 };

/** Everything the sequence wrote an inline style to, for the final sweep. */
let touched: HTMLElement[] = [];

/** The return animations, so teardown can cancel any still in flight. */
let returning: Animation[] = [];

export function isRunning(): boolean {
  return running;
}

function after(ms: number, fn: () => void): void {
  timers.push(window.setTimeout(fn, ms));
}

/** Every mutation registers its own undo here and nowhere else. */
function undo(fn: () => void): void {
  restorers.push(fn);
}

/* ---------------------------------------------------------------------- */
/* Letters                                                                  */
/* ---------------------------------------------------------------------- */

/**
 * Wraps an element's text so each letter can move on its own.
 *
 * Words are wrapped too, and kept unbreakable. Without that, letters become
 * individual inline boxes and the browser is free to break a line in the middle
 * of a word — the heading would reflow the instant it was split, before it had
 * moved at all.
 *
 * The original markup is saved and restored verbatim rather than unwrapped,
 * which is both simpler and exact: whatever was in there — a `data-rise` span,
 * a non-breaking space — comes back untouched.
 */
function shatterText(el: HTMLElement, budget: { left: number }, arrival: number): void {
  const text = el.textContent ?? '';
  if (!text.trim() || text.length > 52 || text.length > budget.left) return;

  const original = el.innerHTML;
  undo(() => {
    el.innerHTML = original;
  });

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
  }

  let index = 0;
  for (const node of nodes) {
    const value = node.nodeValue ?? '';
    if (!value.trim()) continue;

    const fragment = document.createDocumentFragment();
    // Split on spaces but keep them, so the gaps between words survive.
    for (const chunk of value.split(/(\s+)/)) {
      if (!chunk) continue;
      if (!chunk.trim()) {
        fragment.appendChild(document.createTextNode(chunk));
        continue;
      }

      const word = document.createElement('span');
      word.className = 'dm-word';
      for (const character of chunk) {
        const letter = document.createElement('span');
        letter.className = 'dm-char';
        letter.textContent = character;
        /*
         * Each letter leaves on its own vector and arrives on its own beat.
         *
         * Deliberately short of what looks best in a still. The words have to
         * stay readable while they are apart — the effect is the interface
         * being disassembled, and a heading scrambled past recognition is just
         * broken text. Far enough to see the join come apart; not so far that
         * you stop being able to read it.
         */
        letter.style.setProperty('--cx', `${(Math.random() * 2 - 1) * 17}px`);
        letter.style.setProperty('--cy', `${(Math.random() * 2 - 1) * 14 - 4}px`);
        letter.style.setProperty('--cr', `${(Math.random() * 2 - 1) * 10}deg`);
        // Off the mark when the wave gets to this heading, then letter by
        // letter along it — so a word comes apart from where it was standing.
        letter.style.setProperty('--cd', `${arrival + index * 9}ms`);
        // And its own, unrelated moment to come back — not the reverse of the
        // order it left in.
        letter.style.setProperty('--lr', `${Math.round(Math.random() * 900)}ms`);
        word.appendChild(letter);
        index += 1;
      }
      fragment.appendChild(word);
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  budget.left -= index;
}

/* ---------------------------------------------------------------------- */
/* The sequence                                                             */
/* ---------------------------------------------------------------------- */

export interface DesignerModeOptions {
  /** Where the shock starts, in viewport coordinates. */
  originX: number;
  originY: number;
  /** The character. It stays put, and the arcs come out of it. */
  character: HTMLElement;
  /** The full-viewport canvas the field is drawn on. */
  field: HTMLCanvasElement;
  /** Called once everything is back exactly as it was. */
  onEnd?: () => void;
}

export function run(options: DesignerModeOptions): void {
  if (running) return;
  running = true;

  // Nothing from a previous run can still be pending — teardown clears them —
  // but starting from a known-empty list costs nothing and removes the whole
  // question of a stray timer writing into the run that replaced it.
  timers = [];
  restorers = [];
  touched = [];
  returning = [];

  const root = document.documentElement;
  const narrow = window.innerWidth < 768;
  const beat = narrow ? MOBILE_BEAT : BEAT;

  const { originX, originY, character, field } = options;
  const reach = Math.hypot(
    Math.max(originX, window.innerWidth - originX),
    Math.max(originY, window.innerHeight - originY)
  );

  root.dataset.designer = '';
  undo(() => {
    delete root.dataset.designer;
  });

  character.classList.add('dm-source');
  undo(() => character.classList.remove('dm-source'));

  /* ---- Pick the pieces ------------------------------------------------ */

  const candidates = Array.from(document.querySelectorAll<HTMLElement>(PIECES));
  const chosen: HTMLElement[] = [];

  for (const el of candidates) {
    if (chosen.length >= (narrow ? MAX_PIECES_NARROW : MAX_PIECES_WIDE)) break;
    // The character is the one thing holding still.
    if (character.contains(el) || el.contains(character)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 2) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    // Outermost wins: a card moves as a card, not as a pile of its own parts.
    if (chosen.some((kept) => kept.contains(el))) continue;

    chosen.push(el);
  }

  /* ---- Give each one somewhere to go ---------------------------------- */

  /*
   * Far enough to read as an explosion rather than a nudge. The ceiling is the
   * viewport, not taste: a piece thrown past the edge is a piece nobody sees
   * come back, so the throw is scaled to the smaller half-dimension.
   */
  const push = Math.min(narrow ? 96 : 132, Math.min(window.innerWidth, window.innerHeight) * 0.19);

  /*
   * One bias for the whole run.
   *
   * Without it every explosion is the same explosion: purely radial, evenly
   * spread, statistically identical each time. A single swirl direction and
   * lean, rolled once and applied to every piece, is what makes one run read as
   * a different event from the last rather than a replay of it.
   */
  const swirl = (Math.random() * 2 - 1) * 0.8;
  const lean = { x: (Math.random() * 2 - 1) * 0.35, y: (Math.random() * 2 - 1) * 0.28 };
  const placed: Array<{ el: HTMLElement; anchor: Anchor; settle: Settle }> = [];

  for (const el of chosen) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const vx = cx - originX;
    const vy = cy - originY;
    const distance = Math.hypot(vx, vy) || 1;

    // Nearer the blast is thrown harder, and never straight along the radius —
    // a little sideways is what stops the whole page reading as one explosion
    // diagram.
    const falloff = 0.5 + 0.5 * (1 - Math.min(1, distance / reach));
    // A wide spread is what stops it looking like a diagram of an explosion
    // and starts it looking like one: some pieces barely shift, some are gone.
    const spread = 0.55 + Math.random() * 1.15;
    const strength = push * falloff * spread;

    const nx = vx / distance;
    const ny = vy / distance;
    // Up to a right angle off the radius. Purely radial reads as mechanical.
    // The run's own swirl, plus this piece's share of chaos on top of it.
    const tangent = swirl + (Math.random() * 2 - 1) * 0.55;

    const dx = (nx - ny * tangent + lean.x) * strength;
    const dy = (ny + nx * tangent + lean.y) * strength;
    const rotation = (Math.random() * 2 - 1) * (narrow ? 11 : 9);
    const scale = 1 + (Math.random() * 2 - 1) * 0.07;

    const delay = Math.round(Math.min(1, distance / reach) * WAVE_MS);

    /*
     * The whole attribute, saved and put back.
     *
     * Removing the properties one by one leaves `style=""` on the element —
     * invisible, but it is a change to the markup, and the promise here is that
     * nothing remains. Restoring the attribute verbatim also keeps whatever was
     * already inline, which on a project cover is the placeholder colour.
     */
    const priorStyle = el.getAttribute('style');
    touched.push(el);

    el.style.setProperty('--px', `${dx.toFixed(1)}px`);
    el.style.setProperty('--py', `${dy.toFixed(1)}px`);
    el.style.setProperty('--pr', `${rotation.toFixed(2)}deg`);
    el.style.setProperty('--ps', scale.toFixed(3));
    el.style.setProperty('--pd', `${delay}ms`);
    // The held state breathes rather than sitting dead still.
    /*
     * Held, but never quite still — and further than a tremor. What is being
     * described is something caught in a current, so the drift is slow and
     * wide enough to see rather than a vibration.
     */
    el.style.setProperty('--jx', `${(Math.random() * 2 - 1) * 9}px`);
    el.style.setProperty('--jy', `${(Math.random() * 2 - 1) * 9}px`);
    el.style.setProperty('--jr', `${(Math.random() * 2 - 1) * 2.4}deg`);
    el.style.setProperty('--jd', `${Math.round(Math.random() * 1400)}ms`);
    /*
     * The way back is staggered too, but inward-out rather than outward-in:
     * the field lets go at the character first and the furthest piece is the
     * last to settle, so the page reassembles from the middle instead of
     * everything arriving at once.
     */
    /*
     * How this particular piece comes home, decided now and used much later.
     *
     * Nearer the character is released sooner — the field lets go from the
     * middle outward — but every piece also gets its own slice of randomness on
     * top, so no two set off together and nothing arrives in formation.
     */
    const settle = {
      delay: Math.round(Math.min(1, distance / reach) * 620 + Math.random() * 620),
      duration: Math.round(1900 + Math.random() * 1100),
      // Which way it bows on the way back, and how far.
      bow: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 18),
    };

    undo(() => {
      // An empty attribute is not a style, and leaving one behind would mean
      // the markup did not come back the way it went in.
      if (!priorStyle) el.removeAttribute('style');
      else el.setAttribute('style', priorStyle);
      el.classList.remove('dm-piece', 'dm-thrown', 'dm-held');
      // classList.remove leaves class="" behind for the same reason.
      if (!el.getAttribute('class')) el.removeAttribute('class');
    });

    el.classList.add('dm-piece');
    placed.push({ el, anchor: { x: cx + dx, y: cy + dy }, settle });
  }

  /* ---- The nav stops being a pill ------------------------------------- */

  const nav = document.querySelector<HTMLElement>('.nav');
  if (nav) {
    nav.classList.add('dm-unpinned');
    undo(() => nav.classList.remove('dm-unpinned'));
  }

  /* ---- Where the arcs will reach -------------------------------------- */

  source = {
    x: character.getBoundingClientRect().left + character.getBoundingClientRect().width / 2,
    y: character.getBoundingClientRect().top + character.getBoundingClientRect().height / 2,
  };
  anchors = placed.map((p) => p.anchor);

  /*
   * The electricity is on from the first frame and off at the last.
   *
   * Bringing it up only once everything had stopped made it read as a separate
   * effect that happened afterwards. Arriving with the shock, it is the thing
   * doing the throwing — and it has something to hold before it holds anything.
   */
  startField(field);

  /* ---- Act one: the shock, and everything it touches ------------------ */

  /*
   * The throw and the shatter are the same event.
   *
   * They used to be a second apart, which meant a heading was already halfway
   * across the screen before it came apart — so the letters separated from
   * wherever the block had got to rather than from where the word had been.
   * Both now wait on the same per-element delay: the moment the ring arrives.
   */
  after(beat.impact, () => {
    for (const { el } of placed) el.classList.add('dm-thrown');

    const budget = { left: narrow ? 90 : MAX_LETTERS };
    for (const el of document.querySelectorAll<HTMLElement>(SHATTER)) {
      if (budget.left <= 0) break;
      if (character.contains(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      // Small print stays whole. Letters flying off a 13px label is noise.
      if (narrow && parseFloat(getComputedStyle(el).fontSize) < 17) continue;

      const dx = Math.max(rect.left - originX, 0, originX - rect.right);
      const dy = Math.max(rect.top - originY, 0, originY - rect.bottom);
      const arrival = Math.round((Math.min(1, Math.hypot(dx, dy) / reach) * WAVE_MS) / 10) * 10;

      shatterText(el, budget, arrival);
    }

    root.classList.add('dm-shattered');
    undo(() => root.classList.remove('dm-shattered'));
  });

  /* ---- Act three, mobile only: the menu will not go quietly ----------- */

  const panel = narrow ? document.querySelector<HTMLElement>('[data-panel]') : null;
  if (panel) {
    after(beat.fight ?? beat.freeze, () => {
      panel.classList.add('dm-fighting');
      undo(() => panel.classList.remove('dm-fighting', 'dm-taken', 'dm-releasing'));
    });
    after(beat.freeze, () => {
      panel.classList.remove('dm-fighting');
      panel.classList.add('dm-taken');
    });
  }

  /* ---- Act four: held ------------------------------------------------- */

  after(beat.freeze, () => {
    for (const { el } of placed) el.classList.add('dm-held');
    root.classList.add('dm-charged');
    undo(() => root.classList.remove('dm-charged'));
  });



  /* ---- Act five: the power runs out ----------------------------------- */

  /*
   * The field weakens on its own for six hundred milliseconds before a single
   * element is allowed to move. That gap is the whole difference between a
   * storm passing and an animation ending: the arcs thin out, the big ones
   * stop, the glow starts going, and only once it is visibly losing does
   * anything fall out of it.
   */
  after(beat.decay, () => {
    beginDecay();
    root.classList.remove('dm-charged');
    root.classList.add('dm-quiet');
    undo(() => root.classList.remove('dm-quiet'));
  });

  /* ---- Act six: debris settles ---------------------------------------- */

  /*
   * Each piece takes its own way home, and none of them retraces how it got
   * there.
   *
   * The path bows: out of the current, sideways, and only then in — which is
   * how something released from a force actually travels, and nothing like the
   * straight line a reversed throw would draw. It drifts a few pixels past its
   * mark and eases back, so the last thing each piece does is settle rather
   * than stop.
   *
   * Reads are batched ahead of the writes, so the fourteen matrices cost one
   * layout pass between them.
   */
  after(beat.drift, () => {
    const frozen = placed.map(({ el }) => getComputedStyle(el).transform);

    placed.forEach(({ el, settle }, i) => {
      const m = new DOMMatrix(frozen[i]);
      const fx = m.m41;
      const fy = m.m42;
      const spin = (Math.atan2(m.b, m.a) * 180) / Math.PI;
      const size = Math.hypot(m.a, m.b);

      const span = Math.hypot(fx, fy) || 1;
      // Perpendicular to the way home, which is what makes the path a curve.
      const bowX = (-fy / span) * settle.bow;
      const bowY = (fx / span) * settle.bow;

      const animation = el.animate(
        [
          {
            transform: `translate(${fx}px, ${fy}px) rotate(${spin}deg) scale(${size})`,
            easing: 'cubic-bezier(0.36, 0, 0.5, 0.6)',
          },
          {
            transform:
              `translate(${(fx * 0.54 + bowX).toFixed(1)}px, ${(fy * 0.54 + bowY).toFixed(1)}px) ` +
              `rotate(${(spin * 0.42).toFixed(2)}deg) scale(${(1 + (size - 1) * 0.42).toFixed(3)})`,
            offset: 0.5,
            easing: 'cubic-bezier(0.3, 0.1, 0.2, 1)',
          },
          {
            // A few pixels past the mark, so it arrives by settling.
            transform: `translate(${(-fx * 0.022).toFixed(1)}px, ${(-fy * 0.022).toFixed(1)}px)`,
            offset: 0.86,
            easing: 'cubic-bezier(0.4, 0, 0.3, 1)',
          },
          { transform: 'none' },
        ],
        { duration: settle.duration, delay: settle.delay, fill: 'both' }
      );

      returning.push(animation);

      // The CSS states can go now; the animation is what is driving it.
      el.classList.remove('dm-held', 'dm-thrown');
    });

    /*
     * The sidebar is let go with everything else rather than after it. Held to
     * the end it sat out alone for a second and a half and then slid away by
     * itself, which read as a bug and not as the last thing released.
     */
    if (panel) {
      panel.classList.remove('dm-fighting', 'dm-taken');
      panel.classList.add('dm-releasing');
    }
  });

  /* ---- Act seven: the character comes back ---------------------------- */

  after(beat.avatar, () => {
    delete root.dataset.designer;
    character.classList.remove('dm-source');
  });

  /* ---- Act eight: the words find each other --------------------------- */

  after(beat.letters, () => {
    root.classList.remove('dm-shattered');
    root.classList.add('dm-settling');
    undo(() => root.classList.remove('dm-settling'));
  });

  after(beat.done, () => {
    teardown();
    options.onEnd?.();
  });
}

/* ---------------------------------------------------------------------- */
/* Teardown                                                                 */
/* ---------------------------------------------------------------------- */

export function teardown(): void {
  if (!running) return;
  running = false;

  for (const id of timers) window.clearTimeout(id);
  timers = [];

  for (const animation of returning) {
    try {
      animation.cancel();
    } catch {
      /* already finished */
    }
  }
  returning = [];

  stopField();

  // Backwards, so a later mutation is undone before the earlier one it sat on.
  for (let i = restorers.length - 1; i >= 0; i -= 1) {
    try {
      restorers[i]();
    } catch {
      /* one bad restore must not strand the rest of the page */
    }
  }
  restorers = [];
  anchors = [];

  /*
   * One last look, on the next frame.
   *
   * The restorers put every attribute back as they found it, but a transition
   * or an animation ending in the same task can write one more empty
   * declaration afterwards — inert, invisible, and still a mark on the markup
   * that nobody asked for. Sweeping a frame later is the only point at which
   * everything has certainly finished having its say.
   */
  const swept = touched;
  touched = [];
  // A timer, not a frame: requestAnimationFrame does not run at all in a tab
  // that is not being rendered, and the sweep has to happen whether or not
  // anyone is watching.
  window.setTimeout(() => {
    for (const el of swept) {
      if (el.getAttribute('style') === '') el.removeAttribute('style');
      if (el.getAttribute('class') === '') el.removeAttribute('class');
    }
  }, 0);
}

/* ---------------------------------------------------------------------- */
/* The field                                                                */
/* ---------------------------------------------------------------------- */

/*
 * One canvas, a handful of arcs, and a few dozen motes.
 *
 * A DOM node per spark would be hundreds of composited layers appearing and
 * disappearing every second; a canvas is one layer and one draw call. It is
 * also the only way to draw a line *between* two elements, which is the whole
 * point — the field has to look like it is holding things, not decorating them.
 */

interface Link {
  a: Anchor;
  b: Anchor;
  /** Its own rhythm, so the field crackles unevenly rather than in time. */
  phase: number;
  hot: boolean;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
}

let ctx: CanvasRenderingContext2D | null = null;
let canvas: HTMLCanvasElement | null = null;
let links: Link[] = [];
let motes: Mote[] = [];
let nextMote = 0;
let lastSlot = -1;

/** True once per turn of the arc pair, for the sound to hang off. */
function slotChanged(now: number): boolean {
  const slot = Math.floor(now / (760 / Math.max(0.25, power(now))));
  if (slot === lastSlot) return false;
  lastSlot = slot;
  return true;
}
let onArc: (() => void) | null = null;

/** When the power started going, or 0 while the field is still at full. */
let decayFrom = 0;

/**
 * How much of the field is left, from one down to nothing.
 *
 * The curve matters as much as the length. A linear fade reads as a dimmer
 * being turned down; this leaves most of its strength early and then trails
 * off, so the last second is a few thin sparks a long way apart rather than a
 * steady glow that stops.
 */
function power(now: number): number {
  if (!decayFrom) return 1;
  const t = Math.min(1, (now - decayFrom) / DECAY_MS);
  return Math.max(0, Math.pow(1 - t, 1.7));
}

/** Starts the field exhausting itself. */
export function beginDecay(): void {
  if (!decayFrom) decayFrom = performance.now();
}

export function setArcListener(fn: (() => void) | null): void {
  onArc = fn;
}

/**
 * Wires every held piece into the field.
 *
 * Each one is tied to its two nearest neighbours and, if it is close enough to
 * the character, to the character itself. That is what makes the arcs read as
 * the thing doing the holding rather than as sparks decorating a page of
 * displaced boxes: a piece is never floating, it is always on the end of
 * something.
 */
function wireField(): void {
  links = [];
  if (anchors.length < 2) return;

  for (let i = 0; i < anchors.length; i += 1) {
    const a = anchors[i];

    // Nearest two, by straight distance. Small n, so a sort per node is fine
    // and it only ever runs once, at the freeze.
    const near = anchors
      .map((b, j) => ({ b, j, d: Math.hypot(b.x - a.x, b.y - a.y) }))
      .filter((c) => c.j !== i && c.d > 24)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);

    for (const { b, j } of near) {
      // One link per pair, not two.
      if (j < i) continue;
      links.push({ a, b, phase: Math.random() * Math.PI * 2, hot: false });
    }

    // A line back to the source for roughly every third piece, so the
    // character is visibly the thing at the centre of it.
    if (i % 3 === 0) {
      links.push({ a: source, b: a, phase: Math.random() * Math.PI * 2, hot: true });
    }
  }
}

function startField(el: HTMLCanvasElement): void {
  canvas = el;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.round(window.innerWidth * dpr);
  el.height = Math.round(window.innerHeight * dpr);
  el.style.opacity = '1';

  ctx = el.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  wireField();
  decayFrom = 0;
  motes = [];
  nextMote = 0;
  lastSlot = -1;
  frame = requestAnimationFrame(drawField);
}

function stopField(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (canvas) {
    canvas.style.opacity = '0';
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }
  links = [];
  motes = [];
  ctx = null;
  canvas = null;
}

/**
 * A line that wanders, and re-wanders a few times a second.
 *
 * `step` is quantised deliberately: a continuously reseeded path boils like
 * television static, where electricity holds a shape for a moment and then
 * snaps to another one.
 */
function jaggedPath(from: Anchor, to: Anchor, seed: number, spread: number): void {
  if (!ctx) return;
  const steps = 5;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  ctx.moveTo(from.x, from.y);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const wobble = Math.sin(seed + i * 2.399) * spread * Math.sin(t * Math.PI);
    ctx.lineTo(from.x + dx * t + nx * wobble, from.y + dy * t + ny * wobble);
  }
  ctx.lineTo(to.x, to.y);
}

/** The field itself: slow rings of force running out from the character. */
function drawFieldLines(now: number, strength: number): void {
  if (!ctx || strength <= 0.1) return;
  const period = 2600;

  for (let i = 0; i < 2; i += 1) {
    const t = ((now / period + i / 2) % 1);
    const radius = 60 + t * Math.max(window.innerWidth, window.innerHeight) * 0.62;
    // In at the start, out at the end, so a ring never appears or vanishes.
    const alpha = Math.sin(t * Math.PI) * 0.075 * strength * strength;
    if (alpha <= 0.002) continue;

    ctx.beginPath();
    ctx.ellipse(source.x, source.y, radius, radius * 0.86, 0, 0, Math.PI * 2);
    ctx.strokeStyle = FIELD;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawField(now: number): void {
  frame = requestAnimationFrame(drawField);
  if (!ctx || !canvas || !links.length) return;

  const p = power(now);
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  // Spent. Nothing left to draw, and no reason to keep clearing a blank canvas.
  if (p <= 0.015) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  drawFieldLines(now, p);

  // One small sound per pair of arcs, not per frame of them.
  const step = Math.floor(now / 130);
  if (slotChanged(now)) onArc?.();

  /*
   * One arc at a time, and never the same one for long.
   *
   * Drawing every connection at once turned the page into a cat's cradle —
   * dense, busy, and nothing like the restraint of the rest of the site. A
   * single thin line that keeps moving on reads as a field reaching from piece
   * to piece, and the eye fills in the rest.
   *
   * The pair advances on its own slow clock, and each one fades in and out
   * across its turn, so a line is never cut off mid-existence.
   */
  /*
   * As the power goes, the gaps between arcs stretch out: at full strength one
   * every three quarters of a second, and by the end one every three. That
   * lengthening is most of what makes it read as running out rather than
   * merely dimming.
   */
  const SLOT_MS = 760 / Math.max(0.25, p);
  const slot = Math.floor(now / SLOT_MS);
  const withinSlot = (now % SLOT_MS) / SLOT_MS;
  // In over the first fifth, out over the last quarter, full in between.
  const envelope = Math.min(1, withinSlot / 0.2, (1 - withinSlot) / 0.25);

  for (let i = 0; i < 1; i += 1) {
    const link = links[(slot + i) % links.length];
    if (!link) continue;
    // The long reaches out of the character are the first thing it cannot
    // afford any more.
    if (link.hot && p < 0.55) continue;

    const alpha = (link.hot ? 0.42 : 0.28) * envelope * p;
    if (alpha <= 0.01) continue;
    const seed = step * 0.7 + link.phase;

    ctx.beginPath();
    jaggedPath(link.a, link.b, seed, link.hot ? 13 : 8);

    // A whisper of the deep purple under the line, so it sits in the field
    // rather than floating on the page. Any more and it becomes a glow.
    ctx.strokeStyle = link.hot ? CORE : FIELD;
    ctx.globalAlpha = alpha * 0.22;
    ctx.lineWidth = 3 * (0.4 + 0.6 * p);
    ctx.stroke();

    ctx.strokeStyle = link.hot ? ARC : GLOW;
    ctx.globalAlpha = alpha;
    // Thinner as it weakens, down to a hairline.
    ctx.lineWidth = (link.hot ? 1.1 : 0.9) * (0.45 + 0.55 * p);
    ctx.stroke();
  }

  /* ---- Motes ---------------------------------------------------------- */

  if (p > 0.3 && now > nextMote && motes.length < 12) {
    nextMote = now + (190 + Math.random() * 260) / Math.max(0.3, p);
    const a = anchors[(Math.random() * anchors.length) | 0];
    const angle = Math.random() * Math.PI * 2;
    motes.push({
      x: a.x + Math.cos(angle) * 18,
      y: a.y + Math.sin(angle) * 18,
      vx: (source.x - a.x) * 0.00048,
      vy: (source.y - a.y) * 0.00048,
      born: now,
      life: 900 + Math.random() * 900,
    });
  }

  motes = motes.filter((mote) => now - mote.born < mote.life);
  for (const mote of motes) {
    const t = (now - mote.born) / mote.life;
    mote.x += mote.vx * 16;
    mote.y += mote.vy * 16;

    ctx.beginPath();
    ctx.arc(mote.x, mote.y, 1.15, 0, Math.PI * 2);
    ctx.fillStyle = ARC;
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.45 * p;
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
