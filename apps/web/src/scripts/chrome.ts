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

const REVEAL_SELECTOR = '[data-reveal],[data-rise],[data-num]';

/** Longest reveal transition in global.css, used to know when a stagger is spent. */
const REVEAL_MS = 880;

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
function reveal(el: HTMLElement): void {
  const isRise = el.hasAttribute('data-rise');
  if (!el.hasAttribute('data-num')) {
    const index = parseInt(el.getAttribute(isRise ? 'data-rise' : 'data-reveal') || '0', 10);
    const delay = index * (isRise ? 90 : 70);

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

function show(el: HTMLElement): void {
  if (el.dataset.shown) return;
  el.dataset.shown = '1';
  reveal(el);
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
/**
 * True while the client router is swapping documents.
 *
 * A card's cover and the case study's cover share a view-transition-name, so
 * the browser morphs one into the other across a navigation. That element must
 * stay visible for the morph to land on: hiding it means the snapshot flies to
 * its destination and then vanishes, because the real element underneath was
 * primed for a reveal it will not get until the visitor scrolls.
 *
 * On a first load there is no morph, so the entrance stagger runs as normal.
 */
let swapping = false;

function isMorphTarget(el: HTMLElement): boolean {
  return el.matches('[data-morph]') || el.querySelector('[data-morph]') !== null;
}

/**
 * Whether this page has already played its entrance in this session.
 *
 * The flag is written by the inline priming script, which always runs first.
 */
function alreadyRevealed(): boolean {
  try {
    return sessionStorage.getItem(`mh-seen:${window.location.pathname}`) === '1';
  } catch {
    return false;
  }
}

function primePage(): void {
  // Coming back to a page should not replay its entrance. Returning from a
  // case study, the listing re-ran every row's fade underneath the cover
  // morphing back into its card — two animations of the same content at once,
  // which is what made the return feel unsettled rather than smooth.
  if (alreadyRevealed()) return;

  const viewportHeight = window.innerHeight || 800;
  const above: HTMLElement[] = [];

  document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
    if (el.dataset.shown || el.hasAttribute('data-hidden')) return;

    // Claim it so the later astro:page-load pass does not hide it either.
    if (swapping && isMorphTarget(el)) {
      el.dataset.shown = '1';
      return;
    }

    const onScreen = triggerFor(el).getBoundingClientRect().top < viewportHeight * 0.94;

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
    above.forEach(reveal);
    return;
  }

  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    above.forEach(reveal);
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

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (watched.get(entry.target) ?? []).forEach(show);
        observer?.unobserve(entry.target);
      }
    },
    {
      // Matches the prototype's "reveal once the top passes 94% of the
      // viewport" threshold.
      rootMargin: '0px 0px -6% 0px',
      threshold: 0,
    }
  );

  for (const trigger of watched.keys()) observer.observe(trigger);
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
  styles.setProperty('--nav-blur', `saturate(180%) blur(${condensed ? 20 : 0}px)`);
  styles.setProperty('--nav-shadow', `0 1px 8px rgba(0,0,0,${condensed ? 0.07 : 0})`);
  styles.setProperty('--nav-ink', overDark ? '#ffffff' : '#1d1d1f');
  styles.setProperty('--logo-op', condensed ? '0' : '1');
  styles.setProperty('--logo-y', condensed ? '-10px' : '0px');
  styles.setProperty('--logo-pe', condensed ? 'none' : 'auto');

  const mark = document.querySelector<HTMLElement>('[data-logo] img');
  if (mark) mark.style.filter = overDark ? 'brightness(0) invert(1)' : 'none';
}

let observer: IntersectionObserver | null = null;
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
  // watching elements that no longer exist. Drop it before building a new one.
  observer?.disconnect();
  observer = null;

  // Before priming: after-swap runs inside the transition, so this is the last
  // chance to name the element the incoming snapshot will be taken from.
  applyMorphName(readMorphSlug());

  replayLogoDraw();

  primePage();
  setUpReveals();
  remeasure();

  // These are on `window`, which survives navigation — bind them once or every
  // page visit would add another copy.
  if (!listenersBound) {
    listenersBound = true;
    document.addEventListener('pointerdown', armMorph, true);
    // Keyboard activation never fires pointerdown.
    document.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') armMorph(event);
    }, true);

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
document.addEventListener('astro:before-swap', () => {
  swapping = true;

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
  init();
  restoreScroll();
  swapping = false;
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
 * The name is therefore applied to a single element, at navigation time, and
 * the slug is remembered so the return trip can name the same card again.
 */
const MORPH_KEY = 'mh-morph';

function readMorphSlug(): string | null {
  try {
    return sessionStorage.getItem(MORPH_KEY);
  } catch {
    return null;
  }
}

function applyMorphName(slug: string | null): void {
  document.querySelectorAll<HTMLElement>('[data-morph]').forEach((el) => {
    el.style.viewTransitionName = el.dataset.slug && el.dataset.slug === slug ? `cover-${slug}` : '';
  });
}

function rememberMorph(slug: string): void {
  try {
    sessionStorage.setItem(MORPH_KEY, slug);
  } catch {
    /* private mode — the morph is simply skipped */
  }
}

/*
 * pointerdown rather than click: the router starts the transition on click, and
 * the outgoing snapshot has to already carry the name by then.
 */
function armMorph(event: Event): void {
  const link = (event.target as Element | null)?.closest?.('a[href^="/work/"]');
  const tile = link?.querySelector<HTMLElement>('[data-morph][data-slug]');
  if (!tile?.dataset.slug) return;

  rememberMorph(tile.dataset.slug);
  applyMorphName(tile.dataset.slug);
}

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

// Covers the very first load, where after-swap never fires.
document.addEventListener('astro:page-load', init);
