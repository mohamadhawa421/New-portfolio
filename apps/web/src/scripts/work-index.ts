/**
 * Which project the selected-work frame is showing.
 *
 * Two things change it and nothing else does: pointing at a row, and focusing
 * one with the keyboard. Scrolling never does.
 *
 * That last sentence used to be the opposite, and it was wrong. The frame
 * followed whichever row sat at reading height, on the theory that a visitor
 * who never moves the mouse should still see the work change on the way past.
 * In use it reads as the section changing its mind: the picture swaps while
 * you are reading, nothing you did caused it, and on a wheel it fires several
 * times a second. A preview should answer a question the visitor asked, and
 * scrolling is not a question. There is no scroll listener in this file.
 *
 * The frame is `position: sticky`, so it stays in view while the list moves
 * past it — the browser does that on its own, with nothing here involved.
 */

/** Matches the CSS: below this there is no frame and no mechanism. */
const WIDE = '(min-width: 901px)';

/** The travel of the push, as a fraction of the frame's height. */
const PUSH = 0.07;

/** One change, and the same curve every other travel on this site uses. */
const SWAP_MS = 480;
const GLIDE = 'cubic-bezier(0.33, 0.02, 0.18, 1)';

const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = (): boolean => window.matchMedia(WIDE).matches;

let rows: HTMLElement[] = [];
let frames: HTMLElement[] = [];
let caps: HTMLElement[] = [];
let inlines: HTMLElement[] = [];
let active = -1;
let flights: Animation[] = [];

function collect(): boolean {
  const root = document.querySelector('[data-work-index]');
  if (!root) {
    rows = frames = caps = inlines = [];
    return false;
  }
  rows = Array.from(root.querySelectorAll<HTMLElement>('[data-work-row]'));
  frames = Array.from(root.querySelectorAll<HTMLElement>('[data-work-frame]'));
  caps = Array.from(root.querySelectorAll<HTMLElement>('[data-work-caption] > *'));
  inlines = Array.from(root.querySelectorAll<HTMLElement>('[data-work-inline]'));
  return rows.length > 0;
}

/**
 * Hands `data-morph` to whichever element is actually on screen.
 *
 * `chrome.ts` finds the shared-element source by slug, and two elements
 * answering to one slug would be given the same `view-transition-name` —
 * which makes the browser drop the transition rather than pick one. So the
 * sticky frames own the attribute on a wide screen and the rows' own pictures
 * own it on a narrow one, and never both.
 */
function assignMorph(): void {
  const toFrames = wide();
  for (const el of frames) {
    if (toFrames) el.setAttribute('data-morph', '');
    else el.removeAttribute('data-morph');
  }
  for (const el of inlines) {
    if (toFrames) el.removeAttribute('data-morph');
    else el.setAttribute('data-morph', '');
  }
}

/**
 * Writes which entry is current, and moves nothing.
 *
 * Takes its lists as arguments so the same rule can be applied to a document
 * that is not live yet — that is how the return trip prepares the page it is
 * about to arrive on.
 */
function paint(next: number, list = rows, pics = frames, captions = caps): void {
  for (const [i, el] of list.entries()) {
    const on = i === next ? 'yes' : 'no';
    el.dataset.active = on;
    // The highlight is drawn by the list item, which is the full width of the
    // column. See the component's `.index__item`.
    if (el.parentElement) el.parentElement.dataset.active = on;
  }
  for (const [i, el] of pics.entries()) el.dataset.active = i === next ? 'yes' : 'no';
  for (const [i, el] of captions.entries()) el.dataset.active = i === next ? 'yes' : 'no';
}

/**
 * Moves the picture, in the direction the eye is already travelling.
 *
 * Going down the list pushes the new frame up from below and the old one out
 * of the top, and going back up reverses it — so the change reads as the list
 * moving past a window rather than as two pictures dissolving. Transform and
 * opacity only, which is what keeps it on the compositor; the distance is
 * deliberately small, because this is a change of subject and not a journey.
 *
 * No `fill`. The CSS is what a frame is between changes, so a cancelled or
 * finished animation leaves nothing behind to reset — the same reason the
 * rest of this codebase animates that way.
 */
function show(next: number): void {
  if (next === active || next < 0 || next >= frames.length) return;

  const from = active;
  active = next;
  const down = from === -1 ? true : next > from;

  paint(next);

  if (!wide()) return;

  for (const flight of flights) flight.cancel();
  flights = [];

  if (reduced()) return;

  const enter = frames[next];
  const leave = from >= 0 ? frames[from] : null;
  const d = down ? 1 : -1;

  flights.push(
    enter.animate(
      [
        { opacity: 0, transform: `translate3d(0, ${d * PUSH * 100}%, 0)` },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ],
      { duration: SWAP_MS, easing: GLIDE }
    )
  );

  if (leave) {
    /*
     * The outgoing frame has to be told to stay visible while it leaves —
     * its `data-active` is already `no`, so the stylesheet has it at zero
     * opacity and the animation's first keyframe is what puts it back for
     * the length of the move.
     */
    flights.push(
      leave.animate(
        [
          { opacity: 1, transform: 'translate3d(0, 0, 0)' },
          { opacity: 0, transform: `translate3d(0, ${-d * PUSH * 100}%, 0)` },
        ],
        { duration: SWAP_MS, easing: GLIDE }
      )
    );
  }
}

