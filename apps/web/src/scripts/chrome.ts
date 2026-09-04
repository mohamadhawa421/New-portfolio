/**
 * Page chrome: reveal-on-scroll, counting numbers, and the nav pill that
 * condenses and inverts over dark sections.
 *
 * Ported from `installChromeDriver` in the Claude Design prototype. Two
 * deliberate changes:
 *
 *  - Reveals use IntersectionObserver rather than measuring on every scroll.
 *    Besides being cheaper, it still fires in a backgrounded tab, where
 *    requestAnimationFrame is throttled to nothing — a page opened in a
 *    background tab would otherwise stay blank until the visitor scrolled.
 *  - The nav still needs the scroll position, so that keeps a scroll listener,
 *    throttled through rAF.
 */

const root = document.documentElement;
const styles = root.style;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A touch screen scrolls faster than a wheel, and a reveal that only starts
 * once an element is already well inside the viewport is still running when
 * the element has passed the middle of the screen — which reads as a card that
 * arrives late rather than one that arrives.
 *
 * On a coarse pointer the trigger moves to the viewport edge, so the entrance
 * has the whole height of the screen to play out in.
 */
const coarse = window.matchMedia('(pointer: coarse)').matches;

/** How far into the viewport an element's top has to come to be revealed. */
const REVEAL_AT = coarse ? 0.995 : 0.94;

/**
 * The glass blur behind the condensed nav.
 *
 * On a phone this is a full-width bar, and a backdrop filter is re-applied on
 * every frame of every scroll — at three times the device pixel ratio it is
 * comfortably the most expensive thing on the page. The radius is what that
 * costs, and on a 68px strip the difference between 20 and 12 is not something
 * anyone can see. Desktop, where the same bar is a small centred pill over a
 * discrete GPU, keeps the original.
 */
const NAV_BLUR_PX = coarse ? 12 : 20;

const REVEAL_SELECTOR = '[data-reveal],[data-rise],[data-num]';

/** Longest reveal transition in global.css, used to know when a stagger is spent. */
const REVEAL_MS = 700;

/** Counts a figure up from zero, keeping any prefix/suffix around it ("20+"). */
function rollNumber(el: HTMLElement): void {
  const final = el.dataset.numFinal ?? (el.dataset.numFinal = el.textContent ?? '');
  const match = final.match(/[\d.,]+/);
  if (!match) return;

  const target = parseFloat(match[0].replace(/,/g, ''));
  if (!Number.isFinite(target) || target <= 0 || reduced) {
    el.textContent = final;
    return;
  }

  const start = performance.now();
  const duration = 800;

  const step = (now: number) => {
    const k = Math.min(1, (now - start) / duration);
    if (k < 1) {
      const eased = Math.round(target * (1 - Math.pow(1 - k, 4)));
      el.textContent = final.replace(match[0], eased.toLocaleString('en-US'));
      requestAnimationFrame(step);
    } else {
      el.textContent = final;
    }
  };

  requestAnimationFrame(step);
}

/**
 * Runs the entrance: applies the stagger, then drops [data-hidden] so the
 * transition in global.css plays.
 *
 * Separate from show() because priming needs to claim an element now but
 * reveal it a frame later — see primePage.
 */
function reveal(el: HTMLElement, extra = 0): void {
  const isRise = el.hasAttribute('data-rise');
  if (!el.hasAttribute('data-num')) {
    const index = parseInt(el.getAttribute(isRise ? 'data-rise' : 'data-reveal') || '0', 10);
    const delay = index * (isRise ? 90 : 70) + extra;

    if (delay) {
      el.style.transitionDelay = `${delay}ms`;

      /*
       * The delay has to be removed once the reveal is done. `transition-delay`
       * is not scoped to one property — it applies to every transition on the
       * element — so a staggered item left holding a 700ms delay then waits
       * 700ms before its *hover* starts moving.
       *
       * That is why the project rows felt progressively worse down the list:
       * the last row is index 10, so its hover sat idle for 700ms before
       * anything happened, while the four-item services list never exceeded
       * 210ms and felt fine.
       */
      const clearAfter = delay + REVEAL_MS + 60;
      window.setTimeout(() => {
        el.style.transitionDelay = '';
      }, clearAfter);
    }
  }

  // Must happen for counting numbers too. This used to sit after an early
  // return for [data-num], which left every stat below the fold hidden for
  // good — the number counted up behind opacity: 0.
  el.removeAttribute('data-hidden');

  if (el.hasAttribute('data-num')) rollNumber(el);
}

