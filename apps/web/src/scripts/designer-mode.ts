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
  /** Control is released — which is now only the sidebar. */
  drift: number;
  /**
   * The first piece turns for home, and the last one lands.
   *
   * These two are not decisions. They are read off the flight itself — the
   * nearest piece turns as soon as its own shove and momentum are spent, and
   * the furthest lands a full wave crossing and the longest way home later —
   * and they exist so the sound has the same two numbers the picture does.
   * The rewind is written across exactly this window, so its swell begins on
   * the frame the first piece starts back and its crack lands on the frame the
   * last one arrives.
   */
  homeward: number;
  landed: number;
  /** Nothing is left. */
  done: number;
}

/*
 * The takeover is fast and the recovery is not.
 *
 * A second and a half of storm and nearly four of it passing — the ratio is the
 * point. The destruction has to impress and the restoration has to satisfy, and
 * those are not the same speed. Nothing in the second half is a reversal of
 * anything in the first: every piece comes home on its own trajectory, its own
 * timing and its own curve, because debris settling and debris being thrown look
 * nothing alike.
 *
 * Every number below is either read off the flight or placed against one. The
 * sequence and the sound are written from the same two moments, so they cannot
 * drift apart when one of them is retimed.
 */
/** How long the field takes to exhaust itself once it starts. */
const DECAY_MS = 3000;

/**
 * How long the leading edge takes to cross the viewport. Matches the CSS.
 *
 * Fast enough to read as a release of energy rather than a thing travelling —
 * but not instant, because the whole point is that it is watched crossing the
 * page and hitting things in the order it reaches them. Under about 300 it
 * stops being a front and becomes a flash; over about 500 you are waiting for
 * it.
 */
const WAVE_MS = 380;

/**
 * How long the shove and the momentum after it last, together.
 *
 * Shorter than it reads: the whole point of a blast is that it is over before
 * you have registered it, and what you watch is the momentum running out. Most
 * of this is the running out.
 */
const OUT_MS = 820;
/**
 * And how long they are held out there before they are brought back.
 *
 * This is not a floating phase and the difference is the whole point: nothing
 * drifts, nothing bobs, nothing loops. A piece arrives at the apex with no
 * speed left and is held there, shuddering against the grip — see buzz() — for
 * long enough that you can see the field is doing work. The only movement in
 * it is the struggle, which is a force with a name.
 */
const HOLD_MS = 1500;
/** And the way home: the shortest of them, and how much longer the longest is. */
const HOME_MS = 2600;
const HOME_SPREAD = 1200;

/** The nearest piece turns for home as soon as its own momentum is spent. */
const homewardAt = (impact: number) => impact + OUT_MS + HOLD_MS;
/** The furthest lands a whole wave crossing and the longest way home later. */
const landedAt = (impact: number) =>
  impact + WAVE_MS + OUT_MS + HOLD_MS + HOME_MS + HOME_SPREAD;

const BEAT: Beat = {
  /*
   * Almost immediately, because the delay that matters is per piece, not
   * global: each one waits exactly as long as the ring takes to reach it, so
   * the throw and the shatter happen under the leading edge rather than behind
   * it.
   */
  impact: 70,
  /*
   * The field comes up as the first piece is caught, which is what it is for —
   * the apex, not the release. Those used to be the same instant; now there is
   * a held stretch between them, and this is the front of it.
   */
  freeze: 70 + OUT_MS - 20,
  hold: 70 + OUT_MS - 20,
  homeward: homewardAt(70),
  /* Well into the journey home, so the power is visibly going while things are
     still moving through it rather than after they have stopped. */
  decay: 2300,
  drift: 2600,
  /* Near the end, so the purple leaves him last. */
  avatar: 4200,
  landed: landedAt(70),
  /* Seven hundred milliseconds of quiet after the last piece is back. */
  done: landedAt(70) + 700,
};

/*
 * Mobile runs the same shape with one extra act — the sidebar is dragged out of
 * hiding and fights before it is taken — and that fight is the only reason the
 * phone's version is longer at all.
 */
const MOBILE_BEAT: Beat = {
  impact: 80,
  fight: 300,
  freeze: 80 + OUT_MS - 20,
  hold: 80 + OUT_MS - 20,
  homeward: homewardAt(80),
  decay: 2300,
  drift: 2700,
  avatar: 4500,
  landed: landedAt(80),
  done: landedAt(80) + 700,
};

export { DECAY_MS as FIELD_DECAY_MS, WAVE_MS as WAVE_CROSS_MS };
export type { Beat };

/** Which timeline this viewport runs on. The one place that decides. */
export function beatFor(): Beat {
  return window.innerWidth < 768 ? MOBILE_BEAT : BEAT;
}

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
  /*
   * The prose comes apart too.
   *
   * A paragraph thrown as one block is the least convincing thing in the
   * sequence: everything around it has been broken into its parts and it sails
   * off as a rectangle, which reads as a screenshot being moved rather than as
   * text being hit. Broken into letters it behaves like what it is. They are
   * expensive — a paragraph is two hundred of them where a heading is twenty —
   * so the ceiling below is what keeps a long page from asking for thousands.
   */
  '.hero__intro',
  '.lead',
  '.about__body',
  '.card__summary',
  '.row__summary',
  /*
   * And the controls, which were the last things standing.
   *
   * A button came through the wave rigid and intact while every word around it
   * was in pieces, and a thing that survives a blast unmarked reads as the
   * strongest object on screen. They are not. They are two words on a coloured
   * rectangle, and the words should leave.
   */
  '.btn',
  '.chip',
  '.text-link',
  '.enquiry__send',
  '.footer__links a',
].join(',');

