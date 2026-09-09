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
 * How long the shove lasts.
 *
 * Shorter than it reads: the whole point of a blast is that it is over before
 * you have registered it. What you watch afterwards is not the shove, it is
 * what the shove left behind.
 */
/**
 * How long the pressure front is felt before the force behind it lands.
 *
 * A shockwave is not a wall: the air ahead of it arrives first, and what it
 * does is bend things. So the lift starts on the frame the front reaches an
 * element and the blast waits this long behind it.
 *
 * The number is not free. It is 38% of the lift's own 620ms, which is where
 * that curve peaks — so the force lands on the exact frame the bend is at its
 * furthest, and the blast takes the element at the top of its flex rather than
 * on the way up. At the 110 it was before, the bend was still a third of the
 * way in when it was overrun, which is why it could not be seen.
 */
/**
 * How long one thing takes to be lifted and set back down.
 *
 * This is the whole of the bend, start to finish: the front arrives under an
 * element, it rises, and it settles again — and it is over before anything
 * hits it. Earlier versions had the blast land on the frame the bend was
 * furthest, which is tidy and unreadable: what the eye got was one event, and
 * that event was the shatter.
 *
 * 420ms, peaking at 160 and back down by the end, which is slow enough to be
 * unmistakable and quick enough that the whole page can be crossed and settled
 * before the shock catches up with it.
 */
const SWELL_MS = 420;

/**
 * The furthest a swell can be pushed back by the sweep across its own block.
 *
 * The sweep below travels along each line at about a millisecond per pixel, so
 * a very wide heading could otherwise still be rising when the blast arrives.
 * Capping it is what lets the preload be one number rather than a per-element
 * calculation.
 *
 * 150 rather than the 240 it started at, because the preload is built on top
 * of it: every millisecond of headroom here is a millisecond of stillness
 * between the settle and the shock for everything that is not at the far end
 * of a long line. Measured, the wide cap left 312ms of dead air on the
 * quickest elements, and dead air was the first thing that read as wrong.
 */
const SWEEP_CAP = 150;

/**
 * How long the pressure is felt before the force behind it lands.
 *
 * Not chosen freely: it is the swell, plus the furthest the sweep can push one
 * back, plus a frame or two of clear air. That is what guarantees the order the
 * whole sequence depends on — every letter and every control has risen and
 * settled before the shock reaches it, so the three beats read as three beats
 * and not as one.
 *
 * All three parts were once brought down together, 610ms to 434, on the theory
 * that six tenths of a second between the press and the shatter reads as the
 * site thinking about it. It does not. What it reads as is the lift being cut
 * short: the bend is the one beat in this sequence that has to be *watched* to
 * work at all, and at 434 there was not enough of it left to watch. Visible
 * beats quick here, and it is not close.
 */
const PRELOAD_MS = SWELL_MS + SWEEP_CAP + 40;

const BLAST_MS = 380;

/**
 * How much pressure is left this far out.
 *
 * A shock pulse is not a ripple. The pressure rises almost vertically at the
 * front, peaks, and then decays behind it — so the sheet is bent hard in a
 * narrow band around the front and is very nearly flat everywhere else. What
 * this replaced was linear and bottomed out at half, which bent the whole page
 * by roughly the same amount at once: a page-wide flex rather than something
 * travelling across it.
 *
 * The shape is a stretched exponential, `exp(-(u/k)^1.4)`, fitted to the
 * profile a decaying front actually has:
 *
 *      at the front   1.00
 *      a fifth out    0.62
 *      a third out    0.32
 *      half way       0.09
 *      beyond that    ~0
 *
 * The length scale is a fraction of `reach` rather than a pixel count, because
 * the same click has to read the same way on a phone and on a wide display —
 * a fixed 180px band would be most of a narrow screen and a stripe on a large
 * one.
 *
 * `floor` is what separates the two things this drives. The bend takes 0,
 * because a bend that has decayed to nothing is exactly right and a far corner
 * that stays flat is the point. The throw cannot: this storm's business is
 * taking the whole interface apart, and an element left where it was reads as
 * one the wave could not be bothered with. So the throw keeps a third of its
 * force at any distance and spends the rest on the near field.
 */
function pressure(distance: number, reach: number): number {
  const u = Math.min(1, distance / (reach || 1));
  return Math.exp(-Math.pow(u / 0.42, 1.5));
}

/**
 * How much of the shove is left this far out.
 *
 * The same idea as the pressure above and deliberately not the same curve,
 * because the two are answering different questions. The bend is allowed to
 * decay to nothing — a far corner that stays flat while the front is still
 * near the middle is exactly what a pulse looks like. The shove is not: this
 * storm's business is taking the whole interface apart, and a chip left
 * sitting in the corner reads as one the wave could not be bothered with.
 *
 * So this keeps both ends of what was here before — full force at the origin,
 * half of it at the furthest corner — and only changes the shape between them.
 * It was linear, which spread the force evenly across the page; the same two
 * endpoints with a decaying middle put it where the front is instead. At a
 * fifth of the way out the shove is 0.84 rather than 0.90, at half way 0.61
 * rather than 0.75, and the far corner is unchanged, so nothing about how far
 * the outer pieces travel — which the coast, the grip and the way home are all
 * tuned against — moves at all.
 */
function carry(distance: number, reach: number): number {
  const u = Math.min(1, distance / (reach || 1));
  return 0.5 + 0.5 * Math.exp(-Math.pow(u / 0.38, 1.5));
}

/**
 * And how long the field takes to work that off.
 *
 * The piece is still going the way it was thrown for the whole of this — the
 * distance it has travelled keeps growing — while its speed dies against the
 * grip. That is the difference between this and the hold it replaces, and it
 * is the whole physical story: the field does not stop the thing, it out-lasts
 * it. The shudder is the evidence of the two forces disagreeing, and it stops
 * when the disagreement is settled.
 */
const FIGHT_MS = 1500;

/** From the front reaching a piece to that piece's speed reaching zero. */
const OUT_MS = BLAST_MS + FIGHT_MS;

/**
 * How long it is held at the far point before the pull starts.
 *
 * The one still moment in the sequence, and it has to be earned: the piece has
 * spent a second and a half getting away and has finally been stopped, so this
 * is the grip closing on something that has just lost. Nothing carries it here
 * — the flight contributes no movement at all across this stretch — and the
 * only thing that moves is the shudder, which is why these two numbers are the
 * same number. Longer than a beat and shorter than a pause.
 */
const GRIP_MS = 700;
const GRIP_LETTER_MS = 540;
/** And the way home: the shortest of them, and how much longer the longest is. */
const HOME_MS = 2600;
const HOME_SPREAD = 1200;