/** Marks an element as spoken for. False if something already had it. */
function claim(el: HTMLElement): boolean {
  if (el.dataset.shown) return false;
  el.dataset.shown = '1';
  return true;
}

function show(el: HTMLElement): void {
  if (claim(el)) reveal(el);
}

/**
 * How long each item in a cascade waits behind the one before it.
 *
 * Fast enough that a row of cards still reads as arriving together, slow
 * enough to see them arrive one at a time rather than as a block.
 */
const STAGGER_MS = 85;

/**
 * Reveals a set of elements that became visible at the same moment, cascading
 * the ones that asked for it.
 *
 * A grid is why this exists. Every card carries the same `data-reveal` index,
 * because a fixed index per card would be wrong: the twelfth card would sit on
 * a 700ms delay when it finally scrolled into view, long after the cascade it
 * was numbered for had any meaning. The order has to come from what is
 * actually appearing together, which is only known at the moment it happens —
 * so a lone card entering on scroll waits for nothing, and a row of three
 * entering at once counts itself off.
 */
function revealGroup(els: HTMLElement[]): void {
  let step = 0;
  for (const el of els) {
    reveal(el, el.hasAttribute('data-stagger') ? step++ * STAGGER_MS : 0);
  }
}

/**
 * Whether this arrival should leave the page exactly as it was found.
 *
 * Two cases, and only two. A cover morphing back into its card is one
 * animation; replaying every card's fade underneath it is a second one over
 * the same content, which is what made the return feel unsettled. And an
 * arrival that restores a scroll position lands mid-page, where an entrance
 * would animate content the visitor is already looking at.
 *
 * Everything else — a reload, a fresh visit, following a link from another
 * page — plays the entrance. This used to be a blanket once-per-session flag,
 * which also swallowed the entrance on a plain reload.
 */
function arrivingQuietly(): boolean {
  if (morphSlug !== null) return true;
  const restoredTo = (history.state as { scrollY?: number } | null)?.scrollY ?? 0;
  return restoredTo > 0;
}

/**
 * Hides everything that has not been revealed yet, then plays the entrance for
 * whatever is already on screen.
 *
 * This used to prime only what was below the fold, which meant a page's own
 * heading — always above the fold — was never hidden and so never animated.
 * Only the home page appeared to have an entrance, and only because its hero
 * happens to sit beside content that scrolls.
 *
 * Above-the-fold elements are claimed immediately (marked shown, so the
 * observer leaves them alone) but revealed two frames later. The browser has
 * to paint the hidden state at least once or there is no start value to
 * transition from and the elements simply pop in.
 */
function primePage(): void {
  if (arrivingQuietly()) return;

  const viewportHeight = window.innerHeight || 800;
  const above: HTMLElement[] = [];

  document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
    if (el.dataset.shown || el.hasAttribute('data-hidden')) return;

    const onScreen = triggerFor(el).getBoundingClientRect().top < viewportHeight * REVEAL_AT;

    // A counting number above the fold is left as it is: hiding it would show
    // a blank where a figure should be, and it has no entrance to gain.
    if (onScreen && el.hasAttribute('data-num')) return;

    el.setAttribute('data-hidden', '');
    if (onScreen) {
      el.dataset.shown = '1';
      above.push(el);
    }
  });

  if (!above.length) return;

  if (reduced) {
    revealGroup(above);
    return;
  }

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    revealGroup(above);
  };

  requestAnimationFrame(() => requestAnimationFrame(run));

  // requestAnimationFrame stops dead in a backgrounded tab rather than just
  // slowing, which would leave the heading painted hidden and never revealed.
  // Timers are throttled there but do still fire.
  window.setTimeout(run, 500);
}

