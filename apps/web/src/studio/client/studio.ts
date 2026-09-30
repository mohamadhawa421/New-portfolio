/**
 * Portfolio Studio — editing the portfolio where it stands.
 *
 * The canvas is the real site: the Studio deployment renders every page on
 * demand, and `?draft=1` renders it from the draft (studio/middleware.ts), so
 * what is on screen is the page itself — new projects, deleted ones and added
 * sections included — not a picture of the published page with edits painted
 * over it. `?club=1` puts the site in its frame mode: no shockwave, cursor,
 * sound or lightbox, and every reveal already played.
 *
 * How the owner works on it:
 *
 *   click text        it is editable where it is, caret where they clicked
 *   click a card,     it is selected, and a toolbar appears on it — move,
 *   section, image    hide, replace, details, delete
 *   "+" buttons       sit where new things go: a project after the grid, a
 *                     section after a section, an image after the gallery
 *   Details           a panel for what cannot be clicked: address, SEO, tags
 *
 * Text edits are applied to the page as they are typed. Anything structural
 * — a new project, a deleted section, a reorder — is saved and the page is
 * rendered again from the draft, keeping the scroll position, because only
 * the real template knows how a new thing should look.
 *
 * State, and only this:
 *   draft    what is being edited — the truth in this tab
 *   saved    the draft as the server last confirmed it; autosave sends the
 *            difference between the two and nothing else
 *   history  one snapshot per meaningful edit, for undo
 * Unsaved work is mirrored to localStorage, so a crash, a closed tab or a
 * dropped connection loses nothing.
 */

import {
  EXTRA_BLANK,
  SECTION_NAMES,
  TEMPLATES,
  addSection,
  blockOf,
  deleteProject,
  diff,
  humanize,
  isEmptyDiff,
  moveProject,
  moveSection,
  newProject,
  projectBySlug,
  slugify,
  target,
  type Draft,
  type Row,
  type Target,
} from './keys';
import { createOverlay, type Button, type Inserter, type Overlay } from './overlay';

type Status = 'loading' | 'saved' | 'unsaved' | 'saving' | 'offline' | 'error' | 'publishing' | 'published';

const EMPTY = '⁠⁣empty⁣⁠';
const SAVE_DELAY_MS = 900;
const HISTORY_LIMIT = 120;
const BACKUP_KEY = 'mh-studio-unsaved';
const ARTBOARD = 1440;

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;

/** A small element builder, so the panels read as structure rather than string-building. */
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, any> = {}, ...kids: (Node | string | null | false | undefined)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (typeof v === 'boolean') (el as any)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid) el.append(kid);
  return el;
}

