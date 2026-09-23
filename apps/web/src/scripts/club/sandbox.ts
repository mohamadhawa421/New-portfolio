/**
 * The canvas: the real portfolio, in a frame, with the state painted onto it.
 *
 * The iframe loads `/?club=1` — the actual home page, the actual components,
 * the actual inlined CSS, the actual content and the actual character. That is
 * the whole reason the sandbox looks like the portfolio instead of like a
 * drawing of it, and it is why there is no second copy of any markup anywhere
 * in this feature.
 *
 * Three jobs, in order:
 *
 *   adopt   — find the catalogue's elements in the loaded document and give
 *             each one a stable id. Read only; nothing is written.
 *   quiet   — stop the page behaving like a page. Links do not navigate,
 *             forms do not submit, and the document cannot scroll itself.
 *   apply   — write the store's overrides onto those elements as inline
 *             styles, and build the nodes the designer added.
 *
 * `apply` is a full repaint rather than a diff: it clears everything it wrote
 * last time and writes the current state from scratch. At this scale that is
 * both faster to reason about and impossible to leak — the alternative is
 * tracking which properties were removed since the last pass, which is exactly
 * the bookkeeping that leaves an element stuck at an opacity nobody set.
 */

import {
  GENERIC,
  GENERIC_CAP,
  PROPS_FOR,
  catalogueFor,
  type ClubType,
  type NodeSpec,
  type SectionSpec,
} from './schema';
import type { Props, SandboxState } from './store';

export interface ClubNode {
  id: string;
  label: string;
  type: ClubType;
  /** Section id, or null for a section itself. */
  parentId: string | null;
  /** The live element in the sandbox document. Never in the editor's. */
  el: HTMLElement;
  /** True for nodes the designer created rather than adopted. */
  created?: boolean;
}

/** Everything written by `apply`, so the next pass can clear it exactly. */
const WRITTEN = [
  'transform',
  'width',
  'height',
  'visibility',
  'opacity',
  'borderRadius',
  'background',
  'backgroundColor',
  'color',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'objectFit',
  'padding',
  'gap',
] as const;

export class Sandbox {
  readonly frame: HTMLIFrameElement;
  private nodes = new Map<string, ClubNode>();
  private order: string[] = [];
  /** Original text, kept so clearing a text override puts the real copy back. */
  private baseText = new Map<string, string>();
  private baseSrc = new Map<string, string>();
  private addedHost: HTMLElement | null = null;
  private onReady: (() => void) | null = null;

  constructor(frame: HTMLIFrameElement) {
    this.frame = frame;
  }

  get doc(): Document | null {
    return this.frame.contentDocument;
  }

  /** The sandbox document's full height, which the editor sizes the frame to. */
  get pageHeight(): number {
    return this.doc?.documentElement.scrollHeight ?? 0;
  }

  /** Which page the canvas is showing. Changed from the Pages panel only. */
  path = '/';

  load(path: string, ready: () => void): void {
    this.path = path;
    this.onReady = ready;
    this.frame.addEventListener('load', () => this.afterLoad(), { once: true });
    // The flag is what BaseLayout's primer reads to set `data-club`.
    const join = path.includes('?') ? '&' : '?';
    this.frame.src = `${path}${join}club=1`;
  }

  private afterLoad(): void {
    const doc = this.doc;
    if (!doc) return;
    this.adopt(doc);
    this.quiet(doc);
    this.onReady?.();
  }

  /* ---------------------------------------------------------------- */
  /* Adoption                                                          */
  /* ---------------------------------------------------------------- */

  private adopt(doc: Document): void {
    this.nodes.clear();
    this.order = [];

    const catalogue = catalogueFor(this.path);
    if (!catalogue) {
      this.adoptGenerically(doc);
      return;
    }

    for (const section of catalogue) {
      const host = doc.querySelector<HTMLElement>(section.selector);
      if (!host) continue;

      this.add({
        id: section.key,
        label: section.label,
        type: 'container',
        parentId: null,
        el: host,
      });

      for (const spec of section.children) {
        const found = spec.all
          ? Array.from(host.querySelectorAll<HTMLElement>(spec.selector))
          : [host.querySelector<HTMLElement>(spec.selector)].filter(Boolean as unknown as (v: HTMLElement | null) => v is HTMLElement);

        found.forEach((el, i) => {
          const id = spec.all ? `${section.key}.${spec.key}.${i}` : `${section.key}.${spec.key}`;
          const label = spec.all
            ? (spec.eachLabel ?? `${spec.label} %n`).replace('%n', String(i + 1))
            : spec.label;
          this.add({ id, label, type: spec.type, parentId: section.key, el });
        });
      }
    }
  }

