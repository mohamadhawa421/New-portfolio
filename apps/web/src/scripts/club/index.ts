/**
 * The Designers Club editor.
 *
 * Everything the workspace does, wired to the three things that hold state:
 * the `Store` (what has been changed), the `Sandbox` (the real page, in a
 * frame, with those changes painted on) and the view transform below (where
 * the artboard is and how big it is drawn).
 *
 * Two decisions here are worth stating because everything else follows from
 * them.
 *
 * **The overlay lives inside the transformed stage.** Selection boxes, handles
 * and labels are drawn in *sandbox document* coordinates and inherit the
 * stage's scale for free — so there is exactly one place in this file that
 * knows about zoom, and no selection can ever drift off the thing it is
 * selecting because the two are in the same coordinate space by construction.
 * Hairlines are divided back out so they stay hairlines at any zoom.
 *
 * **The artboard is a fixed width.** The frame is 1440 wide whatever the
 * editor window is, because a design tool's canvas is a document of a known
 * size — if the frame were sized to the available space, dragging a panel or
 * zooming out would reflow the portfolio into a different breakpoint and the
 * designer would watch their layout rearrange itself for reasons that have
 * nothing to do with what they did.
 */

import {
  dismissPicker,
  placement,
  renderLayers,
  renderProps,
  type PanelHooks,
} from './panels';
import { Sandbox, type ClubNode } from './sandbox';
import { Store, type Props } from './store';
import { runTour, shouldTour } from './tour';

/** The artboard's width. A desktop document, not the editor's window. */
const ARTBOARD = 1440;

/*
 * How far out and how far in.
 *
 * Out to five per cent, because this artboard is eight thousand pixels tall
 * and "see the whole page" is a real thing to want. In to sixteen hundred,
 * which is past the point where one CSS pixel is a sixteen-pixel block — the
 * level a designer means by "zoom in on the pixels". The old ceiling of 250%
 * was a website's idea of zoom rather than a design tool's.
 */
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 16;

type Tool = 'select' | 'hand' | 'frame' | 'rect' | 'ellipse' | 'text';

