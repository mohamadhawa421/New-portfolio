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

import { dismissPicker, renderLayers, renderProps, type PanelHooks } from './panels';
import { Sandbox } from './sandbox';
import { Store, type Props } from './store';
import { runTour, shouldTour } from './tour';

/** The artboard's width. A desktop document, not the editor's window. */
const ARTBOARD = 1440;

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.5;

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
  const toast = root.querySelector<HTMLElement>('[data-club-toast]')!;
  const resume = root.querySelector<HTMLButtonElement>('[data-club-resume]')!;

  const store = new Store();
  const sandbox = new Sandbox(frame);

  let tool: Tool = 'select';
  let selected: string | null = null;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let spaceHeld = false;
  let altHeld = false;
  let disposed = false;

  /* ---------------------------------------------------------------- */
  /* The view                                                          */
  /* ---------------------------------------------------------------- */

  function paintView(): void {
    stage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    // Hairlines that stay hairlines. See the note at the top of the file.
    overlay.style.setProperty('--z', String(1 / zoom));
    zoomOut.textContent = `${Math.round(zoom * 100)}%`;
  }

  function sizeFrame(): void {
    const h = Math.max(sandbox.pageHeight, 600);
    frame.style.width = `${ARTBOARD}px`;
    frame.style.height = `${h}px`;
    overlay.style.width = `${ARTBOARD}px`;
    overlay.style.height = `${h}px`;
    stage.style.width = `${ARTBOARD}px`;
    stage.style.height = `${h}px`;
  }

  function fit(): void {
    const box = canvas.getBoundingClientRect();
    const pad = 48;
    zoom = Math.max(MIN_ZOOM, Math.min(1, (box.width - pad * 2) / ARTBOARD));
    panX = (box.width - ARTBOARD * zoom) / 2;
    panY = pad / 2;
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
    renderLayers(layersHost, sandbox, store, selected, hooks);
    renderProps(propsHost, propsHead, sandbox, store, selected, hooks);
    drawOverlay();
    syncHistoryButtons();
  }

  store.subscribe(() => refresh(gesture !== null));

  /* ---------------------------------------------------------------- */
  /* Selection and its overlay                                         */
  /* ---------------------------------------------------------------- */

  function select(id: string | null): void {
    /*
     * A colour picker belongs to the thing that is selected, so changing the
     * selection closes it — but a property *update* must not. It used to be
     * dismissed on every render, which meant the first live frame of a colour
     * drag closed the picker doing the dragging.
     */
    if (id !== selected) dismissPicker();
    selected = id;
    renderLayers(layersHost, sandbox, store, selected, hooks);
    renderProps(propsHost, propsHead, sandbox, store, selected, hooks);
    drawOverlay();
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

  function drawOverlay(): void {
    overlay.replaceChildren();

    if (hovered && hovered !== selected) {
      const hb = sandbox.boxOf(hovered);
      if (hb) {
        const h = document.createElement('div');
        h.className = 'club__hover';
        h.style.cssText = `left:${hb.x}px;top:${hb.y}px;width:${hb.width}px;height:${hb.height}px;border-width:calc(1px * var(--z,1))`;
        overlay.appendChild(h);
      }
    }

    if (!selected) return;
    const box = sandbox.boxOf(selected);
    const node = sandbox.get(selected);
    if (!box || !node) return;

    const sel = document.createElement('div');
    sel.className = 'club__sel';
    sel.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;border-width:calc(1px * var(--z,1))`;
    overlay.appendChild(sel);

    /*
     * The badge says the size, under the box, the way Figma's does — a
     * designer mid-drag is reading numbers, not the name of the thing they
     * are already looking at. The name is in the layers panel, highlighted.
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
    if (altHeld) drawPadding(node, box);

    // Sections are containers for the tree, not things to drag by the corner.
    if (node.parentId === null) return;

    for (const [dir, fx, fy] of HANDLES) {
      const h = document.createElement('div');
      h.className = 'club__handle';
      h.dataset.dir = dir;
      h.style.cssText = `left:${box.x + box.width * fx}px;top:${box.y + box.height * fy}px;transform:scale(var(--z,1));cursor:${dir}-resize`;
      overlay.appendChild(h);
    }
  }

  /** The four inside edges of a box, drawn and labelled. */
  function drawPadding(node: { el: HTMLElement }, box: DOMRect): void {
    const view = node.el.ownerDocument.defaultView;
    if (!view) return;
    const cs = view.getComputedStyle(node.el);

    const sides: [string, number, string][] = [
      ['top', parseFloat(cs.paddingTop) || 0, 'row'],
      ['bottom', parseFloat(cs.paddingBottom) || 0, 'row'],
      ['left', parseFloat(cs.paddingLeft) || 0, 'col'],
      ['right', parseFloat(cs.paddingRight) || 0, 'col'],
    ];

    for (const [side, size, axis] of sides) {
      if (size < 1) continue;

      const band = document.createElement('div');
      band.className = 'club__pad';

      const horizontal = axis === 'row';
      const w = horizontal ? box.width : size;
      const h = horizontal ? size : box.height;
      const left = side === 'right' ? box.x + box.width - size : box.x;
      const top = side === 'bottom' ? box.y + box.height - size : box.y;

      band.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;

      const label = document.createElement('span');
      label.className = 'club__pad-n';
      label.textContent = String(Math.round(size));
      label.style.transform = `translate(-50%, -50%) scale(var(--z,1))`;
      band.appendChild(label);

      overlay.appendChild(band);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Direct manipulation                                               */
  /* ---------------------------------------------------------------- */

  interface Gesture {
    kind: 'move' | 'resize' | 'pan';
    dir?: string;
    id?: string;
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

  function beginMove(id: string, docX: number, docY: number): void {
    const p = store.propsOf(id);
    const box = sandbox.boxOf(id);
    store.beginGesture();
    gesture = {
      kind: 'move',
      id,
      startX: docX,
      startY: docY,
      baseX: p.x ?? 0,
      baseY: p.y ?? 0,
      baseW: box?.width ?? 0,
      baseH: box?.height ?? 0,
      basePanX: panX,
      basePanY: panY,
    };
  }

  function onGestureMove(docX: number, docY: number, shift: boolean): void {
    if (!gesture) return;
    let dx = docX - gesture.startX;
    let dy = docY - gesture.startY;

    if (gesture.kind === 'move' && gesture.id) {
      // Shift constrains to one axis, the way it does everywhere else.
      if (shift) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      store.set(
        gesture.id,
        { x: Math.round(gesture.baseX + dx), y: Math.round(gesture.baseY + dy) },
        'move',
        true
      );
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

      const patch: Props = {};
      if (dir.match(/[ew]/)) patch.w = Math.max(8, Math.round(w));
      if (dir.match(/[ns]/)) patch.h = Math.max(8, Math.round(h));
      // Dragging a west or north edge also moves the origin.
      if (dir.includes('w')) patch.x = Math.round(gesture.baseX + dx);
      if (dir.includes('n')) patch.y = Math.round(gesture.baseY + dy);
      store.set(gesture.id, patch, 'resize', true);
    }
  }

  function endGesture(): void {
    if (!gesture) return;
    const was = gesture;
    gesture = null;
    if (was.kind === 'pan') return;
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
      if (tool === 'hand' || spaceHeld || e.button === 1) {
        startPan(e.clientX + rectLeft(), e.clientY + rectTop());
        e.preventDefault();
        return;
      }

      // `freeze` took pointer events off the page, so ask the point instead.
      const node = sandbox.at(e.clientX, e.clientY);

      if (tool !== 'select') {
        createAt(e.clientX, e.clientY);
        return;
      }

      if (!node) {
        select(null);
        return;
      }

      select(node.id);
      if (node.parentId !== null) beginMove(node.id, e.clientX, e.clientY);
      e.preventDefault();
    });

    sandboxDoc.addEventListener('pointermove', (e) => {
      if (gesture?.kind === 'pan') {
        panTo(e.clientX + rectLeft(), e.clientY + rectTop());
        return;
      }
      if (gesture) {
        onGestureMove(e.clientX, e.clientY, e.shiftKey);
        return;
      }
      // Nothing is dragging: show what would be picked up.
      const over = tool === 'select' ? (sandbox.at(e.clientX, e.clientY)?.id ?? null) : null;
      if (over !== hovered) {
        hovered = over;
        drawOverlay();
      }
    });

    sandboxDoc.addEventListener('pointerup', endGesture);

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

    /* Double-click a text layer and type into the page itself. */
    sandboxDoc.addEventListener('dblclick', (e) => {
      const node = sandbox.at(e.clientX, e.clientY);
      if (!node || (node.type !== 'text' && node.type !== 'button')) return;
      e.preventDefault();
      editInPlace(node.id);
    });
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

    const handle = target?.closest?.<HTMLElement>('.club__handle');
    if (handle && selected) {
      const box = sandbox.boxOf(selected);
      const p = store.propsOf(selected);
      const at = toDoc(e.clientX, e.clientY);
      store.beginGesture();
      gesture = {
        kind: 'resize',
        dir: handle.dataset.dir,
        id: selected,
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

    // Empty canvas: pan with the hand, otherwise clear the selection.
    if (target === canvas) {
      if (tool === 'hand' || spaceHeld || e.button === 1) startPan(e.clientX, e.clientY);
      else select(null);
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (gesture?.kind === 'pan') {
      panTo(e.clientX, e.clientY);
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
    endGesture();
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
      zoom = clamp(zoom * (1 - e.deltaY / 320), MIN_ZOOM, MAX_ZOOM);
      paintView();
      const after = toDoc(clientX, clientY);
      // Keep the point under the cursor where it was.
      panX += (after.x - before.x) * zoom;
      panY += (after.y - before.y) * zoom;
    } else {
      panX -= e.deltaX;
      panY -= e.deltaY;
    }
    paintView();
  }

  function bindEditorInput(): void {
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

    selected = null;
    hovered = null;
    store.clear();

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
    editable.focus();

    const done = (): void => {
      editable.removeAttribute('contenteditable');
      editable.removeEventListener('blur', done);
      editable.removeEventListener('keydown', onKeyDown);
      store.set(id, { text: editable.textContent ?? '' }, 'text');
    };

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
        store.set(id, { src: String(fileReader.result) }, 'image');
        say('Okay… I see you.');
      });
      fileReader.addEventListener('error', () => flash("Couldn't read that file."));
      fileReader.readAsDataURL(file);
    });
    filePicker.click();
  }

  function removeSelected(): void {
    if (!selected) return;
    const node = sandbox.get(selected);
    if (!node) return;
    const id = selected;

    if (node.created) {
      store.commit('delete', (draft) => {
        delete draft.overrides[id];
        draft.addedOrder = draft.addedOrder.filter((x) => x !== id);
      });
      select(null);
    } else {
      // The portfolio's own elements are hidden rather than destroyed: the
      // sandbox is a layer over the real page and there is nothing to delete.
      store.set(id, { visible: false }, 'hide');
    }
    say('Brave.');
  }

  function duplicateSelected(): void {
    if (!selected) return;
    const node = sandbox.get(selected);
    const spec = store.propsOf(selected).created;
    if (!node || !spec) return;
    const id = `added.${Date.now().toString(36)}.${addedCount++}`;
    const from = store.propsOf(selected);
    store.commit('duplicate', (draft) => {
      draft.overrides[id] = {
        ...from,
        created: { ...spec, left: spec.left + 24, top: spec.top + 24 },
      };
      draft.addedOrder.push(id);
    });
    select(id);
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

    const layer = hit('[data-layer]');
    if (layer?.dataset.layer) {
      select(layer.dataset.layer);
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
      select(null);
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

    if (e.altKey && !altHeld) {
      altHeld = true;
      drawOverlay();
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
      select(focusedLayer);
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
        select(null);
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
    if (selected && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const p = store.propsOf(selected);
      const patch: Props = {};
      if (e.key === 'ArrowLeft') patch.x = (p.x ?? 0) - step;
      if (e.key === 'ArrowRight') patch.x = (p.x ?? 0) + step;
      if (e.key === 'ArrowUp') patch.y = (p.y ?? 0) - step;
      if (e.key === 'ArrowDown') patch.y = (p.y ?? 0) + step;
      store.set(selected, patch, 'nudge');
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') {
      spaceHeld = false;
      canvas.dataset.tool = tool;
    }

    if (!e.altKey && altHeld) {
      altHeld = false;
      drawOverlay();
    }
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
  window.addEventListener('resize', fit);

  bindEditorInput();
  setTool('select');
  setMode('edit');

  sandbox.load('/', () => {
    if (disposed) return;
    bindSandboxInput();
    bindSandboxKeys();
    sizeFrame();
    fit();
    refresh();
    if (shouldTour()) runTour(root, () => flash('Tip: V select · H hand · R rectangle · T text'));
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
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('wheel', onWheel);
    document.removeEventListener('click', onClick);
    window.removeEventListener('resize', fit);
    frame.src = 'about:blank';
    document.removeEventListener('astro:before-swap', dispose);
  }

  document.addEventListener('astro:before-swap', dispose);
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
