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

function show(el: HTMLElement): void {
  if (el.dataset.shown) return;

  if (el.hasAttribute('data-num')) {
    el.dataset.shown = '1';
    rollNumber(el);
    return;
  }

  const isRise = el.hasAttribute('data-rise');
  const index = parseInt(el.getAttribute(isRise ? 'data-rise' : 'data-reveal') || '0', 10);
  el.style.transitionDelay = `${index * (isRise ? 90 : 70)}ms`;
  el.dataset.shown = '1';
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

  // Anything already on screen is revealed straight away. getBoundingClientRect
  // is used rather than waiting for the observer because it ignores ancestor
  // clipping, so it sees rise elements the observer cannot.
  const viewportHeight = window.innerHeight || 800;
  for (const [trigger, group] of watched) {
    if (trigger.getBoundingClientRect().top < viewportHeight * 0.94) {
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

function chromePass(): void {
  const y = window.scrollY || root.scrollTop || 0;
  const condensed = y > 90;

  // Which tile sits under the nav decides its ink colour. Pure arithmetic now:
  // no layout is read during the scroll.
  const probe = y + 34;
  let overDark = false;
  for (const tile of tiles) {
    if (probe >= tile.top && probe <= tile.bottom) overDark = tile.dark;
  }

  if (condensed === lastCondensed && overDark === lastOverDark) return;
  lastCondensed = condensed;
  lastOverDark = overDark;

  styles.setProperty('--nav-top', condensed ? '10px' : '18px');
  styles.setProperty('--nav-gap', condensed ? '2px' : 'clamp(16px,4.6vw,56px)');
  styles.setProperty('--nav-pad', condensed ? '2px 6px' : '2px 12px');
  styles.setProperty('--nav-link-pad', condensed ? '0 15px' : '0 6px');
  styles.setProperty(
    '--nav-bg',
    condensed
      ? overDark
        ? 'rgba(40,40,42,0.7)'
        : 'rgba(255,255,255,0.74)'
      : 'rgba(255,255,255,0)'
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

function init(): void {
  // The client router swaps the whole page, so the previous page's observer is
  // watching elements that no longer exist. Drop it before building a new one.
  observer?.disconnect();
  observer = null;

  setUpReveals();
  remeasure();

  // These are on `window`, which survives navigation — bind them once or every
  // page visit would add another copy.
  if (!listenersBound) {
    listenersBound = true;
    window.addEventListener('scroll', scheduleChrome, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    // Images finishing late change section offsets, so measure again.
    window.addEventListener('load', remeasure);
  }
}

// `astro:after-swap` fires once the new DOM is in place but before the browser
// paints it, so revealing above-the-fold content there means it is already
// visible on the first frame. Doing this on `astro:page-load` instead — which
// runs after paint — showed up as a flash of empty page on every navigation.
document.addEventListener('astro:after-swap', init);

// Covers the very first load, where after-swap never fires.
document.addEventListener('astro:page-load', init);