  /**
   * A page with no catalogue of its own, read by shape.
   *
   * Every `section` becomes a group named after its own heading, and the
   * headings, paragraphs, pictures and buttons inside it become layers. It is
   * plainer than the home page's hand-written tree and it is the reason the
   * Club is not a one-page feature: About, Work and Contact are editable
   * without a line of code describing them, and so is whatever page ships
   * next.
   */
  private adoptGenerically(doc: Document): void {
    const sections = Array.from(doc.querySelectorAll<HTMLElement>('main section, main > div'));

    sections.forEach((host, s) => {
      const heading = host.querySelector('h1, h2')?.textContent?.trim();
      const key = `s${s}`;
      this.add({
        id: key,
        label: trim(heading) || `Section ${s + 1}`,
        type: 'container',
        parentId: null,
        el: host,
      });

      let taken = 0;
      for (const spec of GENERIC) {
        for (const [i, el] of Array.from(host.querySelectorAll<HTMLElement>(spec.selector)).entries()) {
          if (taken >= GENERIC_CAP) break;
          // A node already adopted by an earlier rule is not adopted twice.
          if (el.dataset.clubId) continue;
          taken += 1;
          this.add({
            id: `${key}.${spec.key}.${i}`,
            label: labelFor(spec, el, i),
            type: spec.type,
            parentId: key,
            el,
          });
        }
      }
    });
  }

  private add(node: ClubNode): void {
    node.el.dataset.clubId = node.id;
    this.nodes.set(node.id, node);
    this.order.push(node.id);
    if (node.type === 'text' || node.type === 'button') {
      this.baseText.set(node.id, node.el.textContent ?? '');
    }
    if (node.type === 'image') {
      this.baseSrc.set(node.id, (node.el as HTMLImageElement).getAttribute('src') ?? '');
    }
  }

  /* ---------------------------------------------------------------- */
  /* Making the page stop being a page                                 */
  /* ---------------------------------------------------------------- */

