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

import { resolvedTheme, restoreTheme } from './theme-state';

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
/*
 * Enough blur to soften, not enough to hide.
 *
 * This was 20, which is frosted glass: shapes behind it stop being shapes and
 * become a wash of their average colour. At 8 the thing behind is still
 * legibly itself — a heading passing under the bar is a heading, an image is
 * that image — and the material reads as a thin polished sheet rather than as
 * a translucent panel. Readability is carried by the contrast and brightness
 * in the filter and by the tint, not by destroying what is underneath.
 */
const NAV_BLUR_PX = coarse ? 6 : 8;

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
        el.style.removeProperty('transition-delay');
        // Clearing the property leaves `style=""` on the element — inert, but
        // it is a mark on the markup that nothing put there on purpose.
        if (!el.getAttribute('style')) el.removeAttribute('style');
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
 * How long a whole cascade is allowed to take, however many items are in it.
 *
 * A fixed step per item is fine for a row of three and wrong for a grid of
 * twelve: at 85ms apiece the last card waited 935ms before it began, and
 * nearly a second and a half before it finished. Scrolling into the work grid
 * meant scrolling into a page that was still filling in.
 *
 * Past about six items the step shrinks so the cascade always lands inside
 * this budget. Below that nothing changes — a small group keeps the spacing it
 * has, because that is where the effect is legible.
 */
const CASCADE_MS = 420;

/**
 * How far into the viewport an element can be before its entrance is dropped.
 *
 * The observer reports as an element crosses the bottom edge, but the report
 * arrives on a later frame, and a fling can carry the element most of the way
 * up the screen in the meantime. Staggering something the visitor is already
 * looking at is how a list comes to be read as loading: the content is there,
 * and the page is holding it back.
 *
 * Anything already past the middle by the time we get to it has been on screen
 * long enough. It skips the queue and fades in on the spot.
 */
const LATE_AT = 0.5;

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
function revealGroup(els: HTMLElement[], scrolled = false): void {
  /*
   * `scrolled` separates the two callers. The observer is reporting things the
   * visitor has scrolled to, and how far past them they already are is worth
   * knowing. Priming is not: everything it reveals is on screen at load, much
   * of it near the top, and treating that as "already scrolled past" would
   * throw away the entrance on every first paint.
   */
  const queued = els.filter((el) => el.hasAttribute('data-stagger') && !(scrolled && isLate(el)));
  const gap = queued.length > 1 ? Math.min(STAGGER_MS, CASCADE_MS / (queued.length - 1)) : 0;
  const queue = new Set(queued);

  let step = 0;
  for (const el of els) {
    reveal(el, queue.has(el) ? step++ * gap : 0);
  }
}

