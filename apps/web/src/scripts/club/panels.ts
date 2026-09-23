/**
 * The two side panels: what is on the page, and what you can do to one of it.
 *
 * Both render from the catalogue and the store and hold no state of their own,
 * which is what keeps them honest. The properties panel in particular can only
 * offer what `PROPS_FOR` says the selected type supports — so there is no path
 * by which a control appears for something the sandbox would then ignore. An
 * editor that shows a font size on an image and does nothing when you change
 * it stops feeling real at exactly that moment.
 */

import { PROPS_FOR } from './schema';
import type { ClubNode, Sandbox } from './sandbox';
import type { Props, Store } from './store';

export interface PanelHooks {
  select(id: string | null): void;
  toggleVisible(id: string): void;
  replaceImage(id: string): void;
}

/* ------------------------------------------------------------------ */
/* Layers                                                              */
/* ------------------------------------------------------------------ */

/**
 * A glyph per kind, the way a layers panel is read.
 *
 * Nobody reads forty layer names top to bottom; they scan for the shape of the
 * thing they want and read the name once they are near it. Figma's tree is
 * legible for exactly this reason, and it costs four small paths.
 */
const TYPE_ICON: Record<string, string> = {
  text: '<svg viewBox="0 0 16 16"><path d="M4 4h8M8 4v9"/></svg>',
  image:
    '<svg viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="m3.5 11 3-3 2.5 2.5L11 9l1.5 1.5"/><circle cx="6" cy="6" r="1"/></svg>',
  button: '<svg viewBox="0 0 16 16"><rect x="2" y="5" width="12" height="6" rx="3"/></svg>',
  surface: '<svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="2"/></svg>',
  container:
    '<svg viewBox="0 0 16 16"><path d="M5.5 2v12M10.5 2v12M2 5.5h12M2 10.5h12"/></svg>',
};

const EYE_OPEN = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.2 10-6.2S22 12 22 12s-3.6 6.2-10 6.2S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>';
const EYE_SHUT = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A10.6 10.6 0 0 1 12 6c6.4 0 10 6 10 6a18 18 0 0 1-3.3 3.9M6.6 8.2A17.6 17.6 0 0 0 2 12s3.6 6 10 6a10 10 0 0 0 3.6-.64"/></svg>';

export function renderLayers(
  host: HTMLElement,
  sandbox: Sandbox,
  store: Store,
  selectedId: string | null,
  hooks: PanelHooks
): void {
  const nodes = sandbox.list();
  const frag = document.createDocumentFragment();

  /*
   * The tree renders to whatever depth it has, rather than to two levels.
   *
   * It used to assume section-then-child, which was true until frames started
   * adopting the text inside them: a project row's title is a child of the
   * row, which is a child of the section, and under the old renderer it simply
   * did not appear. Walking parents is both correct and shorter, and it means
   * a deeper catalogue needs no change here.
   */
  const childrenOf = new Map<string | null, ClubNode[]>();
  for (const node of nodes) {
    const list = childrenOf.get(node.parentId) ?? [];
    list.push(node);
    childrenOf.set(node.parentId, list);
  }

  const emit = (node: ClubNode, depth: number): void => {
    frag.appendChild(row(node, depth, selectedId, store, hooks));
    for (const child of childrenOf.get(node.id) ?? []) emit(child, depth + 1);
  };

  for (const section of childrenOf.get(null) ?? []) emit(section, 0);

  host.replaceChildren(frag);

  // Keep the selected row in view when selection came from the canvas.
  if (selectedId) {
    host.querySelector<HTMLElement>(`[data-layer="${cssSafe(selectedId)}"]`)?.scrollIntoView({
      block: 'nearest',
    });
  }
}