  /**
   * The canvas is a picture of the site, not the site.
   *
   * Everything here is capture-phase and `preventDefault`, applied to the
   * sandbox document only. A link that navigated would replace the artboard
   * with another page and strand every adopted node; a form that submitted
   * would do the same via the network. The scripts that would have fought the
   * editor are already standing down — see `club.ts` — so this is only about
   * the browser's own default behaviours, which no flag can switch off.
   */
  private quiet(sandboxDoc: Document): void {
    const stop = (e: Event): void => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('a,button,[role="button"],summary,label')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    sandboxDoc.addEventListener('click', stop, true);
    sandboxDoc.addEventListener('submit', (e) => e.preventDefault(), true);
    sandboxDoc.addEventListener('keydown', (e) => {
      // Enter on a focused link is a navigation too.
      if (e.key === 'Enter') e.preventDefault();
    }, true);

    // The editor owns scrolling; the frame is sized to the whole document.
    sandboxDoc.documentElement.style.overflow = 'hidden';
    sandboxDoc.body.style.overflow = 'hidden';

    /*
     * Every picture, now, rather than when it is scrolled to.
     *
     * Lazy loading is right on the real site and wrong here twice over. The
     * frame is sized to the whole document and never scrolls, so the browser
     * has no scroll to trigger on — and an image that has not loaded is drawn
     * as its placeholder colour, which is a flat block sitting in the middle
     * of the artboard where a project shot should be. It would then be
     * exported that way, which is the version that actually matters: the PNG
     * is the thing the designer sends, and a placeholder in it reads as the
     * portfolio being broken rather than as a loading state.
     */
    sandboxDoc.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      img.setAttribute('loading', 'eager');
    });

    this.freeze(sandboxDoc);
  }

  /**
   * The canvas stops being a website and becomes a frame.
   *
   * In Figma the thing on the artboard does not respond to you — it is a
   * picture of an interface, and the only thing that reacts is the editor. The
   * sandbox has to behave the same way or the two interaction models fight:
   * moving the pointer across a project row lights it up, a button fills in
   * under the cursor, the reveal transitions fire as boxes are resized, and
   * none of it is the designer's doing.
   *
   * Two rules do all of it. `pointer-events: none` on everything inside the
   * body means no `:hover` can ever match, because nothing is ever hovered —
   * which is the only way to switch hover off wholesale, since CSS has no way
   * to say "ignore this state". Selection still works: the pointer events land
   * on the document instead, and the editor asks `elementFromPoint` what is
   * underneath, which ignores pointer-events entirely.
   *
   * And transitions and animations are cut to nothing, so the page holds
   * perfectly still while it is being edited and lands in the export exactly
   * as it looks on screen.
   *
   * Written as a stylesheet in the sandbox rather than as inline styles on
   * every node, so `apply` never has to work around it and nothing here shows
   * up as a property the designer appears to have set.
   */
  private freeze(sandboxDoc: Document): void {
    const style = sandboxDoc.createElement('style');
    style.dataset.clubFreeze = '';
    style.textContent = `
      body * { pointer-events: none !important; }
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        scroll-behavior: auto !important;
      }
      /* Carets and text selection belong to the editor, not to the page. */
      body { caret-color: transparent; }
      body *::selection { background: transparent; }
      /* Except while something is genuinely being typed into. */
      [contenteditable="plaintext-only"] { pointer-events: auto !important; caret-color: auto; }
      [contenteditable="plaintext-only"]::selection { background: Highlight; }

      /*
       * The site's own navigation is not part of the artboard.
       *
       * It is \`position: fixed\`, and the frame is sized to the whole document
       * rather than to a viewport — so it does not follow anything, it just
       * sits across the top of an eight-thousand-pixel page and lands in the
       * export that way. Changing page is the Pages panel's job in here, which
       * leaves the nav with nothing to do and a permanent stripe to occupy.
       * The skip link goes for the same reason: it appears on focus, and focus
       * moves around constantly while editing.
       */
      [data-nav], [data-logo], .skip-link, .scroller { display: none !important; }
    `;
    sandboxDoc.head.appendChild(style);
  }

  /* ---------------------------------------------------------------- */
  /* Reading                                                           */
  /* ---------------------------------------------------------------- */

  list(): ClubNode[] {
    return this.order.map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  get(id: string): ClubNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * What is under this point in the sandbox, found geometrically.
   *
   * Neither of the obvious answers works here. `event.target` is always the
   * document, because `freeze` takes pointer events off everything in the body
   * so that no `:hover` can ever match. And `elementFromPoint` — which was the
   * second attempt — *honours* `pointer-events: none`, so it walks straight
   * past every element and hands back the body as well.
   *
   * So the hit test is done against the adopted nodes' own rectangles. It is
   * the smallest box containing the point, which resolves "the headline inside
   * the hero" to the headline; sections lose to their children on area, which
   * is the behaviour a designer expects from a click. Forty-odd rectangles is
   * nothing to measure, and it has a property the DOM version never had: only
   * things in the catalogue can be hit, so a click can never select some
   * anonymous wrapper that happens to be on top.
   */
  at(x: number, y: number): ClubNode | undefined {
    let best: ClubNode | undefined;
    let bestArea = Infinity;

    for (const node of this.nodes.values()) {
      const r = node.el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const area = r.width * r.height;
      if (area < bestArea) {
        bestArea = area;
        best = node;
      }
    }

    return best;
  }

  /** Which adopted node owns this element, walking up from an element. */
  hit(el: Element | null): ClubNode | undefined {
    let cur: Element | null = el;
    while (cur) {
      const id = (cur as HTMLElement).dataset?.clubId;
      if (id && this.nodes.has(id)) return this.nodes.get(id);
      cur = cur.parentElement;
    }
    return undefined;
  }

  /** A node's box in sandbox-document coordinates, before the canvas zoom. */
  boxOf(id: string): DOMRect | null {
    const n = this.nodes.get(id);
    if (!n || !this.doc) return null;
    const r = n.el.getBoundingClientRect();
    const sx = this.doc.documentElement.scrollLeft || 0;
    const sy = this.doc.documentElement.scrollTop || 0;
    return new DOMRect(r.left + sx, r.top + sy, r.width, r.height);
  }

  /* ---------------------------------------------------------------- */
  /* Painting the state on                                             */
  /* ---------------------------------------------------------------- */

  apply(state: SandboxState): void {
    const doc = this.doc;
    if (!doc) return;

    this.syncCreated(doc, state);

    for (const node of this.nodes.values()) {
      const p = state.overrides[node.id] ?? {};
      const s = node.el.style;

      // Clear last pass before writing this one. See the note at the top.
      for (const k of WRITTEN) s.removeProperty(camelToKebab(k));

      const allowed = new Set(PROPS_FOR[node.type]);
      const has = (k: keyof Props): boolean => allowed.has(k as string) && p[k] !== undefined;

      if (has('visible') && p.visible === false) s.visibility = 'hidden';
      if (has('opacity')) s.opacity = String(p.opacity);
      if (has('x') || has('y')) s.transform = `translate(${p.x ?? 0}px, ${p.y ?? 0}px)`;
      if (has('w')) s.width = `${p.w}px`;
      if (has('h')) s.height = `${p.h}px`;
      if (has('radius')) s.borderRadius = `${p.radius}px`;
      if (has('bg')) s.background = p.bg!;
      if (has('color')) s.color = p.color!;
      if (has('fontSize')) s.fontSize = `${p.fontSize}px`;
      if (has('fontWeight')) s.fontWeight = String(p.fontWeight);
      if (has('lineHeight')) s.lineHeight = String(p.lineHeight);
      if (has('letterSpacing')) s.letterSpacing = `${p.letterSpacing}px`;
      if (has('align')) s.textAlign = p.align!;
      if (has('fit')) s.objectFit = p.fit!;
      if (has('padding')) s.padding = `${p.padding}px`;
      if (has('gap')) s.gap = `${p.gap}px`;

      /*
       * Text and src are content rather than style, so "no override" has to
       * put the original back explicitly — there is no `removeProperty` for a
       * text node. This is why the base values were captured at adoption.
       */
      if (allowed.has('text')) {
        const base = this.baseText.get(node.id);
        const want = p.text ?? base;
        if (want !== undefined && node.el.textContent !== want) node.el.textContent = want;
      }
      if (allowed.has('src')) {
        const base = this.baseSrc.get(node.id);
        const want = p.src ?? base;
        const img = node.el as HTMLImageElement;
        if (want !== undefined && img.getAttribute('src') !== want) img.setAttribute('src', want);
      }
    }
  }

  /**
   * Nodes the designer added.
   *
   * Rebuilt from the state rather than kept alive across edits, so undoing a
   * creation is deleting a key and redoing it is putting the key back — the
   * same mechanism as every other edit, with no special case in the history.
   */
  private syncCreated(doc: Document, state: SandboxState): void {
    if (!this.addedHost || !this.addedHost.isConnected) {
      const host = doc.createElement('div');
      host.dataset.clubAdded = '';
      host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:40;';
      doc.body.style.position = doc.body.style.position || 'relative';
      doc.body.appendChild(host);
      this.addedHost = host;
    }

    const want = new Set(state.addedOrder);
    // Drop anything no longer in the state (an undone creation).
    for (const el of Array.from(this.addedHost.children)) {
      const id = (el as HTMLElement).dataset.clubId ?? '';
      if (!want.has(id)) {
        el.remove();
        this.nodes.delete(id);
        this.order = this.order.filter((x) => x !== id);
      }
    }

    for (const id of state.addedOrder) {
      const spec = state.overrides[id]?.created;
      if (!spec) continue;
      let el = this.addedHost.querySelector<HTMLElement>(`[data-club-id="${cssEscape(id)}"]`);
      if (!el) {
        el = doc.createElement(spec.kind === 'text' ? 'p' : 'div');
        el.dataset.clubId = id;
        el.style.pointerEvents = 'auto';
        if (spec.kind === 'text') el.textContent = 'Text';
        this.addedHost.appendChild(el);
      }
      // Position is part of the creation, not an override, so it is written here.
      el.style.position = 'absolute';
      el.style.left = `${spec.left}px`;
      el.style.top = `${spec.top}px`;
      el.style.margin = '0';
      if (spec.kind === 'ellipse') el.style.borderRadius = '50%';
      if (spec.kind !== 'text' && !el.style.background) el.style.background = 'currentColor';

      if (!this.nodes.has(id)) {
        const type: ClubType = spec.kind === 'text' ? 'text' : spec.kind === 'frame' ? 'container' : 'surface';
        const label =
          spec.kind === 'text' ? 'Text' : spec.kind === 'frame' ? 'Frame' : spec.kind === 'ellipse' ? 'Ellipse' : 'Rectangle';
        this.nodes.set(id, { id, label, type, parentId: spec.section, el, created: true });
        this.order.push(id);
        if (type === 'text') this.baseText.set(id, 'Text');
      }
    }
  }

  /** Editor chrome the export must not capture lives outside the frame, so
   *  this only has to drop the selection marks the sandbox itself carries. */
  stripForExport(): void {
    this.doc?.querySelectorAll('[data-club-selected]').forEach((el) => {
      (el as HTMLElement).removeAttribute('data-club-selected');
    });
  }
}

const camelToKebab = (s: string): string => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** `CSS.escape` is not in every target this ships to; the ids are known-safe. */
const cssEscape = (s: string): string => s.replace(/"/g, '\\"');

/** Layer names come from the content, cut to something a panel can show. */
function trim(text: string | undefined): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > 28 ? `${clean.slice(0, 27)}…` : clean;
}

/** A generic layer is named after what it says, and numbered only if it is mute. */
function labelFor(spec: NodeSpec, el: HTMLElement, i: number): string {
  if (spec.type === 'image') {
    const alt = trim((el as HTMLImageElement).alt);
    return alt || (spec.eachLabel ?? 'Image %n').replace('%n', String(i + 1));
  }
  return trim(el.textContent ?? '') || (spec.eachLabel ?? '%n').replace('%n', String(i + 1));
}
