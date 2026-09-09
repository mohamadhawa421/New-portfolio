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

  const from = box(source);

  /*
   * Shown before anything is measured, and that order is the whole of it.
   *
   * The stage has no rectangle at all while the dialog is display:none, so
   * every measurement below has to happen with it laid out. Nothing is painted
   * in between — `is-open` is what fades the veil in, and that is still a
   * frame away.
   */
  shell.hidden = false;

  /*
   * A clone rather than the image itself.
   *
   * Moving the original out of the page would collapse the layout under it and
   * reflow the whole section behind the veil, and the visitor would find the
   * article rearranged when they closed the picture. The clone costs nothing:
   * the browser already has these bytes and this element's own decode is a
   * frame at most, which the fit below does not wait for anyway.
   */
  const big = source.cloneNode(true) as HTMLImageElement;
  big.removeAttribute('loading');
  big.removeAttribute('data-reveal');

  /*
   * Fitted here rather than by the stylesheet, and told its size outright.
   *
   * A cloned <img> starts its own request even when the bytes are already in
   * the cache, so for the first frame or two of its life it is `complete:
   * false` with a natural size of zero — and the `width`/`height` attributes
   * that would normally hold its place are presentation hints, outranked by
   * any real rule. Left to CSS the clone therefore laid out at nothing, the
   * flip measured a target of zero, and the travel silently degraded to a
   * fade. It did exactly that until this was found.
   *
   * The original is on screen and decoded, so its natural size is known. The
   * stage is a fixed room. Fitting one into the other is two divisions, and
   * the answer does not wait on anything.
   */
  /*
   * Its real size, from whichever of the three sources actually knows it.
   *
   * `naturalWidth` is the truth once the picture has decoded, and zero before
   * — which is not the rare case it sounds like: every gallery image is
   * `loading="lazy"`, so one that has only just scrolled into view can be
   * clicked before it has finished. The `width` and `height` attributes are
   * the intrinsic size the CMS exported and are there from the first byte of
   * HTML, so they answer while the bytes are still arriving.
   *
   * The rendered rectangle is the last resort and would be a poor primary: the
   * thumbnail is smaller than the room it is about to open into, so a fit
   * computed from it comes out capped at 1 and the picture opens at exactly
   * the size it already was. Which is the whole of what this is for.
   */
  const wide = source.naturalWidth || Number(source.getAttribute('width')) || from.width;
  const tall = source.naturalHeight || Number(source.getAttribute('height')) || from.height;
  const room = box(stage);

  if (wide && tall && room.width && room.height) {
    // Never past its own resolution: a picture blown up beyond what it holds
    // is not the work at the size it was made, it is the work out of focus.
    const fit = Math.min(room.width / wide, room.height / tall, 1);
    big.style.width = `${Math.round(wide * fit)}px`;
    big.style.height = `${Math.round(tall * fit)}px`;
  }

  big.style.opacity = '0';
  stage.replaceChildren(big);

  shell.setAttribute('aria-hidden', 'false');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  /*
   * The veil starts fading on this frame, not the next one.
   *
   * A transition needs a computed starting value to run from, which an element
   * inside `display: none` does not have — so the class cannot simply be added
   * with the attribute. It used to wait a `requestAnimationFrame` for that,
   * which is a frame of the picture standing on a clear page, and is no frame
   * at all in a tab whose clock is stopped: the dialog opened with no veil
   * behind it and no way to see the close button.
   *
   * The measurement above has already flushed layout with the dialog visible,
   * so the veil's zero is real by the time this line runs and the transition
   * has its start. No wait, and nothing that depends on a frame arriving.
   */
  shell.classList.add('is-open');

  /*
   * The page is held still while this is up.
   *
   * The native bar is already hidden, so there is no width to compensate for
   * and nothing shifts — which is the one thing that usually makes a scroll
   * lock worse than the scrolling it prevents.
   */
  document.documentElement.style.overflow = 'hidden';

  /*
   * Laid out at its real size first, and only then told where it came from.
   *
   * Reading the target rectangle has to happen after the clone is in the
   * document and before anything is transformed onto it, or the measurement is
   * of the transform rather than of the layout.
   */
  const to = box(big);
  big.style.opacity = '';

  if (reduced() || !to.width || !from.width) {
    big.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 1 : 240, easing: 'ease-out' });
  } else {
    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);

    flight = big.animate(
      [
        { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`, opacity: 0.65 },
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      ],
      // --ease-glide, written out: a Web Animations easing is not a place a
      // custom property is resolved, and the site's own glide is what every
      // other travel on the page uses.
      { duration: TRAVEL_MS, easing: 'cubic-bezier(0.33, 0.02, 0.18, 1)' }
    );

    // The thumbnail is not in two places at once. It comes back the moment the
    // big one starts going home.
    source.style.visibility = 'hidden';
  }

  close.focus({ preventScroll: true });
}

function hide(): void {
  if (!open) return;

  const shell = document.querySelector<HTMLElement>('[data-lightbox]');
  const stage = document.querySelector<HTMLElement>('[data-lightbox-stage]');
  const big = stage?.querySelector<HTMLImageElement>('img');
  const source = origin?.querySelector<HTMLImageElement>('img') ?? null;
  if (!shell || !stage) return;

  open = false;
  flight?.cancel();
  flight = null;

  shell.classList.remove('is-open');

  let finished = false;
  const done = () => {
    /*
     * Once, however it is arrived at.
     *
     * There are two ways here — the flight home ending, and the timeout below
     * that does not trust it to. A dialog that tears its own contents down
     * twice would put focus back twice and clear an overflow lock somebody
     * else might by then have set.
     */
    if (finished) return;
    finished = true;

    stage.replaceChildren();
    shell.hidden = true;
    shell.setAttribute('aria-hidden', 'true');
    shell.removeAttribute('role');
    shell.removeAttribute('aria-modal');
    document.documentElement.style.removeProperty('overflow');
    if (source) source.style.removeProperty('visibility');
    origin = null;
    camefrom?.focus({ preventScroll: true });
    camefrom = null;
  };

  if (!big || !source || reduced()) {
    done();
    return;
  }

  /*
   * Back to the rectangle it came out of, measured again rather than
   * remembered.
   *
   * The page can have moved underneath: the router restores a scroll position,
   * a lazy image below the fold lands and pushes the section down, the window
   * is resized while the picture is open. Re-reading is the difference between
   * the picture going home and the picture going where home used to be.
   */
  const to = box(source);
  const from = box(big);
  const scale = to.width / from.width || 1;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  const back = big.animate(
    [
      { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`, opacity: 0.4 },
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
export function bindLightbox(): void {
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
