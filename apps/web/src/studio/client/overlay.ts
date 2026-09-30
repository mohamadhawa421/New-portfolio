/**
 * The Studio's controls, drawn inside the page they control.
 *
 * Everything here lives in one shadow root appended to the frame's body, so
 * the portfolio's CSS cannot restyle the toolbar and the toolbar's CSS cannot
 * touch the portfolio. It is positioned in *document* coordinates, so it
 * scrolls with the page for free and is never a frame behind it.
 *
 * The frame is drawn scaled (a 1440 artboard fitted to the window), which
 * would shrink these controls with it; every control is counter-scaled by the
 * same factor, so a toolbar is the same physical size at every zoom.
 */

export interface Button {
  id: string;
  label: string;
  /** Short text shown on the button itself; the label is its accessible name. */
  text?: string;
  icon?: keyof typeof ICONS;
  danger?: boolean;
  disabled?: boolean;
  primary?: boolean;
}

export interface Toolbar {
  label: string;
  buttons: Button[];
}

export interface Inserter {
  /** The element the button sits under. */
  anchor: Element;
  label: string;
  action: string;
  /** Payload handed back with the action. */
  data?: string;
}

export const ICONS = {
  up: '<path d="M10 15V5M5 10l5-5 5 5"/>',
  down: '<path d="M10 5v10M5 10l5 5 5-5"/>',
  left: '<path d="M15 10H5M10 5l-5 5 5 5"/>',
  right: '<path d="M5 10h10M10 5l5 5-5 5"/>',
  eye: '<path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Z"/><circle cx="10" cy="10" r="2.5"/>',
  eyeOff: '<path d="M3 3l14 14M8.5 5.2A8 8 0 0 1 10 4c5 0 8 6 8 6a14 14 0 0 1-2.4 3M6 6.7C3.6 8.2 2 10 2 10s3 6 8 6a7.6 7.6 0 0 0 3.2-.7"/>',
  trash: '<path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/>',
  copy: '<rect x="7" y="7" width="9" height="9" rx="1.5"/><path d="M4 13V5a1 1 0 0 1 1-1h8"/>',
  plus: '<path d="M10 4v12M4 10h12"/>',
  image: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="m3 13 4-4 4 4 2-2 4 4"/>',
  sliders: '<path d="M4 6h8M15 6h1M4 14h2M9 14h7"/><circle cx="13.5" cy="6" r="1.5"/><circle cx="7.5" cy="14" r="1.5"/>',
  open: '<path d="M11 4h5v5M16 4l-7 7M14 12v4H4V6h4"/>',
  star: '<path d="m10 3 2.2 4.4 4.8.7-3.5 3.4.8 4.8L10 14l-4.3 2.3.8-4.8L3 8.1l4.8-.7Z"/>',
  parent: '<path d="M7 12 3 8l4-4M3 8h9a5 5 0 0 1 5 5v3"/>',
  text: '<path d="M4 5h12M10 5v11M7 16h6"/>',
};