function showAll(): void {
  document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(show);
}

/**
 * Which element's position decides when `el` gets revealed.
 *
 * A `data-rise` element starts translated 112% down inside a parent with
 * `overflow: hidden`, so it is clipped to nothing. IntersectionObserver
 * intersects a target against its ancestors' clip rects, which means a rise
 * element has no visible area of its own and would never report as
 * intersecting — it would stay hidden forever. Watch the clipping parent,
 * which is where the text is going to appear anyway.
 */
function triggerFor(el: HTMLElement): HTMLElement {
  return el.hasAttribute('data-rise') && el.parentElement ? el.parentElement : el;
}

function setUpReveals(): void {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));

  if (reduced || typeof IntersectionObserver === 'undefined') {
    showAll();
    return;
  }

  // One trigger can own several reveal elements.
  const watched = new Map<Element, HTMLElement[]>();
  for (const el of elements) {
    const trigger = triggerFor(el);
    const group = watched.get(trigger);
    if (group) group.push(el);
    else watched.set(trigger, [el]);
  }

  // Anything not marked hidden is already on screen and needs no animation —
  // just record it as done so the observer ignores it.
  for (const [trigger, group] of watched) {
    if (group.every((el) => !el.hasAttribute('data-hidden'))) {
      group.forEach(show);
      watched.delete(trigger);
    }
  }

  if (!watched.size) return;

  /*
   * Safety net for the case where the observer never reports at all.
   *
   * Everything below the fold is hidden on the assumption that something will
   * later reveal it. If that never happens the page is not merely unanimated,
   * it is empty — the content is there but invisible, with no way for the
   * visitor to get at it. An observer callback fires once per observed element
   * as soon as it is observed, whatever its state, so this flag is set almost
   * immediately in any browser where the mechanism works at all; it stays
   * false only when the page is genuinely not being rendered.
   */
  let observerReported = false;

  observer = new IntersectionObserver(
    (entries) => {
      observerReported = true;

      /*
       * Collected first, revealed second. Everything the browser reports in one
       * callback crossed the line together — a whole row of cards on arrival,
       * or a single one part way down a scroll — and revealGroup is what turns
       * that into a cascade rather than a block appearing at once.
       */
      const batch: HTMLElement[] = [];
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const el of watched.get(entry.target) ?? []) {
          if (claim(el)) batch.push(el);
        }
        observer?.unobserve(entry.target);
      }
      revealGroup(batch);
    },
    {
      // Matches the prototype's "reveal once the top passes 94% of the
      // viewport" threshold — and the whole viewport on a touch screen, which
      // scrolls too fast for the entrance to finish otherwise.
      rootMargin: `0px 0px -${Math.round((1 - REVEAL_AT) * 100)}% 0px`,
      threshold: 0,
    }
  );

  for (const trigger of watched.keys()) observer.observe(trigger);

  /*
   * Held so init() can cancel it. An observer that is replaced before its first
   * callback ever runs leaves this timer behind with `observerReported` still
   * false, and four seconds later it reveals the entire page at once — no
   * entrance, no cascade, everything simply on.
   *
   * That is not hypothetical: init() runs twice for one navigation, at
   * after-swap and again at page-load, so the first observer is routinely
   * disconnected within a frame of being created. Whether it had reported by
   * then was a race, and on a slow device or a backgrounded tab it lost.
   */
  safetyTimer = window.setTimeout(() => {
    if (!observerReported) showAll();
  }, 4000);
}

/**
 * Section tops in document coordinates, measured once per page and after a
 * resize rather than on every frame.
 *
 * Reading getBoundingClientRect() inside the scroll handler forces the browser
 * to flush layout on every single frame while scrolling, which is exactly the
 * kind of work that makes an otherwise cheap page feel sticky.
 */
let tiles: { top: number; bottom: number; dark: boolean }[] = [];

