/**
 * Opening a picture over the page, and putting it back.
 *
 * One dialog, reused. Every image that can be opened is marked in the page
 * with `data-zoom` on its frame, and everything below works from that mark
 * alone — so a new section with pictures in it opts in by saying so, and there
 * is no list here to keep in step with the templates.
 *
 * The travel is a flip: the clone starts life at the exact rectangle of the
 * thumbnail that was clicked, scaled and offset onto it, and animates to the
 * place layout has already put it. Nothing is measured twice and nothing is
 * animated from a guess — the browser lays the big version out, and the
 * animation is the difference between where it is and where it came from.
 */

/** How long the picture takes to arrive, and to go back. */
const TRAVEL_MS = 520;
const RETURN_MS = 420;

/** The frame currently opened, so it can be given its image back. */
let origin: HTMLElement | null = null;
/** Whatever had focus before, so the visitor is put back where they were. */
let camefrom: HTMLElement | null = null;
let open = false;
let flight: Animation | null = null;

/**
 * The travelling surface, and everything the zoom needs while it is up.
 *
 * `surface` is the box that moves: a fixed div clipping the picture, carrying
 * the corner radius, and animated from the thumbnail's rectangle to the
 * fitted one. `big` is the picture inside it, which the zoom transforms and
 * the travel never touches. Keeping the two apart is what lets the same
 * element be a shared-element transition on the way in and a pan-and-zoom
 * viewport once it has arrived.
 */
let surface: HTMLElement | null = null;
let big: HTMLImageElement | null = null;
/** Where the picture lands, so the zoom knows what it is panning inside. */
let fitted = { width: 0, height: 0 };
let zoom = 1;
let panX = 0;
let panY = 0;

function reduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Four corner marks, drawn rather than imported.
 *
 * The same hairline weight the nav's marks and the grid overlay use, so this
 * belongs to the site rather than to whichever icon set it came from. Corners
 * pointing outward is the one drawing everybody reads as "bigger" without a
 * label, and unlike a magnifying glass it does not promise a zoom control the
 * dialog does not have.
 */
function badge(): HTMLElement {
  const mark = document.createElement('span');
  mark.className = 'zoom-badge';
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML =
    '<svg viewBox="0 0 18 18" width="16" height="16" focusable="false">' +
    '<path d="M7 2H2v5M11 2h5v5M7 16H2v-5M11 16h5v-5" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return mark;
}

/**
 * Marks up every openable frame on the page that is not marked up yet.
 *
 * Runs on each navigation. The guard is the badge's own presence rather than a
 * flag: the router can swap in a page that was already prepared once and is
 * being restored from the back/forward cache, and asking the DOM what it
 * actually has is the only answer that is true in both cases.
 */
export function stampZoomables(): void {
  document.querySelectorAll<HTMLElement>('[data-zoom]').forEach((frame) => {
    const image = frame.querySelector('img');
    // A cover with no picture in it is initials on a colour, and there is
    // nothing to open.
    if (!image) return;
    if (frame.querySelector('.zoom-badge')) return;

    frame.appendChild(badge());

    /*
     * It is a button, and it has to say so.
     *
     * A div that opens a dialog is unreachable by keyboard and unannounced by
     * a screen reader. The alt text is already the description of the picture,
     * so the label is that plus what pressing it does.
     */
    frame.setAttribute('role', 'button');
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('aria-label', `${image.getAttribute('alt') || 'Image'} — open full screen`);
  });
}

/** Where an element is on screen right now. */
function box(el: Element): DOMRect {
  return el.getBoundingClientRect();
}

/* ---------------------------------------------------------------------- */
/* Looking closer                                                          */
/* ---------------------------------------------------------------------- */

/**
 * How far in the picture will go, and in what steps.
 *
 * Four is enough to read a caption in a screenshot designed at fifteen hundred
 * pixels and not so far that the visitor is lost inside a blur. The click
 * steps rather than sliding because a click is a discrete gesture: it should
 * land somewhere definite and be undoable by clicking again.
 */
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.6;

/**
 * Keeps the picture covering its own window.
 *
 * At any zoom the image is `fitted * zoom` and the window is `fitted`, so the
 * pan can run to half the difference in each direction before an edge comes
 * inside the frame. Clamping here rather than at the point of each gesture
 * means the wheel, the drag, the bar and a window resize all obey the same
 * rule, and none of them can leave the picture somewhere the others would not
 * have allowed.
 */