/*
 * Text that comes apart without its container being spared.
 *
 * The rule everywhere else is that a thing is either thrown whole or broken
 * into letters, never both — a heading has no surface of its own, so a block
 * flying with letters twitching inside it is nonsense. A control does have
 * one. Its shell is a real object and should be thrown; its label is text and
 * should leave. Both together is the shell tumbling away while the word it was
 * carrying bursts out of it, which is what a weak thing looks like when it is
 * hit.
 */
const SHELLS = '.btn, .chip, .text-link, .enquiry__send, .footer__links a';

/** Ceilings, so a long page cannot ask a weak GPU for hundreds of layers. */
const MAX_PIECES_WIDE = 84;
const MAX_PIECES_NARROW = 34;
const MAX_LETTERS = 460;
/*
 * A phone gets fewer than a desktop, but not so few that a paragraph cannot
 * fit.
 *
 * At 170 the hero's own intro is 178 characters and could never be shattered
 * even with the whole allowance to itself — so on a phone it was skipped, fell
 * through to the piece list, and sailed off as a rigid rectangle while every
 * word around it came apart. The number has to be larger than the longest
 * block the page actually has, or the rule quietly becomes "prose does not
 * shatter on mobile".
 */
const MAX_LETTERS_NARROW = 360;
/** And no single block may take more than this much of it. */
const MAX_ONE_BLOCK = 240;

/* ---------------------------------------------------------------------- */
/* State                                                                    */
/* ---------------------------------------------------------------------- */

interface Anchor {
  x: number;
  y: number;
}

/**
 * One piece's whole journey, from the wave reaching it to it being back.
 *
 * Every number here is decided before anything moves and none of it is written
 * to the element: the sequence is one animation per piece, and this is what it
 * is built from. There is deliberately no field for a held position, because
 * there is no moment at which a piece is being held. The apex is where its
 * momentum runs out, and it leaves again on the same frame it arrives.
 */
interface Flight {
  /** Where the shove and the momentum after it carry it, arriving with none left. */
  ax: number;
  ay: number;
  ar: number;
  as: number;
  /** How long the front takes to reach it, and how long the way back takes. */
  wave: number;
  home: number;
  /** How far the path home bows off the straight line, and which way. */
  bow: number;
  /** How hard the field has to work to hold it. 0 for a cover, 1 for a chip. */
  grip: number;
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
/** Every text node in an element, in the order a letter walk will see them. */
function textNodes(el: HTMLElement): Text[] {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if ((text.nodeValue ?? '').trim()) nodes.push(text);
  }
  return nodes;
}

/**
 * Where every character actually is, before anything is done to it.
 *
 * A Range around one character reports the box the browser drew it in, kerning
 * and all. That is the number that matters, and it can only be had while the
 * text is still text — which is why this is a separate pass that runs over the
 * whole page before a single element is split.
 */
function measureLetters(el: HTMLElement): DOMRect[] {
  const spots: DOMRect[] = [];
  const range = document.createRange();

  for (const node of textNodes(el)) {
    const value = node.nodeValue ?? '';
    for (let i = 0; i < value.length; i += 1) {
      if (!value[i].trim()) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      spots.push(range.getBoundingClientRect());
    }
  }

  return spots;
}

/**
 * Breaks one element into letters and hands them back.
 *
 * It only builds, and it walks the text in exactly the order measureLetters
 * did, so the two lists line up one to one. Where each letter goes is decided
 * afterwards, in one pass over every letter on the page — see run() — because
 * that needs each letter's position on screen and reading those one element at
 * a time is a layout per heading.
 */
