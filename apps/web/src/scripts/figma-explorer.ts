/**
 * The design explorer's behaviour: when the iframe is built, and what is on
 * screen before and instead of it.
 *
 * There is no animation loop here and nothing that runs per frame, and there
 * is no observer either. Between a page loading and somebody pressing the
 * button in the explorer, this module does nothing at all.
 *
 * That last part is the design. An earlier version started the embed when the
 * section came within 400px of the viewport, which is the ordinary answer and
 * the wrong one here: a Figma embed is an entire application, and this
 * section sits four down a case study. Scrolling *past* something is not a
 * request for it. So the explorer introduces itself, and the document is not
 * fetched until a visitor says they want it — which also means the storm, the
 * cursor and the reveals never have to share the main thread with a Figma
 * boot nobody asked for.
 */

/**
 * How long to wait for the embed before calling it a failure.
 *
 * An iframe's `load` event fires for a served error page as readily as for the
 * real thing, and its `error` event fires for almost nothing — a cross-origin
 * document that refuses to render is still, to us, a document that loaded. So
 * the honest signal available here is time: Figma either paints within a few
 * seconds or something is wrong with the link, the sharing setting, or the
 * network. Twelve seconds is long enough not to libel a slow connection.
 */
const PATIENCE = 12000;

/*
 * The expand, in the same vocabulary as the lightbox.
 *
 * `--ease-glide` written out, because a Web Animations easing is not a place
 * a custom property is resolved, and this travel has to match the one the
 * pictures make or the site has two different ideas about how things grow.
 */
const GLIDE = 'cubic-bezier(0.33, 0.02, 0.18, 1)';
const OPEN_MS = 460;
const SHUT_MS = 380;

/** Timers keyed by the frame they are watching, so a swap can clear them. */
const timers = new WeakMap<HTMLElement, number>();

function state(root: HTMLElement, next: string): void {
  root.dataset.state = next;
}

/**
 * Builds the iframe, once.
 *
 * Everything about it is set here rather than in the markup because the
 * element does not exist until this runs — which is the point. An iframe in
 * the HTML is a request the browser makes whether or not anybody wants it,
 * and this one is only ever built in answer to a press.
 */
function load(root: HTMLElement): void {
  if (root.dataset.state !== 'invite') return;

  const stage = root.querySelector<HTMLElement>('[data-figma-stage]');
  const src = root.dataset.embed;
  if (!stage || !src) return;

  state(root, 'loading');

  const frame = document.createElement('iframe');
  frame.className = 'figma__frame';
  frame.src = src;
  frame.title = `${root.dataset.projectName || 'Project'} — design file`;
  frame.loading = 'lazy';
  /*
   * The embed needs to go fullscreen from inside itself, and nothing else.
   *
   * `allowfullscreen` is what lets Figma's own control work; the sandbox is
   * everything the embed genuinely needs and no more. Scripts and same-origin
   * together would normally be worth a second look — that pair lets a framed
   * document reach out of its sandbox — but the frame is cross-origin to us,
   * so `allow-same-origin` grants it its own origin and not ours.
   */
  frame.allow = 'fullscreen';
  frame.setAttribute('allowfullscreen', '');
  frame.referrerPolicy = 'strict-origin-when-cross-origin';

  const settle = () => {
    window.clearTimeout(timers.get(root));
    timers.delete(root);
  };

  frame.addEventListener('load', () => {
    settle();
    state(root, 'ready');
  });

  frame.addEventListener('error', () => {
    settle();
    state(root, 'error');
  });

  timers.set(
    root,
    window.setTimeout(() => {
      if (root.dataset.state === 'loading') state(root, 'error');
    }, PATIENCE)
  );

  stage.appendChild(frame);
}

/* ---------------------------------------------------------------- expand -- */

/**
 * Whichever explorer is currently expanded, and what it has to go back to.
 *
 * One at a time, always: two Figma documents at full size is two application
 * instances, and there is no reading position from which both are useful.
 */
let big: {
  root: HTMLElement;
  stage: HTMLElement;
  hold: HTMLElement;
  veil: HTMLElement;
  flight: Animation | null;
} | null = null;

