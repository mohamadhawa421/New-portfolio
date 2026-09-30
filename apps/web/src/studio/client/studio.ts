/**
 * Portfolio Studio — the editor.
 *
 * The canvas is the real portfolio: the Studio build's own static pages, in a
 * same-origin frame, with `?club=1` so the site's frame mode is on (no
 * shockwave, no cursor, no sound, no lightbox, reveals already played — see
 * scripts/club.ts). Nothing about the page is re-implemented here.
 *
 * Those pages carry `data-edit` keys (lib/edit.ts) naming the draft field each
 * element shows. The Studio holds the whole draft in memory, paints it onto
 * the frame by key, and turns an edit on the page into a change to the draft.
 * So the frame is always "the published build, with the draft painted on" —
 * which is exact for text and images, the everyday edits, and needs no build.
 *
 * Three pieces of state, and only three:
 *   draft   what the owner is editing (the source of truth in this tab)
 *   saved   the draft as the server last confirmed it — autosave sends the
 *           row-level difference between the two, and nothing else
 *   history snapshots of the draft, one per meaningful edit, for undo
 *
 * Unsaved changes are also mirrored to localStorage, so a crash, a closed tab
 * or a dropped connection loses nothing; the next load offers them back.
 */

import { changes, humanize, projectBySlug, target, type Draft, type Row } from './keys';

type Status = 'loading' | 'saved' | 'unsaved' | 'saving' | 'offline' | 'error' | 'publishing' | 'published';

const SAVE_DELAY_MS = 1200;
const HISTORY_LIMIT = 100;
const BACKUP_KEY = 'mh-studio-unsaved';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;

