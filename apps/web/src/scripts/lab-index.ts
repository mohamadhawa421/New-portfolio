/**
 * The two things the Lab index cannot do in CSS.
 *
 * Quietening the rows around the one being pointed at is a hover state and
 * lives in the stylesheet, as a `:has()` rule with no listener behind it. What
 * is left is which frame is showing — a stylesheet cannot map row 3 to figure 3
 * without a rule per row — and the filter, which has to move things that are
 * staying as well as hide things that are going.
 *
 * Listeners go on `document`, never on an element inside the page: the client
 * router replaces the page on every navigation, so an element binding is a
 * binding to a node that is about to be detached, and one guarded to run once
 * per tab never comes back. See CLAUDE.md.
 */

/** Matches the CSS. Below this there is no frame and no mechanism. */
const WIDE = '(min-width: 901px)';

/** The leave, then the move. Both shorter than the site's 460ms reveal: this
 *  is a rearrangement of things already read, not an arrival. */
const LEAVE_MS = 180;
const MOVE_MS = 420;
const GLIDE = 'cubic-bezier(0.33, 0.02, 0.18, 1)';

const still = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const wide = (): boolean => window.matchMedia(WIDE).matches;

const root = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-lab-index]');

/* ------------------------------------------------------------------ */
/* Which frame is showing                                              */
/* ------------------------------------------------------------------ */

/**
 * Shows the frame belonging to a row, and only ever one.
 *
 * Driven by pointer and focus, never by scroll — the same decision, for the
 * same reason, as `work-index.ts`: a preview should answer a question the
 * visitor asked, and scrolling is not a question.
 */
function show(index: string | null): void {
  const host = root();
  if (!host || !wide()) return;

  const frames = host.querySelectorAll<HTMLElement>('[data-lab-frame]');
  if (!frames.length) return;

  /*
   * A row that has been filtered out takes its frame with it, so the target
   * falls back to the first frame still on the page rather than to none —
   * otherwise clearing a hover after a filter leaves the column empty.
   */
  let matched = false;
  for (const frame of frames) {
    const on = frame.dataset.i === index && !frame.hidden;
    frame.classList.toggle('lab-frame--on', on);
    if (on) matched = true;
  }

  if (matched) return;

  const first = Array.from(frames).find((frame) => !frame.hidden);
  for (const frame of frames) frame.classList.toggle('lab-frame--on', frame === first);
}

/** The row a pointer or focus landed in, if it landed in one. */
function rowOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-lab-row]') : null;
}

document.addEventListener(
  'pointerover',
  (event) => {
    const row = rowOf(event.target);
    if (row) show(row.dataset.i ?? null);
  },
  { passive: true }
);

document.addEventListener(
  'focusin',
  (event) => {
    const row = rowOf(event.target);
    if (row) show(row.dataset.i ?? null);
  },
  { passive: true }
);

/*
 * Leaving the list restores the lead rather than blanking the column.
 *
 * An empty frame beside a full list reads as something having failed. `null`
 * finds no match and falls through to the first row still on the page, which
 * is the state the page loaded in.
 */
document.addEventListener(
  'pointerleave',
  (event) => {
    const target = event.target;
    if (target instanceof Element && target.matches('[data-lab-index] .lab-index__list')) {
      show(null);
    }
  },
  { capture: true, passive: true }
);

/* ------------------------------------------------------------------ */
/* The filter                                                          */
/* ------------------------------------------------------------------ */

/** Cancelled when a second press lands before the first has finished. */
let flights: Animation[] = [];
let era = 0;

function settle(): void {
  era += 1;
  for (const flight of flights) {
    try {
      flight.cancel();
    } catch {
      /* already gone with its element */
    }
  }
  flights = [];
}

/**
 * Applies a filter, moving what stays and fading what goes.
 *
 * The same order the Work grid uses, for the same reason: the rows that are
 * leaving fade *where they stand*, with the layout still the old one, and only
 * then does everything else close the gap. Hiding and moving in one step reads
 * as the list flinching.
 */