function measureTiles(): void {
  const offset = window.scrollY || root.scrollTop || 0;
  tiles = Array.from(document.querySelectorAll<HTMLElement>('[data-tile]')).map((tile) => {
    const rect = tile.getBoundingClientRect();
    return {
      top: rect.top + offset,
      bottom: rect.bottom + offset,
      dark: tile.dataset.tile === 'dark',
    };
  });
}

/** Remembers the last values written, so the same string is not set twice. */
let lastCondensed: boolean | null = null;
let lastOverDark: boolean | null = null;

/**
 * In dark mode every surface is dark, so the nav ink and the logo have to
 * invert everywhere — not only over the sections tagged as dark tiles. Without
 * this the black logo mark sits on a near-black page and disappears.
 */
function isDarkTheme(): boolean {
  const set = root.dataset.theme;
  if (set === 'dark') return true;
  if (set === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function chromePass(): void {
  const y = window.scrollY || root.scrollTop || 0;
  const condensed = y > 90;

  // Which tile sits under the nav decides its ink colour. Pure arithmetic now:
  // no layout is read during the scroll.
  const probe = y + 34;
  let overDarkTile = false;
  for (const tile of tiles) {
    if (probe >= tile.top && probe <= tile.bottom) overDarkTile = tile.dark;
  }
  const overDark = overDarkTile || isDarkTheme();

  if (condensed === lastCondensed && overDark === lastOverDark) return;
  lastCondensed = condensed;
  lastOverDark = overDark;

  styles.setProperty('--nav-top', condensed ? '10px' : '18px');
  /*
   * The links carry their own padding in both states rather than being spaced
   * apart by the gap alone. At 6px of padding the hover fill hugged the text
   * so tightly it read as a highlighter mark instead of a control; the gap is
   * pulled in to compensate, so the rhythm along the bar is about what it was.
   */
  styles.setProperty('--nav-gap', condensed ? '2px' : 'clamp(6px,2.2vw,30px)');
  styles.setProperty('--nav-pad', condensed ? '2px 6px' : '2px 6px');
  styles.setProperty('--nav-link-pad', condensed ? '0 15px' : '0 16px');
  styles.setProperty(
    '--nav-bg',
    condensed
      ? overDark
        ? 'rgba(28,28,32,0.72)'
        : 'rgba(255,255,255,0.74)'
      : 'transparent'
  );
  styles.setProperty('--nav-blur', `saturate(180%) blur(${condensed ? NAV_BLUR_PX : 0}px)`);
  styles.setProperty('--nav-shadow', `0 1px 8px rgba(0,0,0,${condensed ? 0.07 : 0})`);
  styles.setProperty('--nav-ink', overDark ? '#ffffff' : '#1d1d1f');
  styles.setProperty('--logo-op', condensed ? '0' : '1');
  styles.setProperty('--logo-y', condensed ? '-10px' : '0px');
  styles.setProperty('--logo-pe', condensed ? 'none' : 'auto');

  const mark = document.querySelector<HTMLElement>('[data-logo] img');
  if (mark) mark.style.filter = overDark ? 'brightness(0) invert(1)' : 'none';
}

let observer: IntersectionObserver | null = null;
/** The observer's last-resort timer, cancelled whenever the observer is. */
let safetyTimer = 0;
/** Set when after-swap has already initialised the page this navigation. */
let initedOnSwap = false;
let listenersBound = false;

let frame = 0;
function scheduleChrome(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    chromePass();
  });
}

function remeasure(): void {
  measureTiles();
  // Section positions moved, so the cached decision may no longer hold.
  lastCondensed = null;
  lastOverDark = null;
  chromePass();
}

/**
 * Restarts the logo's draw-on animation.
 *
 * The logo survives navigation (transition:persist), so its animation has
 * already finished and will not run again on its own. Dropping the flag,
 * forcing a reflow and setting it again is what makes the browser treat it as
 * a new animation rather than a continuing one.
 */
function replayLogoDraw(): void {
  const mark = document.querySelector('[data-logo-mark]');
  if (!mark) return;

  delete root.dataset.logoDraw;
  void (mark as HTMLElement).offsetWidth;
  root.dataset.logoDraw = '1';
}