/** Whether the visitor has already scrolled well past this element. */
function isLate(el: HTMLElement): boolean {
  return triggerFor(el).getBoundingClientRect().top < (window.innerHeight || 800) * LATE_AT;
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
      revealGroup(batch, true);
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
 * True from the moment a swap begins until the new page has settled.
 *
 * While it is set the nav wears nothing, whatever the scroll position says.
 * That position is not yet the one the visitor will land on: the router has
 * not finished with it, and reading it mid-flight is how the pill ended up
 * being told to appear on a page that turned out to be at the top. Held, it
 * cannot be told anything; at the settle below it is asked once, and whatever
 * it answers is what it wears.
 *
 * Only the three properties the visitor sees as "a background" are held. The
 * ink and the logo are not: they depend on which tile is under the nav, and
 * that is right from the first frame of the new page.
 */
let navHeld = false;

/**
 * Stops the nav animating, and holds it bare, for the length of a navigation.
 *
 * Called twice on purpose. The router replaces every attribute on <html> with
 * the incoming document's — inline custom properties included — so a value set
 * before the swap is gone by the time it matters most.
 */
function holdNav(): void {
  navHeld = true;
  styles.setProperty('--nav-anim', '0ms');
}

/** Asks once, now that the page it is answering about has stopped moving. */
function releaseNav(): void {
  navHeld = false;
  lastCondensed = null;
  lastOverDark = null;
  chromePass();
  styles.removeProperty('--nav-anim');
}

/**
 * In dark mode every surface is dark, so the nav ink and the logo have to
 * invert everywhere — not only over the sections tagged as dark tiles. Without
 * this the black logo mark sits on a near-black page and disappears.
 *
 * The 404 is dark whatever the theme, so asking the theme is not enough there:
 * in light mode this would answer false, and the moment the nav probe left the
 * dark tile — over the footer, which carries no `data-tile` — the ink would
 * revert to near-black over a near-black page. Same failure, one page, and
 * invisible in dark mode.
 */
function isDarkTheme(): boolean {
  /*
   * Super designer mode is dark whatever the theme underneath it, and asking
   * the theme was not enough: a visitor who found the mode while in light mode
   * got the white pill and near-black nav ink over a near-black violet page.
   */
  return (
    resolvedTheme() === 'dark' ||
    root.dataset.surface === 'void' ||
    root.hasAttribute('data-super')
  );
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

  // What the nav is dressed in, as opposed to what the page is doing. See
  // navHeld: during a navigation these two are allowed to disagree.
  const dressed = condensed && !navHeld;

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
  /*
   * Nothing at all until the page has been scrolled — the pill is a response to
   * content passing under it, not a permanent bar. Super designer mode gets its
   * own tint rather than the neutral dark one: a grey pill on that ground reads
   * as a panel from another site sitting on top of the room.
   */
  /*
   * Thin enough to see through, which is most of what changed here.
   *
   * These were 0.72 to 0.78, and at that alpha the pill is a painted surface
   * with a blur behind it: the page underneath contributes almost nothing, so
   * nothing about the material reacts to what passes below. Around a third is
   * where the shapes behind stay shapes: enough paint to hold the type, and
   * not so much that the page underneath is reduced to its average colour.
   *
   * The readability that alpha used to buy is bought instead by the contrast
   * and brightness in the filter below. The one thing it must not be bought
   * with is blur, which buys legibility by destroying exactly what this is
   * meant to be showing.
   */
  styles.setProperty(
    '--nav-bg',
    dressed
      ? root.hasAttribute('data-super')
        ? 'rgba(22,8,42,0.3)'
        : overDark
          ? 'rgba(24,24,28,0.28)'
          : 'rgba(255,255,255,0.34)'
      : 'transparent'
  );
  /*
   * The saturation goes with the blur, and that was the whole bug.
   *
   * `saturate(180%)` was left on at rest, with only the blur going to zero — a
   * backdrop-filter that is still doing something. Over white and over
   * near-black it does nothing anyone can see, because neither has any
   * saturation to push, so it survived both other modes unnoticed. Over the
   * violet ground of super designer mode it lit a pill-shaped patch of the
   * page, which is exactly the "background before it is scrolled" it should
   * not have had. 100% is the identity, and it still interpolates.
   */
  /*
   * `none` at rest, not an identity filter.
   *
   * A backdrop-filter that is still a filter — even one that changes nothing —
   * keeps the nav on its own composited layer with a backdrop root behind it,
   * for every frame of every page. `none` takes the layer away entirely, and
   * it still interpolates: an empty filter list animates from the identity of
   * whatever it is going to, so the blur fades in on scroll exactly as before.
   */
  /*
   * The filter does the work the opacity used to.
   *
   * Saturation is what lets colour behind the glass reach the front of it — a
   * blue section or the storm's purple arrives as a tint rather than as grey —
   * and it is pushed further than before because there is now half as much
   * paint on top to hide it. Brightness and contrast are the readability: over
   * a dark page the backdrop is lifted so the white type has something to sit
   * on, over a light one it is pressed down, and in both cases the contrast
   * term stops a busy photograph turning the bar into noise.
   *
   * One filter, not several stacked layers. Every additional backdrop-filter
   * is another backdrop root for the compositor to build on every frame, and
   * this bar is on screen for the whole visit.
   */
  const lift = overDark ? 'brightness(1.22)' : 'brightness(1.04)';
  styles.setProperty(
    '--nav-blur',
    dressed ? `saturate(210%) contrast(1.08) ${lift} blur(${NAV_BLUR_PX}px)` : 'none'
  );
  /*
   * The shadow separates the glass from the page rather than decorating it.
   *
   * Two of them now: a tight one that is the sheet's own contact shadow, and a
   * wider soft one that is what gives it somewhere to float. Deeper over a
   * dark page, because a light-coloured sheet on a dark ground needs less
   * help to be seen than the other way round.
   */
  const cast = overDark ? 0.34 : 0.1;
  styles.setProperty(
    '--nav-shadow',
    dressed
      ? `0 1px 2px rgba(0,0,0,${(cast * 0.5).toFixed(3)}), 0 8px 28px rgba(0,0,0,${cast.toFixed(3)})`
      : '0 1px 8px rgba(0,0,0,0)'
  );

  /*
   * Which way the light is coming from, and how hard the lip under it is.
   *
   * The rim is the colour of whatever is lighting the room: white on the two
   * neutral themes, and the mode's own violet in super designer mode, where a
   * white edge reads as a piece of another site's chrome. Both are used at
   * single-figure percentages — see the layers in SiteNav.astro — so what
   * changes between themes is the hue of the highlight rather than its
   * strength.
   */
  const superb = root.hasAttribute('data-super');
  styles.setProperty('--nav-rim', superb ? '#d8b4fe' : '#ffffff');
  styles.setProperty('--nav-lip', superb ? '#12002e' : '#000000');
  styles.setProperty('--nav-glass', dressed ? '1' : '0');
  styles.setProperty('--nav-ink', overDark ? '#ffffff' : '#1d1d1f');
  styles.setProperty('--logo-op', condensed ? '0' : '1');
  styles.setProperty('--logo-y', condensed ? '-10px' : '0px');
  styles.setProperty('--logo-pe', condensed ? 'none' : 'auto');

  const mark = document.querySelector<HTMLElement>('[data-logo] img');
  if (mark) mark.style.filter = overDark ? 'brightness(0) invert(1)' : 'none';

  /*
   * Where the light is caught, which is a function of how far the page has
   * moved and of nothing else.
   *
   * The brief for this material is that it should react to its environment
   * rather than perform on a clock, so there is no animation behind the
   * highlight: it is placed from the scroll offset, in the pass that was
   * already running for the ink and the pill, and it is therefore perfectly
   * still whenever the page is. A full sweep every two viewport-heights, so
   * across a long page the highlight crosses the bar a handful of times and
   * never fast enough to be watched.
   *
   * Quantised to two places and skipped when unchanged, because this is the
   * one value here that moves on most frames and a custom property write is a
   * style invalidation of everything that reads it.
   */
  const sweep = Math.round(((window.scrollY / (window.innerHeight * 2)) % 1) * 100) / 100;
  if (sweep !== lastSheen) {
    lastSheen = sweep;
    styles.setProperty('--nav-sheen', String(sweep));
  }
}

/** The last sheen written, so an unchanged one is not written again. */
let lastSheen = -1;

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
  /*
   * Tells the inline priming script that this module arrived.
   *
   * That script hides everything below the fold before the first paint, and
   * every route back out of that state — the observer, the no-observer
   * fallback, the four-second timer — lives in here. So if this file never
   * loads, all of it stays at opacity 0 for good. The fallback that covers
   * that is in BaseLayout and waits on this flag, because a fallback that
   * simply revealed everything on a timer would undo the scroll reveal for
   * anyone who reads slowly.
   */
  root.dataset.chrome = 'on';

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
    /*
     * And when super designer mode arrives, which changes both the ink test and
     * the pill's tint without changing the scroll position — so the cached
     * answer above would otherwise hold and the nav would keep the palette of
     * the theme the visitor just left.
     */
    document.addEventListener('mh:super', repaintChrome);
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
  holdNav();


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
    /*
     * The class comes off however the transition ends. `finally`, because the
     * browser rejects `finished` whenever it abandons one, and hiding the tab
     * mid-navigation is enough to do that.
     */
    transition.finished.finally(() => root.classList.remove('morphing')).catch(() => {});

    /*
     * The name comes off later, and never early.
     *
     * Releasing it the moment `finished` settled was taking it away while the
     * morph was still the thing on screen, and the cover stopped morphing at
     * all. Both of the ways a transition can end badly do this: an abandoned
     * one rejects immediately, and a skipped one *resolves* immediately, so
     * neither `finally` nor `then` is on its own a signal that the move is over.
     *
     * So it waits for the transition to settle and for the cover animation's
     * own length to have passed, whichever is later. The cost of being late is
     * nothing — an unused name sits there until the next navigation — and the
     * cost of being early is the effect itself.
     */
    const settled = transition.finished.catch(() => {});
    const elapsed = new Promise((done) => window.setTimeout(done, MORPH_MS + 140));
    const era = morphEra;

    void Promise.all([settled, elapsed]).then(() => {
      // A navigation that started while this was waiting has already named its
      // own cover, and releasing now would take that one instead.
      if (era === morphEra) releaseMorphNames();
    });
  } else {
    root.classList.remove('morphing');
    releaseMorphNames();
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
   * First, before anything reads it. The router has just wiped every attribute
   * off <html>, and the nav ink is decided from the theme.
   */
  restoreTheme();

  // And the hold, for the same reason: it was set before the swap and the wipe
  // has just taken it off again, one line above the passes that depend on it.
  holdNav();

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

/** How long the cover takes to move, matching mh-morph-radius in global.css. */
const MORPH_MS = 460;

/**
 * Counts navigations, so a release scheduled by one cannot land on the next.
 * Incremented before anything else the navigation does.
 */
let morphEra = 0;

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
 * Takes the name back off once the move is over.
 *
 * A `view-transition-name` was only ever cleared by the next navigation that
 * did not want it, so a cover kept its name for as long as the visitor stayed
 * on the page it landed on. That is not inert. Every transition the browser
 * starts captures every named element and hides the original underneath its
 * snapshot for the duration — so the next one to run, whether that is the
 * theme wipe or the fade into the following page, lifted the cover out and put
 * it back, and an aborted transition could leave a frame with neither the
 * snapshot nor the element painted. Which is a cover that flickers and
 * disappears while the block around it stays exactly where it is.
 *
 * The name is only needed between before-preparation and the end of the
 * transition. After that it is a claim on an animation nobody asked for.
 */
function releaseMorphNames(): void {
  document.querySelectorAll<HTMLElement>('[data-morph]').forEach((el) => {
    el.style.viewTransitionName = '';
    if (!el.getAttribute('style')) el.removeAttribute('style');
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

/* ---------------------------------------------------------------------- */
/* Links to the page you are already on                                     */
/* ---------------------------------------------------------------------- */

/*
 * A link to the current page scrolls to the top instead of navigating.
 *
 * The logo is the one that matters. On a phone it stays put at the top of every
 * page — the nav pill hides it once you scroll, but the phone header is the
 * logo and the burger, so it cannot — which makes it the easiest thing on the
 * screen to press while already on the home page. Doing that ran an entire
 * navigation to the same URL: a page transition, a full re-initialise, and
 * scroll restoration putting you back exactly where you started. All of that to
 * arrive where you already were.
 *
 * Scrolling up is what a logo is for anyway.
 *
 * Capture, not bubble: the router's own click handler is bound from the head
 * and so runs before anything bound down here. It does check whether the event
 * has been cancelled — but only a capturing listener gets to cancel it first.
 */
document.addEventListener(
  'click',
  (event) => {
    const mouse = event as MouseEvent;
    if (mouse.defaultPrevented || mouse.button !== 0) return;
    if (mouse.metaKey || mouse.ctrlKey || mouse.shiftKey || mouse.altKey) return;

    const link = (mouse.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

    const to = new URL(link.href, window.location.href);
    if (to.origin !== window.location.origin) return;
    // An in-page anchor is a link to somewhere, even on this page.
    if (to.hash) return;
    if (to.pathname !== window.location.pathname || to.search !== window.location.search) return;

    event.preventDefault();

    /*
     * After the other handlers, not before them.
     *
     * A link inside the mobile menu closes it, and closing it restores the
     * scroll position the page was locked at — which would land on top of this
     * and put the visitor straight back down the page.
     */
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }, 0);
  },
  true
);

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

  morphEra += 1;
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

  /*
   * And the nav is asked, once, two frames later.
   *
   * Not immediately: the scroll restore above lands on this turn of the loop,
   * and asking before the position it is responding to has settled is the
   * whole bug. By the second frame the answer is the real one, it is written
   * with no transition, and only then does the transition come back — so what
   * it covers from that point on is the visitor's own scrolling and nothing
   * else.
   */
  requestAnimationFrame(() => requestAnimationFrame(releaseNav));
  /*
   * And on a timer as well, because rAF does not run in a background tab.
   *
   * A navigation finished behind another tab would otherwise leave the nav
   * held — bare, and with no transition — until the visitor came back and the
   * frames started again. releaseNav is safe to run twice: it resets the cache,
   * asks once, and removes a property that may already be gone.
   */
  window.setTimeout(releaseNav, 500);
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