/** The nearest piece turns for home the moment its momentum is finally spent. */
const homewardAt = (impact: number) => impact + PRELOAD_MS + OUT_MS + GRIP_MS;
/** The furthest lands a whole wave crossing and the longest way home later. */
const landedAt = (impact: number) =>
  impact + WAVE_MS + PRELOAD_MS + OUT_MS + GRIP_MS + HOME_MS + HOME_SPREAD;

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
  freeze: 70 + PRELOAD_MS + OUT_MS - 20,
  hold: 70 + PRELOAD_MS + OUT_MS - 20,
  homeward: homewardAt(70),
  /*
   * Derived, because a typed number here went stale the moment the preload
   * grew.
   *
   * The field comes up when the grip closes and goes when the grip opens —
   * those are `freeze` and `homeward`, and both move with the flight. Written
   * down as 2300 they eventually sat *before* the freeze that was supposed to
   * precede them, so the vignette was switched off a hundred and sixty
   * milliseconds before it was switched on and then stayed on until teardown.
   * Nothing about that is visible in a diff; it is only visible on screen.
   */
  decay: homewardAt(70),
  drift: homewardAt(70) + 200,
  /* Unused now: he changes back off the measured landing. See run(). */
  avatar: landedAt(70),
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
  freeze: 80 + PRELOAD_MS + OUT_MS - 20,
  hold: 80 + PRELOAD_MS + OUT_MS - 20,
  homeward: homewardAt(80),
  decay: homewardAt(80),
  drift: homewardAt(80) + 200,
  avatar: landedAt(80),
  landed: landedAt(80),
  done: landedAt(80) + 700,
};

export { DECAY_MS as FIELD_DECAY_MS, WAVE_MS as WAVE_CROSS_MS, PRELOAD_MS };
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
  /** How much pressure was left here when the front passed. Drives the bend. */
  force: number;
  /** Which way the front was travelling when it got here. */
  nx: number;
  ny: number;
  /** How much further than the shove alone the momentum carried it. */
  coast: number;
}

let running = false;
let restorers: Array<() => void> = [];
let timers: number[] = [];
let frame = 0;

/**
 * What the front broke, kept until the page has finished landing.
 *
 * The settle at the end glitches the same elements the wave did rather than a
 * fresh selection, because it is the same screen recovering from the same
 * event — a second, different set would read as a new effect arriving after
 * the story was over.
 */