const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Where the stage has to go to sit in the middle of the viewport, and how much
 * bigger it is allowed to get.
 *
 * `--------- why a transform and not a bigger box ---------`
 *
 * Because Figma's embed fits the design to its container exactly once, on
 * load, and then holds that zoom and its top-left anchor for the life of the
 * document. Resizing the container does not re-fit — measured, not assumed:
 * taking the stage from 1080x576 to 1440x900 left the design at precisely its
 * old size, pinned to the top left, with every pixel of the new room added as
 * empty canvas below and to the right. The embed's postMessage channel
 * carries prototype events and nothing that sets a viewport, so there is no
 * way to ask for a new fit short of loading the document again.
 *
 * Scaling asks for nothing. The iframe keeps the size it was fitted at, so
 * the fit is still the right fit and the design is still centred in it; only
 * the magnification changes. That is why expanding does not reload — an
 * earlier version of this did, and a reload is a second or two of skeleton
 * and the loss of wherever the visitor had panned to, in exchange for a
 * centring that the transform gives away for free.
 *
 * The cap is there because a 3x embed is a 3x set of Figma's own controls
 * sitting in the corner of the screen. Past about double, the thing being
 * magnified stops looking like a design and starts looking like a screenshot
 * of one.
 */
const MAX_SCALE = 2;

function flightTo(box: DOMRect): string {
  const k = Math.min(
    MAX_SCALE,
    (window.innerWidth * 0.98) / box.width,
    (window.innerHeight * 0.98) / box.height
  );
  const dx = (window.innerWidth - box.width * k) / 2 - box.left;
  const dy = (window.innerHeight - box.height * k) / 2 - box.top;
  return `translate(${dx}px, ${dy}px) scale(${k})`;
}

/**
 * Grows the stage out of the page and into the middle of the viewport.
 *
 * The box never changes, which is the whole trick — see `MAX_SCALE`. What
 * changes is one transform on one element, which is a compositor property and
 * nothing else: no layout, no paint, and no resize event reaching the embed.
 *
 * This is not the browser's fullscreen either, and that is also deliberate.
 * Real fullscreen changes the viewport, so the page behind relays out
 * mid-flight and there is no longer a place for the box to have grown *from*;
 * the travel cannot land. An overlay keeps one viewport from the first frame
 * to the last, which is what the pictures on this site already do when they
 * open.
 *
 * The stage goes `fixed` where it already is, and is never moved in the DOM —
 * re-parenting an iframe reloads it. `hold` is a plain div of the same height
 * left in its place so the section does not collapse and the page behind does
 * not jump while the design is up.
 */
function grow(root: HTMLElement, stage: HTMLElement): void {
  if (big) return;

  const from = stage.getBoundingClientRect();

  const hold = document.createElement('div');
  hold.className = 'figma__hold';
  hold.style.height = from.height + 'px';
  hold.setAttribute('aria-hidden', 'true');
  stage.before(hold);

  const veil = document.createElement('div');
  veil.className = 'figma__veil';
  document.body.appendChild(veil);

  stage.classList.add('figma__stage--big');
  stage.style.left = from.left + 'px';
  stage.style.top = from.top + 'px';
  stage.style.width = from.width + 'px';
  stage.style.height = from.height + 'px';

  document.documentElement.style.overflow = 'hidden';
  root.dataset.full = 'yes';

  const to = flightTo(from);
  big = { root, stage, hold, veil, flight: null };

  /*
   * The end state is written to the element, and only then is the animation
   * thrown away.
   *
   * A `fill` keeps the last keyframe applied for as long as the animation
   * object is alive, which is the correct behaviour and a trap: leave it
   * filling and it outranks the stylesheet for the rest of the page's life.
   * This is exactly how the collapse used to leave a stage with a frozen
   * width and height behind it.
   */
  const land = (value: string) => {
    stage.style.transform = value;
    big?.flight?.cancel();
    if (big) big.flight = null;
  };

  if (reduced()) {
    veil.style.opacity = '1';
    land(to);
    return;
  }

  veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS, easing: GLIDE, fill: 'both' });

  big.flight = stage.animate([{ transform: 'none' }, { transform: to }], {
    duration: OPEN_MS,
    easing: GLIDE,
    fill: 'both',
  });

  big.flight.finished.then(() => land(to)).catch(() => {});
}

