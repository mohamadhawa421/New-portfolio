/**
 * Five tooltips, and then out of the way.
 *
 * Deliberately not the character. He does the inviting — on the home page and
 * on the too-small screen — and then stops, because a cartoon narrating a
 * design tool is a mascot explaining an interface, and the interface is the
 * thing being learnt. In here the tour is chrome: a small dark card that
 * points at a panel, says one sentence about it, and moves on.
 *
 * It highlights by dimming everything else: one element with an enormous
 * spread shadow, moved and resized between steps. Nothing is cloned, nothing
 * is layered over the panels, and the editor underneath stays fully legible
 * the whole way through — which matters because the point of each step is to
 * look at a real part of the real editor.
 *
 * Shown once per browser, remembered in `localStorage` rather than the
 * session: a designer who has taken the tour does not want it again next week
 * either. It is skippable, escapable, and the Club is fully usable while it
 * runs — nothing here traps focus or blocks a click.
 */

const SEEN = 'mh-club-toured';

interface Step {
  says: string;
  /** What to put the spotlight on. Absent means the whole workspace. */
  target?: string;
  cta?: string;
}

const STEPS: Step[] = [
  {
    says: 'This is the real portfolio, and you get to redesign it. Nothing you do here touches the live site.',
    target: '[data-club-canvas]',
  },
  {
    says: 'Your tools. Move, pan, and add frames, shapes and text.',
    target: '[data-club-tools]',
  },
  {
    says: 'Pages and layers. Pick something here and it is selected on the canvas — and change page from the top of this panel.',
    target: '.club__panel--left',
  },
  {
    says: 'Select anything and its properties appear here. Only the ones that actually do something.',
    target: '.club__panel--right',
  },
  {
    says: 'When you are happy, export the whole page as a PNG and send it over.',
    target: '[data-act="export"]',
    cta: 'Finish',
  },
];

export function shouldTour(): boolean {
  try {
    return localStorage.getItem(SEEN) !== '1';
  } catch {
    // Storage refused. Showing it once more is a far smaller cost than a
    // designer never being told what the panels are.
    return true;
  }
}

export function markToured(): void {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    /* not fatal */
  }
}

export interface TourHandle {
  stop(): void;
}

export function runTour(root: HTMLElement, onDone: () => void): TourHandle {
  const host = root.querySelector<HTMLElement>('[data-club-host]');
  const says = root.querySelector<HTMLElement>('[data-club-says]');
  const dots = root.querySelector<HTMLElement>('[data-club-dots]');
  const spot = root.querySelector<HTMLElement>('[data-club-spot]');
  const next = root.querySelector<HTMLButtonElement>('[data-tour="next"]');
  const skip = root.querySelector<HTMLButtonElement>('[data-tour="skip"]');
  if (!host || !says || !dots || !spot || !next || !skip) return { stop() {} };

  let at = 0;
  let stopped = false;

  const paint = (): void => {
    const step = STEPS[at];
    says.textContent = step.says;
    next.textContent = step.cta ?? 'Next';
    // On the last step there is nothing to skip past, only a way to be done.
    skip.hidden = at === STEPS.length - 1;

    dots.replaceChildren(
      ...STEPS.map((_, i) => {
        const d = document.createElement('i');
        if (i <= at) d.dataset.on = '1';
        return d;
      })
    );

    if (step.target) {
      const el = root.querySelector<HTMLElement>(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        // A little air, so the ring reads as "this thing" rather than a crop.
        const pad = 6;
        spot.hidden = false;
        spot.style.top = `${r.top - pad}px`;
        spot.style.left = `${r.left - pad}px`;
        spot.style.width = `${r.width + pad * 2}px`;
        spot.style.height = `${r.height + pad * 2}px`;
        place(r);
      }
    } else {
      spot.hidden = true;
      host!.style.left = `${(window.innerWidth - 268) / 2}px`;
      host!.style.top = `${window.innerHeight - 190}px`;
    }
  };

  /*
   * The card sits next to the thing it is describing, on whichever side has
   * room — a tooltip that covers its own subject is worse than no tooltip.
   */
  function place(target: DOMRect): void {
    const w = 268;
    const gap = 14;
    const h = host!.offsetHeight || 120;

    let left = target.right + gap;
    if (left + w > window.innerWidth - 8) left = target.left - w - gap;
    if (left < 8) left = Math.min(Math.max(8, target.left), window.innerWidth - w - 8);

    let top = target.top + target.height / 2 - h / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));

    host!.style.left = `${left}px`;
    host!.style.top = `${top}px`;
  }

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    markToured();
    host.hidden = true;
    spot.hidden = true;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('click', onTourClick);
    onDone();
  };

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
    }
  }

  /*
   * Delegated, like everything else in the Club.
   *
   * The bubble's two buttons are markup in the workspace, which the client
   * router detaches on a navigation — so the handler goes on the document and
   * asks which button was pressed. It comes off again in `stop`, which is the
   * only way out of the tour.
   */
  function onTourClick(e: MouseEvent): void {
    const which = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-tour]')?.dataset
      .tour;
    if (!which) return;
    if (which === 'skip') {
      stop();
      return;
    }
    if (at >= STEPS.length - 1) {
      stop();
      return;
    }
    at += 1;
    paint();
  }

  document.addEventListener('click', onTourClick);
  document.addEventListener('keydown', onKey);

  host.hidden = false;
  paint();
  // The bubble is where the tour's keyboard journey starts.
  next.focus({ preventScroll: true });

  return { stop };
}