function shatterText(el: HTMLElement): { letters: HTMLElement[]; restore: () => void } {
  const original = el.innerHTML;
  let restored = false;

  /*
   * The way back, which can be asked for early.
   *
   * Every element used to be put back at the same instant, at the end of the
   * whole sequence — one page-wide swap from letters to text, which is the
   * most visible moment such a swap can possibly have. Each block now goes
   * back the moment its own last letter has landed, so the swaps are spread
   * across a second and a half and none of them coincides with anything.
   * Guarded, because teardown will ask for it again and setting innerHTML a
   * second time would throw away a restored DOM the visitor is already using.
   */
  const restore = () => {
    if (restored) return;
    restored = true;
    el.innerHTML = original;
  };

  undo(restore);

  /*
   * The element keeps the box it had, whatever happens inside it.
   *
   * Splitting a line into inline-blocks changes its width — every kerning pair
   * is gone — and anything laid out against that width moves. The theme
   * control sits in a row with four nav links; when those came apart the row
   * got narrower, the centred nav re-centred, and the control was fifty-six
   * pixels from where it had been. Its own flight then brought it home to a
   * position that no longer existed, and the swap back to real text at the end
   * put it right in one frame. That is the snap, and it was never about the
   * letters: it was about everything standing next to them.
   *
   * Pinning the outside means the split is invisible to the page. --ox and --oy
   * put every letter exactly where its character was inside that box, so both
   * halves of the illusion hold: nothing moves, and nothing has moved.
   */
  const box = el.getBoundingClientRect();
  const priorWidth = el.style.width;
  const priorHeight = el.style.height;
  const priorSizing = el.style.boxSizing;
  el.style.boxSizing = 'border-box';
  el.style.width = `${box.width}px`;
  el.style.height = `${box.height}px`;
  undo(() => {
    el.style.width = priorWidth;
    el.style.height = priorHeight;
    el.style.boxSizing = priorSizing;
  });

  /*
   * Whatever is clipping this text stops clipping it while it is in pieces.
   *
   * Several headings sit in a box with `overflow: hidden` — it is what hides
   * the rising text before it slides into place, and what keeps a tight
   * line-height from shaving the descenders. Neither matters once the reveal
   * has run, but the box is still there, so the letters flew out of a word and
   * were cut off at its edge as if the whole thing were happening inside an
   * invisible frame.
   *
   * Three levels is enough to find the clip and shallow enough not to start
   * opening up sections. Each one is restored exactly as it was, inline value
   * or none at all.
   */
  let clip: HTMLElement | null = el;
  for (let up = 0; up < 3 && clip; up += 1, clip = clip.parentElement) {
    if (window.getComputedStyle(clip).overflow === 'visible') continue;
    const node = clip;
    const had = node.style.overflow;
    node.style.overflow = 'visible';
    undo(() => {
      node.style.overflow = had;
    });
  }

  const letters: HTMLElement[] = [];

  for (const node of textNodes(el)) {
    const value = node.nodeValue ?? '';
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
        word.appendChild(letter);
        letters.push(letter);
      }
      fragment.appendChild(word);
    }

    /*
     * One wrapper per text node, not a run of loose spans.
     *
     * A button is a flex container with a single anonymous item in it — its
     * label. Replacing that text node with eleven word spans makes eleven flex
     * items, and the button lays itself out completely differently. Handing
     * back one element for the one node that was there keeps every container
     * seeing what it saw before.
     */
    const holder = document.createElement('span');
    holder.className = 'dm-line';
    holder.appendChild(fragment);
    node.parentNode?.replaceChild(holder, node);
  }

  return { letters, restore };
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