function init(): void {
  // The client router swaps the whole page, so the previous page's observer is
  // watching elements that no longer exist. Drop it — and its safety net —
  // before building a new one.
  observer?.disconnect();
  observer = null;
  window.clearTimeout(safetyTimer);
  safetyTimer = 0;

  primePage();
  setUpReveals();
  remeasure();

  // These are on `window`, which survives navigation — bind them once or every
  // page visit would add another copy.
  if (!listenersBound) {
    listenersBound = true;
    window.addEventListener('scroll', scheduleChrome, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });

    // The nav ink depends on the theme, so it has to be recomputed when the
    // theme changes — by the switch, or by the OS while the page is open.
    const repaintChrome = () => {
      lastCondensed = null;
      lastOverDark = null;
      chromePass();
    };
    window.addEventListener('mh:themechange', repaintChrome);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', repaintChrome);
    // Images finishing late change section offsets, so measure again.
    window.addEventListener('load', remeasure);
  }
}

// `astro:after-swap` fires once the new DOM is in place but before the browser
// paints it, so revealing above-the-fold content there means it is already
// visible on the first frame. Doing this on `astro:page-load` instead — which
// runs after paint — showed up as a flash of empty page on every navigation.
document.addEventListener('astro:before-swap', (event) => {

  /*
   * The `morphing` class only means anything while a transition is running, and
   * it must not be left behind: it hides the outgoing snapshot, which the theme
   * wipe needs to wipe over. The transition object hands us the exact moment.
   */
  const transition = (event as unknown as { viewTransition?: { finished: Promise<void> } })
    .viewTransition;
  // `finally` passes a rejection through, and the browser rejects `finished`
  // whenever it abandons a transition — hiding the tab mid-navigation is
  // enough. The class still has to come off either way.
  if (transition) {
    transition.finished.finally(() => root.classList.remove('morphing')).catch(() => {});
  } else {
    root.classList.remove('morphing');
  }

  /*
   * `html { scroll-behavior: smooth }` is there for in-page anchors, but the
   * router restores scroll position with scrollTo() — which that rule turns
   * into an animation. Going back then slides the page down from the top over
   * a second or so instead of simply being where it was, and any interruption
   * leaves it stranded part way.
   *
   * Restoring position is not a scroll the visitor should see happen.
   */
  root.style.scrollBehavior = 'auto';
});

document.addEventListener('astro:after-swap', () => {
  /*
   * Inside the transition's update callback: the last moment at which the
   * incoming snapshot can be given the name its counterpart is flying to.
   */
  if (morphSlug !== null) {
    applyMorphName(morphSlug);
    applyMorphRadius(morphSlug);
  }

  // Before init(), so priming measures against the position the visitor will
  // actually be at, and so the destination cover is not still below the fold
  // when the browser decides whether to bother loading it.
  restoreScroll();
  init();
  initedOnSwap = true;

  /*
   * The mark only draws when it is actually on screen.
   *
   * The nav hides the logo once the page is scrolled, so replaying the draw
   * after returning to a restored scroll position meant it animated and then
   * vanished as the page jumped down to where it had been.
   *
   * The restored offset is read from history rather than from window.scrollY,
   * which has not caught up yet at this point.
   */
  const restoredTo = (history.state as { scrollY?: number } | null)?.scrollY ?? 0;
  if (restoredTo <= 90) replayLogoDraw();
  else delete root.dataset.logoDraw;
});

/* ---------------------------------------------------------------------- */
/* Scroll restoration                                                       */
/* ---------------------------------------------------------------------- */

/*
 * Re-applies the saved scroll position until it actually takes.
 *
 * The router does save it — history.state carries the offset, and hands it back
 * on popstate — but it restores immediately after the swap, while the incoming
 * page is often still shorter than the offset being restored to. The browser
 * clamps the scroll to whatever the document height allows at that instant,
 * which on a page whose images have not laid out yet is frequently zero, and
 * nothing scrolls it back down once the real height arrives.
 *
 * So: ask again over the next few hundred milliseconds, and stop the moment
 * the visitor takes over. Being dragged to a position you did not ask for is
 * worse than losing it.
 */