/** The project a `/work/<slug>` path is about, or null. */
function slugOf(path: string): string | null {
  const m = /^\/work\/([^/]+)\/?$/.exec(path);
  return m ? m[1] : null;
}

export function bindWorkIndex(): void {
  const start = (): void => {
    if (!collect()) return;
    assignMorph();

    /*
     * An index arriving with a frame already marked was prepared by the
     * before-swap below, which means the visitor is coming back from that
     * project. Adopt it rather than resetting to the first: the morph has
     * just put that picture on screen and pushing away from it would undo
     * the landing.
     */
    const prepared = frames.findIndex((f) => f.dataset.active === 'yes');
    if (prepared > 0) {
      active = prepared;
      return;
    }

    active = -1;
    show(0);
  };

  /*
   * Hover means the pointer moved. It does not mean a row arrived under it.
   *
   * This was `pointerover`, and that is wrong on a wheel: scrolling with the
   * pointer parked over the list slides row after row underneath a cursor
   * that has not moved a pixel, and the browser fires a boundary event for
   * every one of them. The frame then changed project several times a second
   * while the visitor was only scrolling the page.
   *
   * A real movement is the test — the coordinates have to differ from the
   * last ones seen. Chrome does emit a `pointermove` after a scroll to
   * refresh the hover state, but it carries the same `clientX`/`clientY`, so
   * comparing them separates a hand from a wheel with no timers and no
   * heuristics. That, and there being no scroll listener anywhere in this
   * file, is what leaves the frame alone while the page moves.
   */
  let lastX = -1;
  let lastY = -1;

  document.addEventListener(
    'pointermove',
    (event) => {
      const moved = event.clientX !== lastX || event.clientY !== lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      if (!moved) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest<HTMLElement>('[data-work-row]');
      if (!row) return;

      show(Number(row.dataset.i) || 0);
    },
    { passive: true }
  );

  /* A keyboard walking the list takes the picture with it. */
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest<HTMLElement>('[data-work-row]');
    if (!row) return;
    show(Number(row.dataset.i) || 0);
  });

  /*
   * A press settles the frame before the navigation reads it.
   *
   * On a wide screen it is already right, because pointing at the row is what
   * put it there. This covers a click with no pointer movement first, and
   * anything synthetic. `pointerdown` is before the click that starts the
   * navigation, so `applyMorphName` finds the frame already correct.
   */
  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest<HTMLElement>('[data-work-row]');
    if (!row) return;
    show(Number(row.dataset.i) || 0);
  });

  /*
   * The way back, prepared on the document that is arriving.
   *
   * Coming home from a project, `chrome.ts` names the incoming counterpart
   * inside `astro:after-swap` — and that fires before this module's
   * `astro:page-load`, so on arrival nothing carried `data-morph` yet and the
   * return found no element to fly into. The picture simply appeared.
   *
   * `astro:before-swap` hands over the incoming document before it is live,
   * which is early enough to fix both halves of that: the right elements get
   * `data-morph`, and the frame for the project being left is made the
   * visible one. So the cover flies back to exactly the slot it came out of,
   * already showing the right picture, and the list underneath is already
   * pointing at the same row.
   */
  document.addEventListener('astro:before-swap', (event) => {
    const swap = event as unknown as { newDocument?: Document; from?: URL };
    const doc = swap.newDocument;
    if (!doc) return;
    const root = doc.querySelector('[data-work-index]');
    if (!root) return;

    const nextRows = Array.from(root.querySelectorAll<HTMLElement>('[data-work-row]'));
    const nextFrames = Array.from(root.querySelectorAll<HTMLElement>('[data-work-frame]'));
    const nextCaps = Array.from(root.querySelectorAll<HTMLElement>('[data-work-caption] > *'));
    const nextInlines = Array.from(root.querySelectorAll<HTMLElement>('[data-work-inline]'));

    const toFrames = wide();
    for (const el of nextFrames) {
      if (toFrames) el.setAttribute('data-morph', '');
      else el.removeAttribute('data-morph');
    }
    for (const el of nextInlines) {
      if (toFrames) el.removeAttribute('data-morph');
      else el.setAttribute('data-morph', '');
    }

    /*
     * Which project are we walking back out of?
     *
     * From the event, not from `location`. By the time this fires the address
     * bar is already showing the page being arrived at, so asking the window
     * returns "/" and the answer is always null.
     */
    const slug = slugOf(swap.from?.pathname ?? '');
    if (!slug) return;
    const at = nextFrames.findIndex((f) => f.dataset.slug === slug);
    if (at < 0) return;

    paint(at, nextRows, nextFrames, nextCaps);
  });

  /*
   * Crossing the breakpoint changes which element owns the morph, and a
   * rotated phone that kept the frame's copy would navigate without one.
   */
  window.addEventListener('resize', assignMorph);

  document.addEventListener('astro:page-load', start);
  start();
}