export function startClub(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLElement>('[data-club-canvas]')!;
  const stage = root.querySelector<HTMLElement>('[data-club-stage]')!;
  const frame = root.querySelector<HTMLIFrameElement>('[data-club-frame]')!;
  const overlay = root.querySelector<HTMLElement>('[data-club-overlay]')!;
  const layersHost = root.querySelector<HTMLElement>('[data-club-layers]')!;
  const propsHost = root.querySelector<HTMLElement>('[data-club-props]')!;
  const propsHead = root.querySelector<HTMLElement>('[data-club-prop-head]')!;
  const zoomOut = root.querySelector<HTMLElement>('[data-club-zoom]')!;
  const zoomField = root.querySelector<HTMLInputElement>('[data-club-zoom-field]')!;
  const toast = root.querySelector<HTMLElement>('[data-club-toast]')!;
  const tip = root.querySelector<HTMLElement>('[data-club-tip]')!;
  const resume = root.querySelector<HTMLButtonElement>('[data-club-resume]')!;

  const store = new Store();
  const sandbox = new Sandbox(frame);

  let tool: Tool = 'select';
  /**
   * What is selected, primary first.
   *
   * A list rather than an id, because every design tool's selection is one —
   * and because the things that follow from it (shared properties, a combined
   * bounding box, moving several layers as one) are not features bolted onto a
   * single selection, they are what a list gives you for free.
   */
  let selection: string[] = [];
  /** Which branches of the layer tree are twisted open. */
  const open = new Set<string>();
  const primary = (): string | null => selection[0] ?? null;

  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let spaceHeld = false;
  let altHeld = false;
  let disposed = false;

  /* ---------------------------------------------------------------- */
  /* The view                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * Promoted while the view is moving, and let go the moment it stops.
   *
   * `will-change: transform` is what made zooming smooth and what made the
   * result blurry. It is a promise to the compositor that this subtree is
   * about to move, so the subtree is rasterised once into a texture and that
   * texture is then *scaled* — which at 400% is a 100% picture stretched four
   * times, soft edges and all. Selecting something appeared to fix it because
   * writing a style into the frame forced a fresh raster at the real scale.
   *
   * Dropping the hint destroys the cached layer and the content is painted
   * again at the scale it is actually being shown at. So it is held for a
   * fifth of a second after the last change — long enough to cover a wheel or
   * a pan, short enough that a designer who has stopped moving is looking at
   * sharp type.
   */
  let sharpen = 0;

  function paintView(): void {
    stage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    stage.style.willChange = 'transform';
    window.clearTimeout(sharpen);
    sharpen = window.setTimeout(() => {
      stage.style.willChange = 'auto';
    }, 200);
    // Hairlines that stay hairlines. See the note at the top of the file.
    overlay.style.setProperty('--z', String(1 / zoom));
    if (zoomField.hidden) zoomOut.textContent = `${Math.round(zoom * 100)}%`;
  }

  /**
   * The artboard's box, and it has to be set *before* the page inside it loads.
   *
   * An `<iframe>` with no width is 300 pixels wide, and a document laid out in
   * 300 pixels is the phone layout. Adoption measures every element and skips
   * the ones with no box, so for as long as this ran after the load the editor
   * was reading the *mobile* portfolio: the work index's preview is
   * `display: none` below the desktop breakpoint, so the five project covers
   * and everything around them simply did not exist as far as the Club was
   * concerned. That is the other half of "some elements I cannot click", and
   * it was true of every desktop-only element on every page.
   *
   * The height floor is the canvas's own height rather than a number, so that
   * a section measured before the document's real height is known is measured
   * against a plausible viewport instead of a letterbox — `100vh` is a real
   * unit on this site.
   */
  function sizeFrame(): void {
    const floor = Math.round(canvas.getBoundingClientRect().height) || 600;
    const h = Math.max(sandbox.pageHeight, floor);
    frame.style.width = `${ARTBOARD}px`;
    frame.style.height = `${h}px`;
    overlay.style.width = `${ARTBOARD}px`;
    overlay.style.height = `${h}px`;
    stage.style.width = `${ARTBOARD}px`;
    stage.style.height = `${h}px`;
  }

  /**
   * Fit the artboard's *width*, and start at the top.
   *
   * Not the whole document, which is what "zoom to fit" means in a tool whose
   * frames are a screen tall. This one is eight thousand pixels: fitting it
   * vertically puts the portfolio on screen at eight per cent, which is a
   * thumbnail rather than a view. The width is the dimension that matters —
   * it is the dimension the design was laid out against.
   */
  function fit(): void {
    const box = canvas.getBoundingClientRect();
    const pad = 48;
    zoom = Math.max(MIN_ZOOM, Math.min(1, (box.width - pad * 2) / ARTBOARD));
    panX = (box.width - ARTBOARD * zoom) / 2;
    panY = pad / 2;
    paintView();
  }

  /** Put a rectangle of the document in the middle of the view, comfortably. */
  function fitTo(box: DOMRect, pad = 72): void {
    if (box.width <= 0 || box.height <= 0) return;
    const view = canvas.getBoundingClientRect();
    zoom = clamp(
      Math.min((view.width - pad * 2) / box.width, (view.height - pad * 2) / box.height),
      MIN_ZOOM,
      MAX_ZOOM
    );
    panX = (view.width - box.width * zoom) / 2 - box.x * zoom;
    panY = (view.height - box.height * zoom) / 2 - box.y * zoom;
    paintView();
  }

  /** Shift+2: everything selected, filling the view. Nothing selected, nothing. */
  function fitSelection(): void {
    const box = unionOf(boxesOf(selection));
    if (box) fitTo(box);
  }

  /** Any percentage, about the middle of the view. */
  function zoomTo(next: number): void {
    const box = canvas.getBoundingClientRect();
    const cx = box.width / 2;
    const cy = box.height / 2;
    const before = { x: (cx - panX) / zoom, y: (cy - panY) / zoom };
    zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);
    panX = cx - before.x * zoom;
    panY = cy - before.y * zoom;
    paintView();
  }

  /**
   * The zoom readout, which is also a field.
   *
   * Both halves are in the markup and one of them is hidden, rather than an
   * input being built on demand: the client router owns this page, and a
   * control created by script and left in the DOM is a control that survives
   * a navigation it should not have.
   */
  function openZoomField(): void {
    zoomOut.hidden = true;
    zoomField.hidden = false;
    zoomField.value = String(Math.round(zoom * 100));
    zoomField.focus();
    zoomField.select();
  }

  function closeZoomField(apply: boolean): void {
    if (zoomField.hidden) return;
    const asked = parseFloat(zoomField.value);
    zoomField.hidden = true;
    zoomOut.hidden = false;
    if (apply && Number.isFinite(asked) && asked > 0) zoomTo(asked / 100);
    paintView();
  }

  /** Editor-window coordinates → sandbox document coordinates. */
  function toDoc(clientX: number, clientY: number): { x: number; y: number } {
    const box = canvas.getBoundingClientRect();
    return {
      x: (clientX - box.left - panX) / zoom,
      y: (clientY - box.top - panY) / zoom,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Rendering the three views of the state                            */
  /* ---------------------------------------------------------------- */

  const hooks: PanelHooks = {
    select: (id) => select(id),
    toggleVisible: (id) => {
      const now = store.propsOf(id).visible !== false;
      store.set(id, { visible: !now }, 'visibility');
      if (!now) say('Back you come.');
    },
    replaceImage: (id) => pickImage(id),
  };

  /**
   * Repaint, in one of two weights.
   *
   * The heavy pass rebuilds both panels, and during a drag that is a
   * catastrophe: a pointermove arrives every frame, and each one was throwing
   * away forty-four layer rows and a dozen property fields and building them
   * again, then reading `scrollHeight` off the frame to re-measure it. That is
   * why dragging felt like it was catching — the work per frame was tens of
   * milliseconds of DOM churn for a change the designer could already see.
   *
   * While a gesture is running only two things can have changed: where the
   * element is, and therefore where its selection box is. So the live pass
   * applies the state to the sandbox and redraws the overlay, and nothing
   * else. The panels catch up once on the frame the pointer comes up, which is
   * also the frame the edit becomes a history step.
   */
  function refresh(live = false): void {
    if (disposed) return;
    sandbox.apply(store.current);

    if (live) {
      drawOverlay();
      return;
    }

    // Layout may have changed under the edit, so the frame is re-measured.
    sizeFrame();
    renderLayers(layersHost, sandbox, store, selection, open, hooks);

    /*
     * The panel is not rebuilt underneath the field being typed into.
     *
     * Every keystroke in a property field commits, and committing repaints —
     * which threw away the input the caret was in and built a new one, so the
     * field lost focus after a single character and the rest of the number
     * went nowhere. Typing "120" produced a 1.
     *
     * The values in the other fields are still stale-free, because the only
     * thing that changed is the one the designer is holding. Rebuilding
     * resumes the moment focus leaves the panel.
     */
    if (!propsHost.contains(document.activeElement)) {
      renderProps(propsHost, propsHead, sandbox, store, selection, hooks);
    }

    drawOverlay();
    syncHistoryButtons();
  }

  store.subscribe(() => refresh(gesture !== null));

  /* ---------------------------------------------------------------- */
  /* Selection and its overlay                                         */
  /* ---------------------------------------------------------------- */

  /**
   * The one way the selection changes, and the three views that follow it.
   *
   * The overlay, the layer tree and the properties panel are rebuilt rather
   * than diffed: at this size the rebuild costs a fraction of a millisecond,
   * and a diff is where the one bug a design tool cannot have comes from — a
   * panel describing something that is no longer selected.
   */
  function setSelection(ids: string[]): void {
    /*
     * A colour picker belongs to the thing that is selected, so changing the
     * selection closes it — but a property *update* must not. It used to be
     * dismissed on every render, which meant the first live frame of a colour
     * drag closed the picker doing the dragging.
     */
    if (ids[0] !== selection[0]) dismissPicker();
    selection = ids;

    /*
     * The tree opens itself to whatever was picked on the canvas.
     *
     * Nothing is expanded until it is asked for — two hundred and sixty-six
     * rows at once is a wall rather than a panel — so a selection made by
     * clicking the page would otherwise be highlighted on a row that is not
     * rendered, which is a panel quietly lying about what is selected.
     */
    for (const id of ids) for (const a of sandbox.ancestors(id)) open.add(a);

    renderLayers(layersHost, sandbox, store, selection, open, hooks);
    renderProps(propsHost, propsHead, sandbox, store, selection, hooks);
    drawOverlay();
  }

  function select(id: string | null): void {
    setSelection(id ? [id] : []);
  }

  /** Shift-click: in if it was out, out if it was in, and newest is primary. */
  function toggle(id: string): void {
    setSelection(selection.includes(id) ? selection.filter((x) => x !== id) : [id, ...selection]);
  }

  /**
   * Which layer a shift-click means.
   *
   * A plain click drills one level per press, and shift-clicking must not —
   * adding to a selection is not the same gesture as going deeper, and a
   * modifier that also changes depth makes multiple selection unusable. So
   * this looks for the deepest thing under the pointer that is a *sibling* of
   * what is already selected, which is how a second and third object get added
   * at the level the designer is working at.
   *
   * When there is no sibling under the pointer it takes the deepest thing
   * there instead. The first version fell back to the *outermost*, which on a
   * real page is a wrapper the size of a section — so shift-clicking a
   * paragraph that happened not to be a sibling added the whole hero to the
   * selection. Nobody has ever meant that.
   */
  /**
   * What a click means, in one rule.
   *
   * The outermost thing under the pointer that is not a frame — the button,
   * the picture, the paragraph — because that is the thing the designer is
   * pointing at. Everything above it is scaffolding: a section, a shell, the
   * wrapper around a pair of buttons. Clicking down through five of those to
   * reach a button, which is what this did before, is four clicks spent on
   * boxes nobody can see.
   *
   * And when there is no object under the pointer — the gap between two
   * buttons, a section's own padding — it takes the innermost *frame*
   * instead. That is how a frame gets selected, and it is why the auto-layout
   * overlay is reachable at all: the space inside a frame belongs to the
   * frame.
   *
   * Going further in is a double-click, which is the same bargain the tool
   * this borrows from makes with a component: the whole thing is one click,
   * and you enter it deliberately.
   */
  function pickObject(stack: ClubNode[]): ClubNode {
    return stack.find((n) => n.type !== 'container') ?? stack[stack.length - 1];
  }

  function siblingPick(stack: ClubNode[]): ClubNode {
    const at = primary();
    const level = at ? (sandbox.get(at)?.parentId ?? null) : undefined;
    if (level !== undefined) {
      const sibling = [...stack].reverse().find((n) => n.parentId === level);
      if (sibling) return sibling;
    }
    return stack[stack.length - 1];
  }

  const HANDLES: [string, number, number][] = [
    ['nw', 0, 0],
    ['n', 0.5, 0],
    ['ne', 1, 0],
    ['e', 1, 0.5],
    ['se', 1, 1],
    ['s', 0.5, 1],
    ['sw', 0, 1],
    ['w', 0, 0.5],
  ];

  /** What the pointer is over, drawn faintly so selection stays the loud one. */
  let hovered: string | null = null;

  /** Where the pointer last was, in document coordinates, so the hover can be
   *  recomputed when something other than the pointer changes what it means. */
  let pointerAt: { x: number; y: number } | null = null;

  /**
   * What a click would take, which is what a hover outline promises.
   *
   * It used to be the outermost thing under the pointer, which on this page is
   * always a section — so the outline was a box round a whole third of the
   * screen no matter what you pointed at, and it never agreed with what
   * clicking actually did.
   *
   * It is the same rule a click uses, so the outline is exactly a promise of
   * what pressing would take.
   *
   * With Alt down it resolves the way a shift-click does: a sibling of what is
   * selected if there is one under the pointer, and otherwise the deepest
   * layer. That modifier is for measuring, and the measurement a designer
   * means is almost always between two things at the same level — the two
   * buttons, the two rows. Measuring to the section that contains what you are
   * pointing at is not a measurement anybody wanted, and measuring to the text
   * *inside* the button reports the gap plus that button's padding, which is a
   * correct number and the wrong answer.
   */
  function nextPick(stack: ClubNode[]): ClubNode {
    if (altHeld) return siblingPick(stack);
    return pickObject(stack);
  }

  function reHover(): boolean {
    const was = hovered;
    if (!pointerAt || tool !== 'select') hovered = null;
    else {
      const stack = sandbox.stackAt(pointerAt.x, pointerAt.y);
      hovered = stack.length ? nextPick(stack).id : null;
    }
    return hovered !== was;
  }

  /** A drag on empty ground, in sandbox-document coordinates. */
  let marquee: { x0: number; y0: number; x1: number; y1: number; add: boolean } | null = null;

  /** The smallest rectangle containing all of them. */
  function unionOf(boxes: DOMRect[]): DOMRect | null {
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map((b) => b.left));
    const top = Math.min(...boxes.map((b) => b.top));
    return new DOMRect(
      left,
      top,
      Math.max(...boxes.map((b) => b.right)) - left,
      Math.max(...boxes.map((b) => b.bottom)) - top
    );
  }

  /** Every selected layer's measured box, in document coordinates. */
  const boxesOf = (ids: readonly string[]): DOMRect[] =>
    ids
      .map((id) => sandbox.boxOf(id))
      .filter(Boolean as unknown as (v: DOMRect | null) => v is DOMRect);

  const mark = (className: string, box: DOMRect): HTMLElement => {
    const el = document.createElement('div');
    el.className = className;
    el.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;border-width:calc(1px * var(--z,1))`;
    return el;
  };

  function drawOverlay(): void {
    overlay.replaceChildren();

    if (marquee) {
      const r = new DOMRect(
        Math.min(marquee.x0, marquee.x1),
        Math.min(marquee.y0, marquee.y1),
        Math.abs(marquee.x1 - marquee.x0),
        Math.abs(marquee.y1 - marquee.y0)
      );
      overlay.appendChild(mark('club__marquee', r));
    }

    if (hovered && !selection.includes(hovered)) {
      const hb = sandbox.boxOf(hovered);
      if (hb) overlay.appendChild(mark('club__hover', hb));
    }

    /*
     * The alignment guides, drawn only along the run they are about.
     *
     * A line from edge to edge of an eight-thousand-pixel document tells you
     * that something lined up and not with what. Extending the guide to cover
     * the moving box and whatever it landed on is the whole message in one
     * mark, and it disappears with the drag.
     */
    if (holdingX || holdingY) {
      const now = boxesOf(selection);
      const span = (g: Guide, lo: number, hi: number): [number, number] => [
        Math.min(g.a, lo),
        Math.max(g.b, hi),
      ];
      // A true hairline: one screen pixel, whatever the canvas is scaled to.
      const hair = 1 / zoom;
      if (holdingX && now.length) {
        const [a, b] = span(
          holdingX,
          Math.min(...now.map((r) => r.top)),
          Math.max(...now.map((r) => r.bottom))
        );
        overlay.appendChild(
          mark('club__guide', new DOMRect(holdingX.v - hair / 2, a, hair, b - a))
        );
      }
      if (holdingY && now.length) {
        const [a, b] = span(
          holdingY,
          Math.min(...now.map((r) => r.left)),
          Math.max(...now.map((r) => r.right))
        );
        overlay.appendChild(
          mark('club__guide', new DOMRect(a, holdingY.v - hair / 2, b - a, hair))
        );
      }
    }

    if (!selection.length) return;

    /*
     * Several things selected get thin outlines each and one box around the
     * lot, which is the only reading that answers both questions a designer
     * has mid-selection: what exactly did I catch, and how big is it together.
     */
    const boxes = boxesOf(selection);
    const box = unionOf(boxes);
    if (!box) return;

    if (boxes.length > 1) {
      for (const b of boxes) overlay.appendChild(mark('club__member', b));
    }

    const node = sandbox.get(primary()!);
    if (!node) return;

    overlay.appendChild(mark('club__sel', box));

    /*
     * The name, above the box, in the selection's own colour.
     *
     * Figma puts it there and it earns its place on a page like this one,
     * where a dozen nested wrappers all look the same on the canvas: the
     * outline tells you the size of what you caught and the label tells you
     * what it is, without a trip to the layers panel to find the highlighted
     * row.
     */
    const name = document.createElement('div');
    name.className = 'club__name';
    name.textContent = selection.length > 1 ? `${selection.length} layers` : node.label;
    name.style.cssText = `left:${box.x}px;top:${box.y}px;transform:translate(0, -100%) translate(0, -4px) scale(var(--z,1));transform-origin:0 100%`;
    overlay.appendChild(name);

    /*
     * The badge says the size, under the box, the way Figma's does — a
     * designer mid-drag is reading numbers, not the name of the thing they
     * are already looking at.
     */
    const tag = document.createElement('div');
    tag.className = 'club__tag';
    tag.textContent = `${Math.round(box.width)} × ${Math.round(box.height)}`;
    tag.style.cssText = `left:${box.x + box.width / 2}px;top:${box.y + box.height}px;transform:translate(-50%, 6px) scale(var(--z,1));transform-origin:50% 0`;
    overlay.appendChild(tag);

    /*
     * Hold Alt and the padding appears, the way it does in the tool this
     * borrows from.
     *
     * Figma shows the space *inside* a container as filled bands with their
     * measurements on them, and it is the fastest way to understand why
     * something sits where it does. The numbers here are read straight off the
     * computed style, so they are the real values the stylesheet produced
     * rather than anything the Club has invented — which also means they are
     * the numbers to type into the Padding field beside them.
     *
     * Only where there is padding to show: a band of zero is noise, and four
     * of them around every text layer would make the modifier useless.
     */
    if (selection.length === 1) {
      /*
       * An auto-layout frame shows how it lays out, the moment it is selected.
       *
       * Figma does this and it is most of what makes auto layout legible: the
       * padding and the gaps are the layout, so they are drawn where they
       * happen rather than only described as numbers in a panel eighteen
       * inches away. They are draggable for the same reason — the shortest
       * path from "that gap is too tight" to a fixed gap is to pull it.
       *
       * A frame with no auto layout has nothing to show until it is asked, so
       * it keeps the old behaviour: padding on Alt, and nothing otherwise.
       */
      /*
       * Not while the frame itself is being dragged or resized.
       *
       * Its internal spacing has not changed — only where the box is — so
       * every frame of the drag would re-measure a set of children to draw
       * the same numbers again, which is the one place this costs anything
       * measurable. It is also calmer: Figma drops these while you are
       * moving something for the same reason.
       */
      const settled = gesture?.kind !== 'move' && gesture?.kind !== 'resize';

      if (node.flow && settled) drawPadding(node, box, true);
      else if (altHeld && settled) drawPadding(node, box, false);

      if (node.flow && settled) drawGaps(node, box);

      // And the gap to whatever the pointer is over, which is the other half
      // of what the modifier is for.
      if (altHeld && hovered && !selection.includes(hovered)) {
        const other = sandbox.boxOf(hovered);
        if (other) drawMeasure(box, other);
      }
    }

    /*
     * Handles on one thing at a time, and never on a section.
     *
     * A section is the tree's container rather than something to drag by the
     * corner; and resizing several layers at once needs a rule for what
     * happens to the ones that are not the one you grabbed, which is a
     * decision the brief explicitly says not to guess at.
     */
    if (selection.length > 1 || node.parentId === null) return;

    for (const [dir, fx, fy] of HANDLES) {
      const h = document.createElement('div');
      h.className = 'club__handle';
      h.dataset.dir = dir;
      h.style.cssText = `left:${box.x + box.width * fx}px;top:${box.y + box.height * fy}px;transform:scale(var(--z,1));cursor:${dir}-resize`;
      overlay.appendChild(h);
    }
  }

  /**
   * The distance from the selection to whatever the pointer is over.
   *
   * This is the half of Alt that answers "how far apart are these two", and it
   * is the measurement a designer reaches for constantly — the gap between a
   * heading and the paragraph under it, between two rows, between a button and
   * the edge of its section.
   *
   * Only the axes where the boxes genuinely do not overlap. Two things that
   * overlap horizontally have no horizontal gap to report, and inventing one —
   * the distance between their left edges, say — is a number that looks
   * authoritative and means nothing. Figma shows nothing there for the same
   * reason.
   */
  function drawMeasure(from: DOMRect, to: DOMRect): void {
    const line = (x: number, y: number, w: number, h: number, value: number): void => {
      const rule = document.createElement('div');
      rule.className = 'club__measure';
      rule.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(w, 1)}px;height:${Math.max(h, 1)}px`;

      const tag = document.createElement('span');
      tag.className = 'club__measure-n';
      tag.textContent = String(Math.round(value));
      tag.style.transform = 'translate(-50%, -50%) scale(var(--z,1))';
      rule.appendChild(tag);

      overlay.appendChild(rule);
    };

    // Horizontal: one is entirely to the left of the other.
    const midY = Math.max(from.top, to.top) + Math.min(from.bottom, to.bottom) > 0
      ? (Math.max(from.top, to.top) + Math.min(from.bottom, to.bottom)) / 2
      : from.top + from.height / 2;

    if (to.right <= from.left) line(to.right, midY, from.left - to.right, 0, from.left - to.right);
    else if (from.right <= to.left) line(from.right, midY, to.left - from.right, 0, to.left - from.right);

    // Vertical: one is entirely above the other.
    const midX = (Math.max(from.left, to.left) + Math.min(from.right, to.right)) / 2;
    const useX = Number.isFinite(midX) ? midX : from.left + from.width / 2;

    if (to.bottom <= from.top) line(useX, to.bottom, 0, from.top - to.bottom, from.top - to.bottom);
    else if (from.bottom <= to.top) line(useX, from.bottom, 0, to.top - from.bottom, to.top - from.bottom);
  }

  /**
   * One tinted region with its measurement on it.
   *
   * Padding and gaps are the same object as far as the canvas is concerned —
   * a rectangle of space with a number and, when the frame is laying its
   * children out, a handle to pull. `key`, `sign` and `axis` are what the drag
   * needs to know: which property it is changing, which way the pointer moves
   * to make it bigger, and along which axis to read the movement.
   */
  function band(
    at: DOMRect,
    value: number,
    key: 'gap' | 'padX' | 'padY',
    axis: 'x' | 'y',
    sign: number,
    live: boolean
  ): void {
    if (at.width < 0.5 || at.height < 0.5) return;

    const el = document.createElement('div');
    el.className = 'club__space';
    el.style.cssText = `left:${at.x}px;top:${at.y}px;width:${at.width}px;height:${at.height}px`;
    if (live) {
      el.dataset.space = key;
      el.dataset.axis = axis;
      el.dataset.sign = String(sign);
      el.dataset.base = String(Math.round(value));
    }

    const label = document.createElement('span');
    label.className = 'club__space-n';
    label.textContent = String(Math.round(value));
    label.style.transform = 'translate(-50%, -50%) scale(var(--z,1))';
    el.appendChild(label);

    overlay.appendChild(el);
  }

  /** The four inside edges of a box, drawn and labelled. */
  function drawPadding(node: { el: HTMLElement }, box: DOMRect, live: boolean): void {
    const view = node.el.ownerDocument.defaultView;
    if (!view) return;
    const cs = view.getComputedStyle(node.el);

    const top = parseFloat(cs.paddingTop) || 0;
    const bottom = parseFloat(cs.paddingBottom) || 0;
    const left = parseFloat(cs.paddingLeft) || 0;
    const right = parseFloat(cs.paddingRight) || 0;

    // Dragging the near edge outward makes the padding bigger; the far edge
    // is the same gesture mirrored, which is what the sign carries.
    if (top >= 1) band(new DOMRect(box.x, box.y, box.width, top), top, 'padY', 'y', 1, live);
    if (bottom >= 1) {
      band(
        new DOMRect(box.x, box.y + box.height - bottom, box.width, bottom),
        bottom,
        'padY',
        'y',
        -1,
        live
      );
    }
    if (left >= 1) band(new DOMRect(box.x, box.y, left, box.height), left, 'padX', 'x', 1, live);
    if (right >= 1) {
      band(
        new DOMRect(box.x + box.width - right, box.y, right, box.height),
        right,
        'padX',
        'x',
        -1,
        live
      );
    }
  }

  /**
   * The space between the children, wherever two of them are genuinely in a
   * row.
   *
   * One rule covers a flex row, a flex column and a grid: two consecutive
   * children are side by side if one ends before the other begins *and* they
   * overlap on the other axis. A grid's items in the same row overlap
   * vertically, so their horizontal gaps are drawn; items in different rows do
   * not, so nothing is drawn across the wrap — which is right, because there
   * is no gap there to pull.
   */
  function drawGaps(node: ClubNode, box: DOMRect): void {
    const kids = sandbox.childBoxes(node.id);
    if (kids.length < 2) return;

    const meets = (a0: number, a1: number, b0: number, b1: number): boolean =>
      Math.min(a1, b1) - Math.max(a0, b0) > 1;

    for (let i = 1; i < kids.length; i += 1) {
      const a = kids[i - 1];
      const b = kids[i];

      if (b.left >= a.right && meets(a.top, a.bottom, b.top, b.bottom)) {
        const top = Math.max(a.top, b.top);
        band(
          new DOMRect(a.right, top, b.left - a.right, Math.min(a.bottom, b.bottom) - top),
          b.left - a.right,
          'gap',
          'x',
          1,
          true
        );
        continue;
      }

      if (b.top >= a.bottom && meets(a.left, a.right, b.left, b.right)) {
        const left = Math.max(a.left, b.left);
        band(
          new DOMRect(left, a.bottom, Math.min(a.right, b.right) - left, b.top - a.bottom),
          b.top - a.bottom,
          'gap',
          'y',
          1,
          true
        );
      }
    }
    void box;
  }

  /* ---------------------------------------------------------------- */
  /* Direct manipulation                                               */
  /* ---------------------------------------------------------------- */

  interface Gesture {
    kind: 'move' | 'resize' | 'pan' | 'marquee' | 'space';
    dir?: string;
    id?: string;
    /** For a spacing drag: which property, which way, and where it started. */
    spaceKey?: 'gap' | 'padX' | 'padY';
    spaceAxis?: 'x' | 'y';
    spaceSign?: number;
    spaceBase?: number;
    /** Every layer a move is carrying, and where each of them started. */
    bases?: Map<string, { x: number; y: number }>;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    baseW: number;
    baseH: number;
    basePanX: number;
    basePanY: number;
  }

  let gesture: Gesture | null = null;

  /**
   * Where a moving layer is allowed to click into place.
   *
   * Built once, when the drag starts, and never touched again until it ends —
   * which is the whole performance story for this feature. Measuring every
   * candidate on every pointermove is what makes snapping in a hand-written
   * editor feel like treacle: it is a full geometric pass over the document
   * sixty times a second to answer a question whose answer cannot change,
   * because nothing except the thing in your hand is moving.
   *
   * Candidates are the moved layers' own parents and their siblings, and
   * nothing else. Snapping the hero's headline to a paragraph six sections
   * down is not alignment, it is a coincidence — and offering it costs the
   * guides their meaning, because a guide that appears for a relationship
   * nobody can see reads as a bug.
   */
  interface Guide {
    /** The coordinate the edge lands on. */
    v: number;
    /** How far the line is worth drawing, along the other axis. */
    a: number;
    b: number;
  }

  let guidesX: Guide[] = [];
  let guidesY: Guide[] = [];
  let holdingX: Guide | null = null;
  let holdingY: Guide | null = null;
  /** The moving selection's box before the drag, so snaps read off one rect. */
  let movedFrom: DOMRect | null = null;

  /** Six screen pixels: close enough to want, far enough not to fight. */
  const SNAP = 6;

  /** How many siblings are worth measuring. A list can be very long. */
  const SNAP_POOL = 160;

  function armGuides(ids: string[]): void {
    guidesX = [];
    guidesY = [];
    holdingX = null;
    holdingY = null;

    const moving = new Set(ids);
    const levels = new Set(ids.map((id) => sandbox.get(id)?.parentId ?? null));

    const edges = (box: DOMRect): void => {
      guidesX.push(
        { v: box.left, a: box.top, b: box.bottom },
        { v: box.left + box.width / 2, a: box.top, b: box.bottom },
        { v: box.right, a: box.top, b: box.bottom }
      );
      guidesY.push(
        { v: box.top, a: box.left, b: box.right },
        { v: box.top + box.height / 2, a: box.left, b: box.right },
        { v: box.bottom, a: box.left, b: box.right }
      );
    };

    const pool: string[] = [];
    for (const level of levels) {
      if (level) {
        const parent = sandbox.boxOf(level);
        if (parent) edges(parent);
      }
      for (const node of sandbox.list()) {
        if (node.parentId !== level || moving.has(node.id)) continue;
        pool.push(node.id);
        if (pool.length >= SNAP_POOL) break;
      }
    }

    for (const id of pool) {
      const box = sandbox.boxOf(id);
      if (box && box.width > 0 && box.height > 0) edges(box);
    }

    movedFrom = unionOf(boxesOf(ids));
  }

  /**
   * The nudge that puts an edge on a guide, or nothing.
   *
   * Three anchors per axis — the two edges and the centre — and the smallest
   * correction of the three wins, so a box a hair off centre snaps to centre
   * rather than to whichever edge was checked first.
   */
  function pull(anchors: number[], guides: Guide[]): { shift: number; on: Guide } | null {
    const tol = SNAP / zoom;
    let best: { shift: number; on: Guide } | null = null;
    for (const anchor of anchors) {
      for (const guide of guides) {
        const shift = guide.v - anchor;
        if (Math.abs(shift) > tol) continue;
        if (!best || Math.abs(shift) < Math.abs(best.shift)) best = { shift, on: guide };
      }
    }
    return best;
  }

  function beginMove(ids: string[], docX: number, docY: number): void {
    const bases = new Map<string, { x: number; y: number }>();
    for (const id of ids) {
      const p = store.propsOf(id);
      bases.set(id, { x: p.x ?? 0, y: p.y ?? 0 });
    }
    armGuides(ids);
    store.beginGesture();
    gesture = {
      kind: 'move',
      id: ids[0],
      bases,
      startX: docX,
      startY: docY,
      baseX: 0,
      baseY: 0,
      baseW: 0,
      baseH: 0,
      basePanX: panX,
      basePanY: panY,
    };
  }

  /** A drag on ground nothing can be moved by: a rectangle, and what it caught. */
  function beginMarquee(docX: number, docY: number, add: boolean): void {
    if (!add) setSelection([]);
    marquee = { x0: docX, y0: docY, x1: docX, y1: docY, add };
    gesture = {
      kind: 'marquee',
      startX: docX,
      startY: docY,
      baseX: 0,
      baseY: 0,
      baseW: 0,
      baseH: 0,
      basePanX: panX,
      basePanY: panY,
    };
    drawOverlay();
  }

  function dragMarquee(docX: number, docY: number): void {
    if (!marquee) return;
    marquee.x1 = docX;
    marquee.y1 = docY;
    drawOverlay();
  }

  function onGestureMove(docX: number, docY: number, shift: boolean): void {
    if (!gesture) return;
    let dx = docX - gesture.startX;
    let dy = docY - gesture.startY;

    if (gesture.kind === 'move' && gesture.bases) {
      // Shift constrains to one axis, the way it does everywhere else.
      let locked: 'x' | 'y' | null = null;
      if (shift) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dy = 0;
          locked = 'y';
        } else {
          dx = 0;
          locked = 'x';
        }
      }
      /*
       * One write for the whole selection rather than one per layer: `set`
       * emits, and emitting five times a frame repaints the sandbox five
       * times for a change the designer makes once.
       */
      /*
       * Snapping is applied to the *offset*, not to each layer, so a group of
       * five keeps its internal spacing exactly and the whole thing lands on
       * the guide together. Shift has already flattened one axis above, and a
       * flattened axis is not snapped: the designer has said which direction
       * this move is in and a snap sideways would contradict them.
       */
      holdingX = null;
      holdingY = null;
      if (movedFrom) {
        const at = movedFrom;
        if (locked !== 'x') {
          const hit = pull([at.left + dx, at.left + at.width / 2 + dx, at.right + dx], guidesX);
          if (hit) {
            dx += hit.shift;
            holdingX = hit.on;
          }
        }
        if (locked !== 'y') {
          const hit = pull([at.top + dy, at.top + at.height / 2 + dy, at.bottom + dy], guidesY);
          if (hit) {
            dy += hit.shift;
            holdingY = hit.on;
          }
        }
      }

      const bases = gesture.bases;
      store.live('move', (draft) => {
        for (const [id, base] of bases) {
          draft.overrides[id] = {
            ...(draft.overrides[id] ?? {}),
            x: Math.round(base.x + dx),
            y: Math.round(base.y + dy),
          };
        }
      });
      return;
    }

    if (gesture.kind === 'space' && gesture.id && gesture.spaceKey) {
      const along = gesture.spaceAxis === 'x' ? dx : dy;
      const value = Math.max(0, Math.round((gesture.spaceBase ?? 0) + along * (gesture.spaceSign ?? 1)));
      store.set(gesture.id, { [gesture.spaceKey]: value } as Props, gesture.spaceKey, true);
      return;
    }

    if (gesture.kind === 'resize' && gesture.id) {
      const dir = gesture.dir ?? 'se';
      let w = gesture.baseW;
      let h = gesture.baseH;
      if (dir.includes('e')) w = gesture.baseW + dx;
      if (dir.includes('w')) w = gesture.baseW - dx;
      if (dir.includes('s')) h = gesture.baseH + dy;
      if (dir.includes('n')) h = gesture.baseH - dy;

      /*
       * Shift on a corner keeps the proportions.
       *
       * Only on a corner: an edge handle changes one dimension by definition,
       * and "constrain proportions" applied to it would move the edge the
       * designer is not holding, which is the kind of modifier behaviour the
       * brief rightly says to leave out unless it can be made predictable.
       * The axis that moved further is the one believed, so the box follows
       * whichever way the hand went.
       */
      if (shift && dir.length === 2 && gesture.baseH > 0) {
        const ratio = gesture.baseW / gesture.baseH;
        if (Math.abs(w - gesture.baseW) >= Math.abs(h - gesture.baseH)) h = w / ratio;
        else w = h * ratio;
      }

      w = Math.max(8, Math.round(w));
      h = Math.max(8, Math.round(h));

      const patch: Props = {};
      if (dir.match(/[ew]/)) patch.w = w;
      if (dir.match(/[ns]/)) patch.h = h;
      /*
       * Dragging a west or north edge also moves the origin — and it is
       * derived from the size rather than from the pointer, so the opposite
       * edge stays exactly where it is even when the size has been clamped to
       * the minimum or bent by the ratio above.
       */
      if (dir.includes('w')) patch.x = Math.round(gesture.baseX + (gesture.baseW - w));
      if (dir.includes('n')) patch.y = Math.round(gesture.baseY + (gesture.baseH - h));
      store.set(gesture.id, patch, 'resize', true);
    }
  }

  function endGesture(): void {
    if (!gesture) return;
    const was = gesture;
    gesture = null;
    if (was.kind === 'pan') return;

    holdingX = null;
    holdingY = null;
    movedFrom = null;

    if (was.kind === 'marquee') {
      const m = marquee;
      marquee = null;
      if (m) {
        const caught = sandbox.inside(m.x0, m.y0, m.x1, m.y1).map((n) => n.id);
        setSelection(m.add ? [...new Set([...caught, ...selection])] : caught);
      } else {
        drawOverlay();
      }
      return;
    }

    /*
     * The panels catch up here, once, on the frame the gesture ends — see the
     * note on `refresh`. `gesture` is already null, so this is the heavy pass.
     */
    refresh();
  }

  /* ---- Pointer input, from both documents ------------------------- */

  /*
   * A drag that begins over the frame keeps receiving moves from the frame's
   * own document while the pointer is over it, and from the editor's once it
   * leaves. Both are converted to document coordinates before anything reads
   * them, so neither path knows it is special.
   */
  function bindSandboxInput(): void {
    /*
     * The sandbox's own Document — not an element in this page.
     *
     * The invariant that listeners belong on `document` is about the client
     * router replacing *this* page underneath a binding. This is a different
     * document entirely, it is recreated whenever the frame loads, and this
     * function runs again each time it does. Named explicitly so the guard in
     * `tests/invariants.test.js` can tell the two cases apart.
     */
    const sandboxDoc = sandbox.doc;
    if (!sandboxDoc) return;

    sandboxDoc.addEventListener('pointerdown', (e) => {
      /*
       * A press inside the words being edited belongs to the browser.
       *
       * Placing a caret where you clicked is the default behaviour of a
       * mousedown on editable content, and this file was calling
       * `preventDefault` on every press in the sandbox — so the caret stayed
       * wherever it was put when the edit began and no amount of clicking
       * moved it. Standing down is the whole fix: click, double-click to take
       * a word, drag to select a run, exactly as in any other text field.
       *
       * A press anywhere else is the designer finishing, so the edit is
       * closed before the press is dealt with normally.
       */
      if (editing) {
        const at = e.target as Node | null;
        if (at && editing.contains(at)) return;
        stopEditing?.();
      }

      if (tool === 'hand' || spaceHeld || e.button === 1) {
        startPan(e.clientX + rectLeft(), e.clientY + rectTop());
        e.preventDefault();
        return;
      }

      if (tool !== 'select') {
        createAt(e.clientX, e.clientY);
        return;
      }

      /*
       * A press decides nothing on its own any more.
       *
       * The old version selected *and* drilled *and* started a move on the
       * same event, which had a bug you could not work around: pressing on the
       * layer you had just selected went one level deeper before the drag
       * began, so there was no way to pick something up and move it. You could
       * only ever move whatever was one level inside what you meant.
       *
       * So the press records what is under the pointer and waits, which is
       * what the tool this imitates does. Moving past a few pixels is a drag —
       * of the selection if it can be moved, of a marquee if it cannot.
       * Releasing without moving is a click, and a click on something already
       * selected goes one level in. `freeze` took pointer events off the page,
       * so the point is asked rather than the event, and it answers with
       * everything underneath from the outside in.
       */
      const stack = sandbox.stackAt(e.clientX, e.clientY);
      if (!stack.length) {
        beginMarquee(e.clientX, e.clientY, e.shiftKey);
        e.preventDefault();
        return;
      }

      if (e.shiftKey) {
        toggle(siblingPick(stack).id);
        e.preventDefault();
        return;
      }

      const already = stack.some((n) => selection.includes(n.id));
      if (!already) select(pickObject(stack).id);
      pending = { stack, docX: e.clientX, docY: e.clientY, fresh: !already };
      e.preventDefault();
    });

    sandboxDoc.addEventListener('pointermove', (e) => {
      if (gesture?.kind === 'pan') {
        panTo(e.clientX + rectLeft(), e.clientY + rectTop());
        return;
      }
      if (gesture?.kind === 'marquee') {
        dragMarquee(e.clientX, e.clientY);
        return;
      }
      if (gesture) {
        onGestureMove(e.clientX, e.clientY, e.shiftKey);
        return;
      }

      if (pending && startDrag(e.clientX, e.clientY)) {
        if (gesture) onGestureMove(e.clientX, e.clientY, e.shiftKey);
        else dragMarquee(e.clientX, e.clientY);
        return;
      }

      // Nothing is dragging: show what would be picked up.
      pointerAt = { x: e.clientX, y: e.clientY };
      if (reHover()) drawOverlay();
    });

    sandboxDoc.addEventListener('pointerup', onSandboxUp);

    /*
     * Scrolling and zooming while the pointer is over the artboard.
     *
     * This is the one piece of input the editor cannot get from its own
     * document. A wheel event over an iframe is delivered to the *frame's*
     * document and stops there — it does not bubble out to the parent — so the
     * editor's own wheel handler never saw a single tick while the pointer was
     * over the canvas, which is the whole canvas. The result was a page that
     * refused to scroll everywhere except the thin margin around the artboard.
     *
     * The frame's coordinates are the document's, so they are converted to the
     * editor's before being handed to the same handler the margin uses.
     */
    sandboxDoc.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        // Document coordinates → editor-window coordinates.
        const box = canvas.getBoundingClientRect();
        wheelAt(box.left + panX + e.clientX * zoom, box.top + panY + e.clientY * zoom, e);
      },
      { passive: false }
    );

    /*
     * Double-click goes all the way in, and on words it starts typing.
     *
     * Single clicks descend one level each, which is right for finding your
     * way around a page nobody laid out as layers — but it is a lot of clicks
     * to reach a word inside a button inside a row. So the double-click takes
     * the deepest thing under the pointer in one go, and if that turns out to
     * be text it drops a caret in rather than waiting to be asked twice. It
     * used to require the text to be selected already, which meant two
     * double-clicks to type into anything you had not just clicked — one
     * gesture too many for the most ordinary edit there is.
     */
    sandboxDoc.addEventListener('dblclick', (e) => {
      // Inside a live edit a double-click takes a word, as it does anywhere.
      if (editing && editing.contains(e.target as Node)) return;

      const stack = sandbox.stackAt(e.clientX, e.clientY);
      const deepest = stack[stack.length - 1];
      if (!deepest) return;
      e.preventDefault();
      pending = null;

      select(deepest.id);
      if (deepest.type === 'text') editInPlace(deepest.id);
    });
  }

  /**
   * A press that has not yet committed to being a click or a drag.
   *
   * Held in sandbox-document coordinates, like everything else the canvas
   * reasons about, so the threshold below is the only place that has to think
   * about zoom.
   */
  interface Pending {
    stack: ClubNode[];
    docX: number;
    docY: number;
    /** True when the press itself changed the selection, so it cannot drill. */
    fresh: boolean;
  }

  let pending: Pending | null = null;

  /**
   * The element currently being typed into, and the way out of it.
   *
   * The editor has to know, because while an edit is running the press that
   * places a caret is a press the *browser* should handle — and every other
   * press in this file ends in `preventDefault`, which is precisely what
   * stops a caret from moving.
   */
  let editing: HTMLElement | null = null;
  let stopEditing: (() => void) | null = null;

  /** Four screen pixels, which is the distance a click is allowed to wander. */
  const SLOP = 4;

  /**
   * Turns a waiting press into a drag, if the pointer has travelled far enough.
   *
   * Which drag depends on what is under it. Something movable is picked up;
   * anything else — a section, the ground outside the artboard — starts a
   * marquee, which is the same rule Figma runs on and the reason dragging
   * across a frame's background selects what is inside it rather than sliding
   * the frame around.
   */
  function startDrag(docX: number, docY: number): boolean {
    if (!pending) return false;
    const moved = Math.hypot(docX - pending.docX, docY - pending.docY) * zoom;
    if (moved < SLOP) return false;

    const anchor = pending.stack.find((n) => selection.includes(n.id));
    if (anchor && anchor.parentId !== null) beginMove(selection, pending.docX, pending.docY);
    else beginMarquee(pending.docX, pending.docY, false);

    pending = null;
    return true;
  }

  /**
   * A press released without travelling is a click, and a click on something
   * already selected goes one level in — the row, then its title, then the
   * word. The press that *made* the selection does not also drill, or a single
   * click would land two levels down.
   */
  function onSandboxUp(): void {
    if (pending) {
      const was = pending;
      pending = null;
      if (was.fresh) return;

      /*
       * Clicking one member of a multiple selection keeps only that one,
       * rather than drilling into it. Dropping five layers to reach the one
       * under the pointer is the move a designer means by that click; going
       * deeper would leave them somewhere they never asked to be.
       */
      const at = was.stack.findIndex((n) => selection.includes(n.id));
      if (selection.length > 1) {
        const member = [...was.stack].reverse().find((n) => selection.includes(n.id));
        if (member) select(member.id);
        return;
      }

      /*
       * A second click on the same place takes the object again.
       *
       * It matters after Escape: having stepped up to the frame, clicking back
       * on the button selects the button rather than doing nothing. It never
       * goes deeper than the object — that is the double-click's job — so
       * clicking repeatedly on a button leaves the button selected, wherever
       * on it the pointer lands.
       */
      void at;
      const want = pickObject(was.stack);
      if (want && !selection.includes(want.id)) select(want.id);
      return;
    }
    endGesture();
  }

  const rectLeft = (): number => canvas.getBoundingClientRect().left + panX;
  const rectTop = (): number => canvas.getBoundingClientRect().top + panY;

  function startPan(clientX: number, clientY: number): void {
    gesture = {
      kind: 'pan',
      startX: clientX,
      startY: clientY,
      baseX: 0,
      baseY: 0,
      baseW: 0,
      baseH: 0,
      basePanX: panX,
      basePanY: panY,
    };
    canvas.dataset.panning = '1';
  }

  function panTo(clientX: number, clientY: number): void {
    if (!gesture || gesture.kind !== 'pan') return;
    panX = gesture.basePanX + (clientX - gesture.startX);
    panY = gesture.basePanY + (clientY - gesture.startY);
    paintView();
  }

  /** The editor's own document: handles, panning off the frame, drag exits. */
  /*
   * Every editor-level listener, named so it can be taken off again.
   *
   * All of them sit on `document` or `window` and ask the event where it came
   * from, rather than binding to the canvas or the overlay. Those are markup
   * in this page, which the client router detaches on every navigation — a
   * handler bound straight to one is a handler on a dead node the moment
   * somebody leaves the Club and comes back. Delegating also happens to be
   * what lets a resize keep tracking after the pointer has left the small
   * handle it started on.
   */
  function onPointerDown(e: PointerEvent): void {
    const target = e.target as HTMLElement | null;

    const only = primary();

    /*
     * A spacing band, pulled. The bands are rebuilt on every live frame, so
     * the element under the pointer is gone a moment later — which is fine,
     * because the move is tracked from the document and from the sandbox,
     * neither of which cares what started it.
     */
    const space = target?.closest?.<HTMLElement>('.club__space');
    if (space?.dataset.space && only) {
      const at = toDoc(e.clientX, e.clientY);
      store.beginGesture();
      gesture = {
        kind: 'space',
        id: only,
        spaceKey: space.dataset.space as 'gap' | 'padX' | 'padY',
        spaceAxis: space.dataset.axis === 'y' ? 'y' : 'x',
        spaceSign: Number(space.dataset.sign) || 1,
        spaceBase: Number(space.dataset.base) || 0,
        startX: at.x,
        startY: at.y,
        baseX: 0,
        baseY: 0,
        baseW: 0,
        baseH: 0,
        basePanX: panX,
        basePanY: panY,
      };
      e.preventDefault();
      return;
    }

    const handle = target?.closest?.<HTMLElement>('.club__handle');
    if (handle && only) {
      const box = sandbox.boxOf(only);
      const p = store.propsOf(only);
      const at = toDoc(e.clientX, e.clientY);
      store.beginGesture();
      gesture = {
        kind: 'resize',
        dir: handle.dataset.dir,
        id: only,
        startX: at.x,
        startY: at.y,
        baseX: p.x ?? 0,
        baseY: p.y ?? 0,
        baseW: box?.width ?? 0,
        baseH: box?.height ?? 0,
        basePanX: panX,
        basePanY: panY,
      };
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    /*
     * The ground around the artboard. The hand pans it; the select tool draws
     * a marquee across it, which is the one place in the workspace where
     * "empty canvas" means what it means in a design tool.
     */
    if (target === canvas) {
      if (tool === 'hand' || spaceHeld || e.button === 1) {
        startPan(e.clientX, e.clientY);
        return;
      }
      const at = toDoc(e.clientX, e.clientY);
      beginMarquee(at.x, at.y, e.shiftKey);
    }
  }

  function onPointerMove(e: PointerEvent): void {
    /*
     * A pointer move that reaches the *editor* means the pointer is no longer
     * over the artboard — the frame is a separate document and keeps its own
     * moves — so whatever was hovered is not hovered any more.
     *
     * Without this the outline stayed on the last thing the pointer crossed
     * on its way out, and sat there over the design while the designer worked
     * in the panels. A frame is a picture: nothing on it reacts to a pointer
     * that has gone.
     */
    if (!gesture && pointerAt) {
      pointerAt = null;
      if (reHover()) drawOverlay();
    }

    if (gesture?.kind === 'pan') {
      panTo(e.clientX, e.clientY);
      return;
    }
    if (gesture?.kind === 'marquee') {
      const at = toDoc(e.clientX, e.clientY);
      dragMarquee(at.x, at.y);
      return;
    }
    // A move started inside the frame is tracked by the frame's own listener,
    // in its coordinates; this one owns resizes, which start out here.
    if (!gesture || gesture.kind === 'move') return;
    const at = toDoc(e.clientX, e.clientY);
    onGestureMove(at.x, at.y, e.shiftKey);
  }

  function onPointerUp(): void {
    canvas.removeAttribute('data-panning');
    /*
     * A press that began inside the frame and was released outside it — over a
     * panel, off the window — is still that press ending, so it goes through
     * the same door rather than being dropped.
     */
    onSandboxUp();
  }

  /*
   * Zoom on the pointer, pan on a plain wheel.
   *
   * `ctrlKey` is what a trackpad pinch arrives as, and what every design tool
   * treats as zoom. Non-passive because both branches have to stop the browser
   * doing its own page zoom or scroll underneath the canvas.
   */
  function onWheel(e: WheelEvent): void {
    if (!(e.target as HTMLElement | null)?.closest?.('[data-club-canvas]')) return;
    e.preventDefault();
    wheelAt(e.clientX, e.clientY, e);
  }

  /** Editor-window coordinates in, pan or zoom out. Shared with the frame. */
  function wheelAt(clientX: number, clientY: number, e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      const before = toDoc(clientX, clientY);
      /*
       * One notch is a step, not a leap.
       *
       * The first version scaled by `1 - deltaY / 320`, which turns a single
       * mouse-wheel notch into a 1.75× jump — 60% to 105% in one click, which
       * overshoots whatever the designer was aiming at every time. A trackpad
       * pinch sends many small deltas and a wheel sends few large ones, so the
       * factor is clamped rather than the delta: the pinch keeps its
       * smoothness and the wheel gets a sane step.
       */
      const factor = clamp(Math.exp(-e.deltaY / 420), 0.82, 1.22);
      zoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
      paintView();
      const after = toDoc(clientX, clientY);
      // Keep the point under the cursor where it was.
      panX += (after.x - before.x) * zoom;
      panY += (after.y - before.y) * zoom;
    } else if (e.shiftKey) {
      // Shift makes a vertical wheel horizontal, which is the convention a
      // mouse with one wheel relies on.
      panX -= e.deltaY || e.deltaX;
    } else {
      panX -= e.deltaX;
      panY -= e.deltaY;
    }
    paintView();
  }

  /*
   * Clicking away from the zoom field is the same as pressing Enter.
   *
   * `focusout` rather than `blur`, because blur does not bubble and this is
   * delegated from the document like every other listener in here — the
   * client router detaches this page's markup on a navigation, and the field
   * is markup.
   */
  function onFocusOut(e: FocusEvent): void {
    if (e.target === zoomField) closeZoomField(true);
  }

  function bindEditorInput(): void {
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('click', onClick);
  }

  /**
   * Zoom about the middle of the canvas, for the buttons and the shortcuts.
   *
   * The wheel zooms about the pointer, which is right when there is a pointer
   * to zoom about; a button press has no position, so the centre of the view
   * is the only honest anchor.
   */
  function zoomBy(factor: number): void {
    const box = canvas.getBoundingClientRect();
    const cx = box.width / 2;
    const cy = box.height / 2;
    const before = { x: (cx - panX) / zoom, y: (cy - panY) / zoom };
    zoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
    panX = cx - before.x * zoom;
    panY = cy - before.y * zoom;
    paintView();
  }

  /**
   * Another page of the portfolio, opened from the panel.
   *
   * Every link inside the canvas is inert — a click there means "select this"
   * — so this is the only way to change what is being designed, which is also
   * how the tool it is imitating works: you change page in the sidebar, never
   * by clicking something in the design.
   *
   * The sandbox is rebuilt from scratch, and so is the state. Edits are
   * described as overrides on ids like `hero.title`, and those ids mean
   * nothing on a different page — carrying them across would apply a home page
   * headline's font size to whatever happened to be first on the work index.
   * A page is a document, and a document gets its own sandbox.
   */
  function openPage(path: string): void {
    if (path === sandbox.path) return;

    root.querySelectorAll<HTMLElement>('[data-page]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.page === path));
    });

    selection = [];
    hovered = null;
    pointerAt = null;
    open.clear();
    store.clear();

    // The artboard is sized before the page arrives, so it arrives desktop.
    sizeFrame();
    sandbox.load(path, () => {
      if (disposed) return;
      bindSandboxInput();
      bindSandboxKeys();
      sizeFrame();
      fit();
      refresh();
    });
  }

  /* ---------------------------------------------------------------- */
  /* Creating, editing, removing                                       */
  /* ---------------------------------------------------------------- */

  let addedCount = 0;

  function createAt(frameX: number, frameY: number): void {
    const kind = tool === 'text' ? 'text' : tool === 'frame' ? 'frame' : tool;
    if (kind !== 'rect' && kind !== 'ellipse' && kind !== 'text' && kind !== 'frame') return;

    const id = `added.${Date.now().toString(36)}.${addedCount++}`;
    const section = sandbox.hit(sandbox.doc?.elementFromPoint(frameX, frameY) ?? null)?.parentId ?? 'hero';

    store.commit('create', (draft) => {
      draft.overrides[id] = {
        created: { kind, section, left: Math.round(frameX), top: Math.round(frameY) },
        w: kind === 'text' ? undefined : 160,
        h: kind === 'text' ? undefined : 110,
        bg: kind === 'text' ? undefined : '#7c3aed',
        radius: kind === 'frame' ? 16 : undefined,
        color: kind === 'text' ? '#111111' : undefined,
        fontSize: kind === 'text' ? 24 : undefined,
      };
      draft.addedOrder.push(id);
    });

    setTool('select');
    select(id);
    say('Your toys are ready.');
  }

  /**
   * Typing into the page, not into a box beside it.
   *
   * `contenteditable` on the real element for the length of the edit, then the
   * result goes into the store and the attribute comes straight back off. It
   * has to be removed: leaving it on would let a later click put a caret in a
   * layer nobody was editing, and it would be serialised into the export.
   */
  function editInPlace(id: string): void {
    const node = sandbox.get(id);
    if (!node) return;
    /*
     * Named for what it is: an element inside the *sandbox* document, made
     * editable for the length of one edit and handed back immediately. Both
     * listeners come off in `done`, so nothing outlives the gesture.
     */
    const editable = node.el;
    editable.setAttribute('contenteditable', 'plaintext-only');
    editing = editable;
    editable.focus();

    /*
     * The caret goes to the end of what is already there.
     *
     * Focusing a contenteditable leaves the caret wherever the browser decides,
     * which in practice is the very start — so the first keystroke went in
     * front of the headline instead of after it, and a designer wanting to add
     * a word had to click again to get somewhere useful. The end is the one
     * position that is right whether the intention is to extend the sentence or
     * to select it all and start again.
     */
    const view = editable.ownerDocument.defaultView;
    const caret = view?.getSelection();
    if (caret) {
      const at = editable.ownerDocument.createRange();
      at.selectNodeContents(editable);
      at.collapse(false);
      caret.removeAllRanges();
      caret.addRange(at);
    }

    const done = (): void => {
      if (editing !== editable) return;
      editing = null;
      stopEditing = null;
      editable.removeAttribute('contenteditable');
      editable.removeEventListener('blur', done);
      editable.removeEventListener('keydown', onKeyDown);
      store.set(id, { text: editable.textContent ?? '' }, 'text');
    };

    stopEditing = done;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        done();
      }
    }

    editable.addEventListener('blur', done);
    editable.addEventListener('keydown', onKeyDown);
  }

  /**
   * Swapping an image for one off the designer's machine.
   *
   * Read as a data URL rather than an object URL, because the export has to be
   * able to serialise it — an object URL points at a blob in this tab's memory
   * and would come out of the capture as nothing at all.
   */
  function pickImage(id: string): void {
    const filePicker = document.createElement('input');
    filePicker.type = 'file';
    filePicker.accept = 'image/*';
    filePicker.addEventListener('change', () => {
      const file = filePicker.files?.[0];
      if (!file) return;
      const fileReader = new FileReader();
      fileReader.addEventListener('load', () => {
        /*
         * The new picture goes into the old one's frame.
         *
         * Figma replaces the *fill* of a shape and leaves the shape alone —
         * which is what makes swapping an image feel safe rather than like
         * dropping a file onto a layout. Here the element keeps its own CSS
         * for free, corner radius included, but not its size: a portrait
         * dropped into a landscape slot would have re-laid the page out around
         * it. So the measured box is pinned and the picture is told to cover
         * it, unless the designer has already said otherwise.
         *
         * One commit, so the whole replacement is a single undo.
         */
        const box = sandbox.boxOf(id);
        store.commit('image', (draft) => {
          const was = draft.overrides[id] ?? {};
          draft.overrides[id] = {
            ...was,
            src: String(fileReader.result),
            w: was.w ?? (box ? Math.round(box.width) : undefined),
            h: was.h ?? (box ? Math.round(box.height) : undefined),
            fit: was.fit ?? 'cover',
          };
        });
        say('Okay… I see you.');
      });
      fileReader.addEventListener('error', () => flash("Couldn't read that file."));
      fileReader.readAsDataURL(file);
    });
    filePicker.click();
  }

  /**
   * Delete, over however many layers are selected, in one history step.
   *
   * Two different things, deliberately. A shape the designer added is really
   * removed, because it was theirs and there is nothing underneath it. A piece
   * of the portfolio is hidden instead: the sandbox is a layer of overrides
   * over a page it does not own, and "delete the hero" has no meaning there —
   * hiding it is the honest version of the same result, and it is the version
   * that comes back.
   */
  function removeSelected(): void {
    if (!selection.length) return;
    const ids = selection.slice();
    const made = new Set(ids.filter((id) => sandbox.get(id)?.created));

    store.commit('delete', (draft) => {
      for (const id of ids) {
        if (made.has(id)) {
          delete draft.overrides[id];
          draft.addedOrder = draft.addedOrder.filter((x) => x !== id);
        } else {
          draft.overrides[id] = { ...(draft.overrides[id] ?? {}), visible: false };
        }
      }
    });

    if (made.size) setSelection(ids.filter((id) => !made.has(id)));
    say('Brave.');
  }

  /**
   * Duplicate, for the things that can honestly be duplicated.
   *
   * A shape the designer added is described by a `CreatedSpec`, so a copy is a
   * second spec offset a little — the same mechanism as every other edit, with
   * undo and redo already working. A piece of the portfolio is an *adopted*
   * element: there is no description of it to copy, only a reference to a node
   * the sandbox does not own, and cloning it would be inventing a second
   * headline the store has no way to describe.
   *
   * So it says so rather than doing nothing. A control that looks like it
   * worked and did not is the thing the brief warns about.
   */
  function duplicateSelected(): void {
    const made = selection.filter((id) => store.propsOf(id).created);
    if (!made.length) {
      if (selection.length) flash('Only shapes you added can be duplicated.');
      return;
    }

    const fresh: string[] = [];
    store.commit('duplicate', (draft) => {
      for (const from of made) {
        const spec = draft.overrides[from]?.created;
        if (!spec) continue;
        const id = `added.${Date.now().toString(36)}.${addedCount++}`;
        draft.overrides[id] = {
          ...draft.overrides[from],
          created: { ...spec, left: spec.left + 24, top: spec.top + 24 },
        };
        draft.addedOrder.push(id);
        fresh.push(id);
      }
    });
    setSelection(fresh);
  }

  /**
   * Align, which means two different things and should not.
   *
   * With several layers selected they are aligned to each other, inside the
   * box they already occupy together. With one, it is aligned inside its
   * parent — because "align this to itself" is nothing, and aligning a single
   * thing to its container is what a designer means every time they press it
   * with one thing selected. Figma reads it the same way, and the reason it
   * feels like one command rather than two is that both are "put this edge on
   * that edge" with a different `that`.
   *
   * It writes offsets like every other move, so it undoes as one step and
   * resets to nothing along with everything else.
   */
  function alignSelection(how: string): void {
    if (!selection.length) return;

    const boxes = new Map<string, DOMRect>();
    for (const id of selection) {
      const box = sandbox.boxOf(id);
      if (box) boxes.set(id, box);
    }
    if (!boxes.size) return;

    const parent = sandbox.get(selection[0])?.parentId ?? null;
    const field =
      boxes.size > 1 ? unionOf([...boxes.values()]) : parent ? sandbox.boxOf(parent) : null;
    if (!field) return;

    store.commit('align', (draft) => {
      for (const [id, box] of boxes) {
        const was = draft.overrides[id] ?? {};
        let dx = 0;
        let dy = 0;
        if (how === 'left') dx = field.left - box.left;
        else if (how === 'centre') dx = field.left + field.width / 2 - (box.left + box.width / 2);
        else if (how === 'right') dx = field.right - box.right;
        else if (how === 'top') dy = field.top - box.top;
        else if (how === 'middle') dy = field.top + field.height / 2 - (box.top + box.height / 2);
        else if (how === 'bottom') dy = field.bottom - box.bottom;
        draft.overrides[id] = {
          ...was,
          x: Math.round((was.x ?? 0) + dx),
          y: Math.round((was.y ?? 0) + dy),
        };
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* Toolbar, shortcuts and the top-right actions                      */
  /* ---------------------------------------------------------------- */

  function setTool(next: Tool): void {
    tool = next;
    canvas.dataset.tool = next;
    root.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.tool === next));
    });
  }

  /* ---------------------------------------------------------------- */
  /* Tooltips, and the panels they describe                            */
  /* ---------------------------------------------------------------- */

  /**
   * Which keyboard this is, which is the one thing the Club has to sniff.
   *
   * Not to change behaviour — Cmd and Ctrl are read together everywhere in
   * here, so both work on both — but to *write the label down*. A Mac
   * designer reading "Ctrl Z" on a tooltip learns the wrong thing, and there
   * is no feature to detect that would answer the question.
   */
  const MAC = /mac|iphone|ipad/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform ??
      ''
  );

  const keyLabel = (raw: string): string =>
    raw.replace('Mod', MAC ? '⌘' : 'Ctrl').replace('Alt', MAC ? '⌥' : 'Alt');

  /**
   * One tooltip, after a pause, naming the control and its key.
   *
   * `title` was doing this and doing it badly: the browser's own tooltip
   * arrives after a second and a half, in the operating system's font, at the
   * pointer rather than at the control, and it cannot show a key in a
   * different weight. It is also the one piece of chrome in here that would
   * have looked like neither Figma nor this portfolio.
   */
  let tipTimer = 0;

  function showTip(on: HTMLElement): void {
    tip.replaceChildren();
    const says = document.createElement('span');
    says.textContent = on.dataset.tip ?? '';
    tip.appendChild(says);
    if (on.dataset.key) {
      const key = document.createElement('kbd');
      key.textContent = keyLabel(on.dataset.key);
      tip.appendChild(key);
    }

    tip.hidden = false;
    const at = on.getBoundingClientRect();
    const box = tip.getBoundingClientRect();
    // Above, unless there is no above — the tool pill is at the bottom, the
    // top bar is at the top, and one rule has to serve both.
    const top = at.top - box.height - 8;
    tip.style.top = `${top < 6 ? at.bottom + 8 : top}px`;
    tip.style.left = `${Math.max(6, Math.min(at.left + at.width / 2 - box.width / 2, window.innerWidth - box.width - 6))}px`;
  }

  function hideTip(): void {
    window.clearTimeout(tipTimer);
    window.clearTimeout(sharpen);
    tip.hidden = true;
  }

  function onOver(e: PointerEvent): void {
    const on = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-tip]');
    if (!on) return;
    window.clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => showTip(on), 420);
  }

  function onOut(e: PointerEvent): void {
    if (!(e.target as HTMLElement | null)?.closest?.('[data-tip]')) return;
    hideTip();
  }

  /**
   * Folding a panel away, which is what a small screen and a long look at the
   * work both want.
   *
   * Each side folds on its own and both fold together on the shortcut, which
   * is the pair of gestures the tool this imitates offers. The buttons stay in
   * the top bar when a panel is away, so getting it back is where putting it
   * away was rather than a hunt along the window edge.
   */
  const folded = new Set<string>();

  function fold(side: string): void {
    if (folded.has(side)) folded.delete(side);
    else folded.add(side);
    root.dataset.fold = [...folded].join(' ');
    requestAnimationFrame(() => {
      drawOverlay();
      paintView();
    });
  }

  function syncHistoryButtons(): void {
    const u = root.querySelector<HTMLButtonElement>('[data-act="undo"]');
    const r = root.querySelector<HTMLButtonElement>('[data-act="redo"]');
    if (u) u.disabled = !store.canUndo;
    if (r) r.disabled = !store.canRedo;
  }

  /*
   * One click handler for the whole workspace, routed by attribute.
   *
   * Every control in here is page markup that the router detaches on
   * navigation, so binding to each button individually leaves a set of
   * handlers on dead nodes the moment somebody leaves the Club and comes
   * back. Routing from the document also means the toolbar's markup can grow
   * a button without this wiring changing.
   */
  function onClick(e: MouseEvent): void {
    const hit = (sel: string): HTMLElement | null =>
      (e.target as HTMLElement | null)?.closest?.<HTMLElement>(sel) ?? null;

    // The eye is inside the row, so it has to be asked about first.
    const eye = hit('[data-eye]');
    if (eye?.dataset.eye) {
      e.stopPropagation();
      hooks.toggleVisible(eye.dataset.eye);
      return;
    }

    /*
     * The twist is inside the row, so it is asked about first — otherwise
     * opening a branch would also select it, and opening the tree to look
     * around would keep changing what the properties panel is describing.
     */
    const twist = hit('[data-twist]')?.dataset.twist;
    if (twist) {
      e.stopPropagation();
      if (open.has(twist)) open.delete(twist);
      else open.add(twist);
      renderLayers(layersHost, sandbox, store, selection, open, hooks);
      return;
    }

    const layer = hit('[data-layer]');
    if (layer?.dataset.layer) {
      if (e.shiftKey) toggle(layer.dataset.layer);
      else select(layer.dataset.layer);
      return;
    }

    hideTip();

    const how = hit('[data-align]')?.dataset.align;
    if (how) {
      alignSelection(how);
      return;
    }

    /* Which way the children run. */
    const flow = hit('[data-flow]')?.dataset.flow;
    if (flow) {
      for (const id of selection) store.set(id, { flow }, 'flow');
      return;
    }

    /*
     * And where they sit, from the nine-square picker.
     *
     * The cell is a position on screen; which CSS property each half of it
     * means depends on the direction, so the translation lives with the
     * picker that drew it rather than being written out twice.
     */
    const cell = hit('[data-place]')?.dataset.place;
    if (cell) {
      const id = primary();
      if (!id) return;
      const now = (store.propsOf(id).flow as string) ?? sandbox.get(id)?.flow ?? 'row';
      const [col, row] = cell.split(',').map(Number);
      const patch = placement(now, col, row);
      const ids = selection.slice();
      store.commit('place', (draft) => {
        for (const one of ids) draft.overrides[one] = { ...(draft.overrides[one] ?? {}), ...patch };
      });
      return;
    }

    const toolBtn = hit('[data-tool]');
    if (toolBtn) {
      setTool(toolBtn.dataset.tool as Tool);
      return;
    }

    if (hit('[data-club-resume]')) {
      setMode('edit');
      return;
    }

    const page = hit('[data-page]')?.dataset.page;
    if (page) {
      openPage(page);
      return;
    }

    const act = hit('[data-act]')?.dataset.act;
    if (!act) return;

    if (act === 'zoom-in') zoomBy(1.25);
    else if (act === 'zoom-out') zoomBy(1 / 1.25);
    else if (act === 'fit') fit();
    else if (act === 'zoom-set') openZoomField();
    else if (act === 'fold-left') fold('left');
    else if (act === 'fold-right') fold('right');
    else if (act === 'undo') store.undo();
    else if (act === 'redo') store.redo();
    else if (act === 'preview') setMode('preview');
    else if (act === 'export') void doExport();
    else if (act === 'reset') {
      const ok = window.confirm(
        'Reset your redesign?' + String.fromCharCode(10, 10) + 'Everything you have changed goes back to the original.'
      );
      if (!ok) return;
      select(null);
      store.reset();
      flash('Back to the original.');
    }
  }

  function setMode(mode: 'edit' | 'preview'): void {
    root.dataset.mode = mode;
    resume.hidden = mode !== 'preview';
    if (mode === 'preview') {
      setSelection([]);
      // The artboard gets the whole window back.
      requestAnimationFrame(fit);
    } else {
      requestAnimationFrame(fit);
    }
  }

  function onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    const typing =
      t &&
      (t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.tagName === 'SELECT' ||
        t.isContentEditable);

    if (e.key === ' ' && !typing) {
      spaceHeld = true;
      canvas.dataset.tool = 'hand';
    }

    /*
     * Alt belongs to the editor for as long as the editor is open.
     *
     * Windows and Linux give a bare Alt press to the browser's menu bar, which
     * takes focus out of the page — so the modifier worked exactly once and
     * then every following press went to the chrome instead. Preventing the
     * default keeps it here, which is what a design tool does with it.
     */
    if (e.key === 'Alt' || e.altKey) {
      e.preventDefault();
      if (!altHeld) {
        altHeld = true;
        // Alt changes what the pointer is pointing *at*, not just what is
        // drawn over it, so the hover is resolved again before the redraw.
        reHover();
        drawOverlay();
      }
    }

    /*
     * The zoom field owns its own keys while it has focus.
     *
     * Without this, typing 150 into it would set the Frame tool on the 1 and
     * leave the field holding a number nobody asked for.
     */
    if (e.target === zoomField) {
      if (e.key === 'Enter') closeZoomField(true);
      if (e.key === 'Escape') closeZoomField(false);
      return;
    }

    /*
     * The view shortcuts, read off the physical key rather than the character.
     *
     * Shift+1 arrives as "!" on a US layout, as "&" on a French one and as
     * something else again on a German one — `e.code` is the same key on all
     * of them, which is what makes these work for a designer who is not
     * typing in English.
     */
    if ((e.metaKey || e.ctrlKey) && e.code === 'Backslash') {
      e.preventDefault();
      fold('left');
      fold('right');
      return;
    }

    if (e.shiftKey && !e.metaKey && !e.ctrlKey) {
      if (e.code === 'Digit1') {
        e.preventDefault();
        fit();
        return;
      }
      if (e.code === 'Digit2') {
        e.preventDefault();
        fitSelection();
        return;
      }
      if (e.code === 'Digit0') {
        e.preventDefault();
        zoomTo(1);
        return;
      }
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }

    /*
     * A focused layer row answers to the keyboard, which is the whole of the
     * non-pointer route into selection: tab to the tree, arrow through it,
     * press Enter, then nudge with the arrow keys below.
     */
    const focusedLayer = (e.target as HTMLElement | null)?.dataset?.layer;
    if (focusedLayer && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (e.shiftKey) toggle(focusedLayer);
      else select(focusedLayer);
      return;
    }

    if (typing) return;

    switch (e.key.toLowerCase()) {
      case 'v':
        setTool('select');
        break;
      case 'h':
        setTool('hand');
        break;
      case 'r':
        setTool('rect');
        break;
      case 'o':
        setTool('ellipse');
        break;
      case 't':
        setTool('text');
        break;
      case 'f':
        setTool('frame');
        break;
      case 'escape':
        stepOut();
        break;
      case 'enter':
        stepIn();
        break;
      case '0':
        fit();
        break;
      case '=':
      case '+':
        zoomBy(1.25);
        break;
      case '-':
        zoomBy(1 / 1.25);
        break;
      case 'delete':
      case 'backspace':
        e.preventDefault();
        removeSelected();
        break;
      case 'd':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          duplicateSelected();
        }
        break;
      default:
        break;
    }

    /*
     * Arrow keys, which are the non-drag way to move something.
     *
     * WCAG 2.2 asks that anything achievable by dragging also be achievable
     * without it, and this is that: select with the keyboard in the layers
     * tree, nudge with the arrows, hold shift for ten at a time.
     */
    /*
     * Arrows move the thing, or move the view when there is no thing.
     *
     * Both of them stop the browser scrolling whatever it thinks is
     * scrollable underneath, which in a fixed workspace is nothing useful and
     * in the frame is the artboard sliding out from under the pointer.
     */
    if (!selection.length && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 160 : 40;
      if (e.key === 'ArrowLeft') panX += step;
      if (e.key === 'ArrowRight') panX -= step;
      if (e.key === 'ArrowUp') panY += step;
      if (e.key === 'ArrowDown') panY -= step;
      paintView();
      return;
    }

    if (selection.length && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      const ids = selection.slice();
      store.commit('nudge', (draft) => {
        for (const id of ids) {
          const was = draft.overrides[id] ?? {};
          draft.overrides[id] = { ...was, x: (was.x ?? 0) + dx, y: (was.y ?? 0) + dy };
        }
      });
    }
  }

  /**
   * Escape, which climbs rather than clears.
   *
   * A drag in progress is what it undoes first, then the level of nesting the
   * designer has clicked down into, one press at a time, and only when there
   * is nowhere further up does it clear the selection. Pressing it never
   * leaves the Club: that is a deliberate act with a door of its own, and an
   * editor you can fall out of by pressing Escape is an editor nobody trusts
   * with their work.
   */
  function stepOut(): void {
    if (gesture?.kind === 'marquee') {
      gesture = null;
      marquee = null;
      drawOverlay();
      return;
    }
    const id = primary();
    if (!id) return;
    if (selection.length > 1) {
      select(id);
      return;
    }
    select(sandbox.get(id)?.parentId ?? null);
  }

  /** Enter, which is the opposite: into the frame, or into the words. */
  function stepIn(): void {
    const id = primary();
    if (!id) return;
    const kids = sandbox.children(id);
    if (kids.length) {
      select(kids[0].id);
      return;
    }
    if (sandbox.get(id)?.type === 'text') editInPlace(id);
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') {
      spaceHeld = false;
      canvas.dataset.tool = tool;
    }

    if (e.key === 'Alt') e.preventDefault();

    if (!e.altKey && altHeld) {
      altHeld = false;
      reHover();
      drawOverlay();
    }
  }

  /*
   * And a window that loses focus has no modifier held any more.
   *
   * Without this, alt-tabbing away leaves `altHeld` true for ever: the keyup
   * lands in whatever window took focus, never here, so the measurements stay
   * frozen on screen until the key is pressed and released again.
   */
  function onBlur(): void {
    if (!altHeld && !spaceHeld) return;
    altHeld = false;
    spaceHeld = false;
    canvas.dataset.tool = tool;
    reHover();
    drawOverlay();
  }

  /*
   * The frame gets the keystroke when the pointer is over it, and keyboard
   * events do not cross out of an iframe any more than wheel events do. So the
   * sandbox document listens too and hands the modifier back.
   */
  function bindSandboxKeys(): void {
    const sandboxDoc = sandbox.doc;
    if (!sandboxDoc) return;
    sandboxDoc.addEventListener('keydown', onKey);
    sandboxDoc.addEventListener('keyup', onKeyUp);
  }

  /* ---------------------------------------------------------------- */
  /* Export                                                            */
  /* ---------------------------------------------------------------- */

  let exporting = false;

  async function doExport(): Promise<void> {
    if (exporting) return;
    exporting = true;
    flash('Rendering your redesign…', 60000);

    try {
      const dataUrl = await requestCapture();
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'designers-club-redesign.png';
      a.click();
      flash('Your redesign is ready. Downloaded as PNG.');
      say('Now send me your masterpiece.');
    } catch (error) {
      flash("Couldn't export this version. Try again.");
      // The sandbox is untouched by a failed export; nothing needs restoring.
      console.warn('[club] export failed', error);
    } finally {
      exporting = false;
    }
  }

  /**
   * Asks the sandbox to serialise itself, and waits for the answer.
   *
   * The capture runs inside the frame — see `capture.ts` for why — so this is
   * a message rather than a function call. The pixel ratio comes down as the
   * page gets taller, because a 5000px artboard at 2× is a 100-megapixel
   * canvas and browsers simply refuse past a point; 2× on a short page and 1×
   * on a long one keeps every export inside what a canvas will allocate.
   */
  function requestCapture(): Promise<string> {
    return new Promise((resolve, reject) => {
      const win = frame.contentWindow;
      if (!win) return reject(new Error('no sandbox'));

      const height = sandbox.pageHeight;
      const scale = height > 4200 ? 1 : height > 2600 ? 1.5 : 2;

      const timer = window.setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error('capture timed out'));
      }, 45000);

      function onMessage(event: MessageEvent): void {
        if (event.origin !== window.location.origin) return;
        const d = event.data as { type?: string; ok?: boolean; dataUrl?: string; message?: string };
        if (d?.type !== 'club:captured') return;
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        if (d.ok && d.dataUrl) resolve(d.dataUrl);
        else reject(new Error(d.message ?? 'capture failed'));
      }

      window.addEventListener('message', onMessage);
      sandbox.stripForExport();
      win.postMessage({ type: 'club:capture', scale }, window.location.origin);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Small talk                                                        */
  /* ---------------------------------------------------------------- */

  let toastTimer = 0;

  function flash(message: string, ms = 2600): void {
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, ms);
  }

  /*
   * The host's asides, rationed.
   *
   * One in four, at most one a minute, and never during the tour. The brief is
   * explicit that these are a bonus layer rather than the interface, and a
   * character who comments on every edit stops being a character and becomes a
   * notification system.
   */
  /**
   * The single hint the Club offers after the tour, once per browser.
   *
   * Measuring is the interaction a designer will not go looking for and will
   * use constantly once they know it exists — there is nothing on screen that
   * suggests a modifier key does anything. Everything else in here is either
   * visible or is a shortcut for something visible, so this is the only one
   * worth spending a message on.
   */
  const ALT_TIP = 'mh-club-measure-tip';

  function altTip(): void {
    try {
      if (localStorage.getItem(ALT_TIP) === '1') return;
      localStorage.setItem(ALT_TIP, '1');
    } catch {
      // Storage refused. Showing it once more costs far less than a designer
      // never finding the measurement overlay at all.
    }
    flash(`Tip: hold ${MAC ? 'Option' : 'Alt'} and hover to measure spacing.`, 5600);
  }

  let lastSaid = 0;

  function say(line: string): void {
    const now = Date.now();
    if (now - lastSaid < 60000) return;
    if (Math.random() > 0.25) return;
    lastSaid = now;
    flash(line, 2200);
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', fit);

  /*
   * The drawn pointer goes, even when it was already running.
   *
   * `Cursor.astro` now declines to *start* inside the workspace, which covers
   * a cold load — but arriving from the home page it is already running, and
   * `has-custom-cursor` sets `cursor: none !important` on every element in the
   * document and is never taken off. So the ring followed the pointer into the
   * panels and the native arrow stayed hidden underneath it.
   *
   * Taking the class off is enough and is self-repairing: the cursor's own
   * page-load handler puts it back whenever it is running and the class is
   * missing, which is exactly what happens on the way out of the Club.
   */
  document.documentElement.classList.remove('has-custom-cursor');
  document.querySelector<HTMLElement>('[data-cursor]')?.setAttribute('hidden', '');

  bindEditorInput();
  setTool('select');
  setMode('edit');

  // Likewise on the way in: 1440 wide before the first byte of the page.
  sizeFrame();
  sandbox.load('/', () => {
    if (disposed) return;
    bindSandboxInput();
    bindSandboxKeys();
    sizeFrame();
    fit();
    refresh();
    if (shouldTour()) runTour(root, altTip);
    else altTip();
  });

  /*
   * Leaving the Club takes everything with it.
   *
   * The client router replaces the document on a navigation, but these
   * listeners are on `document` and `window`, which it does not — so without
   * this a visitor who leaves and comes back has two editors reading the same
   * keystrokes. The frame is blanked explicitly so its document, its adopted
   * nodes and the imaging chunk it loaded can all be collected.
   */
  function dispose(): void {
    disposed = true;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
    window.clearTimeout(tipTimer);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerout', onOut);
    document.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('wheel', onWheel);
    document.removeEventListener('click', onClick);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', fit);
    frame.src = 'about:blank';
    // The drawn pointer was hidden on the way in and is given back on the way
    // out. It is `transition:persist`, so the attribute would otherwise cross
    // the navigation and leave the portfolio with no pointer at all.
    document.querySelector<HTMLElement>('[data-cursor]')?.removeAttribute('hidden');
    document.removeEventListener('astro:before-swap', dispose);
  }

  document.addEventListener('astro:before-swap', dispose);
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