function restoreScroll(): void {
  const state = history.state as { scrollX?: number; scrollY?: number } | null;
  const targetY = state?.scrollY ?? 0;
  const targetX = state?.scrollX ?? 0;
  if (!targetY && !targetX) return;

  let cancelled = false;
  const surrender = () => {
    cancelled = true;
  };

  window.addEventListener('wheel', surrender, { once: true, passive: true });
  window.addEventListener('touchstart', surrender, { once: true, passive: true });
  window.addEventListener('keydown', surrender, { once: true });

  const settled = () => Math.abs(window.scrollY - targetY) <= 2;

  const apply = (attempt: number): void => {
    if (cancelled || settled()) return;

    // Explicitly instant. `html { scroll-behavior: smooth }` is back in force
    // by the time the later attempts run, and an animated restore never lands:
    // each attempt restarts the animation the previous one began.
    window.scrollTo({ left: targetX, top: targetY, behavior: 'instant' });

    // ~400ms of attempts: long enough for a page of images to lay out, short
    // enough that it cannot fight the visitor for meaningfully long.
    if (attempt < 8 && !settled()) window.setTimeout(() => apply(attempt + 1), 50);
  };

  apply(0);
}

/* ---------------------------------------------------------------------- */
/* Shared-element morph                                                     */
/* ---------------------------------------------------------------------- */

/*
 * Exactly one cover carries a view-transition-name at any moment.
 *
 * Naming every cover on a listing looks correct but is not: only the cover
 * being opened has a counterpart on the case study. Every other name exists on
 * one side of the transition only, and the browser gives each of those its own
 * independent entry animation instead of folding it into the page fade — so
 * covers flash in one by one, the big featured one most visibly of all.
 *
 * Which navigations morph is decided from the two paths, at the moment the
 * router starts — early enough that the name is in place before the outgoing
 * snapshot is taken. A listing opening a case study morphs, and so does a case
 * study returning to one. Everything else — one case study to the next, a case
 * study to About — deliberately does not: the cover would be named on one side
 * only, and would then animate on its own alongside the page.
 */
const MORPH_RADIUS_KEY = 'mh-morph-radius';

/** The listings that show a project cover: the work index and the home page. */
function isListing(path: string): boolean {
  const clean = path.replace(/\/+$/, '') || '/';
  return clean === '/' || clean === '/work';
}

/** `/work/<slug>`, and nothing deeper. */
function caseSlug(path: string): string | null {
  const match = path.replace(/\/+$/, '').match(/^\/work\/([^/]+)$/);
  return match ? match[1] : null;
}

/**
 * The cover this navigation morphs, or null when it should not morph at all.
 * It is the same slug on both legs of the trip: the project being opened, or
 * the project being left.
 */
function morphSlugFor(from: string, to: string): string | null {
  const opening = caseSlug(to);
  if (opening && isListing(from)) return opening;

  const leaving = caseSlug(from);
  if (leaving && isListing(to)) return leaving;

  return null;
}

/** Set for the length of one navigation, by the before-preparation handler. */
let morphSlug: string | null = null;

function applyMorphName(slug: string | null): void {
  document.querySelectorAll<HTMLElement>('[data-morph]').forEach((el) => {
    const isTarget = Boolean(el.dataset.slug) && el.dataset.slug === slug;
    el.style.viewTransitionName = isTarget ? `cover-${slug}` : '';

    if (!isTarget) return;

    /*
     * The cover has to be painted before the browser snapshots this page, or
     * the morph lands on an empty tile and the picture appears afterwards —
     * which is the white flash on the way back from a project.
     *
     * Listing covers are lazy, and on arrival the page is still at the top
     * with the card far below the fold, so the browser has every reason not to
     * have loaded it. Scroll is restored moments later and it finally loads.
     * Opting this one image out of lazy loading is enough: it is the same file
     * the case study just displayed, so it is already in cache.
     */
    const img = el.querySelector<HTMLImageElement>('img');
    if (!img) return;

    img.loading = 'eager';
    img.fetchPriority = 'high';
    if (typeof img.decode === 'function') void img.decode().catch(() => {});
  });
}