function clampPan(): void {
  const slackX = Math.max(0, (fitted.width * zoom - fitted.width) / 2);
  const slackY = Math.max(0, (fitted.height * zoom - fitted.height) / 2);
  panX = Math.max(-slackX, Math.min(slackX, panX));
  panY = Math.max(-slackY, Math.min(slackY, panY));
}

/** Writes the current zoom to the picture and to the bar, and nowhere else. */
function paintZoom(animate = false): void {
  if (!big || !surface) return;
  clampPan();

  big.style.transition = animate ? 'transform 260ms cubic-bezier(0.33, 0.02, 0.18, 1)' : '';
  big.style.transform = `translate3d(${panX.toFixed(1)}px, ${panY.toFixed(1)}px, 0) scale(${zoom.toFixed(3)})`;

  surface.dataset.zoomed = zoom > 1.001 ? 'yes' : 'no';

  const shell = document.querySelector<HTMLElement>('[data-lightbox]');
  const fill = shell?.querySelector<HTMLElement>('[data-zoom-fill]');
  const label = shell?.querySelector<HTMLElement>('[data-zoom-label]');
  const at = (zoom - 1) / (ZOOM_MAX - 1);
  if (fill) fill.style.setProperty('--at', String(Math.max(0, Math.min(1, at))));
  if (label) label.textContent = `${Math.round(zoom * 100)}%`;
  shell?.classList.toggle('is-zoomed', zoom > 1.001);
}

/**
 * Zooms about a point rather than about the middle.
 *
 * Zooming about the centre is the thing that makes an image viewer feel like a
 * form control: you aim at a detail, press, and the detail leaves. Holding the
 * point under the cursor still is what makes it feel like moving a lens — the
 * pan is adjusted by exactly the amount that point would otherwise have
 * travelled, which is its offset from centre times the change in scale.
 */
function zoomTo(next: number, atX?: number, atY?: number, animate = true): void {
  if (!surface) return;
  const was = zoom;
  zoom = Math.max(1, Math.min(ZOOM_MAX, next));
  if (zoom === was) return;

  if (atX !== undefined && atY !== undefined) {
    const r = box(surface);
    const ox = atX - (r.left + r.width / 2);
    const oy = atY - (r.top + r.height / 2);
    const k = zoom / was;
    panX = (panX - ox) * k + ox;
    panY = (panY - oy) * k + oy;
  }

  // Home again the moment it is all visible: a picture at its own size has
  // nowhere to be panned to, and leaving an offset behind would show as a
  // shift the next time somebody zoomed in.
  if (zoom === 1) {
    panX = 0;
    panY = 0;
  }

  paintZoom(animate);
}

/** Everything the zoom knows, forgotten. Called on open and on close. */
function resetZoom(): void {
  zoom = 1;
  panX = 0;
  panY = 0;
  if (big) {
    big.style.transition = '';
    big.style.transform = '';
  }
  document.querySelector('[data-lightbox]')?.classList.remove('is-zoomed');
}

/**
 * The rectangle the picture is allowed, and the size it takes inside it.
 *
 * Its own function because the open, the close and a window resize all need
 * the same answer, and a second copy of this arithmetic is a second chance for
 * the picture to go home somewhere slightly wrong.
 */
function fit(source: HTMLImageElement, stage: HTMLElement) {
  const wide = source.naturalWidth || Number(source.getAttribute('width')) || 1;
  const tall = source.naturalHeight || Number(source.getAttribute('height')) || 1;
  const room = box(stage);
  // Never past its own resolution: a picture blown up beyond what it holds is
  // not the work at the size it was made, it is the work out of focus.
  const k = Math.min(room.width / wide, room.height / tall, 1);
  const width = Math.round(wide * k);
  const height = Math.round(tall * k);
  return {
    width,
    height,
    left: Math.round(room.left + (room.width - width) / 2),
    top: Math.round(room.top + (room.height - height) / 2),
  };
}