const svg = (name: keyof typeof ICONS) =>
  `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

const CSS = `
  :host { all: initial; position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 2147483000; }
  * { box-sizing: border-box; }
  .box { position: absolute; pointer-events: none; border-radius: 3px; }
  .hover { outline: 1px solid var(--accent); outline-offset: 3px; opacity: .9; }
  .sel { outline: 2px solid var(--accent); outline-offset: 3px; }
  .sel.section, .hover.section { outline-style: dashed; outline-offset: -1px; border-radius: 0; }
  .chip {
    position: absolute; pointer-events: none; transform-origin: 0 100%;
    font: 600 11px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    color: #fff; background: var(--accent); padding: 4px 7px; border-radius: 5px 5px 5px 0; white-space: nowrap;
  }
  .bar {
    position: absolute; display: flex; align-items: center; gap: 2px; padding: 4px;
    transform-origin: 0 100%;
    background: #141416; color: #f5f5f7; border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px; box-shadow: 0 10px 30px -8px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.25);
    font: 500 12px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    white-space: nowrap; pointer-events: auto;
  }
  .bar__label { padding: 0 8px 0 6px; color: #a1a1a6; font-weight: 600; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
  .bar__sep { width: 1px; height: 18px; background: rgba(255,255,255,.12); margin: 0 3px; }
  button {
    all: unset; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 8px;
    border-radius: 8px; cursor: pointer; color: inherit; font: inherit;
  }
  button:hover:not([disabled]) { background: rgba(255,255,255,.1); }
  button:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  button[disabled] { opacity: .35; cursor: default; }
  button.danger:hover:not([disabled]) { background: rgba(255,69,58,.18); color: #ff6961; }
  button.primary { background: var(--accent); color: #fff; }
  button.primary:hover { filter: brightness(1.1); background: var(--accent); }
  button.icon-only { width: 28px; padding: 0; justify-content: center; }
  svg { width: 16px; height: 16px; flex: none; }
  .ins {
    position: absolute; pointer-events: auto; transform-origin: 50% 50%;
    display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px 0 9px;
    border-radius: 999px; border: 1px dashed color-mix(in srgb, var(--accent) 60%, transparent);
    background: color-mix(in srgb, var(--paper) 88%, transparent); color: var(--accent);
    font: 600 12px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    white-space: nowrap; opacity: .6; transition: opacity .15s ease, background-color .15s ease;
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }
  .ins:hover, .ins:focus-visible { opacity: 1; background: var(--paper); border-style: solid; }
`;

export function createOverlay(doc: Document, onAction: (action: string, data?: string) => void) {
  const host = doc.createElement('mh-studio-overlay');
  const root = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = CSS;
  root.append(style);
  doc.body.append(host);

  let scale = 1;
  const hoverBox = doc.createElement('div');
  hoverBox.className = 'box hover';
  const hoverChip = doc.createElement('div');
  hoverChip.className = 'chip';
  const selBox = doc.createElement('div');
  selBox.className = 'box sel';
  const bar = doc.createElement('div');
  bar.className = 'bar';
  bar.setAttribute('role', 'toolbar');
  const inserterLayer = doc.createElement('div');
  root.append(inserterLayer, hoverBox, hoverChip, selBox, bar);
  for (const el of [hoverBox, hoverChip, selBox, bar]) el.hidden = true;
  // Clicks on the Studio's own controls must never reach the page underneath.
  for (const type of ['mousedown', 'click', 'dblclick']) root.addEventListener(type, (e) => e.stopPropagation());

  let hovered: Element | null = null;
  let selected: Element | null = null;
  let inserters: Inserter[] = [];

  const theme = () => {
    const dark = doc.documentElement.dataset.theme === 'dark' || (!doc.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    host.style.setProperty('--accent', dark ? '#a855f7' : '#7c3aed');
    host.style.setProperty('--paper', dark ? '#1d1d1f' : '#ffffff');
  };
  theme();

  const rectOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    const sx = doc.defaultView!.scrollX;
    const sy = doc.defaultView!.scrollY;
    return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
  };

  const place = (box: HTMLElement, el: Element) => {
    const r = rectOf(el);
    Object.assign(box.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
  };

  const inv = () => `scale(${1 / scale})`;

  function position() {
    if (hovered && hovered.isConnected && hovered !== selected) {
      place(hoverBox, hovered);
      const r = rectOf(hovered);
      Object.assign(hoverChip.style, { left: `${r.x}px`, top: `${r.y - 22 / scale - 4}px`, transform: inv() });
      hoverBox.hidden = hoverChip.hidden = false;
    } else {
      hoverBox.hidden = hoverChip.hidden = true;
    }
    if (selected && selected.isConnected) {
      place(selBox, selected);
      selBox.hidden = false;
      const r = rectOf(selected);
      const h = 38 / scale;
      // Above the element; below it if the element is at the very top.
      const top = r.y - h - 8 / scale < doc.defaultView!.scrollY + 4 ? r.y + r.h + 8 / scale : r.y - h - 8 / scale;
      const maxLeft = doc.documentElement.clientWidth - bar.offsetWidth / scale - 8;
      Object.assign(bar.style, { left: `${Math.max(8, Math.min(r.x, maxLeft))}px`, top: `${top}px`, transform: inv() });
      bar.hidden = bar.childElementCount === 0;
    } else {
      selBox.hidden = bar.hidden = true;
    }
    for (const [i, ins] of inserters.entries()) {
      const btn = inserterLayer.children[i] as HTMLElement | undefined;
      if (!btn) continue;
      if (!ins.anchor.isConnected) {
        btn.hidden = true;
        continue;
      }
      const r = rectOf(ins.anchor);
      btn.hidden = false;
      Object.assign(btn.style, {
        left: `${r.x + r.w / 2}px`,
        top: `${r.y + r.h}px`,
        transform: `translate(-50%, -50%) ${inv()}`,
      });
    }
  }

  function setHover(el: Element | null, label = '') {
    hovered = el;
    hoverChip.textContent = label;
    hoverBox.classList.toggle('section', !!el && label.startsWith('Section'));
    position();
  }

  function setSelection(el: Element | null, toolbar: Toolbar | null, isSection = false) {
    selected = el;
    selBox.classList.toggle('section', isSection);
    bar.innerHTML = '';
    if (el && toolbar) {
      const label = doc.createElement('span');
      label.className = 'bar__label';
      label.textContent = toolbar.label;
      bar.append(label);
      for (const b of toolbar.buttons) {
        if (b.id === '|') {
          const sep = doc.createElement('span');
          sep.className = 'bar__sep';
          bar.append(sep);
          continue;
        }
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-label', b.label);
        btn.title = b.label;
        if (b.disabled) btn.setAttribute('disabled', '');
        if (b.danger) btn.classList.add('danger');
        if (b.primary) btn.classList.add('primary');
        btn.innerHTML = `${b.icon ? svg(b.icon) : ''}${b.text ? `<span>${b.text}</span>` : ''}`;
        if (!b.text) btn.classList.add('icon-only');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onAction(b.id);
        });
        bar.append(btn);
      }
    }
    position();
  }

  function setInserters(list: Inserter[]) {
    inserters = list;
    inserterLayer.innerHTML = '';
    for (const ins of list) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'ins';
      btn.innerHTML = `${svg('plus')}<span></span>`;
      btn.querySelector('span')!.textContent = ins.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onAction(ins.action, ins.data);
      });
      inserterLayer.append(btn);
    }
    position();
  }

  /** Is this node part of the Studio's own UI rather than the page? */
  const owns = (node: EventTarget | null) => node === host;

  const ro = new ResizeObserver(() => position());
  ro.observe(doc.documentElement);

  return {
    setHover,
    setSelection,
    setInserters,
    position,
    owns,
    setScale(s: number) {
      scale = s;
      position();
    },
    theme,
    destroy() {
      ro.disconnect();
      host.remove();
    },
  };
}

export type Overlay = ReturnType<typeof createOverlay>;