/**
 * Hands the transition the corner radius at each end of the move, so it can be
 * interpolated rather than snapped: a row thumbnail is 8px and a case study
 * cover is 22px, and clipping at one fixed radius means the corner is wrong at
 * one end and jumps to the right value the instant the transition finishes.
 */
function recordMorphRadius(slug: string): void {
  const el = document.querySelector<HTMLElement>(`[data-morph][data-slug="${CSS.escape(slug)}"]`);
  if (!el) return;
  try {
    sessionStorage.setItem(MORPH_RADIUS_KEY, getComputedStyle(el).borderRadius);
  } catch {
    /* private mode — the corner simply does not interpolate */
  }
}

function applyMorphRadius(slug: string): void {
  const el = document.querySelector<HTMLElement>(`[data-morph][data-slug="${CSS.escape(slug)}"]`);
  if (!el) return;

  const arriving = getComputedStyle(el).borderRadius;
  try {
    const leaving = sessionStorage.getItem(MORPH_RADIUS_KEY) || arriving;
    root.style.setProperty('--morph-r-from', leaving);
    root.style.setProperty('--morph-r-to', arriving);
    // The return trip leaves from here.
    sessionStorage.setItem(MORPH_RADIUS_KEY, arriving);
  } catch {
    root.style.setProperty('--morph-r-from', arriving);
    root.style.setProperty('--morph-r-to', arriving);
  }
}

/*
 * Fires before the router fetches the next page and well before the outgoing
 * snapshot is taken, which is the window in which the name has to be set.
 *
 * `morphing` on the root switches the page's own blur-and-fade off. Between a
 * listing and a case study the cover is the transition — running a fade of the
 * whole page underneath it means two things move at once and neither reads.
 */
document.addEventListener('astro:before-preparation', (event) => {
  const detail = event as unknown as { from?: URL; to?: URL };
  const from = detail.from?.pathname ?? window.location.pathname;
  const to = detail.to?.pathname ?? window.location.pathname;

  morphSlug = morphSlugFor(from, to);

  // The inline priming script in BaseLayout runs during the swap, before this
  // module gets another look at the page, and has to make the same call about
  // whether to replay the entrance.
  (window as unknown as { __mhMorph?: string | null }).__mhMorph = morphSlug;

  root.classList.toggle('morphing', morphSlug !== null);

  if (morphSlug === null) {
    // Leave nothing named: a name with a counterpart on one side only gets its
    // own animation, separate from the page's.
    applyMorphName(null);
    return;
  }

  recordMorphRadius(morphSlug);
  applyMorphName(morphSlug);
});

/*
 * The path the visitor was on before this one.
 *
 * A case study's "All work" link is a forward navigation, so it lands at the
 * top of the listing. If the listing is where they actually came from, going
 * back instead restores their scroll position — and lets them watch the cover
 * morph back into the card they opened.
 */
let lastPath: string | null = null;

document.addEventListener('astro:page-load', () => {
  if (lastPath !== null && lastPath !== window.location.pathname) {
    (window as unknown as { __mhFrom?: string }).__mhFrom = lastPath;
  }
  lastPath = window.location.pathname;
});

document.addEventListener('astro:page-load', () => {
  // After the restore has been applied, hand anchors their smooth scroll back.
  window.setTimeout(() => {
    root.style.scrollBehavior = '';
  }, 0);
});

/*
 * Covers the very first load, and the fallback path where the router does an
 * ordinary navigation — in both, after-swap never fires.
 *
 * On a client-side navigation both events fire, and init() is not cheap: it
 * rebuilds the IntersectionObserver over every reveal element and re-measures
 * every section. Doing that twice for one navigation is a second round of
 * layout work on the frame the visitor is already waiting on.
 */
document.addEventListener('astro:page-load', () => {
  if (initedOnSwap) {
    initedOnSwap = false;
    return;
  }
  init();
});