export function startStudio(root: HTMLElement, cfg: { supabaseUrl: string }): void {
  const frame = $<HTMLIFrameElement>('[data-frame]', root);
  const stage = $('[data-stage]', root);
  const statusEl = $('[data-status]', root);
  const pageBtn = $<HTMLButtonElement>('[data-pages]', root);
  const pageLabel = $('[data-page-label]', root);
  const pagesPop = $<HTMLElement>('[data-pages-pop]', root);
  const undoBtn = $<HTMLButtonElement>('[data-undo]', root);
  const redoBtn = $<HTMLButtonElement>('[data-redo]', root);
  const previewBtn = $<HTMLButtonElement>('[data-preview]', root);
  const deviceBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-device]')];
  const publishBtn = $<HTMLButtonElement>('[data-publish]', root);
  const inspector = $<HTMLElement>('[data-inspector]', root);
  const inspectorBody = $('[data-inspector-body]', root);
  const inspectorTitle = $('[data-inspector-title]', root);
  const toastEl = $('[data-toast]', root);
  const loader = $('[data-loader]', root);

  let draft!: Draft;
  let saved!: Draft;
  let release: { id: number; createdAt: string; snapshot: any } | null = null;
  let past: string[] = [];
  let future: string[] = [];
  let saveTimer = 0;
  let saving: Promise<boolean> | null = null;
  let status: Status = 'loading';
  let path = '/';
  let selected: { key: string; el: HTMLElement } | null = null;
  let editing: HTMLElement | null = null;
  let editStart = '';
  let preview = false;
  let fdoc: Document | null = null;
  let overlay: Overlay | null = null;
  let restoreScroll: number | null = null;
  let scale = 1;
  let inspecting: (() => void) | null = null;

  const clone = <T,>(v: T): T => structuredClone(v);

  /* ================================================================ */
  /* Status, toasts                                                     */
  /* ================================================================ */

  const STATUS_TEXT: Record<Status, string> = {
    loading: 'Loading…',
    saved: 'All changes saved',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    offline: 'Offline — kept on this device',
    error: 'Could not save',
    publishing: 'Publishing…',
    published: 'Published',
  };
  function setStatus(s: Status, detail = '') {
    status = s;
    statusEl.textContent = detail ? `${STATUS_TEXT[s]} — ${detail}` : STATUS_TEXT[s];
    statusEl.dataset.state = s;
    publishBtn.disabled = s === 'loading' || s === 'publishing';
  }

  let toastTimer = 0;
  function toast(text: string, action?: { label: string; run: () => void }) {
    toastEl.innerHTML = '';
    toastEl.append(h('span', {}, text));
    if (action) {
      toastEl.append(
        h('button', {
          type: 'button',
          class: 'toast__action',
          onclick: () => {
            toastEl.hidden = true;
            action.run();
          },
        }, action.label)
      );
    }
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastEl.hidden = true), action ? 7000 : 3200);
  }

  /* ================================================================ */
  /* Loading                                                            */
  /* ================================================================ */

  const normalise = (d: any): Draft => ({
    settings: d.settings ?? { fields: {}, seo: {} },
    pages: d.pages ?? [],
    media: d.media ?? [],
    projects: d.projects ?? [],
    tags: d.tags ?? [],
    blocks: d.blocks ?? [],
    lists: d.lists ?? [],
    styles: d.styles ?? [],
  });

  async function load() {
    setStatus('loading');
    const res = await fetch('/studio/api/draft', { credentials: 'same-origin' });
    if (res.status === 401) return void location.assign('/studio/login?next=/studio');
    if (!res.ok) return setStatus('error', 'the draft did not load');
    const body = await res.json();
    draft = normalise(body.draft);
    saved = clone(draft);
    release = body.release;
    setStatus('saved');
    offerBackup();
    openPage(new URLSearchParams(location.search).get('page') ?? '/');
  }

  function offerBackup() {
    let backup: { at: number; draft: Draft } | null = null;
    try {
      backup = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? 'null');
    } catch {
      /* private mode or corrupt; nothing to offer */
    }
    if (!backup || isEmptyDiff(diff(saved, normalise(backup.draft)))) return;
    toast(`Unsaved edits from ${new Date(backup.at).toLocaleString()} were kept on this device.`, {
      label: 'Restore',
      run: () => commit(() => void (draft = normalise(backup!.draft)), true),
    });
  }

  /* ================================================================ */
  /* Pages                                                              */
  /* ================================================================ */

  const PAGES = [
    { label: 'Home', path: '/' },
    { label: 'Work', path: '/work' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  const labelFor = (p: string) => PAGES.find((x) => x.path === p)?.label ?? projectBySlug(draft, p.replace('/work/', ''))?.title ?? p;

  function openPage(p: string, keepScroll = false) {
    stopEditing(true);
    select(null);
    if (!keepScroll) closeInspector();
    path = p;
    pageLabel.textContent = labelFor(p);
    history.replaceState(null, '', `/studio?page=${encodeURIComponent(p)}`);
    restoreScroll = keepScroll ? frame.contentWindow?.scrollY ?? 0 : null;
    loader.hidden = false;
    frame.src = `${p}${p.includes('?') ? '&' : '?'}club=1&draft=1&t=${Date.now()}`;
  }

  /** The page again, from the draft as it now is. */
  async function rerender() {
    await saveNow();
    openPage(path, true);
  }

  function renderPagesMenu() {
    pagesPop.innerHTML = '';
    const search = h('input', { class: 'pop__search', type: 'search', placeholder: 'Find a page or project…', 'aria-label': 'Find a page or project' });
    const list = h('div', { class: 'pop__list', role: 'listbox', 'aria-label': 'Pages' });
    const item = (label: string, p: string, note?: string, dim = false) =>
      h('button', {
        type: 'button',
        class: `pop__item${p === path ? ' is-current' : ''}${dim ? ' is-dim' : ''}`,
        role: 'option',
        'aria-selected': String(p === path),
        onclick: () => {
          pagesPop.hidden = true;
          openPage(p);
        },
      }, h('span', { class: 'pop__name' }, label), note ? h('span', { class: 'pop__note' }, note) : null);
    const fill = (q = '') => {
      list.innerHTML = '';
      const m = (s: string) => s.toLowerCase().includes(q.toLowerCase());
      const pages = PAGES.filter((x) => m(x.label));
      if (pages.length) list.append(h('div', { class: 'pop__group' }, 'Pages'), ...pages.map((x) => item(x.label, x.path)));
      const projects = draft.projects.filter((x) => x.kind === 'case' && m(x.title)).sort((a, b) => a.sort_order - b.sort_order);
      if (projects.length) {
        list.append(h('div', { class: 'pop__group' }, `Projects · ${projects.length}`));
        for (const x of projects) list.append(item(x.title, `/work/${x.slug}`, x.visible ? (x.featured ? 'Lead' : '') : 'Hidden', !x.visible));
      }
    };
    search.addEventListener('input', () => fill(search.value));
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') (list.querySelector('.pop__item') as HTMLButtonElement | null)?.click();
      if (e.key === 'Escape') pagesPop.hidden = true;
    });
    fill();
    pagesPop.append(
      search,
      list,
      h('div', { class: 'pop__foot' },
        h('button', { type: 'button', class: 'btn btn--primary btn--small', onclick: () => { pagesPop.hidden = true; openNewProject(); } }, 'New project'),
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => { pagesPop.hidden = true; inspectSettings(); } }, 'Site settings'))
    );
    requestAnimationFrame(() => search.focus());
  }

  pageBtn.addEventListener('click', () => {
    pagesPop.hidden = !pagesPop.hidden;
    pageBtn.setAttribute('aria-expanded', String(!pagesPop.hidden));
    if (!pagesPop.hidden) renderPagesMenu();
  });
  document.addEventListener('mousedown', (e) => {
    if (!pagesPop.hidden && !pagesPop.contains(e.target as Node) && !pageBtn.contains(e.target as Node)) {
      pagesPop.hidden = true;
      pageBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /* ================================================================ */
  /* The frame                                                          */
  /* ================================================================ */

  /*
   * A desktop document of a known width, scaled to fit — not a frame the size
   * of whatever space is left. At the width the canvas actually has, the
   * portfolio would show its tablet layout, and the owner would be editing a
   * page no desktop visitor sees. Mobile is the phone width at 1:1.
   */
  function fit() {
    if (stage.dataset.device === 'mobile') {
      scale = 1;
      frame.style.width = frame.style.height = frame.style.transform = '';
    } else {
      scale = Math.min(1, stage.clientWidth / ARTBOARD);
      frame.style.width = `${ARTBOARD}px`;
      frame.style.height = `${stage.clientHeight / scale}px`;
      frame.style.transform = `scale(${scale})`;
      frame.style.transformOrigin = '0 0';
    }
    overlay?.setScale(scale);
  }
  new ResizeObserver(fit).observe(stage);

  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    loader.hidden = true;
    if (!doc?.body) return;
    const win = frame.contentWindow!;
    if (win.location.pathname.startsWith('/studio')) return; // bounced to the login
    fdoc = doc;
    overlay?.destroy();
    overlay = createOverlay(doc, onToolbar);
    overlay.setScale(scale);
    injectPageStyle(doc);
    bindFrame(doc);
    markPlaceholders();
    paint();
    placeInserters();
    if (restoreScroll != null) win.scrollTo(0, restoreScroll);
    restoreScroll = null;
    // Preview lets links navigate; keep the page label honest.
    const here = win.location.pathname.replace(/\/$/, '') || '/';
    if (here !== path) {
      path = here;
      pageLabel.textContent = labelFor(here);
    }
  });

  /** What the page itself needs to show for editing: cursors, placeholders, dimming. */
  function injectPageStyle(doc: Document) {
    doc.head.append(
      Object.assign(doc.createElement('style'), {
        textContent: `
          html[data-studio-edit] [data-edit] { cursor: pointer; }
          html[data-studio-edit] [data-studio-text] { cursor: text; }
          html[data-studio-edit] a[href] { cursor: default; }
          html[data-studio-edit] [data-studio-text]:hover { background: color-mix(in srgb, #7c3aed 6%, transparent); border-radius: 2px; }
          [data-studio-editing] {
            outline: none !important; cursor: text !important;
            user-select: text !important; -webkit-user-select: text !important;
            caret-color: #7c3aed; background: color-mix(in srgb, #7c3aed 8%, transparent) !important;
          }
          [data-studio-empty]::before {
            content: attr(data-placeholder); opacity: .4; font-style: italic; pointer-events: none;
          }
          [data-studio-empty] { min-width: 6em; }
          [data-studio-hidden] { opacity: .32 !important; filter: grayscale(1); }
        `,
      })
    );
    doc.documentElement.toggleAttribute('data-studio-edit', !preview);
    for (const el of doc.querySelectorAll<HTMLElement>('[data-edit]')) {
      const t = safeTarget(el.dataset.edit!);
      if (!t) el.dataset.studioUnknown = '';
      else if (t.kind === 'text') el.setAttribute('data-studio-text', '');
    }
    // Uploaded images live in Storage until the next publish; their resized
    // variants do not exist anywhere yet, so the srcset would point at nothing.
    for (const img of doc.querySelectorAll<HTMLImageElement>('img')) {
      if (img.src.includes('/storage/v1/object/public/')) img.removeAttribute('srcset');
    }
  }

  const keyed = (el: EventTarget | null) => ((el as Element | null)?.closest?.('[data-edit]:not([data-studio-unknown])') as HTMLElement | null) ?? null;
  const frameEls = (key?: string) => [...(fdoc?.querySelectorAll<HTMLElement>(key ? `[data-edit="${CSS.escape(key)}"]` : '[data-edit]') ?? [])];
  const safeTarget = (key: string): Target | null => {
    try {
      return target(key);
    } catch {
      return null;
    }
  };

  function chipLabel(key: string) {
    const t = safeTarget(key);
    if (!t) return '';
    if (t.kind === 'project') return `Project · ${t.read(draft)?.title ?? ''}`;
    if (t.kind === 'section') return `Section · ${t.label}`;
    return t.kind === 'text' ? `${t.label} — click to write` : t.label;
  }

  function bindFrame(doc: Document) {
    doc.addEventListener(
      'mousemove',
      (e) => {
        if (preview || overlay?.owns(e.target)) return;
        const el = keyed(e.target);
        overlay?.setHover(el && el !== selected?.el ? el : null, el ? chipLabel(el.dataset.edit!) : '');
      },
      true
    );
    doc.documentElement.addEventListener('mouseleave', () => overlay?.setHover(null));

    // Capture: the page's own handlers — links, the lightbox, the portrait —
    // must never see a press the Studio means as a selection.
    doc.addEventListener(
      'mousedown',
      (e) => {
        if (preview || overlay?.owns(e.target)) return;
        // Nothing on the page gets the press, whatever happens next.
        e.stopPropagation();
        if (e.button !== 0) return;
        const el = keyed(e.target);
        if (editing && el === editing) return; // moving the caret: let the browser do it
        if (editing) stopEditing(true);
        if (!el) return select(null);
        const t = safeTarget(el.dataset.edit!);
        if (!t) return;
        e.preventDefault();
        if (t.kind === 'text') startEditing(el, e.clientX, e.clientY);
        else select(el.dataset.edit!, el);
      },
      true
    );
    doc.addEventListener('keydown', onKey, true);

    /*
     * The shield. In editing mode the page is a document, not an app: no
     * button, link, form or shortcut of the site's may act. Registered in the
     * capture phase on the frame's document, so it runs before every handler
     * the site has — on elements, on the document, and on window, which the
     * event would only reach later by bubbling. (The site binds its listeners
     * to document and window by rule, so nothing sits above this.)
     *
     * Clicking into a button's label to edit it is the case this exists for:
     * the click that places the caret must not also press the button, and
     * Space or Enter typed into it must not activate it.
     *
     * Stopping propagation leaves the browser's own default in place where
     * editing needs it — placing the caret, selecting text, typing — and the
     * defaults that would *act* (following a link, submitting, dragging) are
     * cancelled outright. Preview turns the shield off: there the site is
     * meant to behave like the site.
     */
    const ACTS = new Set(['click', 'auxclick', 'submit', 'dragstart']);
    const SHIELD = [
      'click', 'auxclick', 'dblclick', 'contextmenu', 'mouseup',
      'pointerdown', 'pointerup', 'pointercancel',
      'touchstart', 'touchend',
      'keydown', 'keyup', 'keypress',
      'submit', 'reset', 'selectstart', 'dragstart',
    ];
    for (const type of SHIELD) {
      doc.addEventListener(type, (e) => {
        if (preview || overlay?.owns(e.target)) return;
        e.stopImmediatePropagation();
        if (ACTS.has(type)) e.preventDefault();
      }, true);
    }
    bindDrops(doc);
    doc.defaultView!.addEventListener('scroll', () => overlay?.position(), { passive: true });
  }

  const mediaUrl = (m: Row) =>
    m.path.startsWith('legacy/')
      ? `/media/${m.path.slice('legacy/'.length)}`
      : `${cfg.supabaseUrl}/storage/v1/object/public/portfolio-media/${m.path}`;

  /*
   * What an empty field invites. A prompt for what to write, in the voice of
   * the page — not the field's name, which is how the database thinks of it.
   */
  const PROMPTS: Array<[RegExp, string]> = [
    [/\.brief\.lead$/, 'What was asked for, in one sentence'],
    [/\.problem\.lead$/, 'What was actually wrong'],
    [/\.approach\.lead$/, 'How you went at it'],
    [/\.reflection\.lead$/, 'What you would keep, and what you would change'],
    [/\.(brief|approach|reflection)\.body$/, 'The detail, if it needs it'],
    [/\.gallery\.heading$/, 'A line above the screens'],
    [/\.caption$/, 'A caption'],
    [/\.quote$/, 'The words, exactly as they were said'],
    [/\.cite$/, 'Who said it'],
    [/\.heading$/, 'A heading'],
    [/\.(body|left|right)$/, 'A few sentences'],
    [/\.eyebrow$/, 'Label'],
    [/\.title$/, 'Title'],
    [/\.value$/, '0'],
    [/\.label$/, 'What it measures'],
    [/\.summary$/, 'One line on what it is'],
    [/\.discipline$/, 'Discipline'],
    [/\.role$/, 'Your role'],
  ];
  const promptFor = (key: string) => PROMPTS.find(([re]) => re.test(key))?.[1] ?? 'Write here';

  function setEmpty(el: HTMLElement, empty: boolean) {
    el.toggleAttribute('data-studio-empty', empty);
    if (!empty) return;
    el.setAttribute('data-placeholder', `${promptFor(el.dataset.edit!)}…`);
    // An empty inline element has no width to click; give it some, without
    // turning a paragraph into an inline box that sits beside the next one.
    if (el.ownerDocument.defaultView!.getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
  }

  /** Empty fields came from the server as a marker; show them as placeholders. */
  function markPlaceholders() {
    for (const el of frameEls()) {
      if (el.textContent !== EMPTY) continue;
      el.textContent = '';
      setEmpty(el, true);
    }
  }

  /** The draft's text and images onto the page — for edits that need no re-render. */
  function paint() {
    if (!fdoc) return;
    for (const el of frameEls()) {
      const t = safeTarget(el.dataset.edit!);
      if (!t || el === editing) continue;
      if (t.kind === 'text') {
        const v = String(t.read(draft) ?? '');
        const shown = el.hasAttribute('data-studio-empty') ? '' : el.textContent;
        if (shown !== v) el.textContent = v;
        setEmpty(el, v === '');
      } else if (t.kind === 'image') {
        const m = t.media!(draft);
        const img = el as HTMLImageElement;
        if (m && img.tagName === 'IMG') {
          const url = mediaUrl(m);
          if (!img.src.endsWith(url)) {
            img.removeAttribute('srcset');
            img.src = url;
          }
          img.alt = m.alt ?? '';
        }
      } else if (t.kind === 'project') {
        const p = t.read(draft);
        el.toggleAttribute('data-studio-hidden', !!p && !p.visible);
      }
    }
    if (selected && !selected.el.isConnected) select(null);
    overlay?.position();
    if (selected) refreshToolbar();
  }

  /* ================================================================ */
  /* Inserters — where new things go                                    */
  /* ================================================================ */

  function placeInserters() {
    if (!fdoc || !overlay || preview) return overlay?.setInserters([]);
    const list: Inserter[] = [];
    const slug = path.startsWith('/work/') ? path.slice(6) : null;

    if (path === '/work' || path === '/') {
      const items = frameEls().filter((e) => /^project\.[^.]+$/.test(e.dataset.edit!));
      const last = items[items.length - 1];
      if (last) list.push({ anchor: last.parentElement?.tagName === 'LI' ? last.parentElement : last, label: 'New project', action: 'new-project' });
    }

    if (slug && projectBySlug(draft, slug)) {
      for (const s of frameEls().filter((e) => /^(section|xsection)\./.test(e.dataset.edit!))) {
        // A section keyed inside another ("Results" inside "What shipped")
        // would stack two buttons on one edge.
        if (s.parentElement?.closest('[data-edit^="section."], [data-edit^="xsection."]')) continue;
        const b = safeTarget(s.dataset.edit!)?.block?.(draft);
        if (b) list.push({ anchor: s, label: 'Add section', action: 'add-section', data: b.id });
      }
      const gallery = fdoc.querySelector('[data-edit^="image.block."]')?.closest('.gallery');
      if (gallery) list.push({ anchor: gallery, label: 'Add image', action: 'gallery-add', data: slug });
    }
    overlay.setInserters(list);
  }

  /* ================================================================ */
  /* Selection & toolbars                                               */
  /* ================================================================ */

  function select(key: string | null, el?: HTMLElement) {
    if (!key) {
      selected = null;
      overlay?.setSelection(null, null);
      return;
    }
    const target = el ?? frameEls(key)[0];
    if (!target) {
      selected = null;
      return;
    }
    selected = { key, el: target };
    overlay?.setHover(null);
    refreshToolbar();
  }

  function refreshToolbar() {
    if (!selected || !overlay) return;
    const t = safeTarget(selected.key);
    if (!t) return;
    const buttons: Button[] = [];
    const sep: Button = { id: '|', label: '' };
    const parent = selected.el.parentElement?.closest('[data-edit]') as HTMLElement | null;
    const parentT = parent ? safeTarget(parent.dataset.edit!) : null;

    if (t.kind === 'text') {
      if (t.entry) {
        const n = t.entry.count(draft);
        const noun = t.entry.noun.toLowerCase();
        buttons.push(
          { id: 'entry-up', label: `Move ${noun} earlier`, icon: 'left', disabled: t.entry.index === 0 },
          { id: 'entry-down', label: `Move ${noun} later`, icon: 'right', disabled: t.entry.index >= n - 1 },
          { id: 'entry-dup', label: `Duplicate ${noun}`, icon: 'copy' },
          { id: 'entry-add', label: `Add a ${noun} after this one`, icon: 'plus', text: t.entry.noun },
          sep,
          { id: 'entry-del', label: `Delete ${noun}`, icon: 'trash', danger: true }
        );
      }
      if (parentT && parentT.kind !== 'text') {
        if (buttons.length) buttons.push(sep);
        buttons.push({ id: 'parent', label: `Select the whole ${parentT.kind === 'project' ? 'card' : 'section'}`, icon: 'parent', text: parentT.kind === 'project' ? 'Card' : 'Section' });
      }
      overlay.setSelection(selected.el, buttons.length ? { label: t.label, buttons } : null);
      return;
    }

    if (t.kind === 'image') {
      buttons.push(
        { id: 'img-replace', label: 'Replace image', icon: 'image', text: 'Replace' },
        { id: 'img-details', label: 'Alt text and details', icon: 'sliders', text: 'Alt text' }
      );
      if (/^image\.block\.[^.]+\.gallery\.\d+$/.test(selected.key)) buttons.push(sep, { id: 'img-remove', label: 'Remove from the gallery', icon: 'trash', danger: true });
      if (parentT?.kind === 'project') buttons.push(sep, { id: 'parent', label: 'Select the whole card', icon: 'parent', text: 'Card' });
      overlay.setSelection(selected.el, { label: t.label, buttons });
      return;
    }

    if (t.kind === 'project') {
      const p = t.read(draft) as Row;
      const cases = draft.projects.filter((x) => x.kind === 'case').sort((a, b) => a.sort_order - b.sort_order);
      const i = cases.indexOf(p);
      buttons.push(
        { id: 'proj-open', label: 'Open the project page', icon: 'open', text: 'Open' },
        { id: 'proj-details', label: 'Project details', icon: 'sliders', text: 'Details' },
        sep,
        { id: 'proj-up', label: 'Move earlier', icon: 'left', disabled: i <= 0 },
        { id: 'proj-down', label: 'Move later', icon: 'right', disabled: i >= cases.length - 1 },
        { id: 'proj-lead', label: p.featured ? 'The lead project on the home page' : 'Make this the lead project on the home page', icon: 'star', text: p.featured ? 'Lead' : undefined, primary: p.featured },
        { id: 'proj-visible', label: p.visible ? 'Hide from the site' : 'Show on the site', icon: p.visible ? 'eye' : 'eyeOff' },
        sep,
        { id: 'proj-delete', label: 'Delete project', icon: 'trash', danger: true }
      );
      overlay.setSelection(selected.el, { label: p.title, buttons });
      return;
    }

    if (t.kind === 'section') {
      const b = t.block!(draft);
      if (!b) return;
      const name = SECTION_NAMES[b.type] ?? t.label;
      if (b.type in EXTRA_BLANK) {
        buttons.push(
          { id: 'sec-up', label: 'Move section up', icon: 'up' },
          { id: 'sec-down', label: 'Move section down', icon: 'down' },
          sep,
          { id: 'sec-delete', label: 'Delete section', icon: 'trash', danger: true }
        );
      } else {
        buttons.push({ id: 'sec-hide', label: 'Hide this section', icon: 'eyeOff', text: 'Hide section' });
      }
      overlay.setSelection(selected.el, { label: `Section · ${name}`, buttons }, true);
    }
  }

  function onToolbar(action: string, data?: string) {
    if (action === 'new-project') return openNewProject();
    if (action === 'add-section') return addSectionMenu(data!);
    if (action === 'gallery-add') return galleryAdd(data!);
    if (!selected) return;
    const t = safeTarget(selected.key)!;

    switch (action) {
      case 'parent': {
        const parent = selected.el.parentElement?.closest('[data-edit]') as HTMLElement | null;
        if (parent) select(parent.dataset.edit!, parent);
        return;
      }
      case 'entry-up':
      case 'entry-down':
        return structural(() => t.entry!.move(draft, t.entry!.index + (action === 'entry-up' ? -1 : 1)));
      case 'entry-dup':
        return structural(() => t.entry!.duplicate(draft));
      case 'entry-add':
        return structural(() => t.entry!.add(draft));
      case 'entry-del': {
        const noun = t.entry!.noun;
        structural(() => t.entry!.remove(draft));
        return toast(`${noun} deleted.`, { label: 'Undo', run: undo });
      }
      case 'img-replace': {
        // An empty slot (a new project's cover) is not an <img> yet; only the
        // template knows how the picture should sit, so render it again.
        const isImg = selected.el.tagName === 'IMG' && !selected.el.getAttribute('src')?.startsWith('data:');
        return pickImage((m) => {
          commit(() => t.write(draft, m.id), !isImg);
          toast(isImg ? 'Image replaced.' : 'Image added.');
        });
      }
      case 'img-details':
        return inspectImage(selected.key);
      case 'img-remove':
        structural(() => t.write(draft, null));
        return toast('Image removed from the gallery.', { label: 'Undo', run: undo });
      case 'proj-open':
        return openPage(`/work/${t.read(draft).slug}`);
      case 'proj-details':
        return inspectProject(t.read(draft).slug);
      case 'proj-up':
      case 'proj-down':
        return structural(() => void moveProject(draft, t.read(draft).id, action === 'proj-up' ? -1 : 1));
      case 'proj-lead': {
        const p = t.read(draft);
        const on = !p.featured;
        structural(() => {
          for (const x of draft.projects) x.featured = false;
          p.featured = on;
        });
        return toast(on ? `${p.title} now leads Selected Work on the home page.` : 'No lead project — the first one leads.');
      }
      case 'proj-visible': {
        const p = t.read(draft);
        commit(() => void (p.visible = !p.visible));
        return toast(p.visible ? `${p.title} is shown on the site.` : `${p.title} is hidden. It stays here, dimmed, so you can bring it back.`, { label: 'Undo', run: undo });
      }
      case 'proj-delete':
        return confirmDeleteProject(t.read(draft));
      case 'sec-up':
      case 'sec-down':
        return structural(() => void moveSection(draft, t.block!(draft)!.id, action === 'sec-up' ? -1 : 1));
      case 'sec-hide': {
        const b = t.block!(draft)!;
        structural(() => void (b.visible = false));
        return toast(`“${SECTION_NAMES[b.type]}” is hidden. Add section brings it back.`, { label: 'Undo', run: undo });
      }
      case 'sec-delete': {
        const b = t.block!(draft)!;
        structural(() => void (draft.blocks = draft.blocks.filter((x) => x.id !== b.id)));
        return toast('Section deleted.', { label: 'Undo', run: undo });
      }
    }
  }

  /* ================================================================ */
  /* Text, in place                                                     */
  /* ================================================================ */

  function caretAt(doc: Document, x: number, y: number): Range {
    const range = doc.createRange();
    const d = doc as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    if (d.caretPositionFromPoint) {
      const p = d.caretPositionFromPoint(x, y);
      if (p) range.setStart(p.offsetNode, p.offset);
    } else if (d.caretRangeFromPoint) {
      const r = d.caretRangeFromPoint(x, y);
      if (r) range.setStart(r.startContainer, r.startOffset);
    }
    return range;
  }

  function startEditing(el: HTMLElement, x?: number, y?: number) {
    if (editing) stopEditing(true);
    select(el.dataset.edit!, el);
    editing = el;
    const empty = el.hasAttribute('data-studio-empty');
    editStart = empty ? '' : el.textContent ?? '';
    el.setAttribute('data-studio-editing', '');
    try {
      el.contentEditable = 'plaintext-only';
    } catch {
      el.contentEditable = 'true';
    }
    el.addEventListener('paste', onPaste);
    el.addEventListener('input', onInput);
    el.focus({ preventScroll: true });
    const sel = el.ownerDocument.getSelection()!;
    sel.removeAllRanges();
    let range = x != null && !empty ? caretAt(el.ownerDocument, x, y!) : null;
    if (!range || !el.contains(range.startContainer)) {
      range = el.ownerDocument.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel.addRange(range);
  }

  function onPaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*\n\s*/g, ' ');
    editing?.ownerDocument.execCommand('insertText', false, text);
  }

  function onInput() {
    if (!editing) return;
    const v = editing.textContent ?? '';
    setEmpty(editing, v === '');
    target(editing.dataset.edit!).write(draft, v);
    for (const twin of frameEls(editing.dataset.edit)) if (twin !== editing) twin.textContent = v;
    overlay?.position();
    changed();
  }

  function stopEditing(keep: boolean) {
    const el = editing;
    if (!el) return;
    editing = null;
    el.removeEventListener('paste', onPaste);
    el.removeEventListener('input', onInput);
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-studio-editing');
    const key = el.dataset.edit!;
    const typed = el.textContent ?? '';
    const now = typed.trim() === '' ? '' : typed;
    if (!keep || now === editStart) {
      target(key).write(draft, editStart);
    } else {
      // The whole edit is one undo step: record the state before it began.
      target(key).write(draft, editStart);
      pushHistory();
      target(key).write(draft, now);
    }
    changed();
    el.ownerDocument.getSelection()?.removeAllRanges();
    paint();
    if (inspecting) inspecting();
  }

  /* ================================================================ */
  /* History                                                            */
  /* ================================================================ */

  function pushHistory() {
    past.push(JSON.stringify(draft));
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
    syncHistory();
  }

  /** One meaningful edit: snapshot, change, then repaint or re-render, and save. */
  function commit(fn: () => void, rerenderAfter = false) {
    if (editing) stopEditing(true);
    pushHistory();
    fn();
    changed();
    if (rerenderAfter) void rerender();
    else paint();
    if (inspecting) inspecting();
  }
  const structural = (fn: () => void) => commit(fn, true);

  function undo() {
    if (editing) return stopEditing(false);
    const prev = past.pop();
    if (!prev) return;
    const before = draft;
    future.push(JSON.stringify(draft));
    draft = JSON.parse(prev);
    afterHistory(before);
  }
  function redo() {
    const next = future.pop();
    if (!next) return;
    const before = draft;
    past.push(JSON.stringify(draft));
    draft = JSON.parse(next);
    afterHistory(before);
  }

  /** A text-only step repaints in place; anything that moved, appeared or vanished re-renders. */
  function afterHistory(before: Draft) {
    syncHistory();
    changed();
    const d = diff(before, draft);
    const layoutCols = ['sort_order', 'visible', 'featured', 'slug', 'cover_media_id'];
    const structuralStep =
      d.inserts.length > 0 ||
      d.deletes.length > 0 ||
      d.changes.some((c) => c.table === 'lists' || c.table === 'project_tags' || layoutCols.some((k) => k in c.patch) || c.patch.content?.items !== undefined || c.patch.content?.images !== undefined);
    if (structuralStep) void rerender();
    else paint();
    if (inspecting) inspecting();
  }

  function syncHistory() {
    undoBtn.disabled = past.length === 0;
    redoBtn.disabled = future.length === 0;
  }
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  /* ================================================================ */
  /* Autosave                                                           */
  /* ================================================================ */

  function changed() {
    if (!draft) return;
    const pending = !isEmptyDiff(diff(saved, draft));
    try {
      if (pending) localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), draft }));
      else localStorage.removeItem(BACKUP_KEY);
    } catch {
      /* storage unavailable; the in-memory draft is still here */
    }
    if (!pending) {
      if (status !== 'saving') setStatus('saved');
      return;
    }
    if (status !== 'saving') setStatus('unsaved');
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveNow(), SAVE_DELAY_MS);
  }

  /** Save whatever is pending and wait for it. True when nothing is left unsaved. */
  async function saveNow(): Promise<boolean> {
    clearTimeout(saveTimer);
    while (saving) await saving;
    const batch = diff(saved, draft);
    if (isEmptyDiff(batch)) {
      setStatus('saved');
      return true;
    }
    const sending = clone(draft);
    setStatus('saving');
    saving = (async () => {
      try {
        const res = await fetch('/studio/api/save', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(batch),
        });
        if (res.status === 401) {
          setStatus('error', 'signed out — your edits are kept on this device');
          return false;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus('error', body.error ?? `HTTP ${res.status}`);
          return false;
        }
        saved = sending;
        const left = !isEmptyDiff(diff(saved, draft));
        setStatus(left ? 'unsaved' : 'saved');
        if (left) saveTimer = window.setTimeout(() => void saveNow(), SAVE_DELAY_MS);
        else {
          try {
            localStorage.removeItem(BACKUP_KEY);
          } catch {}
        }
        return !left;
      } catch {
        setStatus('offline');
        saveTimer = window.setTimeout(() => void saveNow(), 8000);
        return false;
      }
    })();
    const ok = await saving;
    saving = null;
    return ok;
  }

  window.addEventListener('beforeunload', (e) => {
    if (draft && !isEmptyDiff(diff(saved, draft))) e.preventDefault();
  });
  window.addEventListener('online', () => {
    if (status === 'offline') void saveNow();
  });

  /* ================================================================ */
  /* The inspector — what cannot be clicked                             */
  /* ================================================================ */

  function openInspector(title: string, render: () => void) {
    inspectorTitle.textContent = title;
    inspecting = () => {
      // Never redraw under a field that is being typed in.
      const focused = document.activeElement as HTMLElement | null;
      if (focused && inspectorBody.contains(focused) && focused.matches('input, textarea, select')) return;
      const top = inspectorBody.scrollTop;
      inspectorBody.innerHTML = '';
      render();
      inspectorBody.scrollTop = top;
    };
    inspecting();
    inspector.hidden = false;
    root.setAttribute('data-inspecting', '');
  }
  function closeInspector() {
    inspecting = null;
    inspector.hidden = true;
    root.removeAttribute('data-inspecting');
  }
  $('[data-inspector-close]', root).addEventListener('click', closeInspector);

  interface FieldOpts {
    multiline?: boolean;
    hint?: string;
    prefix?: string;
    validate?: (v: string) => string | null;
    /** Re-render the page when the field is left (a slug, a title in a list). */
    rerender?: boolean;
  }

  function field(label: string, value: string, set: (v: string) => void, opts: FieldOpts = {}) {
    const input = (opts.multiline ? h('textarea', { rows: 3 }) : h('input', { type: 'text' })) as HTMLInputElement | HTMLTextAreaElement;
    input.className = 'field__input';
    input.value = value ?? '';
    const err = h('span', { class: 'field__error', role: 'alert' });
    let entered = false;
    input.addEventListener('focus', () => (entered = false));
    input.addEventListener('input', () => {
      const problem = opts.validate?.(input.value) ?? null;
      err.textContent = problem ?? '';
      input.toggleAttribute('aria-invalid', !!problem);
      if (problem) return;
      if (!entered) {
        pushHistory();
        entered = true;
      }
      set(input.value);
      changed();
      paint();
    });
    input.addEventListener('change', () => {
      if (opts.rerender && entered) void rerender();
    });
    if (opts.multiline) {
      const grow = () => {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight + 2}px`;
      };
      input.addEventListener('input', grow);
      requestAnimationFrame(grow);
    }
    return h('label', { class: 'field' },
      h('span', { class: 'field__label' }, label),
      opts.prefix ? h('span', { class: 'field__prefixed' }, h('span', { class: 'field__prefix' }, opts.prefix), input) : input,
      opts.hint ? h('span', { class: 'field__hint' }, opts.hint) : null,
      err
    );
  }

  function toggle(label: string, on: boolean, set: (v: boolean) => void, hint?: string, rerenderAfter = true) {
    const input = h('input', { type: 'checkbox', role: 'switch', checked: on });
    input.addEventListener('change', () => commit(() => set(input.checked), rerenderAfter));
    return h('label', { class: 'switch' },
      input,
      h('span', { class: 'switch__track', 'aria-hidden': 'true' }),
      h('span', { class: 'switch__text' }, h('span', { class: 'switch__label' }, label), hint ? h('span', { class: 'field__hint' }, hint) : null));
  }

  const group = (title: string, ...kids: (Node | null | false | undefined)[]) =>
    h('section', { class: 'group' }, h('h3', { class: 'group__title' }, title), ...kids);

  function tagsField(p: Row) {
    const wrap = h('div', { class: 'tags' });
    const tags = draft.tags.filter((t) => t.project_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
    for (const t of tags) {
      wrap.append(h('span', { class: 'tag' }, t.label,
        h('button', { type: 'button', class: 'tag__x', 'aria-label': `Remove ${t.label}`, onclick: () =>
          structural(() => {
            draft.tags = draft.tags.filter((x) => x !== t);
            draft.tags.filter((x) => x.project_id === p.id).sort((a, b) => a.sort_order - b.sort_order).forEach((x, i) => (x.sort_order = i));
          }) }, '×')));
    }
    const known = [...new Set(draft.tags.map((t) => t.label))].filter((l) => !tags.some((t) => t.label === l));
    const input = h('input', { class: 'tag__input', type: 'text', placeholder: tags.length ? 'Add…' : 'Add a category…', list: 'studio-tag-options', 'aria-label': 'Add a category' });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !input.value.trim()) return;
      e.preventDefault();
      const label = input.value.trim();
      input.value = '';
      input.blur();
      structural(() => void draft.tags.push({ id: crypto.randomUUID(), project_id: p.id, label, sort_order: tags.length }));
    });
    wrap.append(input, h('datalist', { id: 'studio-tag-options' }, ...known.map((k) => h('option', { value: k }))));
    return h('div', { class: 'field' },
      h('span', { class: 'field__label' }, 'Categories'),
      wrap,
      h('span', { class: 'field__hint' }, 'They drive the filters on the Work page. Enter to add.'));
  }

  function mediaThumb(m: Row | null, onReplace: (m: Row) => void) {
    return h('div', { class: 'thumb' },
      m ? h('img', { src: mediaUrl(m), alt: '' }) : h('div', { class: 'thumb__empty' }, 'No image yet'),
      h('button', { type: 'button', class: 'btn btn--small', onclick: () => pickImage(onReplace) }, m ? 'Replace' : 'Choose an image'));
  }

  function inspectProject(slug: string) {
    const id = projectBySlug(draft, slug)?.id;
    openInspector('Project details', () => {
      const p = draft.projects.find((x) => x.id === id);
      if (!p) return closeInspector();
      const cover = draft.media.find((m) => m.id === p.cover_media_id) ?? null;
      const hidden = draft.blocks.filter((b) => b.project_id === p.id && !b.visible && SECTION_NAMES[b.type]);
      inspectorBody.append(
        group('Project',
          field('Title', p.title, (v) => (p.title = v), { validate: (v) => (v.trim() ? null : 'A project needs a title.') }),
          field('Address', p.slug, (v) => (p.slug = v), {
            prefix: '/work/',
            hint: 'Changing it breaks links people already have.',
            validate: (v) =>
              !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)
                ? 'Lowercase letters, numbers and single dashes.'
                : draft.projects.some((x) => x !== p && x.slug === v)
                  ? 'Another project already uses this address.'
                  : null,
            rerender: true,
          }),
          field('Summary', p.summary, (v) => (p.summary = v), { multiline: true }),
          field('Discipline', p.discipline, (v) => (p.discipline = v)),
          field('Role', p.role, (v) => (p.role = v)),
          tagsField(p)),
        group('Cover', mediaThumb(cover, (m) => structural(() => void (p.cover_media_id = m.id))),
          h('span', { class: 'field__hint' }, 'The picture on its card on the Work page.')),
        group('On the site',
          toggle('Visible', p.visible, (v) => (p.visible = v), 'Hidden projects stay in the Studio, dimmed.', false),
          toggle('Lead project', p.featured, (v) => {
            for (const x of draft.projects) x.featured = false;
            p.featured = v;
          }, 'The large one at the top of Selected Work on the home page.')),
        hidden.length
          ? group('Hidden sections', ...hidden.map((b) =>
              h('div', { class: 'row' }, h('span', {}, SECTION_NAMES[b.type]),
                h('button', { type: 'button', class: 'btn btn--small', onclick: () => structural(() => void (b.visible = true)) }, 'Show'))))
          : '',
        group('Search & sharing',
          field('Title', p.seo?.metaTitle ?? '', (v) => (p.seo = { ...p.seo, metaTitle: v })),
          field('Description', p.seo?.metaDescription ?? '', (v) => (p.seo = { ...p.seo, metaDescription: v }), { multiline: true, hint: 'What search results and link previews show. Around 150 characters.' })),
        h('div', { class: 'danger-zone' },
          h('button', { type: 'button', class: 'btn btn--danger', onclick: () => confirmDeleteProject(p) }, 'Delete project…'))
      );
    });
  }

  function inspectImage(key: string) {
    openInspector('Image', () => {
      const t = target(key);
      const m = t.media!(draft);
      inspectorBody.append(
        group(t.label,
          mediaThumb(m, (nm) => commit(() => t.write(draft, nm.id))),
          m ? h('span', { class: 'field__hint' }, [m.width && m.height ? `${m.width} × ${m.height}` : '', m.bytes ? `${Math.round(m.bytes / 1024)} KB` : ''].filter(Boolean).join(' · ')) : null,
          m ? field('Alt text', m.alt ?? '', (v) => (m.alt = v), { multiline: true, hint: 'What the picture shows, for people who cannot see it.' }) : null)
      );
    });
  }

  function inspectPage() {
    const slug = path.startsWith('/work/') ? path.slice(6) : null;
    if (slug) return inspectProject(slug);
    const key = path === '/' ? 'home' : path.replace(/^\//, '');
    openInspector(`${labelFor(path)} page`, () => {
      const page = draft.pages.find((p) => p.key === key);
      if (!page) return void inspectorBody.append(h('p', { class: 'field__hint' }, 'This page has no copy of its own to edit.'));
      const fields = Object.entries(page.fields).filter(([, v]) => typeof v === 'string');
      inspectorBody.append(
        group('Every text on this page',
          h('p', { class: 'field__hint' }, 'Including the ones that are hard to click — form labels, messages, the parts of a headline.'),
          ...fields.map(([f, v]) => field(humanize(f), v as string, (nv) => (page.fields[f] = nv), { multiline: (v as string).length > 60 }))),
        group('Search & sharing',
          field('Title', page.seo?.metaTitle ?? '', (v) => (page.seo = { ...page.seo, metaTitle: v })),
          field('Description', page.seo?.metaDescription ?? '', (v) => (page.seo = { ...page.seo, metaDescription: v }), { multiline: true }))
      );
    });
  }

  function inspectSettings() {
    openInspector('Site settings', () => {
      const f = draft.settings.fields;
      const text = (k: string, label: string, hint?: string) => field(label, f[k] ?? '', (v) => (f[k] = v), { hint });
      const mode = h('select', { class: 'field__input' }, ...['Both', 'WhatsApp', 'Email'].map((o) => h('option', { value: o, selected: f.contactMode === o }, o)));
      mode.addEventListener('change', () => commit(() => void (f.contactMode = mode.value), true));
      inspectorBody.append(
        group('Identity', text('siteName', 'Name'), text('roleTitle', 'Role'), text('location', 'Location')),
        group('Contact',
          text('email', 'Email'),
          text('whatsappNumber', 'WhatsApp number', 'Digits only, with the country code.'),
          text('phoneLabel', 'Phone, as shown'),
          h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'The enquiry form sends by'), mode)),
        group('Availability',
          toggle('Available for new projects', !!f.available, (v) => (f.available = v)),
          text('availableLabel', 'When available'),
          text('bookedLabel', 'When booked')),
        group('Site', toggle('Play the intro on a first visit', !!f.showIntro, (v) => (f.showIntro = v), undefined, false)),
        group('Default search & sharing',
          field('Title', draft.settings.seo?.metaTitle ?? '', (v) => (draft.settings.seo = { ...draft.settings.seo, metaTitle: v })),
          field('Description', draft.settings.seo?.metaDescription ?? '', (v) => (draft.settings.seo = { ...draft.settings.seo, metaDescription: v }), { multiline: true }))
      );
    });
  }

  $('[data-page-details]', root).addEventListener('click', inspectPage);

  /* ================================================================ */
  /* Creating and deleting                                              */
  /* ================================================================ */

  const newDialog = $<HTMLDialogElement>('[data-new-dialog]', root);
  const newForm = $<HTMLFormElement>('form', newDialog);
  const tplHost = $('[data-templates]', newDialog);
  TEMPLATES.forEach((t, i) =>
    tplHost.append(
      h('label', { class: 'tpl' },
        h('input', { type: 'radio', name: 'template', value: t.id, checked: i === 0 }),
        h('span', { class: `tpl__art tpl__art--${t.id}`, 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
        h('span', { class: 'tpl__name' }, t.name),
        h('span', { class: 'tpl__desc' }, t.description)))
  );

  function openNewProject() {
    stopEditing(true);
    newForm.reset();
    let coverId: string | null = null;
    let slugTouched = false;
    const title = $<HTMLInputElement>('[name="title"]', newForm);
    const slug = $<HTMLInputElement>('[name="slug"]', newForm);
    const err = $('[data-new-error]', newDialog);
    const drop = $<HTMLButtonElement>('[data-new-cover]', newDialog);
    err.textContent = '';
    drop.innerHTML = '<span class="drop__title">Cover image</span><span class="drop__hint">Choose one now, or add it later</span>';
    delete drop.dataset.state;
    const disc = $('#studio-disciplines', newDialog);
    disc.innerHTML = '';
    for (const d of new Set(draft.projects.map((p) => p.discipline).filter(Boolean))) disc.append(h('option', { value: d }));

    title.oninput = () => {
      if (!slugTouched) slug.value = slugify(title.value);
    };
    slug.oninput = () => (slugTouched = true);
    drop.onclick = () =>
      pickImage((m) => {
        coverId = m.id;
        drop.innerHTML = '';
        drop.append(h('img', { src: mediaUrl(m), alt: '' }));
        drop.dataset.state = 'done';
      });

    newForm.onsubmit = (e) => {
      e.preventDefault();
      const data = new FormData(newForm);
      const t = String(data.get('title') ?? '').trim();
      const s = String(data.get('slug') ?? '').trim();
      if (!t) return void ((err.textContent = 'Give it a title.'), title.focus());
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) return void ((err.textContent = 'The address can use lowercase letters, numbers and dashes.'), slug.focus());
      if (draft.projects.some((p) => p.slug === s)) return void ((err.textContent = 'Another project already uses that address.'), slug.focus());
      let created: Row | null = null;
      commit(() => {
        created = newProject(draft, {
          title: t,
          slug: s,
          summary: String(data.get('summary') ?? '').trim(),
          discipline: String(data.get('discipline') ?? '').trim(),
          template: String(data.get('template') ?? 'classic'),
          coverId,
          tags: [],
        });
        // Not on the live site until the owner says so.
        created.visible = false;
      });
      newDialog.close();
      void saveNow().then(() => {
        openPage(`/work/${created!.slug}`);
        toast(`${t} created — hidden from the site until you show it. Click anything to write it.`);
      });
    };
    newDialog.showModal();
    title.focus();
  }
  $('[data-new-close]', newDialog).addEventListener('click', () => newDialog.close());

  const confirmDialog = $<HTMLDialogElement>('[data-confirm-dialog]', root);
  function confirmAction(title: string, body: string, action: string, run: () => void) {
    $('[data-confirm-title]', confirmDialog).textContent = title;
    $('[data-confirm-body]', confirmDialog).textContent = body;
    const go = $<HTMLButtonElement>('[data-confirm-go]', confirmDialog);
    go.textContent = action;
    go.onclick = () => {
      confirmDialog.close();
      run();
    };
    confirmDialog.showModal();
    $<HTMLButtonElement>('[data-confirm-cancel]', confirmDialog).focus();
  }
  $('[data-confirm-cancel]', confirmDialog).addEventListener('click', () => confirmDialog.close());

  function confirmDeleteProject(p: Row) {
    confirmAction(
      `Delete “${p.title}”?`,
      'It leaves the draft now and the live site when you next publish. Until then Undo brings it back; after, Revisions does.',
      'Delete project',
      () => {
        const onItsPage = path === `/work/${p.slug}`;
        closeInspector();
        commit(() => deleteProject(draft, p.id), !onItsPage);
        if (onItsPage) void saveNow().then(() => openPage('/work'));
        toast(`“${p.title}” deleted.`, { label: 'Undo', run: undo });
      }
    );
  }

  const sectionDialog = $<HTMLDialogElement>('[data-section-dialog]', root);
  const SECTION_DESC: Record<string, string> = {
    text: 'A heading and a paragraph.',
    image: 'One large picture, with a caption.',
    quote: 'Something someone said, and who.',
    'two-column': 'Two short points, side by side.',
  };
  function addSectionMenu(afterBlockId: string) {
    const b = draft.blocks.find((x) => x.id === afterBlockId);
    if (!b) return;
    const host = $('[data-section-types]', sectionDialog);
    host.innerHTML = '';
    const pick = (fn: () => void) => () => {
      sectionDialog.close();
      structural(fn);
    };
    for (const type of Object.keys(EXTRA_BLANK)) {
      host.append(
        h('button', { type: 'button', class: 'secopt', onclick: pick(() => void addSection(draft, b.project_id, type, afterBlockId)) },
          h('span', { class: `secopt__art secopt__art--${type}`, 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
          h('span', { class: 'secopt__name' }, SECTION_NAMES[type]),
          h('span', { class: 'secopt__desc' }, SECTION_DESC[type])));
    }
    const hidden = draft.blocks.filter((x) => x.project_id === b.project_id && !x.visible && SECTION_NAMES[x.type]);
    if (hidden.length) {
      host.append(h('div', { class: 'secopt__group' }, 'Or bring back one of the case study’s own'));
      for (const x of hidden) host.append(h('button', { type: 'button', class: 'secopt secopt--row', onclick: pick(() => void (x.visible = true)) }, h('span', { class: 'secopt__name' }, SECTION_NAMES[x.type])));
    }
    sectionDialog.showModal();
  }
  $('[data-section-close]', sectionDialog).addEventListener('click', () => sectionDialog.close());

  function galleryAdd(slug: string) {
    pickImage((m) => {
      const b = blockOf(draft, slug, 'gallery');
      if (!b) return;
      structural(() => void (b.content = { ...b.content, images: [...(b.content.images ?? []), m.id] }));
      toast('Image added to the gallery.');
    });
  }

  /* ================================================================ */
  /* Images                                                             */
  /* ================================================================ */

  const filePicker = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/avif,image/gif', hidden: true });
  root.append(filePicker);
  let onPicked: ((m: Row) => void) | null = null;

  function pickImage(done: (m: Row) => void) {
    onPicked = done;
    filePicker.value = '';
    filePicker.click();
  }
  filePicker.addEventListener('change', () => {
    const file = filePicker.files?.[0];
    if (file && onPicked) void uploadAndUse(file, onPicked);
  });

  /** Dropping a picture onto an image on the canvas replaces it. */
  function bindDrops(doc: Document) {
    doc.addEventListener('dragover', (e) => {
      if (preview || !e.dataTransfer?.types.includes('Files')) return;
      const el = keyed(e.target);
      if (el && safeTarget(el.dataset.edit!)?.kind === 'image') {
        e.preventDefault();
        overlay?.setHover(el, 'Drop to replace');
      }
    }, true);
    doc.addEventListener('drop', (e) => {
      const el = keyed(e.target);
      const file = e.dataTransfer?.files?.[0];
      if (!el || !file) return;
      const t = safeTarget(el.dataset.edit!);
      if (t?.kind !== 'image') return;
      e.preventDefault();
      void uploadAndUse(file, (m) => commit(() => t.write(draft, m.id)));
    }, true);
  }

  async function uploadAndUse(file: File, done: (m: Row) => void) {
    toast('Uploading…');
    try {
      const m = await upload(file);
      if (!draft.media.some((x) => x.id === m.id)) {
        draft.media.push(m);
        saved.media.push(clone(m));
      }
      done(m);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed.');
    }
  }

  /** WebP in the browser, capped at 2400px wide, then up. */
  async function upload(file: File): Promise<Row> {
    if (!file.type.startsWith('image/')) throw new Error('That is not an image.');
    const bitmap = await createImageBitmap(file);
    const s = Math.min(1, 2400 / bitmap.width);
    const w = Math.round(bitmap.width * s);
    const ht = Math.round(bitmap.height * s);
    let blob: Blob = file;
    if (file.type !== 'image/gif') {
      const canvas = new OffscreenCanvas(w, ht);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, ht);
      blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.86 });
    }
    if (blob.size > 15 * 1024 * 1024) throw new Error('Still larger than 15 MB after compression.');
    const form = new FormData();
    const name = file.type === 'image/gif' ? file.name : `${file.name.replace(/\.[^.]+$/, '')}.webp`;
    form.append('file', new File([blob], name, { type: blob.type }));
    form.append('width', String(w));
    form.append('height', String(ht));
    const res = await fetch('/studio/api/upload', { method: 'POST', body: form, credentials: 'same-origin' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
    return body.media;
  }

  /* ================================================================ */
  /* Preview & device                                                   */
  /* ================================================================ */

  previewBtn.addEventListener('click', () => {
    preview = !preview;
    stopEditing(true);
    select(null);
    overlay?.setHover(null);
    root.toggleAttribute('data-previewing', preview);
    previewBtn.setAttribute('aria-pressed', String(preview));
    previewBtn.textContent = preview ? 'Back to editing' : 'Preview';
    fdoc?.documentElement.toggleAttribute('data-studio-edit', !preview);
    placeInserters();
    if (preview) closeInspector();
  });

  for (const b of deviceBtns) {
    b.addEventListener('click', () => {
      stage.dataset.device = b.dataset.device!;
      for (const o of deviceBtns) o.setAttribute('aria-pressed', String(o === b));
      fit();
    });
  }

  /* ================================================================ */
  /* Publish & revisions                                                */
  /* ================================================================ */

  function summary(): string[] {
    const snap = release?.snapshot;
    if (!snap) return ['First release'];
    const out: string[] = [];
    const cmp = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
    const keysDiff = (a: Row = {}, b: Row = {}) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => cmp(a[k], b[k]));
    const sec = (type: string) => (SECTION_NAMES[type] ?? type).toLowerCase();

    const s = keysDiff(snap.settings?.fields, draft.settings.fields);
    if (s.length) out.push(`Site settings: ${s.map((k) => humanize(k).toLowerCase()).join(', ')}`);
    for (const p of draft.pages) {
      const old = snap.pages?.find((x: Row) => x.key === p.key);
      const f = keysDiff(old?.fields, p.fields);
      if (f.length) out.push(`${humanize(p.key)} page: ${f.map((k) => humanize(k).toLowerCase()).join(', ')}`);
      if (cmp(old?.seo, p.seo)) out.push(`${humanize(p.key)} page: search & sharing`);
    }
    const isNew = (id: string) => !snap.projects?.some((x: Row) => x.id === id);
    const titleOf = (id: string) => draft.projects.find((x) => x.id === id)?.title ?? 'A project';
    let reordered = false;
    let images = 0;
    for (const p of draft.projects) {
      const old = snap.projects?.find((x: Row) => x.id === p.id);
      if (!old) {
        out.push(`${p.title}: new project${p.visible ? '' : ' (hidden)'}`);
        continue;
      }
      if (old.sort_order !== p.sort_order) reordered = true;
      if (old.cover_media_id !== p.cover_media_id) images += 1;
      if (old.visible !== p.visible) out.push(`${p.title}: ${p.visible ? 'shown' : 'hidden'}`);
      if (old.featured !== p.featured && p.featured) out.push(`${p.title}: now the lead project`);
      const cols = ['title', 'slug', 'summary', 'discipline', 'role', 'seo'].filter((c) => cmp(old[c], p[c]));
      if (cols.length) out.push(`${p.title}: ${cols.join(', ')}`);
    }
    for (const old of snap.projects ?? []) if (!draft.projects.some((p) => p.id === old.id)) out.push(`${old.title}: deleted`);
    for (const b of draft.blocks) {
      if (isNew(b.project_id)) continue;
      const old = snap.blocks?.find((x: Row) => x.id === b.id);
      if (!old) {
        out.push(`${titleOf(b.project_id)}: new section — ${sec(b.type)}`);
        continue;
      }
      if (old.visible !== b.visible) out.push(`${titleOf(b.project_id)}: ${sec(b.type)} ${b.visible ? 'shown' : 'hidden'}`);
      if (!cmp(old.content, b.content)) continue;
      if (cmp(old.content.image, b.content.image) || cmp(old.content.images, b.content.images)) images += 1;
      if (cmp({ ...old.content, image: 0, images: 0 }, { ...b.content, image: 0, images: 0 })) out.push(`${titleOf(b.project_id)}: ${sec(b.type)}`);
    }
    for (const old of snap.blocks ?? []) {
      if (!draft.blocks.some((b) => b.id === old.id) && draft.projects.some((p) => p.id === old.project_id)) out.push(`${titleOf(old.project_id)}: ${sec(old.type)} deleted`);
    }
    const lists = new Set<string>();
    for (const l of draft.lists) {
      const old = snap.lists?.find((x: Row) => x.id === l.id);
      if (!old || cmp(old.content, l.content) || old.sort_order !== l.sort_order) lists.add(l.list_key);
    }
    for (const old of snap.lists ?? []) if (!draft.lists.some((l) => l.id === old.id)) lists.add(old.list_key);
    for (const l of lists) out.push(`${humanize(l.split('.').pop()!)} updated`);
    const oldTags = JSON.stringify((snap.tags ?? []).map((t: Row) => [t.project_id, t.label]).sort());
    const newTags = JSON.stringify(draft.tags.filter((t) => !isNew(t.project_id)).map((t) => [t.project_id, t.label]).sort());
    if (oldTags !== newTags) out.push('Categories updated');
    if (images) out.push(`${images} image${images > 1 ? 's' : ''} replaced or added`);
    if (reordered) out.push('Work reordered');
    if (draft.media.some((m) => { const o = snap.media?.find((x: Row) => x.id === m.id); return o && o.alt !== m.alt; })) out.push('Alt text updated');
    return out;
  }

  const publishDialog = $<HTMLDialogElement>('[data-publish-dialog]', root);
  const publishGo = $<HTMLButtonElement>('[data-publish-go]', publishDialog);
  publishBtn.addEventListener('click', async () => {
    stopEditing(true);
    if (!(await saveNow())) return toast('Your changes have not saved yet — check the connection and try again.');
    const lines = summary();
    const list = $('[data-summary]', publishDialog);
    list.innerHTML = '';
    for (const line of lines.length ? lines : ['Nothing has changed since the last publish.']) list.append(h('li', {}, line));
    publishGo.disabled = lines.length === 0;
    publishGo.textContent = 'Publish';
    $('[data-publish-result]', publishDialog).textContent = '';
    publishDialog.showModal();
  });
  $('[data-publish-close]', publishDialog).addEventListener('click', () => publishDialog.close());
  publishGo.addEventListener('click', async () => {
    publishGo.disabled = true;
    publishGo.textContent = 'Publishing…';
    setStatus('publishing');
    const result = $('[data-publish-result]', publishDialog);
    try {
      const res = await fetch('/studio/api/publish', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ summary: summary() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setStatus('published');
      publishGo.textContent = 'Published';
      result.textContent =
        body.deploy === 'triggered'
          ? 'Done. mohamadhawa.com is rebuilding and will show this in about three minutes.'
          : 'Published. The site will show it on its next deploy — the deploy hook is not set.';
      release = { id: body.releaseId, createdAt: new Date().toISOString(), snapshot: clone(draft) };
    } catch (err) {
      setStatus('error', 'publish failed');
      publishGo.disabled = false;
      publishGo.textContent = 'Try again';
      result.textContent = `Not published: ${err instanceof Error ? err.message : err}`;
    }
  });

  const revisionsDialog = $<HTMLDialogElement>('[data-revisions-dialog]', root);
  $('[data-revisions]', root).addEventListener('click', async () => {
    const list = $('[data-releases]', revisionsDialog);
    list.innerHTML = '';
    list.append(h('li', { class: 'field__hint' }, 'Loading…'));
    revisionsDialog.showModal();
    const res = await fetch('/studio/api/releases', { credentials: 'same-origin' });
    const body = await res.json().catch(() => ({ releases: [] }));
    list.innerHTML = '';
    for (const r of body.releases ?? []) {
      list.append(
        h('li', { class: 'release' },
          h('div', { class: 'release__when' }, new Date(r.created_at).toLocaleString(), r.is_current ? h('span', { class: 'badge' }, 'Live') : null),
          h('div', { class: 'release__what' }, (r.summary ?? []).slice(0, 3).join(' · ') || '—'),
          r.is_current
            ? null
            : h('button', { type: 'button', class: 'btn btn--small', onclick: () =>
                confirmAction('Restore this version?', 'It becomes the live site again, and your draft is reset to it.', 'Restore', async () => {
                  revisionsDialog.close();
                  const res = await fetch('/studio/api/releases', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
                  if (!res.ok) return toast('Could not restore that version.');
                  past = [];
                  future = [];
                  syncHistory();
                  await load();
                  toast('Restored. The live site is rebuilding.');
                }) }, 'Restore'))
      );
    }
  });
  $('[data-revisions-close]', revisionsDialog).addEventListener('click', () => revisionsDialog.close());

  /* ================================================================ */
  /* Keyboard                                                           */
  /* ================================================================ */

  function onKey(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopEditing(false);
      } else if (e.key === 'Enter') {
        // Every text here is one line or one paragraph on the site, so Enter
        // finishes rather than inserting a break the page would not show.
        e.preventDefault();
        stopEditing(true);
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        stopEditing(false);
      }
      return;
    }
    const inField = (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]');
    if (mod && e.key.toLowerCase() === 'z' && !inField) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void saveNow().then((ok) => ok && toast('Saved.'));
      return;
    }
    if (inField || preview) return;
    if (e.key === 'Escape') {
      if (selected) select(null);
      else closeInspector();
      return;
    }
    if (!selected) return;
    const t = safeTarget(selected.key);
    if (!t) return;
    if (e.key === 'Enter' && t.kind === 'text') {
      e.preventDefault();
      startEditing(selected.el);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (t.kind === 'project') onToolbar('proj-delete');
      else if (t.kind === 'section') onToolbar(t.block?.(draft)?.type in EXTRA_BLANK ? 'sec-delete' : 'sec-hide');
      else if (t.entry) onToolbar('entry-del');
    }
  }
  document.addEventListener('keydown', onKey);

  syncHistory();
  fit();
  void load();
}