export function run(options: DesignerModeOptions): Beat {
  if (running) return beatFor();
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
  const beat = beatFor();

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

  /* ---- Pick the text that comes apart --------------------------------- */

  /*
   * Decided before the pieces, because a thing cannot be both.
   *
   * Nearly every text element on the page matches both lists — h1 is in each of
   * them — so a heading was being thrown as a block *and* broken into letters,
   * and the block throw is three times the letter scatter. What you saw was
   * "Mohamad Hawa" sailing off in one piece and its letters twitching inside it
   * as it went, sometimes snapping apart on the way. That is not two effects
   * fighting; it is one object being told two different stories about what it
   * is.
   *
   * So text is text. Anything that shatters is taken out of the pieces below,
   * and its letters carry the whole of its movement — each one thrown from
   * where it actually is, by the same wave, with the same falloff. A card is
   * still a card and its title still comes apart on it: a card is an object
   * with text on it, and a heading is only the text.
   */
  const shortestFirst = Array.from(document.querySelectorAll<HTMLElement>(SHATTER)).sort(
    (a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length
  );

  let allowance = narrow ? MAX_LETTERS_NARROW : MAX_LETTERS;
  const words: HTMLElement[] = [];

  for (const el of shortestFirst) {
    if (allowance <= 0) break;
    if (character.contains(el)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    // Small print stays whole. Letters flying off a 13px label is noise.
    if (narrow && parseFloat(window.getComputedStyle(el).fontSize) < 17) continue;

    const text = (el.textContent ?? '').trim();
    if (!text || text.length > MAX_ONE_BLOCK || text.length > allowance) continue;

    allowance -= text.length;
    words.push(el);
  }

  /*
   * Shortest first, so the structure always comes apart.
   *
   * In document order a page of prose eats the whole allowance before the
   * headings below it are reached — one paragraph is a hundred and fifty
   * letters where a nav link is four. Sorting by length means every label,
   * link and heading on screen is served for the price of one paragraph, and
   * it is the prose that goes without if anything has to.
   */
  const shattering = new Set(words);

  /* ---- Pick the pieces ------------------------------------------------ */

  const candidates = Array.from(document.querySelectorAll<HTMLElement>(PIECES));
  const chosen: HTMLElement[] = [];

  for (const el of candidates) {
    if (chosen.length >= (narrow ? MAX_PIECES_NARROW : MAX_PIECES_WIDE)) break;
    // The character is the one thing holding still.
    if (character.contains(el) || el.contains(character)) continue;
    // Text that is coming apart is not also thrown whole — unless it has a
    // surface of its own to throw. See SHELLS.
    if (shattering.has(el) && !el.matches(SHELLS)) continue;

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
   * come back, so the throw is scaled to the smaller half-dimension — and a
   * third of that half is as much as can be spent before the far pieces start
   * leaving the screen.
   */
  const push = Math.min(narrow ? 195 : 300, Math.min(window.innerWidth, window.innerHeight) * 0.38);

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
  const placed: Array<{ el: HTMLElement; anchor: Anchor; flight: Flight }> = [];

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
    /*
     * Some scatter, but not enough to drown the mass.
     *
     * At three times between the least and the most, chance decided how far a
     * piece went and the weight of the thing barely showed — a chip and a case
     * study cover took the same wave and moved the same distance about as
     * often as not. Under two times, and the size of what is being thrown is
     * the first thing you read, with the randomness as the grain on top of it.
     *
     * The floor matters as much as the range. Every run should land as a hard
     * shove and differ in how it scatters, not in whether it was hard — at a
     * floor of 0.55 a run could come out limp, which is the one thing none of
     * them should ever be.
     */
    const spread = 0.86 + Math.random() * 0.5;
    const strength = push * falloff * spread;

    const nx = vx / distance;
    const ny = vy / distance;
    // Up to a right angle off the radius. Purely radial reads as mechanical.
    // The run's own swirl, plus this piece's share of chaos on top of it.
    const tangent = swirl + (Math.random() * 2 - 1) * 0.55;

    /*
     * Mass, so that the same wave does not move everything by the same amount.
     *
     * A project cover and a chip take the same shove and should not answer it
     * the same way. Size stands in for mass — it is the only thing about an
     * element the page actually tells us — and the square root of the area
     * keeps a card from being a hundred times heavier than a label instead of
     * a few times. Heavy things move less and turn less; nothing is immune.
     */
    const heft = Math.min(1, Math.sqrt(rect.width * rect.height) / 460);
    const inertia = 0.58 + 0.42 * (1 - heft);

    const dx = (nx - ny * tangent + lean.x) * strength * inertia;
    const dy = (ny + nx * tangent + lean.y) * strength * inertia;

    /*
     * Rotation is torque, not decoration.
     *
     * It comes from the tangential part of the blow — a shove that lands off
     * centre is the only reason a thing in this sequence has to turn at all —
     * so its direction is the direction the piece was already being swung, and
     * a heavy element resists it. Small on purpose: the wave is pushing these
     * things, not spinning them like coins.
     */
    const rotation = tangent * (narrow ? 5.5 : 4.5) * (1 - heft * 0.55);
    const scale = 1 + (Math.random() * 2 - 1) * 0.05;

    const delay = Math.round(Math.min(1, distance / reach) * WAVE_MS);

    /*
     * Where the momentum takes it after the shove, and where the field stops it.
     *
     * The shove is over in 560ms but the piece is still travelling, so it
     * carries on along the same line and arrives at the apex with nothing
     * left. That is the moment the field has it, and it is a moment and not a
     * phase: the way home starts on the same frame.
     */
    const coast = 1.19 + Math.random() * 0.07;

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
    /*
     * The whole journey, decided here and played as one animation.
     *
     * Nothing is written to the element now. What this piece does from the
     * moment the wave reaches it to the moment it is home is a single list of
     * positions and the times it passes through them, and it is handed to
     * el.animate() at impact. That is the difference between a thing being
     * moved by forces and a thing playing three animations in a row: there is
     * no point in this sequence where one movement ends and another has to be
     * started, so there is no point where it can hang.
     */
    const flight: Flight = {
      // Where the shove and the momentum after it take it.
      ax: dx * coast,
      ay: dy * coast,
      ar: rotation * 1.4,
      as: scale,
      // When the wave gets here, and how long it takes to come back.
      wave: delay,
      home: Math.round(HOME_MS + Math.random() * HOME_SPREAD),
      // Which way the path bows on the way in, and how far.
      bow: (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 18),
      // How hard the field has to work to hold it, which is the inverse of
      // how much there is to hold.
      grip: 1 - heft,
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
    placed.push({ el, anchor: { x: cx + dx, y: cy + dy }, flight });
  }

  /*
   * The window the sound has to be written across, measured rather than
   * assumed.
   *
   * beatFor() can only give the theoretical extremes — a piece at the source
   * with the shortest way home, and one at the far corner with the longest —
   * and no real piece is ever at either. On this page that was 140ms of swell
   * before anything had turned and 420ms of crack after everything had landed.
   * These are the actual first turn and the actual last arrival of the pieces
   * that exist, so the two ends of the sound sit on two frames of the picture.
   */
  const turns = placed.map((p) => beat.impact + p.flight.wave + OUT_MS);
  const arrivals = placed.map((p, i) => turns[i] + p.flight.home);
  const timed: Beat = placed.length
    ? {
        ...beat,
        homeward: Math.min(...turns),
        landed: Math.max(...arrivals),
        done: Math.max(...arrivals) + 700,
      }
    : beat;

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
   * The throw and the shatter are the same event, and now the same wave.
   *
   * They used to be a second apart, which meant a heading was already halfway
   * across the screen before it came apart. Then they were simultaneous but
   * still two things happening to one element. Now nothing is both: a piece is
   * thrown or its letters are, and either way the only thing deciding when is
   * how long the front takes to reach it.
   */
  after(beat.impact, () => {
    /*
     * The text comes apart first, and every letter is aimed from where it
     * actually is.
     *
     * Reads before writes: all the letters on the page are built, then their
     * positions are read in one pass, then their vectors are written. Aiming
     * them element by element costs a layout per heading; this costs one.
     *
     * A letter is the lightest thing in the sequence and is thrown like it —
     * the same wave, the same falloff, the same swirl and lean the pieces got,
     * so a paragraph does not disperse in its own private direction. What it
     * does not get is any of the mass that holds a card back. This is what the
     * wave does to something with nothing to it.
     */
    /*
     * Everything is read before anything is written, and in that order for a
     * reason.
     *
     * Splitting one heading changes the width of that heading, which reflows
     * whatever is under it — so every measurement of the page as it stands has
     * to be taken before the first element is touched. Both passes below are
     * pure reads: when each block is struck, and where every one of its
     * characters actually sits.
     */
    const struckAt = words.map((el) => {
      const box = el.getBoundingClientRect();
      const ex = box.left + box.width / 2 - originX;
      const ey = box.top + box.height / 2 - originY;
      return Math.round(Math.min(1, Math.hypot(ex, ey) / reach) * WAVE_MS);
    });

    const wasAt = words.map((el) => measureLetters(el));
    /*
     * How big this block's letters are, read here with everything else.
     *
     * It decides how hard the field throws each one about: a letter of body
     * copy has almost nothing to it, and a letter of a display heading has the
     * mass of a small object. Read per block rather than per letter — 260
     * computed-style reads is a real cost and every letter in a paragraph is
     * the same size anyway.
     */
    const blockSize = words.map((el) => parseFloat(window.getComputedStyle(el).fontSize) || 17);

    const letters: HTMLElement[] = [];
    const struck: number[] = [];
    const before: DOMRect[] = [];
    const sized: number[] = [];
    /** Which block each letter came out of, so it can be put back with it. */
    const block: number[] = [];
    const restores = words.map(() => () => {});
    const lastLetter: number[] = words.map(() => 0);
    words.forEach((el, w) => {
      const made = shatterText(el);
      restores[w] = made.restore;
      made.letters.forEach((letter, i) => {
        letters.push(letter);
        struck.push(struckAt[w]);
        before.push(wasAt[w][i]);
        sized.push(blockSize[w]);
        block.push(w);
      });
    });

    const spots = letters.map((letter) => letter.getBoundingClientRect());

    letters.forEach((letter, i) => {
      const spot = spots[i];

      /*
       * The correction that makes home actually home.
       *
       * A line of text split into inline-blocks is not the same width as the
       * line it came from — the kerning between every pair of letters is gone,
       * and it adds up: measured, this heading came out seventy-four pixels
       * narrower than it went in. So every letter animating back to `none` was
       * animating back to the wrong place, and the swap back to real text at
       * the end of the sequence was what put it right. That is the snap.
       *
       * This is the gap between where the character was drawn and where its
       * span has landed, and it is carried through every keyframe. Home is now
       * the position the character actually had, so the restore at the end
       * moves nothing at all — and it corrects a line that wraps differently
       * as readily as one that is merely narrower, because it is per letter
       * and not per line.
       */
      const was = before[i];

      const lx = spot.left + spot.width / 2 - originX;
      const ly = spot.top + spot.height / 2 - originY;
      const distance = Math.hypot(lx, ly) || 1;

      const falloff = 0.5 + 0.5 * (1 - Math.min(1, distance / reach));
      const spread = 0.7 + Math.random() * 0.7;
      /*
       * Nothing is lighter than a letter, so nothing goes further for its size
       * — except a letter that is already being carried. A card title or a
       * button label is thrown twice, once by its own container and once on
       * its own account, and at the full share the two together put it off the
       * screen. At this share it still plainly separates from what it was
       * written on, which is the whole point of it.
       */
      const carried = letter.closest('.dm-piece');
      const strength = push * falloff * spread * (carried ? 0.42 : 0.82);

      const nx = lx / distance;
      const ny = ly / distance;
      const tangent = swirl + (Math.random() * 2 - 1) * 0.75;

      /*
       * The kerning correction, as position rather than as transform.
       *
       * `relative` shifts what is painted without moving anything else, so the
       * letter sits exactly where its character was and the page around it is
       * untouched — and the animation is then free to end on `none`, which is
       * what keeps the glyphs off a composited layer and drawn like text.
       */
      if (was) {
        const dx = was.left - spot.left;
        const dy = was.top - spot.top;
        if (dx || dy) {
          letter.style.position = 'relative';
          letter.style.left = `${dx.toFixed(2)}px`;
          letter.style.top = `${dy.toFixed(2)}px`;
        }
      }

      const journey = 2100 + Math.round(Math.random() * 900);
      const flight: Throw = {
        cx: (nx - ny * tangent + lean.x) * strength,
        cy: (ny + nx * tangent + lean.y) * strength,
        // Torque, like everything else: it turns the way it was swung, and only
        // that way. A letter has no mass to resist it, so it turns further.
        cr: tangent * 20,
        /*
         * Hit when its block is hit, not when its own position says.
         *
         * Timing each letter off its own distance made the front cross a line
         * of text letter by letter — a clean left-to-right ripple, in order,
         * which is the most orderly thing that has ever happened to a paragraph
         * and the exact opposite of being hit by something. A block is struck
         * at once. The seventy milliseconds on top are so that it is a mess
         * rather than a chord: no two letters leave on the same frame, and no
         * two leave in any particular order either.
         *
         * The direction is still each letter's own, which is what stops it
         * behaving like a block: they are struck together and go their own ways.
         */
        cd: struck[i] + Math.round(Math.random() * 70),
        /*
         * How long its way home takes. Its own number, so the word does not
         * come back in the order it left in — and long enough that the way
         * home is unmistakably slower than the way out.
         */
        home: journey,
      };

      returning.push(launchLetter(letter, flight));

      /*
       * And it shudders while it is held, harder than anything else, because
       * there is less of it than anything else. Scaled off the size of the type
       * it belongs to: body copy at three pixels, a display heading's letters
       * at a little under two — between a paragraph and a button, which is
       * where something that light and that large belongs.
       */
      const weight = Math.min(1, Math.max(0.55, 20 / sized[i]));
      const shake = buzz(letter, flight.cd + LETTER_OUT, 3.2 * weight);
      if (shake) returning.push(shake);

      // When this block is whole again: the last of its letters, plus a frame.
      const ends = flight.cd + LETTER_OUT + HOLD_MS + flight.home;
      if (ends > lastLetter[block[i]]) lastLetter[block[i]] = ends;
    });

    /*
     * And each block goes back to being text the moment its own letters have
     * stopped, rather than every block going back at once at the end.
     *
     * Split text and real text are not rasterised identically — inline-blocks
     * lose the kerning and the ligatures — so the swap can be seen however
     * exactly the boxes line up. Spreading them out is what stops that being a
     * single visible event across the whole page.
     */
    restores.forEach((restore, w) => {
      after(beat.impact + lastLetter[w] + 40, restore);
    });

    root.classList.add('dm-shattered');
    undo(() => root.classList.remove('dm-shattered'));

    for (const { el, flight } of placed) {
      returning.push(launch(el, flight));
      /*
       * Heavier things are held more easily. A chip is thrown about at nearly
       * two pixels and a full-width cover at half of one, and neither is
       * perfectly still — a cover that did not move at all read as the one
       * object the field had no trouble with, which is the opposite of true.
       */
      const shake = buzz(el, flight.wave + OUT_MS, 1.9 * (0.28 + 0.72 * flight.grip));
      if (shake) returning.push(shake);

      const lifted = lift(el, flight);
      if (lifted) returning.push(lifted);
    }
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

  /*
   * The field takes hold of what is already moving.
   *
   * This used to be where the drift started, which made the freeze the moment
   * things began rather than the moment they were caught. They have been
   * adrift since the shove; what happens here is that the room lights up and
   * the current they are in becomes visible — which is the beat the sound is
   * written against, and it has not moved.
   */
  after(beat.freeze, () => {
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

  /* ---- Act six: the field lets go ------------------------------------- */

  /*
   * There is nothing to send home here any more.
   *
   * Every piece has been on its way back since its own momentum ran out
   * against the field — see launch(). This beat is what it always claimed to
   * be and never was: the moment control is released, which is now only true
   * of the sidebar, because it is the one thing the field is still holding.
   */
  after(beat.drift, () => {
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

  /*
   * The letters need no beat of their own either. Each one is on a single
   * animation that carries it out and brings it back — see the dm-letter
   * keyframes — so there is no moment at which the word has to be told to
   * reassemble. It has been reassembling since it came apart.
   */

  after(timed.done, () => {
    teardown();
    options.onEnd?.();
  });

  return timed;
}

/**
 * One piece, one animation, from struck to home.
 *
 * The offsets say where it goes. The easings say how fast, and they are the
 * harder half: an animation is only continuous if the speed a segment ends at
 * is the speed the next one starts at. Give every segment an ease-in-out — the
 * obvious thing to do — and the piece stops dead at every keyframe, which is
 * three animations in a row again with the joins hidden inside one. The first
 * attempt at this did exactly that and stalled four times on the way home.
 *
 * So the speed at each boundary is chosen, not defaulted:
 *
 *   0 → wave      Nothing. The front has not reached it.
 *   wave → apex   One movement, not two. It leaves fast — the curve's opening
 *                 slope is twenty-eight — and decays the whole way, so the shove and
 *                 the momentum after it are the same gesture running out. It
 *                 arrives with no speed left, and that is the catch.
 *   apex → bow    The only place velocity is allowed to reach zero, because it
 *                 is the place the force changes sign. It leaves slowly and
 *                 builds: being pulled, not rebounding.
 *   bow → home    Handed exactly the speed the half before it ends at — both
 *                 halves are the same length and the same duration, so the
 *                 join can be checked by eye. They meet at the fastest point,
 *                 so the way home is one rise and one fall: quickest through
 *                 the middle, slowest as it arrives.
 *
 * The path bows sideways on the way back rather than retracing the line it
 * came out on, which is how something carried by a force travels and nothing
 * like a reversed throw.
 */
function launch(el: HTMLElement, f: Flight): Animation {
  const total = f.wave + OUT_MS + HOLD_MS + f.home;
  const at = (ms: number) => ms / total;
  const apex = f.wave + OUT_MS;
  const away = apex + HOLD_MS;

  const span = Math.hypot(f.ax, f.ay) || 1;
  const bowX = (-f.ay / span) * f.bow;
  const bowY = (f.ax / span) * f.bow;

  return el.animate(
    [
      { transform: 'none', offset: 0, easing: 'linear' },
      // Untouched. The wave arrives on this frame and everything starts here.
      {
        transform: 'none',
        offset: at(f.wave),
        // Opening slope 28, closing slope 0: gone before you see it leave,
        // and then a long time running out.
        easing: 'cubic-bezier(0.03, 0.85, 0.2, 1)',
      },
      // Carried as far as it goes, and caught.
      {
        transform: `translate3d(${f.ax.toFixed(1)}px, ${f.ay.toFixed(1)}px, 0) rotate(${f.ar.toFixed(2)}deg) scale(${f.as.toFixed(3)})`,
        offset: at(apex),
        easing: 'linear',
      },
      /*
       * Held, and only held.
       *
       * The same position as the frame above it, so across this stretch the
       * flight contributes no movement at all — everything you see here is the
       * shudder from buzz(), added on top. That is the distinction this whole
       * sequence turns on: it is not floating, because nothing is carrying it.
       * It has been stopped and it is being fought over.
       */
      {
        transform: `translate3d(${f.ax.toFixed(1)}px, ${f.ay.toFixed(1)}px, 0) rotate(${f.ar.toFixed(2)}deg) scale(${f.as.toFixed(3)})`,
        offset: at(away),
        // From nothing, and still building at the far end: the pull is
        // strongest in the middle of the way home, not at either end of it.
        easing: 'cubic-bezier(0.55, 0, 0.75, 0.6)',
      },
      /*
       * Halfway home in half the time, and out of the line it came along.
       *
       * The two halves of the return are the same length and the same duration
       * on purpose. It is the only way the handover can be checked by eye: the
       * curve above ends at 1.6 and the one below starts at 1.6, so the speed
       * across the join is unchanged and the bow is a bend in the path rather
       * than a beat in the timing.
       *
       * They meet at the fastest point of the return, so the whole of the way
       * home is one rise and one fall — quickest through the middle, slowest
       * as it arrives. Matching them at a slow speed instead put a dip at the
       * bend and a second surge after it, which reads as two pulls.
       */
      {
        transform:
          `translate3d(${(f.ax * 0.5 + bowX).toFixed(1)}px, ${(f.ay * 0.5 + bowY).toFixed(1)}px, 0) ` +
          `rotate(${(f.ar * 0.42).toFixed(2)}deg) scale(${(1 + (f.as - 1) * 0.42).toFixed(3)})`,
        offset: at(away + f.home * 0.5),
        // Handed 1.6 and running out to nothing: it arrives by slowing, not
        // by being stopped there.
        easing: 'cubic-bezier(0.15, 0.24, 0.35, 1)',
      },
      { transform: 'none', offset: 1 },
    ],
    { duration: total, fill: 'both' }
  );
}

/**
 * Whether the browser will add one animation's transform to another's.
 *
 * Without this the tremble would not layer on top of the flight, it would
 * replace it — the piece would shiver on the spot and never go anywhere. Asked
 * once, because the answer cannot change.
 */
const CAN_LAYER = (() => {
  try {
    return new KeyframeEffect(null, [], { composite: 'add' }).composite === 'add';
  } catch {
    return false;
  }
})();

/**
 * How the shudder is shaped, and it is shaped by the hold and nothing else.
 *
 * It used to start before the apex and fade well into the return, which put
 * trembling on the way out and on the way home — two places where the thing
 * moving it is momentum, not a grip. The buzz is evidence of a grip. It cannot
 * be anywhere the grip is not.
 *
 * So it begins on the frame the piece stops and ends on the frame it is let
 * go. The edges are 90ms of ramp so it arrives and leaves without a click, and
 * that ramp lives inside the hold rather than either side of it.
 */
const BUZZ_EDGE = 90;
/*
 * How often the shudder is re-rolled. Coarser on a phone: the step is the only
 * thing deciding how many keyframes three hundred letters ask for, and there
 * it is worth spending a little of the texture to keep the frames.
 */
const BUZZ_STEP = window.innerWidth < 768 ? 76 : 52;

function buzz(el: HTMLElement, apex: number, amp: number): Animation | null {
  if (!CAN_LAYER || amp <= 0) return null;

  const span = HOLD_MS;
  const steps = Math.max(2, Math.round(span / BUZZ_STEP));
  const frames: Keyframe[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const now = (i / steps) * span;

    // In and out inside its own window, so nothing starts or stops abruptly
    // and nothing trembles outside the hold.
    const envelope = Math.min(1, Math.min(now, span - now) / BUZZ_EDGE);

    const reach = amp * Math.max(0, envelope);
    /*
     * Position only, and no rotation at all.
     *
     * A thing turning one way and then the other is the oscillation this
     * sequence has spent its whole life removing, and at this scale a rotation
     * is indistinguishable from a wobble. A held object shivers; it does not
     * rock.
     */
    frames.push({
      offset: i / steps,
      transform:
        `translate3d(${((Math.random() * 2 - 1) * reach).toFixed(2)}px, ` +
        `${((Math.random() * 2 - 1) * reach).toFixed(2)}px, 0)`,
      easing: 'linear',
    });
  }

  // Both ends are exactly nothing, so what it is added to is untouched before
  // the hold and untouched after it.
  frames[0] = { offset: 0, transform: 'translate3d(0, 0, 0)' };
  frames[frames.length - 1] = { offset: 1, transform: 'translate3d(0, 0, 0)' };

  return el.animate(frames, { duration: span, delay: apex, composite: 'add', fill: 'both' });
}

/**
 * How long a letter's own momentum takes to run out.
 *
 * Shorter than a piece's. There is less to a letter, so there is less to keep
 * it going, and the field has it sooner.
 */
const LETTER_OUT = 620;

/** Where a letter is aimed, and when. */
interface Throw {
  cx: number;
  cy: number;
  cr: number;
  cd: number;
  home: number;
}

/**
 * One letter, one animation, told exactly as a piece is told.
 *
 * It used to be a CSS animation with fixed percentages, which cannot express a
 * hold of a set number of milliseconds inside a total that differs per letter
 * — and it meant a letter had a CSS animation and an added Web Animations
 * shudder on the same property, from two systems. Both halves are now the same
 * system, and the same shape as everything else on the page: still, struck,
 * carried, held, brought home.
 *
 * It ends on `transform: none`, and that is not a detail.
 *
 * The kerning correction — a letter's span does not sit where its character
 * was drawn, because a line split into inline-blocks loses every pair — used
 * to live in the last keyframe, so every letter came to rest holding a
 * fractional translate. An element on a fractional transform stays on its own
 * composited layer and has its text drawn with greyscale antialiasing rather
 * than the subpixel kind, so the moment the real text came back it visibly
 * changed: not a jump, a re-rasterisation, and at a button's label that is
 * exactly what a snap looks like. The correction is a layout offset now — see
 * the write pass — and the transform resolves to nothing, so the layer is
 * dropped and the glyphs are drawn the way they are drawn everywhere else.
 */
function launchLetter(el: HTMLElement, t: Throw): Animation {
  const total = t.cd + LETTER_OUT + HOLD_MS + t.home;
  const at = (ms: number) => ms / total;
  const apex = t.cd + LETTER_OUT;

  const out = `translate3d(${t.cx.toFixed(2)}px, ${t.cy.toFixed(2)}px, 0) rotate(${t.cr.toFixed(2)}deg)`;

  return el.animate(
    [
      { transform: 'none', offset: 0, easing: 'linear' },
      // Untouched. The front arrives on this frame.
      { transform: 'none', offset: at(t.cd), easing: 'cubic-bezier(0.03, 0.85, 0.2, 1)' },
      // Struck, and carried until there is nothing left.
      { transform: out, offset: at(apex), easing: 'linear' },
      // Held. The same position, so the only movement here is the shudder.
      { transform: out, offset: at(apex + HOLD_MS), easing: 'cubic-bezier(0.5, 0, 0.3, 1)' },
      { transform: 'none', offset: 1 },
    ],
    { duration: total, fill: 'both' }
  );
}

/**
 * The kick the front gives a thing as it passes under it.
 *
 * The same movement the theme wipe uses — up fourteen pixels and a hair
 * larger, over 620ms — because it is the same idea: something is crossing the
 * page and everything it reaches answers it. There it is the only thing that
 * happens; here it is the first, and it is added on top of the throw rather
 * than replacing it, so what you see is a piece being lifted and flung at the
 * same instant rather than one and then the other.
 *
 * It is scaled by weight for the same reason everything else is. A cover is
 * barely lifted; a chip is thrown off its feet.
 */
function lift(el: HTMLElement, f: Flight): Animation | null {
  if (!CAN_LAYER) return null;

  const height = 14 * (0.35 + 0.65 * f.grip);

  return el.animate(
    [
      { transform: 'translate3d(0, 0, 0) scale(1)', offset: 0 },
      {
        transform: `translate3d(0, ${-height.toFixed(1)}px, 0) scale(${(1 + 0.012 * f.grip).toFixed(4)})`,
        offset: 0.38,
      },
      { transform: 'translate3d(0, 0, 0) scale(1)', offset: 1 },
    ],
    {
      duration: 620,
      delay: f.wave,
      easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)',
      composite: 'add',
      fill: 'both',
    }
  );
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
  // Advances on its own clock, and seeds the jitter on every arc drawn below.
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