function show(frame: HTMLElement): void {
  if (open) return;

  const source = frame.querySelector('img');
  const shell = document.querySelector<HTMLElement>('[data-lightbox]');
  const stage = document.querySelector<HTMLElement>('[data-lightbox-stage]');
  const close = document.querySelector<HTMLElement>('[data-lightbox-close]');
  if (!source || !shell || !stage || !close) return;

  origin = frame;
  camefrom = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  open = true;

  shell.hidden = false;

  /*
   * The thumbnail's own box, not the image's.
   *
   * The frame is what has the corner radius and the `overflow: hidden`, and it
   * is what the visitor sees — the <img> inside it is larger than the frame
   * and cropped by it. Measuring the image would start the travel from a
   * rectangle nobody can see, off the edges of the one they clicked.
   */
  const from = box(frame);
  const fromRadius = getComputedStyle(frame).borderTopLeftRadius || '0px';

  const to = fit(source, stage);
  fitted = { width: to.width, height: to.height };

  /*
   * One surface, clipping one picture — and this is the whole of the fix.
   *
   * What was here before scaled a copy of the <img> from the thumbnail's
   * rectangle to the fitted one, which cannot be right whatever the easing:
   * the thumbnail is `object-fit: cover` at whatever aspect the layout gave
   * it, so what it shows is a *crop*. Measured on this page, one frame renders
   * at 1.598 against a picture whose own aspect is 1.406. Scaling the crop up
   * uniformly can only ever produce a bigger crop, so the moment the real
   * picture appeared the two disagreed and the eye read a swap. The old code
   * covered that disagreement with an opacity fade — 0.65 in, 0.4 out — which
   * is the flicker rather than a cure for it.
   *
   * A box that clips, with the picture filling it at `cover`, has the
   * disagreement built into it instead. As the box travels its aspect goes
   * from the thumbnail's to the picture's own, and `cover` resolves to the
   * whole image at exactly the frame the box reaches the fitted aspect. The
   * crop opens continuously. Nothing fades, nothing is swapped, and the corner
   * radius is a property of the same box, so it interpolates with everything
   * else rather than being switched at either end.
   */
  surface = document.createElement('div');
  surface.className = 'lightbox__surface';
  surface.dataset.zoomed = 'no';

  big = source.cloneNode(true) as HTMLImageElement;
  big.removeAttribute('loading');
  big.removeAttribute('data-reveal');
  big.className = 'lightbox__pic';
  big.draggable = false;

  surface.append(big);
  stage.replaceChildren();
  shell.append(surface);
  resetZoom();

  shell.setAttribute('aria-hidden', 'false');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  shell.classList.add('is-open');
  document.documentElement.style.overflow = 'hidden';

  const land = () => {
    if (!surface) return;
    surface.style.left = `${to.left}px`;
    surface.style.top = `${to.top}px`;
    surface.style.width = `${to.width}px`;
    surface.style.height = `${to.height}px`;
    surface.style.borderRadius = 'var(--r-lg)';
  };

  if (reduced()) {
    land();
    source.style.visibility = 'hidden';
    close.focus({ preventScroll: true });
    return;
  }

  /*
   * Geometry, not transform, and deliberately so.
   *
   * A transform cannot change what `cover` crops — it scales the result,
   * including the crop — so the reveal above is only available by animating
   * the box itself. That is four layout properties on one fixed element with
   * no siblings and nothing in flow beneath it, for four hundred
   * milliseconds, once per opening. It reflows nothing else on the page.
   */
  flight = surface.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        borderRadius: fromRadius,
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        borderRadius: 'var(--r-lg)',
      },
    ],
    // --ease-glide, written out: a Web Animations easing is not a place a
    // custom property is resolved, and the site's own glide is what every
    // other travel on the page uses.
    { duration: TRAVEL_MS, easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)', fill: 'both' }
  );

  flight.finished
    .then(() => {
      land();
      flight?.cancel();
      flight = null;
    })
    .catch(() => {});

  /*
   * The thumbnail steps aside for exactly as long as its picture is elsewhere.
   *
   * Hidden rather than removed, so the section keeps its shape — and hidden on
   * this frame rather than after the travel, because the surface is already
   * sitting precisely on top of it and two copies of the same picture in the
   * same place is the duplicate flash this is meant to avoid.
   */
  source.style.visibility = 'hidden';

  close.focus({ preventScroll: true });
}