function applyFilter(value: string, animate: boolean): void {
  const host = root();
  if (!host) return;

  const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-lab-row]'));
  const frames = Array.from(host.querySelectorAll<HTMLElement>('[data-lab-frame]'));
  const empty = host.querySelector<HTMLElement>('[data-lab-empty]');
  const tally = host.querySelector<HTMLElement>('[data-lab-tally]');

  const wanted = new Map<HTMLElement, boolean>();
  for (const row of rows) {
    const kinds = (row.dataset.kinds || '').split('|').filter(Boolean);
    wanted.set(row, value === 'All' || kinds.includes(value));
  }
  const shown = rows.filter((row) => wanted.get(row)).length;

  /** Everything that is true once the change has landed, however it landed. */
  const land = (): void => {
    for (const row of rows) row.hidden = !wanted.get(row);
    for (const frame of frames) {
      const row = rows.find((candidate) => candidate.dataset.i === frame.dataset.i);
      frame.hidden = Boolean(row && !wanted.get(row));
    }
    if (empty) empty.hidden = shown > 0;
    if (tally) tally.textContent = `${shown} ${shown === 1 ? 'experiment' : 'experiments'}`;
    show(null);
  };

  settle();

  if (!animate || still() || typeof host.animate !== 'function') {
    land();
    return;
  }

  const token = era;
  const before = rows.filter((row) => !row.hidden);
  const leaving = before.filter((row) => !wanted.get(row));
  const entering = rows.filter((row) => row.hidden && wanted.get(row));

  if (!leaving.length && !entering.length) {
    land();
    return;
  }

  /* First: where everything that survives is standing now. */
  const from = new Map<HTMLElement, number>();
  for (const row of before) {
    if (wanted.get(row)) from.set(row, row.getBoundingClientRect().top);
  }

  for (const row of leaving) {
    flights.push(
      row.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: LEAVE_MS,
        easing: 'ease-out',
        fill: 'forwards',
      })
    );
  }

  window.setTimeout(() => {
    if (token !== era) return;

    /* Last. */
    land();

    /*
     * Invert and play, on the vertical only.
     *
     * This is a single column, so nothing ever moves sideways — measuring one
     * number per row instead of a rectangle is the whole difference between
     * this and the Work grid's FLIP, and it is why there is no matrix
     * arithmetic in here.
     */
    for (const row of rows) {
      if (row.hidden) continue;
      const start = from.get(row);
      const now = row.getBoundingClientRect().top;

      if (start === undefined) {
        // New to the list: it arrives rather than travels.
        flights.push(
          row.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: MOVE_MS,
            easing: GLIDE,
          })
        );
        continue;
      }

      const shift = start - now;
      if (Math.abs(shift) < 1) continue;

      flights.push(
        row.animate(
          [
            { transform: `translate3d(0, ${shift}px, 0)` },
            { transform: 'translate3d(0, 0, 0)' },
          ],
          { duration: MOVE_MS, easing: GLIDE }
        )
      );
    }
  }, LEAVE_MS);
}

/** Presses a chip, and lets the rest follow from that. */
function press(value: string, animate: boolean): void {
  const host = root();
  if (!host) return;

  for (const chip of host.querySelectorAll<HTMLElement>('[data-lab-filter]')) {
    const on = chip.dataset.labFilter === value;
    chip.classList.toggle('chip--on', on);
    chip.setAttribute('aria-pressed', String(on));
  }

  applyFilter(value, animate);
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const chip = target.closest<HTMLElement>('[data-lab-filter]');
  if (!chip) return;

  const value = chip.dataset.labFilter || 'All';

  /*
   * The filter lives in the URL, so the back button and a shared link both
   * land on what was being looked at. `replaceState` rather than `pushState`:
   * pressing four chips in a row should not put four entries in the history
   * between the visitor and the page they came from.
   */
  const url = new URL(window.location.href);
  if (value === 'All') url.searchParams.delete('kind');
  else url.searchParams.set('kind', value);
  window.history.replaceState(window.history.state, '', url);

  press(value, true);
});

/* ------------------------------------------------------------------ */
/* Arrival                                                             */
/* ------------------------------------------------------------------ */

/**
 * Restores the filter from the URL, without animating it.
 *
 * A page that opens mid-rearrangement is a page that looks broken for four
 * hundred milliseconds. The state it arrives in is simply the state.
 */
function arrive(): void {
  const host = root();
  if (!host) return;

  const kind = new URL(window.location.href).searchParams.get('kind');
  const known = kind
    ? host.querySelector(`[data-lab-filter="${CSS.escape(kind)}"]`)
    : null;

  if (known) press(kind as string, false);
  else show(null);
}

document.addEventListener('astro:page-load', arrive);

/*
 * The frame column is `display: none` below 901px, so a resize across that
 * line arrives with nothing showing. One listener, and it only ever picks the
 * lead — following the pointer through a resize is not a thing anyone does.
 */
window.addEventListener('resize', () => show(null), { passive: true });