/** And back, by the same one property. */
function shrink(): void {
  if (!big) return;
  const { root, stage, hold, veil, flight } = big;
  flight?.cancel();

  const done = (animation?: Animation) => {
    // Cancelled before the class comes off, for the reason given in `land`.
    animation?.cancel();
    stage.classList.remove('figma__stage--big');
    stage.removeAttribute('style');
    hold.remove();
    veil.remove();
    document.documentElement.style.removeProperty('overflow');
    root.dataset.full = 'no';
    big = null;
  };

  if (reduced()) {
    done();
    return;
  }

  veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SHUT_MS, easing: GLIDE, fill: 'both' });

  const back = stage.animate(
    [{ transform: getComputedStyle(stage).transform }, { transform: 'none' }],
    { duration: SHUT_MS, easing: GLIDE, fill: 'both' }
  );

  back.finished.then(() => done(back)).catch(() => done(back));
}

export function bindFigmaExplorer(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const root = target.closest<HTMLElement>('[data-figma]');
    if (!root) return;

    /*
     * The invitation being accepted.
     *
     * Two things happen and they overlap on purpose: the state moves to
     * `loading`, which puts the skeleton up immediately, and the character
     * is given a class that fades him over the top of it. He is not removed
     * — `astro:before-swap` takes the whole page anyway — because removing
     * him mid-transition is a layout change in the middle of a fade, and
     * leaving him at `pointer-events: none` and zero opacity costs nothing.
     *
     * `load()` is the same function the observer used to call, unchanged. The
     * iframe does not exist before this line runs, which is the requirement:
     * nothing is hidden and revealed, the document is genuinely not asked
     * for until now.
     */
    if (target.closest('[data-figma-open]')) {
      const invite = root.querySelector<HTMLElement>('.figma__invite');
      invite?.classList.add('figma__invite--going');
      load(root);
      return;
    }

    if (target.closest('[data-figma-full]')) {
      const stage = root.querySelector<HTMLElement>('[data-figma-stage]');
      if (!stage) return;
      if (big) shrink();
      else grow(root, stage);
      return;
    }

    /*
     * The first touch arms the canvas, and until then the page scrolls.
     *
     * An iframe that pans and zooms is a hole in a scrolling page: a finger
     * that lands on it is talking to Figma, so the page underneath cannot be
     * scrolled past the explorer. The shield takes that first touch, and once
     * it is dismissed the canvas behaves exactly as Figma intends. There is no
     * equivalent problem with a mouse, so the shield is only rendered where
     * there is no hover.
     */
    if (target.closest('[data-figma-arm]')) {
      root.dataset.armed = 'yes';
    }
  });

  /*
   * Escape closes it, because this is an overlay rather than the browser's
   * own fullscreen and nothing else is going to hear that key on our behalf.
   */
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && big) {
      event.preventDefault();
      shrink();
    }
  });

  /*
   * A resize while the design is open is a new viewport to fill. The box is
   * set outright rather than animated: the visitor is already dragging the
   * window edge, and a box easing after it reads as lag rather than as
   * motion.
   */
  window.addEventListener('resize', () => {
    if (!big || big.flight) return;
    const stage = big.stage;
    /*
     * Measured with the transform off, because `flightTo` works from the box
     * the stage would occupy unmagnified — and `getBoundingClientRect` reports
     * the transformed box, so asking while scaled would compound the scale.
     */
    stage.style.transform = 'none';
    const to = flightTo(stage.getBoundingClientRect());
    stage.style.transform = to;
  });

  /*
   * The page on the way out takes its explorers with it.
   *
   * Which is most of the cleanup for free — the iframe is a child of the
   * section, so the router detaching the page detaches the embed and the
   * Figma application inside it goes with the document. What does not go on
   * its own is the patience timer, which is keyed to an element that is about
   * to stop existing and would otherwise fire into nothing a few seconds into
   * the next project.
   */
  document.addEventListener('astro:before-swap', () => {
    document.querySelectorAll<HTMLElement>('[data-figma]').forEach((root) => {
      window.clearTimeout(timers.get(root));
      timers.delete(root);
    });
    /*
     * The page under an expanded design is about to be replaced, and the
     * scroll lock lives on <html>, which is not. Torn down outright rather
     * than animated shut: the box it would travel back into is already gone.
     */
    if (big) {
      big.veil.remove();
      document.documentElement.style.removeProperty('overflow');
      big = null;
    }
  });
}