function row(
  node: ClubNode,
  depth: number,
  selectedId: string | null,
  store: Store,
  hooks: PanelHooks
): HTMLElement {
  const visible = store.propsOf(node.id).visible !== false;

  const el = document.createElement('div');
  el.className = `club__layer${depth === 0 ? ' club__layer--section' : ''}`;
  // Indent by depth rather than by a class per level, so the tree can be any
  // depth without the stylesheet knowing how deep.
  el.style.paddingLeft = `${6 + depth * 13}px`;
  el.dataset.layer = node.id;
  el.setAttribute('role', 'treeitem');
  el.setAttribute('aria-selected', String(node.id === selectedId));
  el.tabIndex = 0;
  if (!visible) el.dataset.hidden = '1';

  const icon = document.createElement('span');
  icon.className = 'club__type';
  icon.innerHTML = TYPE_ICON[node.type] ?? TYPE_ICON.container;
  el.appendChild(icon);

  const name = document.createElement('span');
  name.className = 'club__layer-name';
  name.textContent = node.label;
  el.appendChild(name);

  const eye = document.createElement('button');
  eye.type = 'button';
  eye.className = 'club__eye';
  eye.dataset.on = visible ? '1' : '0';
  eye.innerHTML = visible ? EYE_OPEN : EYE_SHUT;
  eye.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${node.label}`);
  /*
   * The row carries attributes and no handlers at all.
   *
   * Forty-four rows are rebuilt on every edit, and binding three listeners to
   * each of them would be a hundred and thirty bindings thrown away and
   * remade on every keystroke in a property field. The workspace's one
   * delegated click handler reads `data-layer` and `data-eye` instead — see
   * `onClick` in index.ts — which is both cheaper and the only version that
   * survives the router detaching this panel on a navigation.
   */
  eye.dataset.eye = node.id;
  el.appendChild(eye);

  return el;
}

/* ------------------------------------------------------------------ */
/* Properties                                                          */
/* ------------------------------------------------------------------ */

/**
 * How each property is presented, and which group it belongs to.
 *
 * Grouping is the difference between a panel and a list of inputs. The order
 * here is the order Figma trained everyone to expect — what it says, then how
 * it is set, then where it is and how big — so a designer's eye lands in the
 * right third of the panel without reading the labels.
 */
const GROUPS: { name: string; keys: string[] }[] = [
  /*
   * Figma's order, because a designer's eye already knows it.
   *
   * Position and size first — they are what you reach for most and what the
   * selection badge is already telling you — then the spacing inside the box,
   * then what it says, then how it is set, then how it looks. The earlier
   * version led with Content, which put a textarea at the top of every panel
   * and pushed X and Y below the fold on a short window.
   *
   * The names are Figma's too: Position, Auto layout, Appearance, Fill, Text.
   * Borrowing the vocabulary is most of what makes a panel feel familiar
   * before a single control has been used.
   */
  { name: 'Position', keys: ['x', 'y', 'w', 'h'] },
  { name: 'Auto layout', keys: ['padX', 'padY', 'gap'] },
  { name: 'Text', keys: ['text', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'align'] },
  { name: 'Appearance', keys: ['opacity', 'radius', 'fit'] },
  { name: 'Fill', keys: ['bg', 'color'] },
  { name: 'Image', keys: ['src'] },
];

/*
 * One or two characters wherever Figma uses one or two characters.
 *
 * These sit *beside* the input rather than above it, so a long word would
 * halve the space the number gets. Figma's panel is dense because its labels
 * are glyphs, and the glyphs are legible because they are always in the same
 * place relative to the field.
 */
const LABEL: Record<string, string> = {
  text: '',
  src: '',
  fontSize: 'Aa',
  fontWeight: 'W',
  lineHeight: '↕',
  letterSpacing: '↔',
  align: '',
  color: '',
  bg: '',
  radius: '⌜',
  opacity: '◐',
  fit: '',
  x: 'X',
  y: 'Y',
  w: 'W',
  h: 'H',
  padX: '↔',
  padY: '↕',
  gap: '⇹',
};

/** What the control is, for a screen reader and for the field's `title`. */
const TITLE: Record<string, string> = {
  text: 'Content',
  src: 'Image',
  fontSize: 'Font size',
  fontWeight: 'Font weight',
  lineHeight: 'Line height',
  letterSpacing: 'Letter spacing',
  align: 'Alignment',
  color: 'Text colour',
  bg: 'Background',
  radius: 'Corner radius',
  opacity: 'Opacity',
  fit: 'Image fit',
  x: 'X position',
  y: 'Y position',
  w: 'Width',
  h: 'Height',
  padX: 'Horizontal padding',
  padY: 'Vertical padding',
  gap: 'Gap',
};

export function renderProps(
  host: HTMLElement,
  head: HTMLElement,
  sandbox: Sandbox,
  store: Store,
  selectedId: string | null,
  hooks: PanelHooks
): void {
  const node = selectedId ? sandbox.get(selectedId) : undefined;

  if (!node) {
    head.textContent = 'Properties';
    host.innerHTML =
      '<p class="club__empty">Nothing selected.<br />Pick something on the canvas — or in Layers — and its controls appear here.</p>';
    return;
  }

  head.textContent = node.label;

  const allowed = new Set(PROPS_FOR[node.type]);
  const props = store.propsOf(node.id);
  const measured = sandbox.boxOf(node.id);
  const frag = document.createDocumentFragment();

  for (const group of GROUPS) {
    const keys = group.keys.filter((k) => allowed.has(k));
    if (!keys.length) continue;

    const box = document.createElement('div');
    box.className = 'club__group';

    const title = document.createElement('div');
    title.className = 'club__group-name';
    title.textContent = group.name;
    box.appendChild(title);

    const fields = document.createElement('div');
    fields.className = 'club__fields';

    for (const key of keys) {
      fields.appendChild(field(key, node, props, measured, store, hooks));
    }

    box.appendChild(fields);
    frag.appendChild(box);
  }

  /*
   * Figma's "Selected colors", which is the thing that makes selecting a
   * parent useful rather than a dead end.
   *
   * Pick a section and the panel above can only offer what a section itself
   * has — a width, some padding — which is almost never what a designer
   * wanted. What they wanted was to restyle everything inside it. So the
   * fills actually in use underneath are gathered, deduplicated, and offered
   * as swatches; changing one rewrites every layer using that exact colour in
   * a single step, which is how a palette gets changed in seconds instead of
   * forty clicks.
   */
  if (node.type === 'container' || node.type === 'button') {
    const swatches = coloursInside(sandbox, store, node);
    if (swatches.length) {
      const box = document.createElement('div');
      box.className = 'club__group';

      const title = document.createElement('div');
      title.className = 'club__group-name';
      title.textContent = 'Selected colors';
      box.appendChild(title);

      for (const entry of swatches) {
        box.appendChild(paletteRow(entry, store));
      }

      frag.appendChild(box);
    }
  }

  host.replaceChildren(frag);
}

/** One colour and every place inside the selection that is using it. */
interface Swatch {
  hex: string;
  uses: { id: string; key: 'bg' | 'color' }[];
}

function coloursInside(sandbox: Sandbox, store: Store, node: ClubNode): Swatch[] {
  const found = new Map<string, Swatch>();

  /*
   * By DOM containment rather than by the layer tree.
   *
   * The tree is deliberately shallow — a button's label and a project row are
   * both filed under their section — so "children of this node" in the tree is
   * not the same as "inside this node" on the page. Containment is the
   * question actually being asked.
   */
  for (const other of sandbox.list()) {
    if (other === node || !node.el.contains(other.el)) continue;

    const allowed = new Set(PROPS_FOR[other.type]);
    for (const key of ['bg', 'color'] as const) {
      if (!allowed.has(key)) continue;
      const value = (store.propsOf(other.id)[key] as string) ?? computed(other, key);
      if (!value || value === 'rgba(0, 0, 0, 0)' || value === 'transparent') continue;
      const hex = toHex(value);
      const entry = found.get(hex) ?? { hex, uses: [] };
      entry.uses.push({ id: other.id, key });
      found.set(hex, entry);
    }
  }

  // Most-used first: the colour a designer means is the one they can see most.
  return [...found.values()].sort((a, b) => b.uses.length - a.uses.length).slice(0, 8);
}

function paletteRow(entry: Swatch, store: Store): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'club__field club__field--wide';

  const propInput = document.createElement('button');
  propInput.type = 'button';
  propInput.className = 'club__swatch';
  propInput.setAttribute('aria-label', `${entry.hex}, used ${entry.uses.length} times`);
  propInput.innerHTML =
    `<span class="club__chip" style="background:${entry.hex}"></span>` +
    `<span>${entry.hex.toUpperCase()}</span>` +
    `<span class="club__count">${entry.uses.length}</span>`;

  propInput.addEventListener('click', () => {
    openPicker(propInput, entry.hex, (hex, live) => {
      const chip = propInput.firstElementChild as HTMLElement | null;
      if (chip) chip.style.background = hex;
      const text = propInput.children[1] as HTMLElement | null;
      if (text) text.textContent = hex.toUpperCase();
      /*
       * One history step for the whole palette change, not one per layer —
       * `live` keeps the intermediate frames out of the stack exactly as a
       * drag does, and the last call commits them together.
       */
      for (const use of entry.uses) store.set(use.id, { [use.key]: hex }, 'palette', live);
    });
  });

  wrap.appendChild(propInput);
  return wrap;
}

function field(
  key: string,
  node: ClubNode,
  props: Props,
  measured: DOMRect | null,
  store: Store,
  hooks: PanelHooks
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'club__field';
  const wide = key === 'text' || key === 'src' || key === 'align' || key === 'fit';
  if (wide) wrap.classList.add('club__field--wide');

  const id = `club-${node.id.replace(/\W/g, '-')}-${key}`;
  const title = TITLE[key] ?? key;
  const glyph = LABEL[key] ?? '';

  /*
   * The glyph is decoration; the accessible name is the real word.
   *
   * "X" and "Aa" are perfectly clear to an eye that has used a design tool and
   * meaningless to a screen reader, so the label carries the glyph visually
   * and `aria-label` on the control carries the name. A field with no glyph at
   * all — the textarea, the colour swatch — gets no empty label box either.
   */
  if (glyph) {
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.setAttribute('aria-hidden', 'true');
    label.textContent = glyph;
    label.title = title;
    wrap.appendChild(label);
  }

  const commit = (value: unknown, live = false): void => {
    store.set(node.id, { [key]: value } as Props, key, live);
  };

  /* ---- Content -------------------------------------------------- */

  if (key === 'text') {
    const propInput = document.createElement('textarea');
    propInput.id = id;
    propInput.setAttribute('aria-label', title);
    propInput.value = (props.text ?? node.el.textContent ?? '').trim();
    propInput.addEventListener('input', () => commit(propInput.value, true));
    propInput.addEventListener('change', () => commit(propInput.value));
    wrap.appendChild(propInput);
    return wrap;
  }

  if (key === 'src') {
    const propInput = document.createElement('button');
    propInput.type = 'button';
    propInput.id = id;
    propInput.className = 'club__btn';
    propInput.setAttribute('aria-label', title);
    propInput.textContent = 'Replace image…';
    propInput.addEventListener('click', () => hooks.replaceImage(node.id));
    wrap.appendChild(propInput);
    return wrap;
  }

  /* ---- Choices --------------------------------------------------- */

  if (key === 'align' || key === 'fit') {
    const propInput = document.createElement('select');
    propInput.id = id;
    propInput.setAttribute('aria-label', title);
    const options = key === 'align' ? ['left', 'center', 'right'] : ['cover', 'contain', 'fill'];
    const current = (props[key as 'align' | 'fit'] ?? computed(node, key)) as string;
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt[0].toUpperCase() + opt.slice(1);
      o.selected = opt === current;
      propInput.appendChild(o);
    }
    propInput.addEventListener('change', () => commit(propInput.value));
    wrap.appendChild(propInput);
    return wrap;
  }

  /* ---- Colours --------------------------------------------------- */

  if (key === 'color' || key === 'bg') {
    const current = toHex(((props[key] as string) ?? computed(node, key)) || '#000000');

    const propInput = document.createElement('button');
    propInput.type = 'button';
    propInput.id = id;
    propInput.className = 'club__swatch';
    propInput.setAttribute('aria-label', title);
    propInput.dataset.colour = current;
    propInput.innerHTML =
      `<span class="club__chip" style="background:${current}"></span><span>${current.toUpperCase()}</span>`;
    propInput.addEventListener('click', () => {
      openPicker(propInput, current, (hex, live) => {
        propInput.dataset.colour = hex;
        const chip = propInput.firstElementChild as HTMLElement | null;
        if (chip) chip.style.background = hex;
        const text = propInput.lastElementChild as HTMLElement | null;
        if (text) text.textContent = hex.toUpperCase();
        commit(hex, live);
      });
    });
    wrap.appendChild(propInput);
    return wrap;
  }

  /* ---- Numbers --------------------------------------------------- */

  const propInput = document.createElement('input');
  propInput.type = 'number';
  propInput.id = id;
  propInput.setAttribute('aria-label', title);

  /*
   * The placeholder is the measured value, and the field itself is empty
   * until the designer sets one.
   *
   * That distinction is the whole reason overrides are sparse: an empty W
   * means "whatever the portfolio does", which is responsive and correct, and
   * typing a number is a deliberate act of pinning it. Pre-filling every box
   * with a measurement would turn simply selecting something into overriding
   * everything about it.
   */
  const current = props[key as keyof Props];
  if (current !== undefined) propInput.value = String(current);
  propInput.placeholder = String(fallback(key, node, measured));

  if (key === 'opacity') {
    propInput.step = '0.05';
    propInput.min = '0';
    propInput.max = '1';
  }

  propInput.addEventListener('input', () => {
    if (propInput.value === '') return;
    commit(Number(propInput.value), true);
  });
  propInput.addEventListener('change', () => {
    if (propInput.value === '') {
      // Cleared: hand the property back to the stylesheet.
      store.set(node.id, { [key]: undefined } as Props, key);
      return;
    }
    commit(Number(propInput.value));
  });

  wrap.appendChild(propInput);
  return wrap;
}

/* ------------------------------------------------------------------ */
/* Reading what the page already does                                  */
/* ------------------------------------------------------------------ */

function computed(node: ClubNode, key: string): string {
  const win = node.el.ownerDocument.defaultView;
  if (!win) return '';
  const cs = win.getComputedStyle(node.el);
  if (key === 'color') return cs.color;
  if (key === 'bg') return cs.backgroundColor;
  if (key === 'align') return cs.textAlign;
  if (key === 'fit') return cs.objectFit;
  return '';
}

function fallback(key: string, node: ClubNode, box: DOMRect | null): number | string {
  const win = node.el.ownerDocument.defaultView;
  const cs = win ? win.getComputedStyle(node.el) : null;
  switch (key) {
    case 'w':
      return Math.round(box?.width ?? 0);
    case 'h':
      return Math.round(box?.height ?? 0);
    case 'x':
    case 'y':
      return 0;
    case 'opacity':
      return cs ? Number(cs.opacity).toFixed(2) : 1;
    case 'radius':
      return cs ? Math.round(parseFloat(cs.borderTopLeftRadius) || 0) : 0;
    case 'fontSize':
      return cs ? Math.round(parseFloat(cs.fontSize) || 0) : 16;
    case 'fontWeight':
      return cs ? cs.fontWeight : 400;
    case 'lineHeight': {
      if (!cs) return 1.4;
      const lh = parseFloat(cs.lineHeight);
      const fs = parseFloat(cs.fontSize) || 16;
      return Number.isFinite(lh) ? (lh / fs).toFixed(2) : 1.4;
    }
    case 'letterSpacing':
      return cs && cs.letterSpacing !== 'normal' ? parseFloat(cs.letterSpacing).toFixed(1) : 0;
    case 'padX':
      return cs ? Math.round(parseFloat(cs.paddingLeft) || 0) : 0;
    case 'padY':
      return cs ? Math.round(parseFloat(cs.paddingTop) || 0) : 0;
    case 'gap':
      return cs && cs.gap !== 'normal' ? Math.round(parseFloat(cs.gap) || 0) : 0;
    default:
      return 0;
  }
}

/** `<propInput type="color">` only speaks `#rrggbb`, and computed styles do not. */
function toHex(value: string): string {
  if (value.startsWith('#')) return value.slice(0, 7);
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return '#000000';
  const [r, g, b] = m[1].split(',').map((n) => Math.max(0, Math.min(255, Math.round(parseFloat(n)))));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

const cssSafe = (s: string): string => s.replace(/"/g, '\\"');

/* ------------------------------------------------------------------ */
/* The colour picker                                                   */
/* ------------------------------------------------------------------ */

/**
 * Two draggable surfaces and a hex field, which is what a designer's hands
 * already know.
 *
 * `<input type="color">` was the first version and is the wrong control here
 * for two reasons. It hands the interaction to an operating-system dialog that
 * looks nothing like this workspace — a Windows colour wheel over a dark Figma
 * clone — and, more to the point, it cannot be *dragged*: choosing a colour is
 * a continuous gesture where the page updates under your thumb, and a modal
 * that reports a value when it closes is a different activity altogether.
 *
 * So: saturation and value on one square, hue on a strip, both live. Every
 * move reports `live` so the sandbox repaints under the pointer and the whole
 * drag lands in the history as one step.
 */
let closePicker: (() => void) | null = null;

function openPicker(
  anchor: HTMLElement,
  initial: string,
  onPick: (pickerHex: string, live: boolean) => void
): void {
  closePicker?.();

  let [h, sat, val] = rgbToHsv(hexToRgb(initial));

  const picker = document.createElement('div');
  picker.className = 'club__picker';

  const sv = document.createElement('div');
  sv.className = 'club__sv';
  const svKnob = document.createElement('i');
  svKnob.className = 'club__knob';
  sv.appendChild(svKnob);

  const hue = document.createElement('div');
  hue.className = 'club__hue';
  const hueKnob = document.createElement('i');
  hueKnob.className = 'club__knob';
  hue.appendChild(hueKnob);

  const pickerHex = document.createElement('input');
  pickerHex.className = 'club__hex';
  pickerHex.type = 'text';
  pickerHex.spellcheck = false;

  picker.append(sv, hue, pickerHex);
  document.body.appendChild(picker);

  // Under the swatch, nudged back on screen if it would fall off the bottom.
  const box = anchor.getBoundingClientRect();
  const top = Math.min(box.bottom + 6, window.innerHeight - 232);
  picker.style.left = `${Math.max(8, Math.min(box.left - 130, window.innerWidth - 232))}px`;
  picker.style.top = `${Math.max(8, top)}px`;

  /*
   * `report` is false exactly once, when the picker first draws itself.
   *
   * Reporting on open was a real bug and an instructive one: the opening paint
   * committed the colour it had just read, which re-rendered the properties
   * panel, which dismisses any open picker — so the picker closed on the frame
   * it appeared. Drawing and reporting are two different things, and only a
   * gesture reports.
   */
  const paint = (live: boolean, report = true): void => {
    const hexValue = rgbToHex(hsvToRgb(h, sat, val));
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${rgbToHex(hsvToRgb(h, 1, 1))})`;
    svKnob.style.left = `${sat * 100}%`;
    svKnob.style.top = `${(1 - val) * 100}%`;
    hueKnob.style.left = `${(h / 360) * 100}%`;
    hueKnob.style.top = '50%';
    if (document.activeElement !== pickerHex) pickerHex.value = hexValue;
    if (report) onPick(hexValue, live);
  };

  /*
   * One drag handler for both surfaces.
   *
   * Pointer capture is what makes it feel continuous: the gesture keeps
   * reporting after the pointer has left the 128-pixel square, which is where
   * a colour drag spends most of its time.
   */
  const drag = (pickerSurface: HTMLElement, onMove: (fx: number, fy: number) => void): void => {
    pickerSurface.addEventListener('pointerdown', (e: PointerEvent) => {
      pickerSurface.setPointerCapture(e.pointerId);
      const apply = (ev: PointerEvent): void => {
        const r = pickerSurface.getBoundingClientRect();
        onMove(clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height));
        paint(true);
      };
      apply(e);
      const move = (ev: PointerEvent): void => apply(ev);
      const up = (): void => {
        pickerSurface.removeEventListener('pointermove', move);
        pickerSurface.removeEventListener('pointerup', up);
        paint(false);
      };
      pickerSurface.addEventListener('pointermove', move);
      pickerSurface.addEventListener('pointerup', up);
      e.preventDefault();
    });
  };

  drag(sv, (fx, fy) => {
    sat = fx;
    val = 1 - fy;
  });
  drag(hue, (fx) => {
    h = fx * 360;
  });

  pickerHex.addEventListener('input', () => {
    const v = pickerHex.value.trim();
    if (!/^#?[0-9a-f]{6}$/i.test(v)) return;
    [h, sat, val] = rgbToHsv(hexToRgb(v.startsWith('#') ? v : `#${v}`));
    paint(true);
  });
  pickerHex.addEventListener('change', () => paint(false));

  function onAway(e: MouseEvent): void {
    if (picker.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
    closePicker?.();
  }

  function onEsc(e: KeyboardEvent): void {
    if (e.key === 'Escape') closePicker?.();
  }

  closePicker = (): void => {
    document.removeEventListener('pointerdown', onAway, true);
    document.removeEventListener('keydown', onEsc);
    picker.remove();
    closePicker = null;
  };

  document.addEventListener('pointerdown', onAway, true);
  document.addEventListener('keydown', onEsc);
  paint(false, false);
}

/** Closed when the panel re-renders, so it never outlives its own swatch. */
export function dismissPicker(): void {
  closePicker?.();
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

function hexToRgb(pickerHex: string): [number, number, number] {
  const v = pickerHex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.replace(/./g, (c) => c + c) : v.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;

function rgbToHsv([r, g, b]: [number, number, number]): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const seg = Math.floor(h / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
