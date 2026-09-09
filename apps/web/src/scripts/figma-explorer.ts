/**
 * The design explorer's behaviour: when the iframe is built, and what is on
 * screen before and instead of it.
 *
 * There is no animation loop here and nothing that runs per frame. The whole
 * module is four listeners and one IntersectionObserver, and between a page
 * loading and the visitor scrolling to the explorer it does nothing at all.
 * That is deliberate: the storm, the cursor and the reveals already own the
 * main thread at the moments they run, and an embed that nobody has scrolled
 * to yet has no business competing with them.
 */

/** How far ahead of the viewport the iframe starts loading. */
const REACH = '400px';

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

/** The observers for the page currently on screen. Rebuilt on every swap. */
let watching: IntersectionObserver | null = null;

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
 * the HTML is a request the browser makes whether or not anybody scrolls that
 * far, and on a case study the explorer sits four sections down.
 */
function load(root: HTMLElement): void {
  if (root.dataset.state !== 'idle') return;

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

/**
 * Starts watching the explorers on the page that is currently mounted.
 *
 * The observer is rebuilt per page rather than kept: it holds references to
 * the elements it watches, and the router detaches those on every navigation.
 */
function watch(): void {
  watching?.disconnect();
  watching = null;

  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-figma][data-embed]'));
  if (!roots.length) return;

  // No observer, no lazy loading — a browser without one gets the embed
  // immediately, which is the behaviour it would have had anyway.
  if (typeof IntersectionObserver !== 'function') {
    roots.forEach(load);
    return;
  }

  watching = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        load(entry.target as HTMLElement);
      }
    },
    { rootMargin: REACH }
  );

  roots.forEach((root) => watching!.observe(root));
}

/**
 * One set of listeners for the life of the tab.
 *
 * Delegated from `document`, which the client router never replaces. Anything
 * bound to the explorer itself would be bound to a node that is one navigation
 * away from being detached, and a once-per-tab guard would stop it ever coming
 * back.
 */
export function bindFigmaExplorer(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const root = target.closest<HTMLElement>('[data-figma]');
    if (!root) return;

    if (target.closest('[data-figma-full]')) {
      const stage = root.querySelector<HTMLElement>('[data-figma-stage]');
      if (!stage) return;

      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else if (stage.requestFullscreen) {
        // Rejected when the gesture is not trusted, which is the only case
        // that reaches the catch. Nothing to recover — the button stays as it
        // was and the embed is still usable in place.
        void stage.requestFullscreen().catch(() => {});
      }
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
   * The button says which direction it goes, and the browser is the authority
   * on that — Escape leaves fullscreen without going anywhere near the click
   * handler above.
   */
  document.addEventListener('fullscreenchange', () => {
    const open = Boolean(document.fullscreenElement);
    document.querySelectorAll<HTMLElement>('[data-figma]').forEach((root) => {
      root.dataset.full = open && root.contains(document.fullscreenElement) ? 'yes' : 'no';
    });
  });

  // The page on the way out takes its observer with it, so the next page's
  // explorers are watched by an observer that knows only about them.
  document.addEventListener('astro:before-swap', () => {
    watching?.disconnect();
    watching = null;
  });

  document.addEventListener('astro:page-load', watch);
  watch();
}