export function startStudio(root: HTMLElement, cfg: { supabaseUrl: string }): void {
  const frame = $<HTMLIFrameElement>('[data-frame]', root);
  const stage = $('[data-stage]', root);
  const pageSelect = $<HTMLSelectElement>('[data-page]', root);
  const layersHost = $('[data-layers]', root);
  const propsHost = $('[data-props]', root);
  const statusEl = $('[data-status]', root);
  const undoBtn = $<HTMLButtonElement>('[data-undo]', root);
  const redoBtn = $<HTMLButtonElement>('[data-redo]', root);
  const previewBtn = $<HTMLButtonElement>('[data-preview]', root);
  const deviceBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-device]')];
  const publishBtn = $<HTMLButtonElement>('[data-publish]', root);
  const publishDialog = $<HTMLDialogElement>('[data-publish-dialog]', root);
  const revisionsBtn = $<HTMLButtonElement>('[data-revisions]', root);
  const revisionsDialog = $<HTMLDialogElement>('[data-revisions-dialog]', root);
  const banner = $('[data-banner]', root);

  let draft: Draft;
  let saved: Draft;
  let release: { id: number; createdAt: string; snapshot: any } | null = null;
  let past: string[] = [];
  let future: string[] = [];
  let saveTimer = 0;
  let saving = false;
  let status: Status = 'loading';
  let selected: string | null = null;
  let editing: HTMLElement | null = null;
  let editStart = '';
  let preview = false;
  let fdoc: Document | null = null;

  const clone = <T>(v: T): T => structuredClone(v);

  /* ---------------- status ---------------- */

  const STATUS_TEXT: Record<Status, string> = {
    loading: 'Loading…',
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    offline: 'Offline — kept on this device',
    error: 'Could not save',
    publishing: 'Publishing…',
    published: 'Published',
  };
  function setStatus(s: Status, detail = '') {
    status = s;
    statusEl.textContent = detail ? `${STATUS_TEXT[s]} · ${detail}` : STATUS_TEXT[s];
    statusEl.dataset.state = s;
    publishBtn.disabled = s === 'loading' || s === 'publishing' || s === 'saving';
  }

  /* ---------------- loading ---------------- */

  async function load() {
    setStatus('loading');
    const res = await fetch('/studio/api/draft', { credentials: 'same-origin' });
    if (res.status === 401) return void location.assign('/studio/login?next=/studio');
    if (!res.ok) {
      setStatus('error', 'the draft did not load');
      return;
    }
    const body = await res.json();
    draft = normalise(body.draft);
    saved = clone(draft);
    release = body.release;
    offerBackup();
    buildPageList();
    setStatus('saved');
    openPage(pageSelect.value || '/');
  }

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

  function offerBackup() {
    let backup: { at: number; draft: Draft } | null = null;
    try {
      backup = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? 'null');
    } catch {
      /* private mode or corrupt; nothing to offer */
    }
    if (!backup || !changes(saved, backup.draft).length) return;
    banner.hidden = false;
    banner.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = `You have unsaved edits from ${new Date(backup.at).toLocaleString()}.`;
    const restore = button('Restore them', () => {
      commit(() => {
        draft = normalise(backup!.draft);
      });
      banner.hidden = true;
    });
    const drop = button('Discard', () => {
      try {
        localStorage.removeItem(BACKUP_KEY);
      } catch {}
      banner.hidden = true;
    });
    banner.append(text, restore, drop);
  }

  /* ---------------- pages ---------------- */

  function buildPageList() {
    const current = pageSelect.value;
    pageSelect.innerHTML = '';
    const add = (label: string, path: string, group?: HTMLOptGroupElement) => {
      const o = new Option(label, path);
      (group ?? pageSelect).append(o);
    };
    add('Home', '/');
    add('Work', '/work');
    add('About', '/about');
    add('Contact', '/contact');
    const g = document.createElement('optgroup');
    g.label = 'Projects';
    [...draft.projects]
      .filter((p) => p.kind === 'case')
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((p) => add(p.title, `/work/${p.slug}`, g));
    pageSelect.append(g);
    pageSelect.value = current || '/';
  }

  function openPage(path: string) {
    selected = null;
    stopEditing(false);
    frame.src = `${path}${path.includes('?') ? '&' : '?'}club=1&studio=1`;
  }

  pageSelect.addEventListener('change', () => openPage(pageSelect.value));

  frame.addEventListener('load', () => {
    fdoc = frame.contentDocument;
    if (!fdoc) return;
    injectFrameStyle(fdoc);
    bindFrame(fdoc);
    paint();
    renderLayers();
    renderProps();
    // Keep the picker honest when preview mode lets a link navigate.
    const here = frame.contentWindow!.location.pathname.replace(/\/$/, '') || '/';
    if ([...pageSelect.options].some((o) => o.value === here)) pageSelect.value = here;
  });

  /* ---------------- the frame ---------------- */

  function injectFrameStyle(doc: Document) {
    const style = doc.createElement('style');
    style.dataset.studio = '';
    style.textContent = `
      html[data-studio-edit] [data-edit] { cursor: default; }
      html[data-studio-edit] [data-edit]:hover {
        outline: 1px solid color-mix(in srgb, #7c3aed 55%, transparent);
        outline-offset: 3px; border-radius: 2px;
      }
      html[data-studio-edit] [data-studio-selected] {
        outline: 2px solid #7c3aed !important; outline-offset: 3px; border-radius: 2px;
      }
      html[data-studio-edit] [data-studio-editing] {
        outline: 2px solid #7c3aed !important; outline-offset: 3px;
        background: color-mix(in srgb, #7c3aed 8%, transparent); caret-color: #7c3aed;
        cursor: text !important; user-select: text !important; -webkit-user-select: text !important;
      }
      [data-studio-hidden] { opacity: .28 !important; filter: grayscale(1); }
      html[data-studio-edit] a[href] { cursor: default; }
    `;
    doc.head.append(style);
    doc.documentElement.toggleAttribute('data-studio-edit', !preview);
  }

  const keyOf = (el: Element | null) => (el?.closest('[data-edit]') as HTMLElement | null) ?? null;

  function bindFrame(doc: Document) {
    // Capture phase, so the page's own handlers — links, the lightbox, the
    // portrait — never see a click that the Studio means as a selection.
    doc.addEventListener(
      'click',
      (e) => {
        if (preview) return;
        const el = keyOf(e.target as Element);
        if (editing && el === editing) return;
        e.preventDefault();
        e.stopPropagation();
        if (editing) stopEditing(true);
        select(el?.dataset.edit ?? null);
      },
      true
    );
    doc.addEventListener(
      'dblclick',
      (e) => {
        if (preview) return;
        const el = keyOf(e.target as Element);
        if (!el) return;
        e.preventDefault();
        startEditing(el);
      },
      true
    );
    doc.addEventListener('keydown', onKey, true);
    // A form submit or a drag inside the canvas would do something real.
    doc.addEventListener('submit', (e) => !preview && e.preventDefault(), true);
    doc.addEventListener('dragstart', (e) => !preview && e.preventDefault(), true);
  }

  const frameEls = (key?: string) =>
    [...(fdoc?.querySelectorAll<HTMLElement>(key ? `[data-edit="${CSS.escape(key)}"]` : '[data-edit]') ?? [])];

  const mediaUrl = (m: Row) =>
    m.path.startsWith('legacy/')
      ? `/media/${m.path.slice('legacy/'.length)}`
      : `${cfg.supabaseUrl}/storage/v1/object/public/portfolio-media/${m.path}`;

  /** The draft, painted onto the frame. Idempotent; cheap enough to run on every edit. */
  function paint() {
    if (!fdoc) return;
    for (const el of frameEls()) {
      const key = el.dataset.edit!;
      let t;
      try {
        t = target(key);
      } catch {
        el.dataset.studioUnknown = '';
        continue;
      }
      if (t.kind === 'text') {
        if (el === editing) continue;
        const v = String(t.read(draft) ?? '');
        if (el.textContent !== v) el.textContent = v;
      } else if (t.kind === 'image') {
        const m = t.media!(draft);
        const img = el as HTMLImageElement;
        if (m) {
          const url = mediaUrl(m);
          if (!img.src.endsWith(url)) {
            img.removeAttribute('srcset');
            img.src = url;
          }
          if (img.alt !== m.alt) img.alt = m.alt;
        }
      } else if (t.kind === 'item') {
        const p = t.read(draft);
        el.toggleAttribute('data-studio-hidden', !!p && !p.visible);
      }
    }
    reorderProjects();
  }

  /** Project rows and cards follow the draft's order, wherever they appear. */
  function reorderProjects() {
    const units = new Map<Element, { el: Element; order: number }[]>();
    for (const el of frameEls()) {
      const key = el.dataset.edit!;
      if (!/^project\.[^.]+$/.test(key)) continue;
      const p = projectBySlug(draft, key.split('.')[1]);
      if (!p) continue;
      const unit = el.parentElement?.tagName === 'LI' ? el.parentElement : el;
      const parent = unit.parentElement!;
      if (!units.has(parent)) units.set(parent, []);
      units.get(parent)!.push({ el: unit, order: p.sort_order });
    }
    for (const [parent, list] of units) {
      const sorted = [...list].sort((a, b) => a.order - b.order);
      if (sorted.every((u, i) => u.el === list[i].el)) continue;
      const anchor = list[list.length - 1].el.nextSibling;
      for (const u of sorted) parent.insertBefore(u.el, anchor);
    }
  }

  /* ---------------- selection ---------------- */

  function select(key: string | null) {
    selected = key;
    for (const el of fdoc?.querySelectorAll('[data-studio-selected]') ?? []) el.removeAttribute('data-studio-selected');
    if (key) for (const el of frameEls(key)) el.setAttribute('data-studio-selected', '');
    for (const li of layersHost.querySelectorAll<HTMLElement>('[data-key]')) {
      const on = li.dataset.key === key;
      if (on) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
      if (on) li.scrollIntoView({ block: 'nearest' });
    }
    renderProps();
  }

  function reveal(key: string) {
    const el = frameEls(key)[0];
    el?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /* ---------------- inline text editing ---------------- */

  function startEditing(el: HTMLElement) {
    const key = el.dataset.edit!;
    if (target(key).kind !== 'text') return select(key);
    if (editing) stopEditing(true);
    select(key);
    editing = el;
    editStart = el.textContent ?? '';
    el.setAttribute('data-studio-editing', '');
    // plaintext-only keeps the element's own typography and refuses pasted
    // markup; WebKit and Blink both support it, Firefox falls back to true
    // and the paste handler below strips formatting there.
    try {
      el.contentEditable = 'plaintext-only';
    } catch {
      el.contentEditable = 'true';
    }
    el.addEventListener('paste', onPaste);
    el.addEventListener('input', onInput);
    el.focus();
    const sel = el.ownerDocument.getSelection();
    const range = el.ownerDocument.createRange();
    range.selectNodeContents(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  function onPaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    editing?.ownerDocument.execCommand('insertText', false, text);
  }

  function onInput() {
    if (!editing) return;
    // Live, without a history entry per keystroke: the entry was made when
    // editing began, so one undo takes back the whole edit.
    target(editing.dataset.edit!).write(draft, editing.textContent ?? '');
    for (const twin of frameEls(editing.dataset.edit)) if (twin !== editing) twin.textContent = editing.textContent;
    renderProps(true);
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
    const now = el.textContent ?? '';
    if (!keep) {
      el.textContent = editStart;
      target(el.dataset.edit!).write(draft, editStart);
      changed();
    } else if (now !== editStart) {
      // Record the pre-edit state as the undo point for the whole edit.
      const after = clone(draft);
      target(el.dataset.edit!).write(draft, editStart);
      pushHistory();
      draft = after;
      changed();
    }
    paint();
    renderProps();
  }

  /* ---------------- history ---------------- */

  function pushHistory() {
    past.push(JSON.stringify(draft));
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
    syncHistoryButtons();
  }

  /** One meaningful edit: snapshot, change, repaint, save. */
  function commit(fn: () => void) {
    if (editing) stopEditing(true);
    pushHistory();
    fn();
    paint();
    renderLayers();
    renderProps();
    changed();
  }

  function undo() {
    if (editing) return stopEditing(false);
    const prev = past.pop();
    if (!prev) return;
    future.push(JSON.stringify(draft));
    draft = JSON.parse(prev);
    afterHistory();
  }
  function redo() {
    const next = future.pop();
    if (!next) return;
    past.push(JSON.stringify(draft));
    draft = JSON.parse(next);
    afterHistory();
  }
  function afterHistory() {
    paint();
    renderLayers();
    renderProps();
    syncHistoryButtons();
    changed();
  }
  function syncHistoryButtons() {
    undoBtn.disabled = past.length === 0;
    redoBtn.disabled = future.length === 0;
  }
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  /* ---------------- autosave ---------------- */

  function changed() {
    const pending = changes(saved, draft).length > 0;
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
    saveTimer = window.setTimeout(save, SAVE_DELAY_MS);
  }

  async function save(): Promise<boolean> {
    clearTimeout(saveTimer);
    if (saving) {
      saveTimer = window.setTimeout(save, SAVE_DELAY_MS);
      return false;
    }
    const batch = changes(saved, draft);
    if (!batch.length) {
      setStatus('saved');
      return true;
    }
    const sending = clone(draft);
    saving = true;
    setStatus('saving');
    try {
      const res = await fetch('/studio/api/save', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ changes: batch }),
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
      saving = false;
      if (changes(saved, draft).length) {
        setStatus('unsaved');
        saveTimer = window.setTimeout(save, SAVE_DELAY_MS);
      } else {
        setStatus('saved');
        try {
          localStorage.removeItem(BACKUP_KEY);
        } catch {}
      }
      return true;
    } catch {
      setStatus('offline');
      saveTimer = window.setTimeout(save, 8000);
      return false;
    } finally {
      saving = false;
    }
  }

  // Leaving with edits that have not reached the server.
  window.addEventListener('beforeunload', (e) => {
    if (changes(saved, draft ?? saved).length) e.preventDefault();
  });
  window.addEventListener('online', () => status === 'offline' && save());

  /* ---------------- layers ---------------- */

  function renderLayers() {
    layersHost.innerHTML = '';
    if (!fdoc) return;
    // Grouped by the section each key sits in, named after that section's
    // own first heading — the page's structure, not a list of fields.
    const groups = new Map<Element, { name: string; keys: string[] }>();
    const seen = new Set<string>();
    for (const el of frameEls()) {
      const key = el.dataset.edit!;
      if (seen.has(key) || el.dataset.studioUnknown !== undefined) continue;
      seen.add(key);
      const section = el.closest('section, footer, header') ?? fdoc.body;
      if (!groups.has(section)) {
        const h = section.querySelector('h1, h2, .eyebrow');
        groups.set(section, { name: (h?.textContent ?? 'Page').trim().slice(0, 40), keys: [] });
      }
      groups.get(section)!.keys.push(key);
    }
    for (const { name, keys } of groups.values()) {
      const g = document.createElement('div');
      g.className = 'layers__group';
      const h = document.createElement('div');
      h.className = 'layers__heading';
      h.textContent = name;
      g.append(h);
      const ul = document.createElement('ul');
      ul.setAttribute('role', 'list');
      for (const key of keys) {
        const t = target(key);
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'layer';
        b.dataset.key = key;
        b.dataset.kind = t.kind;
        const v = t.kind === 'text' ? String(t.read(draft) ?? '') : t.kind === 'item' ? t.read(draft)?.title ?? '' : t.label;
        b.innerHTML = '<span class="layer__icon" aria-hidden="true"></span><span class="layer__name"></span>';
        b.querySelector('.layer__name')!.textContent = t.kind === 'text' ? v || t.label : t.kind === 'item' ? `Project · ${v}` : v;
        b.title = t.label;
        if (key === selected) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => {
          select(key);
          reveal(key);
        });
        li.append(b);
        ul.append(li);
      }
      g.append(ul);
      layersHost.append(g);
    }
  }

  /* ---------------- properties ---------------- */

  function field(label: string, value: string, onInput: (v: string) => void, opts: { multiline?: boolean; hint?: string } = {}) {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    const l = document.createElement('span');
    l.className = 'field__label';
    l.textContent = label;
    const input = document.createElement(opts.multiline ? 'textarea' : 'input') as HTMLInputElement | HTMLTextAreaElement;
    input.className = 'field__input';
    input.value = value;
    if (opts.multiline) (input as HTMLTextAreaElement).rows = Math.min(8, Math.max(2, Math.ceil(value.length / 38)));
    // One history entry per visit to a field, not per keystroke.
    let entered = false;
    input.addEventListener('focus', () => {
      entered = false;
    });
    input.addEventListener('input', () => {
      if (!entered) {
        pushHistory();
        entered = true;
      }
      onInput(input.value);
      paint();
      changed();
    });
    input.addEventListener('blur', () => renderLayers());
    wrap.append(l, input);
    if (opts.hint) {
      const h = document.createElement('span');
      h.className = 'field__hint';
      h.textContent = opts.hint;
      wrap.append(h);
    }
    return wrap;
  }

  function toggle(label: string, on: boolean, fn: (v: boolean) => void) {
    const wrap = document.createElement('label');
    wrap.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = on;
    input.setAttribute('role', 'switch');
    input.addEventListener('change', () => commit(() => fn(input.checked)));
    const t = document.createElement('span');
    t.textContent = label;
    wrap.append(input, t);
    return wrap;
  }

  function button(label: string, fn: () => void, cls = 'btn') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function heading(text: string, sub?: string) {
    const h = document.createElement('div');
    h.className = 'props__head';
    h.innerHTML = '<div class="props__title"></div><div class="props__sub"></div>';
    h.querySelector('.props__title')!.textContent = text;
    h.querySelector('.props__sub')!.textContent = sub ?? '';
    return h;
  }

  /** `quiet`: the value changed from the canvas; update inputs in place. */
  function renderProps(quiet = false) {
    if (quiet && selected) {
      const input = propsHost.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-bound]');
      if (input && document.activeElement !== input) input.value = String(target(selected).read(draft) ?? '');
      return;
    }
    propsHost.innerHTML = '';
    if (!selected) return renderPageProps();
    const t = target(selected);

    if (t.kind === 'text') {
      propsHost.append(heading(t.label, 'Text'));
      const value = String(t.read(draft) ?? '');
      const f = field('Content', value, (v) => t.write(draft, v), {
        multiline: value.length > 48,
        hint: 'Or double-click it on the page. Enter to finish, Esc to cancel.',
      });
      f.querySelector('.field__input')!.setAttribute('data-bound', '');
      propsHost.append(f);
      return;
    }

    if (t.kind === 'image') {
      propsHost.append(heading(t.label, 'Image'));
      const m = t.media!(draft);
      if (m) {
        const img = document.createElement('img');
        img.className = 'props__image';
        img.src = mediaUrl(m);
        img.alt = '';
        propsHost.append(img);
        const meta = document.createElement('div');
        meta.className = 'props__meta';
        meta.textContent = [m.width && m.height ? `${m.width} × ${m.height}` : '', `${Math.round(m.bytes / 1024)} KB`].filter(Boolean).join(' · ');
        propsHost.append(meta);
        propsHost.append(field('Alt text', m.alt ?? '', (v) => (m.alt = v), { hint: 'What the picture shows, for people who cannot see it.' }));
      }
      propsHost.append(uploadControl((media) => commit(() => {
        draft.media.push(media);
        saved.media.push(clone(media));
        t.write(draft, media.id);
      })));
      return;
    }

    if (t.kind === 'item') {
      const p = t.read(draft) as Row;
      propsHost.append(heading(p.title, 'Project'));
      propsHost.append(field('Title', p.title, (v) => (p.title = v)));
      propsHost.append(field('Summary', p.summary, (v) => (p.summary = v), { multiline: true }));
      propsHost.append(field('Discipline', p.discipline, (v) => (p.discipline = v)));
      propsHost.append(field('Role', p.role, (v) => (p.role = v)));
      propsHost.append(toggle('Visible on the site', p.visible, (v) => (p.visible = v)));
      propsHost.append(toggle('Featured', p.featured, (v) => (p.featured = v)));
      const order = document.createElement('div');
      order.className = 'props__row';
      order.append(
        button('Move earlier', () => move(p, -1), 'btn btn--small'),
        button('Move later', () => move(p, 1), 'btn btn--small'),
        button('Open page', () => {
          pageSelect.value = `/work/${p.slug}`;
          openPage(pageSelect.value);
        }, 'btn btn--small btn--ghost')
      );
      propsHost.append(order);
    }
  }

  function renderPageProps() {
    const path = pageSelect.value;
    const pageKey = path === '/' ? 'home' : path.replace(/^\//, '');
    const page = draft.pages.find((p) => p.key === pageKey);
    const slug = path.startsWith('/work/') ? path.slice(6) : null;
    const project = slug ? projectBySlug(draft, slug) : null;

    if (project) {
      propsHost.append(heading(project.title, 'Project page'));
      propsHost.append(field('Title', project.title, (v) => (project.title = v)));
      propsHost.append(field('Summary', project.summary, (v) => (project.summary = v), { multiline: true }));
      propsHost.append(toggle('Visible on the site', project.visible, (v) => (project.visible = v)));
      propsHost.append(seoFields(project.seo, (seo) => (project.seo = seo)));
      return;
    }
    if (!page) {
      propsHost.append(heading('Nothing selected', 'Click anything outlined on the page to edit it.'));
      return;
    }
    propsHost.append(heading(`${humanize(pageKey)} page`, 'Every text on this page, including the ones that are hard to click.'));
    for (const [f, v] of Object.entries(page.fields)) {
      if (typeof v !== 'string') continue;
      propsHost.append(field(humanize(f), v, (nv) => (page.fields[f] = nv), { multiline: v.length > 48 }));
    }
    propsHost.append(seoFields(page.seo, (seo) => (page.seo = seo)));
  }

  function seoFields(seo: Row, set: (s: Row) => void) {
    const box = document.createElement('details');
    box.className = 'props__section';
    box.innerHTML = '<summary>Search &amp; sharing</summary>';
    box.append(
      field('Title', seo?.metaTitle ?? '', (v) => set({ ...seo, metaTitle: v })),
      field('Description', seo?.metaDescription ?? '', (v) => set({ ...seo, metaDescription: v }), { multiline: true })
    );
    return box;
  }

  function move(p: Row, dir: -1 | 1) {
    const list = draft.projects.filter((x) => x.kind === p.kind).sort((a, b) => a.sort_order - b.sort_order);
    const i = list.indexOf(p);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    commit(() => {
      [list[i], list[j]] = [list[j], list[i]];
      list.forEach((x, k) => (x.sort_order = k));
    });
    buildPageList();
  }

  /* ---------------- images ---------------- */

  function uploadControl(onDone: (media: Row) => void) {
    const drop = document.createElement('label');
    drop.className = 'drop';
    drop.innerHTML = '<span class="drop__title">Replace image</span><span class="drop__hint">Drop a picture here, or click to choose</span>';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif';
    input.hidden = true;
    drop.append(input);
    const go = async (file: File | undefined) => {
      if (!file) return;
      drop.dataset.state = 'busy';
      drop.querySelector('.drop__hint')!.textContent = 'Preparing…';
      try {
        const media = await upload(file);
        onDone(media);
      } catch (e) {
        drop.dataset.state = 'error';
        drop.querySelector('.drop__hint')!.textContent = e instanceof Error ? e.message : 'Upload failed';
      }
    };
    input.addEventListener('change', () => go(input.files?.[0]));
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.dataset.state = 'over';
    });
    drop.addEventListener('dragleave', () => delete drop.dataset.state);
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      go(e.dataTransfer?.files?.[0]);
    });
    return drop;
  }

  /** WebP in the browser, capped at 2400px wide, then up. */
  async function upload(file: File): Promise<Row> {
    if (!file.type.startsWith('image/')) throw new Error('That is not an image.');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / bitmap.width);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    let blob: Blob = file;
    if (file.type !== 'image/gif') {
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
      blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.86 });
    }
    if (blob.size > 15 * 1024 * 1024) throw new Error('Still larger than 15 MB after compression.');
    const form = new FormData();
    const name = file.type === 'image/gif' ? file.name : file.name.replace(/\.[^.]+$/, '') + '.webp';
    form.append('file', new File([blob], name, { type: blob.type }));
    form.append('width', String(w));
    form.append('height', String(h));
    const res = await fetch('/studio/api/upload', { method: 'POST', body: form, credentials: 'same-origin' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
    return body.media;
  }

  /* ---------------- preview & device ---------------- */

  previewBtn.addEventListener('click', () => {
    preview = !preview;
    if (preview && editing) stopEditing(true);
    root.toggleAttribute('data-previewing', preview);
    previewBtn.setAttribute('aria-pressed', String(preview));
    previewBtn.textContent = preview ? 'Back to editing' : 'Preview';
    fdoc?.documentElement.toggleAttribute('data-studio-edit', !preview);
    if (preview) select(null);
  });

  /*
   * A desktop document of a known width, scaled to fit — not a frame the size
   * of whatever space is left between the panels. At the width the canvas
   * actually has (~860px on a laptop) the portfolio would be showing its
   * tablet layout, and the owner would be editing a page no desktop visitor
   * sees. Mobile is the phone width at 1:1.
   */
  const ARTBOARD = 1440;
  function fit() {
    if (stage.dataset.device === 'mobile') {
      frame.style.width = frame.style.height = frame.style.transform = '';
      return;
    }
    const s = Math.min(1, stage.clientWidth / ARTBOARD);
    frame.style.width = `${ARTBOARD}px`;
    frame.style.height = `${stage.clientHeight / s}px`;
    frame.style.transform = `scale(${s})`;
    frame.style.transformOrigin = '0 0';
  }
  new ResizeObserver(fit).observe(stage);

  for (const b of deviceBtns) {
    b.addEventListener('click', () => {
      stage.dataset.device = b.dataset.device!;
      for (const o of deviceBtns) o.setAttribute('aria-pressed', String(o === b));
      fit();
    });
  }

  /* ---------------- publish ---------------- */

  function summary(): string[] {
    const snap = release?.snapshot;
    if (!snap) return ['First release'];
    const out: string[] = [];
    const cmp = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
    const fieldsDiff = (a: Row = {}, b: Row = {}) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => cmp(a[k], b[k]));

    const s = fieldsDiff(snap.settings?.fields, draft.settings.fields);
    if (s.length) out.push(`Site settings: ${s.map(humanize).join(', ').toLowerCase()}`);
    for (const p of draft.pages) {
      const old = snap.pages?.find((x: Row) => x.key === p.key);
      const f = fieldsDiff(old?.fields, p.fields);
      if (f.length) out.push(`${humanize(p.key)} page: ${f.map(humanize).join(', ').toLowerCase()}`);
      if (cmp(old?.seo, p.seo)) out.push(`${humanize(p.key)} page: search & sharing`);
    }
    const titleOf = (id: string) => draft.projects.find((x) => x.id === id)?.title ?? 'A project';
    let reordered = false;
    let images = 0;
    for (const p of draft.projects) {
      const old = snap.projects?.find((x: Row) => x.id === p.id);
      if (!old) {
        out.push(`${p.title}: new project`);
        continue;
      }
      if (old.sort_order !== p.sort_order) reordered = true;
      if (old.cover_media_id !== p.cover_media_id) images += 1;
      if (old.visible !== p.visible) out.push(`${p.title}: ${p.visible ? 'shown' : 'hidden'}`);
      const cols = ['title', 'summary', 'discipline', 'role', 'featured', 'seo'].filter((c) => cmp(old[c], p[c]));
      if (cols.length) out.push(`${p.title}: ${cols.join(', ')}`);
    }
    for (const b of draft.blocks) {
      const old = snap.blocks?.find((x: Row) => x.id === b.id);
      if (!old || !cmp(old.content, b.content)) continue;
      const imgChanged = cmp(old.content.image, b.content.image) || cmp(old.content.images, b.content.images);
      if (imgChanged) images += 1;
      const textChanged = cmp({ ...old.content, image: 0, images: 0 }, { ...b.content, image: 0, images: 0 });
      if (textChanged) out.push(`${titleOf(b.project_id)}: ${humanize(b.type).toLowerCase()} text`);
    }
    const lists = new Set<string>();
    for (const l of draft.lists) {
      const old = snap.lists?.find((x: Row) => x.id === l.id);
      if (!old || cmp(old.content, l.content) || old.sort_order !== l.sort_order || old.visible !== l.visible) lists.add(l.list_key);
    }
    for (const l of lists) out.push(`${humanize(l)} updated`);
    if (images) out.push(`${images} image${images > 1 ? 's' : ''} replaced`);
    if (reordered) out.push('Work reordered');
    for (const m of draft.media) {
      const old = snap.media?.find((x: Row) => x.id === m.id);
      if (old && old.alt !== m.alt) {
        out.push('Alt text updated');
        break;
      }
    }
    return out;
  }

  publishBtn.addEventListener('click', async () => {
    if (editing) stopEditing(true);
    if (!(await save())) return;
    const lines = summary();
    const list = $('[data-summary]', publishDialog);
    list.innerHTML = '';
    for (const line of lines.length ? lines : ['No changes since the last publish.']) {
      const li = document.createElement('li');
      li.textContent = line;
      list.append(li);
    }
    $<HTMLButtonElement>('[data-confirm]', publishDialog).disabled = lines.length === 0;
    $('[data-result]', publishDialog).textContent = '';
    publishDialog.showModal();
  });

  $<HTMLButtonElement>('[data-confirm]', publishDialog).addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    setStatus('publishing');
    const result = $('[data-result]', publishDialog);
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
      result.textContent =
        body.deploy === 'triggered'
          ? 'Published. The public site is rebuilding and will be live in about three minutes.'
          : 'Published. The public site will show it on its next deploy (no deploy hook is set yet).';
      release = { id: body.releaseId, createdAt: new Date().toISOString(), snapshot: clone(draft) };
    } catch (err) {
      setStatus('error', 'publish failed');
      result.textContent = `Not published: ${err instanceof Error ? err.message : err}`;
      btn.disabled = false;
    }
  });

  /* ---------------- revisions ---------------- */

  revisionsBtn.addEventListener('click', async () => {
    const list = $('[data-releases]', revisionsDialog);
    list.innerHTML = '<li>Loading…</li>';
    revisionsDialog.showModal();
    const res = await fetch('/studio/api/releases', { credentials: 'same-origin' });
    const body = await res.json().catch(() => ({ releases: [] }));
    list.innerHTML = '';
    for (const r of body.releases ?? []) {
      const li = document.createElement('li');
      li.className = 'release';
      const when = new Date(r.created_at).toLocaleString();
      const what = (r.summary ?? []).slice(0, 3).join(' · ') || '—';
      li.innerHTML = '<div class="release__when"></div><div class="release__what"></div>';
      li.querySelector('.release__when')!.textContent = `${when}${r.is_current ? ' — live now' : ''}`;
      li.querySelector('.release__what')!.textContent = what;
      if (!r.is_current) {
        li.append(
          button('Restore', async () => {
            if (!confirm('Make this version live again? Your current draft will be replaced by it.')) return;
            const res = await fetch('/studio/api/releases', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: r.id }),
            });
            if (res.ok) {
              revisionsDialog.close();
              past = [];
              future = [];
              await load();
            } else alert('Could not restore that version.');
          }, 'btn btn--small')
        );
      }
      list.append(li);
    }
  });

  for (const d of [publishDialog, revisionsDialog]) {
    d.querySelector('[data-close]')?.addEventListener('click', () => d.close());
  }

  /* ---------------- keyboard ---------------- */

  function onKey(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopEditing(false);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        stopEditing(true);
      }
      return;
    }
    const inField = (e.target as HTMLElement)?.closest?.('input, textarea, select');
    if (mod && e.key.toLowerCase() === 'z' && !inField) {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
      return;
    }
    if (inField || preview) return;
    if (e.key === 'Escape' && selected) select(null);
    if (e.key === 'Enter' && selected) {
      const el = frameEls(selected)[0];
      if (el) {
        e.preventDefault();
        startEditing(el);
      }
    }
  }
  document.addEventListener('keydown', onKey);

  syncHistoryButtons();
  load();
}