function hide(): void {
  if (!open) return;

  const shell = document.querySelector<HTMLElement>('[data-lightbox]');
  const source = origin?.querySelector<HTMLImageElement>('img') ?? null;
  const frame = origin;
  if (!shell) return;

  open = false;
  flight?.cancel();
  flight = null;

  shell.classList.remove('is-open');

  const panel = surface;
  const picture = big;
  surface = null;
  big = null;

  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;

    /*
     * The thumbnail comes back first, and the surface leaves second.
     *
     * They are on top of each other by this point — the travel has landed on
     * exactly the rectangle the thumbnail occupies — so restoring one before
     * removing the other means there is never a frame with neither of them on
     * screen. That single-frame hole is what read as a snap. Doing it the
     * other way round is free to write and impossible to unsee.
     */
    if (source) source.style.removeProperty('visibility');
    panel?.remove();

    shell.hidden = true;
    shell.setAttribute('aria-hidden', 'true');
    shell.removeAttribute('role');
    shell.removeAttribute('aria-modal');
    shell.classList.remove('is-zoomed');
    document.documentElement.style.removeProperty('overflow');
    origin = null;
    camefrom?.focus({ preventScroll: true });
    camefrom = null;
  };

  if (!panel || !frame || !source || reduced()) {
    done();
    return;
  }

  /*
   * Home is measured again rather than remembered.
   *
   * The page can have moved underneath: the router restores a scroll position,
   * a lazy image below the fold lands and pushes the section down, the window
   * is resized while the picture is open. Re-reading is the difference between
   * the picture going home and the picture going where home used to be.
   */
  const to = box(frame);
  const toRadius = getComputedStyle(frame).borderTopLeftRadius || '0px';
  const now = box(panel);

  /*
   * Anything the zoom did is undone on the way out, in the same movement.
   *
   * Snapping back to 1 first and then travelling would be two gestures, and
   * the first of them would be a jump. Animating the picture's own transform
   * alongside the surface's geometry means a visitor who closes while zoomed
   * in watches one continuous thing: the detail pulls back, the box shrinks,
   * and both arrive together.
   */
  if (picture && zoom > 1.001) {
    picture.style.transition = '';
    picture.animate(
      [
        { transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})` },
        { transform: 'translate3d(0, 0, 0) scale(1)' },
      ],
      { duration: RETURN_MS, easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)', fill: 'forwards' }
    );
  }

  const back = panel.animate(
    [
      {
        left: `${now.left}px`,
        top: `${now.top}px`,
        width: `${now.width}px`,
        height: `${now.height}px`,
        borderRadius: getComputedStyle(panel).borderTopLeftRadius,
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        borderRadius: toRadius,
      },
    ],
    { duration: RETURN_MS, easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)', fill: 'forwards' }
  );

  back.finished.then(done).catch(done);

  /*
   * And a promise is not a guarantee.
   *
   * `finished` never settles if the animation is cancelled by something else,
   * and it does not settle on time if the tab is in the background when the
   * visitor closes the picture and the frame clock stops. Either way the
   * dialog would stay up over a page nobody can reach. The timeout is the
   * floor under that: a little past the travel, and whichever gets there first
   * takes it down.
   */
  window.setTimeout(done, RETURN_MS + 120);
}

/**
 * One set of listeners on `document`, for the life of the tab.
 *
 * Delegated rather than bound per image: the router replaces the article on
 * every navigation, and anything attached to a picture would be attached to a
 * picture that is no longer in the page.
 */
/**
 * Everything that happens to a picture once it has arrived.
 *
 * Bound to the dialog rather than to the surface, because the surface is
 * rebuilt for every opening and the dialog is not — and delegated for the
 * same reason every other listener in this file is.
 */
function bindZoom(): void {
  const shell = document.querySelector<HTMLElement>('[data-lightbox]');
  const bar = shell?.querySelector<HTMLElement>('[data-zoom-bar]');
  if (!shell) return;

  /*
   * A click steps in, and a click at the far end steps all the way out.
   *
   * Not a toggle between two states and not a slider disguised as a click: it
   * multiplies, so each press goes the same proportional distance as the last
   * and the sequence reads as evenly spaced. At the top it returns to 1 rather
   * than stopping dead, which is what makes it undoable without hunting for a
   * control — the same gesture that got you in gets you out.
   *
   * It zooms about the pointer, so the thing being aimed at is the thing that
   * stays still.
   */
  shell.addEventListener('click', (event) => {
    if (!open || !surface) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-lightbox-close]') || target.closest('[data-zoom-bar]')) return;
    if (!target.closest('.lightbox__surface')) return;
    if (dragged) return;

    const next = zoom >= ZOOM_MAX - 0.001 ? 1 : zoom * ZOOM_STEP;
    zoomTo(next, event.clientX, event.clientY);
  });

  /*
   * Dragging moves the picture, not the page.
   *
   * Pointer events rather than mouse ones, so a finger and a stylus work
   * without a second implementation, and capture so a drag that leaves the
   * window still ends properly. `dragged` is what stops a drag from also
   * counting as a click when the pointer comes back up — without it, panning
   * across a picture would zoom it at the end of every gesture.
   */
  let downX = 0;
  let downY = 0;
  let fromX = 0;
  let fromY = 0;
  let dragging = false;

  shell.addEventListener('pointerdown', (event) => {
    if (!open || !surface || zoom <= 1.001) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.lightbox__surface')) return;

    dragging = true;
    dragged = false;
    downX = event.clientX;
    downY = event.clientY;
    fromX = panX;
    fromY = panY;
    surface.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  shell.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - downX;
    const dy = event.clientY - downY;
    // Three pixels of slop, so a click with an unsteady hand is still a click.
    if (!dragged && Math.hypot(dx, dy) > 3) dragged = true;
    panX = fromX + dx;
    panY = fromY + dy;
    paintZoom();
  });

  const release = () => {
    if (!dragging) return;
    dragging = false;
    // Cleared on the next task, not on this one: the click that follows this
    // pointerup has to still be able to see that a drag happened.
    window.setTimeout(() => {
      dragged = false;
    }, 0);
  };
  shell.addEventListener('pointerup', release);
  shell.addEventListener('pointercancel', release);

  /*
   * The wheel zooms rather than scrolls, because the page behind is locked and
   * a wheel that does nothing is a control that appears broken.
   */
  shell.addEventListener(
    'wheel',
    (event) => {
      if (!open || !surface) return;
      event.preventDefault();
      const k = Math.exp(-event.deltaY * 0.0016);
      zoomTo(zoom * k, event.clientX, event.clientY, false);
    },
    { passive: false }
  );

  /*
   * And the bar, which is the same gesture in a different place.
   *
   * Dragging anywhere on the track sets the zoom directly — grabbing the thumb
   * is not required, because a five pixel thumb is not a target on a phone.
   * It zooms about the middle, since there is no pointer position on the
   * picture to hold still.
   */
  if (bar) {
    let sliding = false;

    const setFrom = (clientY: number) => {
      const r = box(bar);
      const at = 1 - Math.max(0, Math.min(1, (clientY - r.top) / r.height));
      zoomTo(1 + at * (ZOOM_MAX - 1), undefined, undefined, false);
    };

    bar.addEventListener('pointerdown', (event) => {
      sliding = true;
      bar.setPointerCapture(event.pointerId);
      setFrom(event.clientY);
      event.preventDefault();
      event.stopPropagation();
    });
    bar.addEventListener('pointermove', (event) => {
      if (sliding) setFrom(event.clientY);
    });
    const stop = () => {
      sliding = false;
    };
    bar.addEventListener('pointerup', stop);
    bar.addEventListener('pointercancel', stop);
  }

  /*
   * Plus and minus, because a keyboard user has no wheel and no pointer to
   * zoom about. Zero is the way back, which is what every other viewer on the
   * machine already uses.
   */
  document.addEventListener('keydown', (event) => {
    if (!open) return;
    if (event.key === '+' || event.key === '=') zoomTo(zoom * ZOOM_STEP);
    else if (event.key === '-' || event.key === '_') zoomTo(zoom / ZOOM_STEP);
    else if (event.key === '0') zoomTo(1);
    else return;
    event.preventDefault();
  });
}

/** Whether the pointer moved far enough for this gesture to be a pan. */
let dragged = false;

export function bindLightbox(): void {
  bindZoom();

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (open) {
      if (target.closest('[data-lightbox-close]') || target.closest('[data-lightbox-veil]')) {
        hide();
      }
      return;
    }

    const frame = target.closest<HTMLElement>('[data-zoom]');
    if (!frame) return;

    /*
     * Not while the interface is being taken apart.
     *
     * The storm has its own copy of every element's position and is animating
     * against it; opening a dialog in the middle of that would measure a
     * thumbnail mid-flight and put the picture back somewhere the page has no
     * intention of leaving it.
     */
    if (document.documentElement.classList.contains('dm-shattered')) return;

    event.preventDefault();
    show(frame);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      hide();
      return;
    }

    if (open) return;

    // Space and Enter on a frame, because it is announced as a button and a
    // button that only answers a mouse is a lie told to a screen reader.
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const frame = document.activeElement?.closest<HTMLElement>('[data-zoom]');
    if (!frame) return;
    event.preventDefault();
    show(frame);
  });

  /*
   * A navigation closes it, and closes it without the flight home.
   *
   * The page the picture came out of is on its way out, so there is nothing to
   * return to — and the router would swap the article out from under a running
   * animation.
   */
  document.addEventListener('astro:before-preparation', () => {
    if (open) hide();
  });

  document.addEventListener('astro:page-load', stampZoomables);
  stampZoomables();
}