let broke: Array<{ el: HTMLElement; sx: number; bite: number }> = [];

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
   * come back, so the throw is scaled to the smaller half-dimension.
   *
   * Trimmed when the coast above was raised. The two multiply — the total is
   * the shove times the coast — so making the momentum harder to beat had to
   * be paid for out of the shove, or the far pieces would spend the fight
   * off the side of the screen where nobody can watch them lose it.
   */
  const push = Math.min(narrow ? 340 : 560, Math.min(window.innerWidth, window.innerHeight) * 0.62);

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

  /*
   * Every run carries the same energy; only its arrangement changes.
   *
   * The spread and the coast used to be drawn independently per piece, and on
   * a page with five of them that is a small sample of a wide range — so one
   * press could deal five low cards and be visibly weaker than the last, with
   * nothing wrong anywhere. The variance was the whole of the difference
   * between "the first one is the best one" and the rest.
   *
   * A ladder instead of five dice: fixed values spanning the range, shuffled
   * and handed out one per piece. The mix is identical every time, which piece
   * gets which is not, and the run's swirl and lean above still decide where
   * it all goes. The only thing that differs between two presses is the
   * direction, which is the only thing that should.
   */
  const rungs = (from: number, to: number, n: number) => {
    const out = Array.from({ length: n }, (_, i) => (n === 1 ? (from + to) / 2 : from + ((to - from) * i) / (n - 1)));
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const placed: Array<{ el: HTMLElement; anchor: Anchor; flight: Flight }> = [];

  // One rung each, shuffled. See the note on rungs() above.
  const spreads = rungs(0.86, 1.36, chosen.length);
  const coasts = rungs(1.55, 1.72, chosen.length);
  let rung = 0;

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
    const falloff = carry(distance, reach);
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
     *
     * Taken off the ladder rather than rolled, so the set of values is the
     * same on every press and only their arrangement moves.
     */
    const spread = spreads[rung];
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

    /*
     * The swirl turns the throw; it does not lengthen it.
     *
     * (nx - ny·t, ny + nx·t) is not a unit vector — its length is sqrt(1 + t²),
     * and the run's swirl carries t as far as 1.35. So a run that happened to
     * roll a strong swirl threw everything up to 1.7 times further than a run
     * that rolled none, for no reason anybody could see, and the lean added
     * more on top. Measured across three presses before this: total apex
     * distance 3969, 3000, 2539 — a fifty-six per cent swing in how hard the
     * page was hit, from two numbers that were only ever meant to aim it.
     *
     * Normalised, the direction is the swirl's and the distance is `strength`
     * alone: `push` for the run, falloff for how far out it is, its rung of
     * the ladder for grain, and inertia for what it weighs. Which is the whole
     * of the brief — every press the same power, and only the direction
     * different.
     */
    const aimX = nx - ny * tangent + lean.x;
    const aimY = ny + nx * tangent + lean.y;
    const aim = Math.hypot(aimX, aimY) || 1;

    const dx = (aimX / aim) * strength * inertia;
    const dy = (aimY / aim) * strength * inertia;

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
    /*
     * How much further the momentum carries it than the shove alone did.
     *
     * This number is the strength of the field, read backwards. At 1.2 the
     * argument was over almost as soon as it started — the fight added a fifth
     * to a distance the shove had already covered, so the grip looked like it
     * barely had to try. At 1.6 the piece travels most of another half of its
     * own throw while it is being worked on, which is what makes the holding
     * look like work: it is still getting away for a second and a half, and
     * only just stops in time.
     */
    const coast = coasts[rung];
    rung += 1;

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
      /*
       * The bend reads the pressure, not the throw.
       *
       * Taken with no floor, unlike the falloff the shove uses: a far corner
       * that is thrown but barely flexed is exactly what a decaying front
       * does, and giving the bend the throw is floor would have bent the whole
       * page a third of the way again.
       */
      force: pressure(distance, reach),
      /*
       * The way it is actually going, not the way the source lies.
       *
       * The bend is about the axis across the direction of travel, so it has
       * to be the travel — the throw carries the run's swirl and lean and this
       * piece's own share of chaos on top of the radius, and bending along the
       * radius while being thrown somewhere else is two forces disagreeing for
       * no reason.
       */
      nx: dx / (Math.hypot(dx, dy) || 1),
      ny: dy / (Math.hypot(dx, dy) || 1),
      coast,
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
  /*
   * The same arithmetic launch() uses, and it has to be exactly that.
   *
   * This was missing the preload and the grip: a piece turns for home at
   * wave + PRELOAD_MS + OUT_MS + GRIP_MS, not at wave + OUT_MS, so the number
   * handed to the sound was most of a second early and the rewind swell began
   * while the field was still winning. It was wrong before and survived
   * because the gap was 340ms; raising the preload to give the bend its own
   * moment took it to 610 and made it audible.
   */
  const turns = placed.map(
    (p) => beat.impact + p.flight.wave + PRELOAD_MS + OUT_MS + GRIP_MS
  );
  const arrivals = placed.map((p, i) => turns[i] + p.flight.home);
  /*
   * The field is electric only while something is being held.
   *
   * The grip closes at each piece's own neutral point — its release minus the
   * length of the hold — so the window is from the first of those to the last
   * release. Measured from the flights rather than named, like everything else
   * the sound and the field share.
   */
  if (placed.length) {
    const at = performance.now();
    armField(at + Math.min(...turns) - GRIP_MS, at + Math.max(...turns));
  }

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
     * Where each block sits, and where on it the front arrives first.
     *
     * Measured once per block rather than per letter: two hundred
     * getBoundingClientRect calls inside the loop that is about to split every
     * heading is the one place in this sequence that could actually drop a
     * frame.
     */
    const wordBox = words.map((el) => el.getBoundingClientRect());
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

    /*
     * The pressure lifts the block; the force then takes its letters off it.
     *
     * A heading is not a piece and so was never lifted — the front reached it
     * and it simply came apart, which skipped the one beat that makes the wave
     * feel like it is made of air. It gets the same lift everything else does,
     * on the element itself, and its letters leave a tenth of a second later.
     */
    /*
     * The block is deliberately not bent, and its letters are.
     *
     * This used to lift the word as one plate, which is a sign being tilted.
     * A blast under a surface lifts what is above it in the order it reaches
     * them, so the swell is applied per letter in the loop below, timed off
     * each glyph's own distance. Nothing is both a block and its letters:
     * bending both put a tilting plate under a rolling swell.
     */

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

      const falloff = carry(distance, reach);
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
      const letterCoast = 1.58 + Math.random() * 0.2;
      // Aimed, not lengthened — see the note in the piece loop above.
      const aimX = nx - ny * tangent + lean.x;
      const aimY = ny + nx * tangent + lean.y;
      const aim = Math.hypot(aimX, aimY) || 1;

      const flight: Throw = {
        coast: letterCoast,
        cx: (aimX / aim) * strength * letterCoast,
        cy: (aimY / aim) * strength * letterCoast,
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
       * The wave passes under this letter and lifts it.
       *
       * This is the bend, and it belongs here rather than on the block. A
       * heading lifted as one plate is a sign being tilted; a blast travelling
       * under a surface lifts what is above it in the order it reaches them,
       * and that order is the whole read — you see the swell cross the words.
       *
       * Timed off each glyph's own distance from the origin, so the front
       * genuinely rolls through the line at the speed it crosses the page.
       * That is deliberately the opposite of what the shatter does twenty
       * lines below, and the note there is right about why: a block struck
       * letter by letter is an orderly ripple, and being hit is not orderly.
       * A ground swell is. So the swell rolls and the impact lands at once,
       * which is also the order they happen in.
       *
       * The block is no longer lifted at all — nothing is both a block and its
       * letters, or the bend is applied twice and the second one is a plate
       * tilting under the first.
       */
      /*
       * Stretched past the front's own speed, and deliberately.
       *
       * At the true crossing time the letters of one heading are about 150ms
       * apart, against a flex that takes 540ms to reach full — an 18% phase
       * difference, which the eye reads as the word leaning rather than as a
       * swell moving through it. At 1.9x the onsets across a line span most of
       * a rise, so at any instant part of the word is coming up, part is at
       * the top and part has not been reached. That is the picture.
       *
       * And the ripple is local: 640ms against the block flex of 1421, so it
       * passes under a letter and leaves rather than holding the whole line up
       * at once. A deformation that outlasts the wave crossing the page is not
       * a wave, it is a bulge.
       */
      /*
       * And the sweep along the line, which is the part that actually rolls.
       *
       * The radial term above is honest and, on its own, not enough: a heading
       * above the click runs across the radius, so every letter in it is very
       * nearly the same distance from the origin and the front reaches them
       * together. Measured on this page, the eleven letters of the h1 were
       * 47ms apart out of a 540ms rise — the word leaned, it did not roll.
       *
       * So the front also travels *along* each block, outward from whichever
       * end of it the wave meets first. That is what a swell crossing the
       * ground does, and it is what puts a real order on the letters: at any
       * instant part of the word is coming up, part is at the top and part has
       * not been reached. Just under a millisecond per pixel, so a 215px
       * heading takes about 180ms to cross — a third of the rise.
       */
      const bx = wordBox[block[i]];
      const entry = Math.max(bx.left, Math.min(originX, bx.right));
      const sweep = Math.min(SWEEP_CAP, Math.abs(spot.left + spot.width / 2 - entry) * 0.85);
      const roll = Math.round(Math.min(1, distance / reach) * WAVE_MS + sweep);
      const swell = lift(letter, roll, nx, ny, pressure(distance, reach), Math.min(1, sized[i] / 460));
      if (swell) returning.push(swell);

      /*
       * And it shudders while it is held, harder than anything else, because
       * there is less of it than anything else. Scaled off the size of the type
       * it belongs to: body copy at three pixels, a display heading's letters
       * at a little under two — between a paragraph and a button, which is
       * where something that light and that large belongs.
       */
      const weight = Math.min(1, Math.max(0.55, 20 / sized[i]));
      const shake = buzz(letter, flight.cd + PRELOAD_MS + LETTER_OUT, 2.6 * weight, GRIP_LETTER_MS);
      if (shake) returning.push(shake);

      // When this block is whole again: the last of its letters, plus a frame.
      const ends = flight.cd + PRELOAD_MS + LETTER_OUT + GRIP_LETTER_MS + flight.home;
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
      const shake = buzz(el, flight.wave + PRELOAD_MS + OUT_MS, 1.55 * (0.28 + 0.72 * flight.grip), GRIP_MS);
      if (shake) returning.push(shake);

      // The pressure still left where it stands, and its own weight.
      /*
       * Lifted and set down again before it is thrown.
       *
       * Same beat as the letters and for the same reason: the front arrives,
       * the thing rises, it settles, and only then does the blast take it.
       * The swell is over 240ms before the shove starts, which is the gap that
       * makes them two events instead of one.
       */
      const lifted = lift(el, flight.wave, flight.nx, flight.ny, flight.force, 1 - flight.grip);
      if (lifted) returning.push(lifted);
    }

    /*
     * And the screen itself gives out where the front crosses it.
     *
     * Every candidate the wave touches is offered — the pieces with the
     * vectors they were already given, the text blocks with theirs recomputed
     * from boxes that were measured before anything was split — and `damage`
     * takes twelve of them spread along the front. It is deliberately the same
     * `at` the lift runs on and the same `force` the bend is scaled by: there
     * is one pressure envelope crossing the page and the tear, the bend and
     * the crackle are three readings of it, not three effects.
     */
    const wounds: Array<{ el: HTMLElement; at: number; sx: number; force: number }> = [];

    for (const { el, flight } of placed) {
      wounds.push({ el, at: flight.wave, sx: flight.nx >= 0 ? 1 : -1, force: flight.force });
    }

    words.forEach((el, w) => {
      const box = wordBox[w];
      const ex = box.left + box.width / 2 - originX;
      const ey = box.top + box.height / 2 - originY;
      const away = Math.hypot(ex, ey) || 1;
      wounds.push({
        el,
        at: struckAt[w],
        sx: ex >= 0 ? 1 : -1,
        force: pressure(away, reach),
      });
    });

    returning.push(...damage(wounds, (strength) => onTear?.(strength)));
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

  /*
   * He is the last thing to change back.
   *
   * The purple left him a second and a half before the last piece had landed,
   * so the page finished putting itself together under a character who had
   * already stopped doing anything — which reads as the effect ending and then
   * some furniture still moving. He holds the purple until everything is home
   * and then lets go, which is the order the story has: the field is his, so
   * it goes out when he does and not before.
   */
  /*
   * And then the screen itself has the last word.
   *
   * Everything is home and nothing is moving, and for a third of a second the
   * picture breaks up anyway before it is finally clean. It sits here, between
   * the last piece landing and the purple leaving him, because that is the
   * order the story has: the page is back, the display it came back on is not
   * quite over it, and he is the last thing on it to fail.
   */
  after(timed.landed, () => {
    returning.push(...resettle(character, (strength) => onFault?.(strength)));
  });

  after(timed.landed + SETTLE_MS + 40, () => {
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
  const total = f.wave + PRELOAD_MS + OUT_MS + GRIP_MS + f.home;
  const at = (ms: number) => ms / total;
  // The pressure gets here first; the force is behind it.
  const hit = f.wave + PRELOAD_MS;
  const struck = hit + BLAST_MS;
  const neutral = hit + OUT_MS;
  // And it is held there while the grip closes, before anything pulls.
  const released = neutral + GRIP_MS;

  const span = Math.hypot(f.ax, f.ay) || 1;
  const bowX = (-f.ay / span) * f.bow;
  const bowY = (f.ax / span) * f.bow;

  // Where the shove alone would have put it, before the field started arguing.
  const bx = f.ax / f.coast;
  const by = f.ay / f.coast;

  return el.animate(
    [
      { transform: 'none', offset: 0, easing: 'linear' },
      // Untouched. The wave arrives on this frame and everything starts here.
      {
        transform: 'none',
        offset: at(hit),
        /*
         * Opening slope 28, closing slope 0.15: gone before you see it leave,
         * and still travelling when the shove ends. That closing number is the
         * whole of the handover — the field takes hold of something moving,
         * not of something that has already stopped.
         */
        easing: 'cubic-bezier(0.03, 0.85, 0.72, 0.958)',
      },
      // The end of the shove. Still going, and now being argued with.
      {
        transform: `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) rotate(${(f.ar * 0.72).toFixed(2)}deg) scale(${f.as.toFixed(3)})`,
        offset: at(struck),
        /*
         * Opening slope 0.93, closing slope 0, and the middle deliberately
         * high.
         *
         * The opening is the speed the shove ends at, expressed in this
         * segment's own terms: it covers a bit over half the shove's distance
         * in four times its duration, so the number that means "the same
         * speed" is much smaller than it was when the fight was a fifth as
         * long. Pushing the second control point out to 0.55 keeps the speed
         * up through the middle instead of collapsing early — the piece is
         * still making real ground when it is half beaten, and only loses it
         * at the end.
         */
        easing: 'cubic-bezier(0.3, 0.28, 0.55, 1)',
      },
      /*
       * The neutral point: the frame the outward speed reaches zero.
       *
       * A keyframe, not a phase. The piece has been slowing for a second and a
       * half and has been moving outward the whole of it — this is only where
       * it finally stops, and it is the same frame it starts back on.
       */
      {
        transform: `translate3d(${f.ax.toFixed(1)}px, ${f.ay.toFixed(1)}px, 0) rotate(${f.ar.toFixed(2)}deg) scale(${f.as.toFixed(3)})`,
        offset: at(neutral),
        easing: 'linear',
      },
      /*
       * Held. The same position as the frame above, so across this stretch the
       * flight contributes nothing at all and everything you see is the
       * shudder — the grip closing on something that has just stopped getting
       * away. It is the only still moment in the sequence and it is the one
       * the whole fight was for.
       */
      {
        transform: `translate3d(${f.ax.toFixed(1)}px, ${f.ay.toFixed(1)}px, 0) rotate(${f.ar.toFixed(2)}deg) scale(${f.as.toFixed(3)})`,
        offset: at(released),
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
       * than a beat in the timing. They meet at the fastest point of the
       * return, so the way home is one rise and one fall.
       */
      {
        transform:
          `translate3d(${(f.ax * 0.5 + bowX).toFixed(1)}px, ${(f.ay * 0.5 + bowY).toFixed(1)}px, 0) ` +
          `rotate(${(f.ar * 0.42).toFixed(2)}deg) scale(${(1 + (f.as - 1) * 0.42).toFixed(3)})`,
        offset: at(released + f.home * 0.5),
        // Handed 1.6 and running out to nothing: it arrives by slowing, not by
        // being stopped there.
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
 * How the shudder is shaped, and where it belongs.
 *
 * It used to start before the apex and fade well into the return, which put
 * trembling on the way out and on the way home — two places where the thing
 * moving it is momentum, not a grip. The buzz is evidence of a grip. It cannot
 * be anywhere the grip is not.
 *
 * It begins at the far point — the frame the outward speed reaches zero, which
 * is the moment the grip finally closes — and it is over shortly after. Not
 * during the fight: the whole of the fight is the piece still getting away,
 * and a tremor laid over travel is read as a rattle in the travel rather than
 * as a hold. What it marks is the instant the thing stops going anywhere.
 *
 * Both edges are ramped inside its own window, so it arrives out of nothing
 * and leaves into nothing and never begins or ends on a frame.
 */
const BUZZ_EDGE = 110;

/*
 * How often the shudder is re-rolled.
 *
 * Every roll is a change of direction, so this is its frequency — and at 52ms
 * it read as a buzz, which is right for something being fought over and wrong
 * for something that has just been caught. At 74 it is a tremor: the same
 * irregularity, half the agitation. Coarser again on a phone, where the step
 * is the only thing deciding how many keyframes three hundred letters ask for.
 */
const BUZZ_STEP = window.innerWidth < 768 ? 92 : 74;



function buzz(el: HTMLElement, from: number, amp: number, span: number): Animation | null {
  if (!CAN_LAYER || amp <= 0) return null;

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
      // Eased between rolls rather than run to in a straight line: it is a
      // tremor and not a series of small jumps.
      easing: 'ease-in-out',
    });
  }

  // Both ends are exactly nothing, so what this is added to is untouched
  // before the grip closes and untouched once it has.
  frames[0] = { offset: 0, transform: 'translate3d(0, 0, 0)' };
  frames[frames.length - 1] = { offset: 1, transform: 'translate3d(0, 0, 0)' };

  return el.animate(frames, { duration: span, delay: from, composite: 'add', fill: 'both' });
}

/**
 * How long a letter's shove lasts.
 *
 * Shorter than a piece's. There is less to a letter, so there is less to keep
 * it going, and the field has hold of it sooner.
 */
const LETTER_BLAST = 260;
/**
 * And how long the field takes to work its momentum off.
 *
 * Shorter than a piece's fight for the same reason the shove is shorter: there
 * is less of it, so there is less to argue with. The shape is identical —
 * still going outward, slowing the whole way, shuddering while the two forces
 * disagree.
 */
const LETTER_FIGHT = 1180;
const LETTER_OUT = LETTER_BLAST + LETTER_FIGHT;

/** Where a letter is aimed, and when. */
interface Throw {
  coast: number;
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
  const total = t.cd + PRELOAD_MS + LETTER_OUT + GRIP_LETTER_MS + t.home;
  const at = (ms: number) => ms / total;
  // Its block has been lifted by the pressure; this is the force arriving.
  const hit = t.cd + PRELOAD_MS;
  const struck = hit + LETTER_BLAST;
  const neutral = hit + LETTER_OUT;
  const released = neutral + GRIP_LETTER_MS;

  // Where the shove alone put it, and where its momentum carried it after.
  const shove =
    `translate3d(${(t.cx / t.coast).toFixed(2)}px, ${(t.cy / t.coast).toFixed(2)}px, 0) ` +
    `rotate(${(t.cr * 0.72).toFixed(2)}deg)`;
  const far = `translate3d(${t.cx.toFixed(2)}px, ${t.cy.toFixed(2)}px, 0) rotate(${t.cr.toFixed(2)}deg)`;

  return el.animate(
    [
      { transform: 'none', offset: 0, easing: 'linear' },
      // Untouched. The front arrives on this frame.
      { transform: 'none', offset: at(hit), easing: 'cubic-bezier(0.03, 0.85, 0.72, 0.958)' },
      // The end of the shove, and still going.
      { transform: shove, offset: at(struck), easing: 'cubic-bezier(0.3, 0.28, 0.55, 1)' },
      // Losing speed the whole way, and out of it here.
      { transform: far, offset: at(neutral), easing: 'linear' },
      // Held while the grip closes. Only the shudder moves it.
      { transform: far, offset: at(released), easing: 'cubic-bezier(0.5, 0, 0.3, 1)' },
      { transform: 'none', offset: 1 },
    ],
    { duration: total, fill: 'both' }
  );
}

/**
 * The kick the front gives a thing as it passes under it.
 *
 * The theme wipe's cue, aimed and turned into a bend. Its 620ms, its curve and
 * its 38% peak are kept exactly — someone who has switched the theme should
 * half-recognise this a beat before the force arrives and think *that language
 * again, and much more of it* — and everything else about it is scaled up
 * until it can actually be seen.
 *
 * Deliberately not scaled by weight, for once: the pressure ahead of a front
 * does not care what it is pushing, and it is the blast behind it that does.
 *
 * It runs on the frame the front arrives and the blast is a tenth of a second
 * behind it, so the order is legible: pressure, then force. Added on top of
 * whatever else is moving the element rather than replacing it.
 */
function lift(
  el: HTMLElement,
  at: number,
  nx = 0,
  ny = 0,
  force = 1,
  heft = 0,
  span = SWELL_MS
): Animation | null {
  if (!CAN_LAYER) return null;

  /*
   * Up, along, and bent — hard enough to be the thing you notice.
   *
   * What a front does to a flat panel is not lift it, it flexes it: the edge
   * the pressure reaches first tips away before the rest of the sheet knows
   * anything has happened, and the whole thing springs back as the front
   * passes through.
   *
   * The tilt is about the axis lying across the direction of travel — so the
   * element bends *towards where it is about to be thrown*, and the preload
   * and the blast are visibly the same force arriving twice rather than two
   * unrelated gestures. The perspective is what makes a rotation a bend at
   * all; without it these numbers are a squash, and 700px is close enough to
   * the page to make the far edge genuinely recede.
   */

  /*
   * How hard this one is bent, and the floor that stops it being a downgrade.
   *
   * `force` is the pressure still left where the element stands. It used to be
   * absent — every element took the same 15° whether it was under the click or
   * in the far corner, which is a page-wide flex rather than a front crossing
   * one — and the gradient is the whole of what makes it read as travelling.
   *
   * But a bare multiply makes most of the page bend *less* than it used to,
   * because pressure is below 1 everywhere except at the origin. So the
   * gradient runs from a floor rather than from nothing: at 0.6 the quietest
   * element on the page still gets 18° against the old flat 15°, and the ones
   * near the click get 30°. Every element bends more than it did, and there is
   * now half again as much difference between the near ones and the far ones
   * as there is bend at all. That is the point of the preload — it has to be
   * seen, on most of the page, before the shatter arrives.
   *
   * Weight is deliberately not in here, and was briefly: the note above about
   * the air ahead of a front not caring what it is pushing is right, and
   * scaling the flex by size took a full-width cover down to a third of the
   * turn — which is exactly the case where a bend is most visible and most
   * worth having. The throw already answers mass, twice, through `inertia` and
   * through the rotation. This does not need to.
   */
  const give = 0.6 + 0.4 * force;

  /*
   * And how much of that this particular thing gives up.
   *
   * A chip and a full-width cover do not flex alike — the small thing snaps
   * and the large one leans — so size comes back in here, which it did not
   * before. It is floored rather than scaled from zero for the same reason the
   * pressure is: a cover that barely creased was the one element on the page
   * the wave appeared not to touch, and a cover is the most visible surface
   * there is to bend.
   */
  const light = 1 - heft * 0.42;

  const px = nx * 46 * give * light;
  const py = (-84 + ny * 46) * give * light;
  const stretch = 1 + 0.105 * give * light;
  const degrees = 30 * give * (1 - heft * 0.34);

  const peak =
    `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) scale(${stretch.toFixed(3)}) ` +
    `perspective(700px) rotate3d(${(-ny).toFixed(3)}, ${nx.toFixed(3)}, 0, ${degrees.toFixed(1)}deg)`;

  /*
   * Braced, and then let go of slowly.
   *
   * The sheet dips a little the wrong way just before the front arrives — the
   * pressure ahead of a pulse pushes down before the crest lifts anything —
   * and that tiny counter-move is what makes the peak read as something
   * arriving rather than something starting. Then the fall is much longer than
   * the rise: a pulse has a near-vertical front and a decaying tail, and the
   * old shape came back as fast as it went, which is a pump rather than a
   * pressure wave.
   *
   * The offsets are the pressure curve of a decaying front, sampled: 85% of
   * peak already reached a twelfth of the way before the top, then 55%, 20%
   * and 5% on the way out. The peak stays at 0.38 because PRELOAD_MS is
   * derived from it and the blast has to land on that exact frame.
   */

  /*
   * Three positions and one curve, which is what it was before any of this.
   *
   * The version in between had seven keyframes — a brace, a sampled rise, a
   * hold, two decay points — and every junction between them was a place the
   * velocity changed abruptly. Sampling a curve and joining the samples with a
   * linear easing does not reproduce the curve, it reproduces a polyline, and
   * the eye reads the corners. One easing across the whole flight cannot have a
   * corner in it.
   *
   * So the shape is carried by the easing and the magnitude by the numbers
   * above. It rises slowly at first, is quickest through the middle, and is
   * still moving — barely — as it arrives at full bend on the frame the blast
   * lands. Then the same curve unwinds it over the remaining 62%, which is the
   * asymmetry a pulse has: a front that arrives and a pressure that decays.
   *
   * The brace is gone with the rest. It was four keyframes' worth of idea
   * spent on eight pixels in the wrong direction, and it cost a junction right
   * where the rise needed to be cleanest.
   */
  return el.animate(
    [
      { transform: 'translate3d(0, 0, 0) scale(1)', offset: 0 },
      { transform: peak, offset: 0.38 },
      { transform: 'translate3d(0, 0, 0) scale(1)', offset: 1 },
    ],
    {
      duration: span,
      delay: at,
      easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)',
      composite: 'add',
      fill: 'both',
    }
  );
}

/**
 * How long one element is torn for, start to recovered.
 *
 * The damage is not the event — the wave is — so this has to be over before
 * anyone has finished registering it. It was a hundred and fifty, which is
 * about four frames of break and four of recovery, and four frames turns out
 * to be under the floor: the whole thing happens during the lift, before the
 * shatter, while the impact flash is still up, and at that length nobody saw
 * it at all. Two hundred and forty is still short enough to be a fault in the
 * screen rather than an effect somebody chose, and long enough to be seen
 * being one.
 */
const TEAR_MS = 240;

/**
 * The most elements one run is allowed to tear.
 *
 * There are between forty and sixty candidates on this page and tearing all of
 * them is not a stronger effect, it is a broken monitor: every filter is a
 * separate offscreen pass, and every tear that fires wants a sound with it, so
 * the honest version of "all of them" is a smear with dozens of clicks over
 * it. Fourteen, spread across the whole crossing rather than bunched where the
 * pressure is highest, is what makes it read as damage travelling — and the
 * spread matters more than the number, because the slices with nothing in
 * them give up nothing.
 */
const TEAR_CAP = 12;

/**
 * The screen giving out where the front crosses it.
 *
 * Three levels of RGB separation defined once in the markup and cut between
 * here — not interpolated, because a glitch that eases is a dissolve. The
 * filter jumps to its worst on the frame the pressure arrives, drops, jumps
 * again, and is gone, and the element skips sideways with it along the
 * direction the wave is travelling.
 *
 * The cuts are timers writing `style.filter` rather than keyframes animating
 * it, and that is not a stylistic choice. WebKit does not interpolate a
 * `filter` value containing a `url()` reference at all — it drops the whole
 * animation — so the keyframe version of this worked in Chrome and did
 * literally nothing in Safari. A discrete property changing at four known
 * instants is a thing timers do exactly, in every engine, so this is both the
 * portable version and the honest one.
 *
 * The displacement stays a Web Animation: it is a transform, it composites
 * onto whatever else is moving the element, and it must not replace the lift
 * that is running underneath it.
 */

/**
 * Whether this engine gets the channels separated by paint rather than by a
 * filter graph.
 *
 * WebKit and Blink both parse `filter: url(#id)` and both claim to apply it,
 * and on this page only one of them puts colour on the screen. Two rounds have
 * now gone into finding out which WebKit rule is responsible — the lazily
 * built filter whose defining `<svg>` is not painted, the interpolation of a
 * `url()` value, the cost of the offscreen pass — and each answer improved
 * something without producing the separation. The next guess is not worth a
 * third round, because the fix does not depend on the answer: what these
 * elements need is a second way of drawing the effect that does not go through
 * a filter at all.
 *
 * So Blink keeps the filter, unchanged and byte for byte, and WebKit gets the
 * separation out of `text-shadow` instead.
 *
 * Sniffing an engine is normally the wrong instrument, and here it is the
 * right one: this is a known difference between two rendering paths and not a
 * feature either engine reports on. Everything on iOS is WebKit, including the
 * browsers that call themselves something else, and they all need this — which
 * is exactly what the test says.
 */
const PAINTED_TEAR = (() => {
  const ua = navigator.userAgent;
  return /AppleWebKit/.test(ua) && !/Chrom(e|ium)|Edg\//.test(ua);
})();

/**
 * How far the channels are pulled apart at each of the three levels.
 *
 * The same three distances the filters in the markup are built around, so the
 * two paths are the same effect drawn twice rather than two effects. Index by
 * level; index nought is unused and only there so the numbering matches
 * `dm-tear-1` through `dm-tear-3`.
 */
const SPLIT = [0, 4, 7, 10];

/**
 * The separation, as two coloured copies of every glyph.
 *
 * Not a fallback in the apologetic sense — for a page whose torn elements are
 * headings, labels, links and paragraphs, doubling the glyphs in red and cyan
 * is a *better* picture of a channel split than shifting the element's own
 * pixels is, because it survives at the small sizes where an offset of four
 * pixels inside a filter region is mostly the element's own background.
 *
 * `text-shadow` is inherited, which is what makes it usable here at all: the
 * storm has already split these blocks into one span per letter, and a value
 * written on the block reaches every one of them without touching any of them.
 * Removing it from the block removes it from all of them too.
 *
 * Zero blur on both, because a blurred copy is a glow and the thing being
 * described is a signal arriving twice.
 */
const fringe = (d: number) =>
  `${d}px 0 0 rgba(255, 42, 92, 0.92), ${-d}px 0 0 rgba(0, 228, 255, 0.86)`;

function tear(el: HTMLElement, at: number, sx: number, bite: number, sy = 0): Animation[] {
  if (!CAN_LAYER) return [];

  const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /*
   * Which of the three it reaches at its worst.
   *
   * `bite` is the pressure here as a share of the hardest-hit element in this
   * run, not the raw pressure — so the damage is heaviest where the front is
   * and lighter at the edges of the page, which is the same gradient the bend
   * runs on, and the worst of it always reaches the top of the scale. Against
   * absolute thresholds it did not: the portrait is the origin, everything
   * near it is excluded from the shatter for that reason, and the closest
   * thing left standing on this page measured 0.5 — so the heaviest filter of
   * the three was written, shipped, and never once applied.
   */
  const peak = quiet ? 1 : bite > 0.62 ? 3 : bite > 0.28 ? 2 : 1;
  const mid = Math.max(1, peak - 1);

  /*
   * Whatever it already had, kept.
   *
   * Nothing in the storm sets either of these today, but the page might: a
   * card with a drop shadow, a heading with a lift under its type. Replacing
   * it for a quarter of a second and then removing the property would take
   * that with it, so the separation is written in front of what is there.
   *
   * Only what is *inline* is read, on both paths. A value coming from the
   * stylesheet is not lost by an inline one being removed — it comes back on
   * its own — and reading the computed style of twelve elements in the middle
   * of the storm is a style recalculation nobody asked for.
   */
  const prop = PAINTED_TEAR ? 'text-shadow' : 'filter';
  const had = PAINTED_TEAR ? el.style.textShadow : el.style.filter;

  /*
   * One pass, and no more than one — whichever pass this engine is getting.
   *
   * A pair of coloured `drop-shadow()` filters was briefly added *alongside*
   * the reference filter, on the theory that Safari needed something plain to
   * fall back on. That failed twice over: two more full filter passes per
   * element is measurably slower on WebKit's SVG filter path, and a drop
   * shadow is a coloured copy of the element's silhouette, so it fringes an
   * outline and leaves a button's label — most of what the effect is for —
   * completely untouched.
   *
   * The two paths here are alternatives rather than layers. Blink resolves one
   * reference filter and nothing else; WebKit writes one `text-shadow` and no
   * filter at all, so it never builds an offscreen pass for this and the cost
   * question that started the whole investigation does not arise.
   */
  const wear = (n: number) => {
    const one = PAINTED_TEAR ? fringe(SPLIT[n]) : `url(#dm-tear-${n})`;
    el.style.setProperty(prop, had ? `${one}${PAINTED_TEAR ? ',' : ''} ${had}` : one);
  };
  const clear = () => {
    if (had) el.style.setProperty(prop, had);
    else el.style.removeProperty(prop);
  };

  touched.push(el);
  undo(clear);

  /*
   * Reduced motion keeps the fringe and loses the fit.
   *
   * Somebody who has asked for less motion has not asked for less colour —
   * the separation is not movement — but three hard cuts and a sideways jump
   * plainly are. So it appears once, at its mildest, and there is nothing to
   * translate.
   */
  if (quiet) {
    after(at, () => wear(1));
    after(at + TEAR_MS, clear);
    return [];
  }

  /*
   * Cut, cut, gone.
   *
   * Three instants rather than a curve, and the uneven gaps are what stop the
   * flicker having a rhythm. There were four; the one dropped was a second
   * return to the peak, which is a frame nobody picks out of a quarter-second
   * burst and a fourth rebuild of the filter for every torn element. Every
   * style change here makes the engine resolve the reference again, so the
   * count is a cost as much as it is a shape.
   */
  after(at, () => wear(peak));
  after(at + TEAR_MS * 0.3, () => wear(mid));
  after(at + TEAR_MS * 0.56, () => wear(peak));
  after(at + TEAR_MS, clear);

  /*
   * Three to seven pixels, on the same gradient as everything else here.
   *
   * Floored rather than scaled from nothing, for the reason the bend's own
   * `give` is: a bare multiply puts most of the page at the bottom of the
   * range, and the bottom of this range is a displacement nobody can see in
   * the few frames it is on screen. The far corner still moves less than the
   * near one — there is just no longer a version of this that does not move.
   */
  const amp = 3 + 4 * Math.max(0, Math.min(1, bite));

  /*
   * And a little of it downward, or none at all.
   *
   * The front's tears are purely sideways, because a pressure wave crossing a
   * screen displaces along its own direction and nothing else. The settle at
   * the end passes a fraction here, and that fraction is most of what makes
   * the second glitch read as a different event rather than the first one
   * played again — a frame that slips both ways is a signal breaking up, not
   * something being pushed.
   */
  const drop = amp * sy;

  // The same four instants the filter cuts on, so the skip and the separation
  // are one event. `steps(1)` holds each value for the whole of its interval.
  const cut = 'steps(1, end)';

  const step = (x: number, y: number) => `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;

  const slipped = el.animate(
    [
      { offset: 0, transform: step(0, 0), easing: cut },
      { offset: 0.04, transform: step(sx * amp, -drop), easing: cut },
      { offset: 0.3, transform: step(-sx * amp * 0.45, drop * 0.6), easing: cut },
      { offset: 0.56, transform: step(sx * amp * 0.72, -drop * 0.3), easing: cut },
      { offset: 1, transform: step(0, 0) },
    ],
    { duration: TEAR_MS, delay: at, composite: 'add', fill: 'none' }
  );

  return [slipped];
}

/**
 * Picks which fourteen, and cracks the speaker for each one.
 *
 * The first version of this sorted by arrival and took every fourth, which is
 * only an even spread if the arrivals are evenly spaced — and they are not.
 * Most of a page sits at a similar radius from the portrait, so a stride
 * through the sorted list handed back four tears bunched in the first quarter
 * of the crossing and nothing at all after it.
 *
 * So the crossing is divided into fourteen equal slices of time and each
 * slice gives up its hardest-hit element. The damage then arrives at a steady
 * rate from the first frame of the front to the last, which is what "it
 * travels with the wave" means, and each tear is the worst one available where
 * it is, which is what keeps the gradient across the page.
 */
function damage(
  candidates: Array<{ el: HTMLElement; at: number; sx: number; force: number }>,
  fire: (strength: number) => void
): Animation[] {
  if (!CAN_LAYER || !candidates.length) return [];

  let first = Infinity;
  let last = -Infinity;
  for (const one of candidates) {
    if (one.at < first) first = one.at;
    if (one.at > last) last = one.at;
  }

  const span = Math.max(1, last - first);
  const picked: Array<{ el: HTMLElement; at: number; sx: number; force: number }> = [];

  for (const one of candidates) {
    const slice = Math.min(TEAR_CAP - 1, Math.floor(((one.at - first) / span) * TEAR_CAP));
    const held = picked[slice];
    if (!held || one.force > held.force) picked[slice] = one;
  }

  /*
   * The hardest hit in this run, which the rest are graded against.
   *
   * Relative rather than absolute because the page decides what "near" means:
   * the portrait is the origin and everything around it is deliberately not in
   * the shatter, so the closest element that is left is already well down the
   * falloff. Grading against it puts the worst damage at the top of the scale
   * on every page and every viewport, and keeps the gradient out to the edges.
   */
  let strongest = 0;
  for (const one of picked) if (one && one.force > strongest) strongest = one.force;

  const made: Animation[] = [];
  broke = [];

  for (const one of picked) {
    if (!one) continue;
    const bite = strongest ? one.force / strongest : 1;
    broke.push({ el: one.el, sx: one.sx, bite });
    made.push(...tear(one.el, one.at, one.sx, bite));
    /*
     * The crackle belongs to the frame the screen actually breaks, not to the
     * schedule — which is why it is fired from here rather than placed with
     * the wave. The sound throttles itself: fourteen tears across three
     * hundred milliseconds is one every twenty-odd, and `crackle` refuses
     * anything inside forty, so a third of them are heard and the rest are
     * only seen. That is the layering the effect needs — a few cracks over a
     * continuous front, rather than one click per broken thing.
     */
    after(one.at, () => fire(one.force));
  }

  return made;
}

/**
 * How far apart the second glitch is allowed to spread.
 *
 * Nearly nothing, and that is the point. The first one travels, because a
 * front travels; this one is the whole frame failing at once, so the elements
 * are only jittered off each other enough that fourteen of them do not look
 * like one switch being thrown.
 */
const SETTLE_SPREAD = 110;

/**
 * The whole of the second glitch, from the first element to the clean frame.
 *
 * The scatter, plus the portrait's own late one, plus the length of a tear.
 * Derived rather than typed, because the purple has to leave him after it and
 * a number written down here would be wrong the first time TEAR_MS moved.
 */
const SETTLE_MS = SETTLE_SPREAD + 40 + TEAR_MS;

/**
 * The screen not quite over it.
 *
 * Everything is home, nothing is moving, and for a third of a second the
 * picture breaks up anyway — then it is clean and the purple leaves the
 * portrait. It is the last beat of the story rather than an extra effect: the
 * page has been put back, and the display it was put back on is still
 * recovering from what crossed it.
 *
 * Three things separate it from the tear that came with the wave. It does not
 * travel — the delays are a scatter, not a sweep. It slips vertically as well
 * as sideways, which is a signal breaking up rather than something being
 * shoved. And every element is thrown the other way from the way the front
 * threw it, so the frame snaps back rather than repeating itself.
 *
 * The portrait goes last and hardest, and it is the reason the beat exists
 * here at all: he is the one still holding the field, so the screen fails on
 * him a moment before he lets it go.
 */
function resettle(who: HTMLElement | null, fire: (strength: number) => void): Animation[] {
  if (!CAN_LAYER || !broke.length) return [];

  const order = broke
    .map((one) => ({ ...one, at: Math.round(Math.random() * SETTLE_SPREAD) }))
    .sort((a, b) => a.at - b.at);

  // Him last, and at the top of the scale whatever the page did.
  if (who) order.push({ el: who, sx: Math.random() < 0.5 ? -1 : 1, bite: 1, at: SETTLE_SPREAD + 40 });

  const made: Animation[] = [];
  let last = -Infinity;

  for (const one of order) {
    /*
     * Floored at a third, unlike the front.
     *
     * Out at the edges of the page the wave had almost nothing left, and the
     * gradient is right for a front arriving. Nothing is arriving now — the
     * screen is failing, and a screen fails all over.
     */
    made.push(...tear(one.el, one.at, -one.sx, Math.max(0.34, one.bite * 0.9), 0.42));

    if (one.at - last >= 40) {
      last = one.at;
      fireAt(one.at, one.bite * 0.55, fire);
    }
  }

  return made;
}

/** A crackle placed on the storm's own timer, so teardown takes it with it. */
function fireAt(at: number, strength: number, fire: (strength: number) => void): void {
  after(at, () => fire(strength));
}

/**
 * What the storm feels like through a phone.
 *
 * The Vibration API has no amplitude — only on and off, in milliseconds — so
 * weight has to be spelled with duration and density. A long unbroken pulse is
 * heavy; short ones spaced out are light; short ones packed together are a
 * texture rather than a hit. That is the whole vocabulary, and it turns out to
 * be enough for the four things this sequence actually does.
 *
 * Built from the same constants the picture is, so retiming the storm retimes
 * the hand holding it. The one liberty is the tail: the way home has no haptic
 * at all. Nothing is hitting the phone by then — the field is carrying things
 * carefully back — and buzzing through that would say the opposite of what the
 * picture says.
 */
export function shockPattern(): number[] {
  const out: number[] = [];

  /*
   * The pressure. Four faint taps across the bend, which is as close as this
   * API gets to something building: each is barely long enough to register on
   * its own, and together they read as a rise.
   */
  const taps = 4;
  const gap = Math.max(4, Math.round(PRELOAD_MS / taps) - 8);
  for (let i = 0; i < taps; i += 1) out.push(8, gap);

  // The blast. One long pulse, and by a distance the longest thing here.
  out.push(110, 60);

  /*
   * The fight, decaying. Eleven pulses that get shorter and further apart as
   * the momentum is worked off — the same shape the speed graph has, told with
   * the only two numbers this API has.
   */
  const beats = 11;
  for (let i = 0; i < beats; i += 1) {
    const left = 1 - i / beats;
    out.push(Math.max(6, Math.round(34 * left * left)), Math.round(FIGHT_MS / beats));
  }

  /*
   * The grip closing. A fine tremor: very short, very close together, so it
   * reads as a texture rather than as a series of taps — the hand's version of
   * the shudder on screen, and exactly as long as it.
   */
  const shivers = Math.round(GRIP_MS / 44);
  for (let i = 0; i < shivers; i += 1) out.push(7, 37);

  return out;
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
  // Nothing else holds these, and holding them would keep a whole page of
  // detached elements alive until the next run.
  broke = [];

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

/** The last arc slot that was actually drawn, so each one sounds once. */
let onArc: ((strength: number) => void) | null = null;
/** Fired once per torn element, so the sound can crack where the screen does. */
let onTear: ((strength: number) => void) | null = null;
/**
 * And the same for the last glitch, which is a separate voice.
 *
 * Two listeners rather than one with a flag, because the two are not the same
 * sound at different levels — the front's tears are contacts arcing and the
 * one at the end is the frame itself giving out. Keeping them apart here is
 * what lets the sound module say that in the buffers rather than in a branch.
 */
let onFault: ((strength: number) => void) | null = null;

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
/**
 * When the field is allowed to draw, and for how long.
 *
 * Absolute timestamps, set by run() from the flights it has just built.
 */
let armedFrom = 0;
let armedTo = 0;

/** Ninety milliseconds of ramp at each end, so it never clicks on or off. */
const ARC_EDGE = 90;

/**
 * How much electricity there is right now.
 *
 * Only while things are being held. The arcs are the visible evidence of a
 * grip, and a grip is a thing that exists between the moment the outward speed
 * reaches zero and the moment the pull starts — so before that they were
 * decorating a shove nothing was holding, and after it they were decorating a
 * journey home that needs no explaining. Either way they were saying something
 * the picture was not doing.
 *
 * Both edges are ramped inside the window rather than either side of it, so
 * the arcs are at nothing on the frame the grip opens and closes.
 */
function power(now: number): number {
  if (armedFrom) {
    if (now < armedFrom || now > armedTo) return 0;
    const edge = Math.min(now - armedFrom, armedTo - now);
    return Math.max(0, Math.min(1, edge / ARC_EDGE));
  }

  if (!decayFrom) return 1;
  const t = Math.min(1, (now - decayFrom) / DECAY_MS);
  return Math.max(0, Math.pow(1 - t, 1.7));
}

/** Hands the field the window it is allowed to be electric in. */
export function armField(from: number, to: number): void {
  armedFrom = from;
  armedTo = to;
}

/** Starts the field exhausting itself. */
export function beginDecay(): void {
  if (!decayFrom) decayFrom = performance.now();
}

export function setArcListener(fn: ((strength: number) => void) | null): void {
  onArc = fn;
}

export function setTearListener(fn: ((strength: number) => void) | null): void {
  onTear = fn;
}

/**
 * Who to tell when the screen gives out for the last time.
 *
 * Called at the instant each element reaches its worst separation — the frame
 * the filter is written, not the frame its window opens — so the crack and the
 * peak are one event rather than two that happen to be close.
 */
export function setFaultListener(fn: ((strength: number) => void) | null): void {
  onFault = fn;
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
  armedFrom = 0;
  armedTo = 0;
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

  // Seeds the jitter on every arc drawn below. The sound is fired from the
  // draw itself, further down, and not from here.
  const step = Math.floor(now / 130);

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

    /*
     * The strike sounds here, because here is where there is one.
     *
     * It used to fire from a clock at the top of this function, on every turn
     * of the slot — and a slot does not always draw anything. The long reaches
     * out of the character are dropped once the power is under 0.55, and any
     * arc whose envelope has faded below a hundredth is skipped as well, so a
     * good part of what was heard was electricity with no lightning under it.
     * Past the decay it was most of it.
     *
     * Now it is the last thing before the stroke and after every test that can
     * refuse one: one sound per arc, on the frame the arc appears, and silence
     * when nothing is being drawn.
     */
    if (slot !== lastSlot) {
      lastSlot = slot;
      onArc?.(alpha / 0.42);
    }

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
