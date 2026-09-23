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

import { PROPS_FOR, catalogueFor, type ClubType } from './schema';
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
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
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

  /**
   * Everything on the page becomes a layer.
   *
   * This started as a hand-written catalogue, which produced a beautiful
   * layer list and a frustrating editor: if a thing was not in the table it
   * could not be clicked, and no table is ever going to cover a whole site.
   * In the tool this imitates every element on the canvas is selectable, so
   * every element here is too — the tree is walked, and what is found is
   * typed by what it actually is.
   *
   * The catalogue did not go away; it stopped being a gate and became a
   * dictionary. Where it names something, that name is used — Name, Headline,
   * Button · See the work read far better than H1, P, A — and everything else
   * is named after its own content. Best of both: a legible tree at the top,
   * and nothing unreachable underneath it.
   *
   * What is skipped is only what could not be edited anyway: the insides of an
   * SVG (the icon itself is adopted, its forty paths are not), scripts and
   * templates, and anything with no box on screen. Bounded by `MAX_NODES`,
   * because the hit test and the layers list are both linear in this and a
   * page is allowed to be enormous.
   */
  private adopt(doc: Document): void {
    this.nodes.clear();
    this.order = [];

    const named = this.namesFrom(doc);
    const root = doc.querySelector<HTMLElement>('main') ?? doc.body;
    let count = 0;

    const walk = (el: HTMLElement, parentId: string | null, path: string): void => {
      for (const [i, raw] of Array.from(el.children).entries()) {
        if (count >= MAX_NODES) return;
        const child = raw as HTMLElement;

        if (SKIP.has(child.tagName)) continue;

        /*
         * No box is not the same as nothing inside.
         *
         * The hero's copy wrapper is `display: contents`, which has no
         * rectangle at all — and the first version treated that as "skip",
         * which skipped the headline, the role line, the description and both
         * buttons with it, because every one of them lives inside it. An
         * element with no box cannot be a layer, but its children still can:
         * it is passed through, and they are adopted onto its parent.
         */
        const box = child.getBoundingClientRect();
        const real = box.width > 0 && box.height > 0;

        let id = `${path}-${i}`;

        if (real) {
          const known = named.get(child);
          id = known?.id ?? id;
          const type = known?.type ?? typeOf(child);

          this.add({
            id,
            label: known?.label ?? nameOf(child, type),
            type,
            parentId,
            el: child,
          });
          count += 1;
        }

        /*
         * An SVG is a picture, not a folder of paths. Descending into one
         * produces dozens of layers nobody can select meaningfully and buries
         * everything after it in the list.
         */
        if (child.tagName.toUpperCase() === 'SVG') continue;

        walk(child, real ? id : parentId, id);
      }
    };

    walk(root, null, 'n');
  }

  /**
   * The catalogue, resolved to the elements it describes.
   *
   * Only for the names and the types: the walk above adopts everything either
   * way, and this is what decides whether a thing is called "Headline" or "P".
   */
  private namesFrom(doc: Document): Map<HTMLElement, { id: string; label: string; type: ClubType }> {
    const named = new Map<HTMLElement, { id: string; label: string; type: ClubType }>();
    const catalogue = catalogueFor(this.path);
    if (!catalogue) return named;

    for (const section of catalogue) {
      const host = doc.querySelector<HTMLElement>(section.selector);
      if (!host) continue;
      named.set(host, { id: section.key, label: section.label, type: 'container' });

      for (const spec of section.children) {
        const found = spec.all
          ? Array.from(host.querySelectorAll<HTMLElement>(spec.selector))
          : [host.querySelector<HTMLElement>(spec.selector)].filter(
              Boolean as unknown as (v: HTMLElement | null) => v is HTMLElement
            );

        found.forEach((el, i) => {
          named.set(el, {
            id: spec.all ? `${section.key}.${spec.key}.${i}` : `${section.key}.${spec.key}`,
            label: spec.all
              ? (spec.eachLabel ?? `${spec.label} %n`).replace('%n', String(i + 1))
              : spec.label,
            type: spec.type,
          });
        });
      }
    }

    return named;
  }

  private add(node: ClubNode): void {
    node.el.dataset.clubId = node.id;
    this.nodes.set(node.id, node);
    this.order.push(node.id);
    if (node.type === 'text') {
      this.baseText.set(node.id, node.el.textContent ?? '');
    }
    if (node.type === 'image') {
      this.baseSrc.set(node.id, (node.el as HTMLImageElement).getAttribute('src') ?? '');
    }
    /*
     * A button holding a bare text node is the one case the walk cannot
     * reach, because a text node is not an element and has no box to adopt.
     * Wrapping it is what gives the words a layer of their own.
     */
    if (node.type === 'button') this.addLabel(node);
  }

  /**
   * The text inside a button, made into a layer you can select.
   *
   * Figma has no such thing as a button with a text property — it has a frame
   * with a text layer in it, and you reach the text by double-clicking into
   * the frame. Matching that is what makes the properties panel honest: one
   * fill on the frame, one on the text, and no panel offering two colours and
   * leaving you to work out which is which.
   *
   * Most of the site's buttons hold a bare text node, which cannot be styled
   * or selected on its own, so one is wrapped. `display: contents` was the
   * first choice and is exactly wrong: an element with no box has no
   * rectangle, so the geometric hit test could never find it and the selection
   * had nothing to draw. It is left as an ordinary inline span, which is the
   * box the anonymous text already occupied — the button lays out as it did,
   * and the wrapper exists only in the sandbox document, which is thrown away
   * on reload like everything else.
   */
  private addLabel(button: ClubNode): void {
    const el = button.el;
    let label = el.querySelector<HTMLElement>('[data-club-label]');

    if (!label) {
      const doc = el.ownerDocument;
      label = doc.createElement('span');
      label.dataset.clubLabel = '';
      // Everything the button says, moved inside the wrapper.
      while (el.firstChild) label.appendChild(el.firstChild);
      el.appendChild(label);
    }

    this.add({
      id: `${button.id}.label`,
      label: 'Label',
      type: 'text',
      parentId: button.id,
      el: label,
    });
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
    return this.stackAt(x, y)[0];
  }

  /**
   * Everything under this point, outermost first.
   *
   * Ordered by area descending, which for nested boxes is the same as
   * outermost-to-innermost and needs no tree walk to work out. The editor
   * uses it to go one level deeper on each click — the section, then the row,
   * then the button, then its label — which is how selection works in the
   * tool this borrows from, and it applies to everything rather than being a
   * special case for buttons.
   */
  stackAt(x: number, y: number): ClubNode[] {
    const under: { node: ClubNode; area: number }[] = [];

    for (const node of this.nodes.values()) {
      const r = node.el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      under.push({ node, area: r.width * r.height });
    }

    return under.sort((a, b) => b.area - a.area).map((u) => u.node);
  }

  /** The text layer inside a button, if this node is a button with one. */
  labelOf(id: string): ClubNode | undefined {
    return this.nodes.get(`${id}.label`);
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
      if (has('padX')) {
        s.paddingLeft = `${p.padX}px`;
        s.paddingRight = `${p.padX}px`;
      }
      if (has('padY')) {
        s.paddingTop = `${p.padY}px`;
        s.paddingBottom = `${p.padY}px`;
      }
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

/**
 * The ceiling on how many things one page offers.
 *
 * Both the hit test and the layers list are linear in this, and a page is
 * allowed to be enormous. Set where the cost stops being free rather than
 * where it starts to hurt.
 */
const MAX_NODES = 600;

/** Not layers: no box, no meaning, or metadata. */
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'BR', 'META', 'LINK', 'TITLE']);

/** What an element is, which decides the properties it is offered. */
function typeOf(el: HTMLElement): ClubType {
  const tag = el.tagName.toUpperCase();
  if (tag === 'IMG' || tag === 'PICTURE' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'SVG') {
    return 'image';
  }
  if (tag === 'A' || tag === 'BUTTON' || el.getAttribute('role') === 'button') return 'button';

  /*
   * Text is the deepest thing holding words, not anything containing them. A
   * section contains its headline; only the headline *is* text, and only it
   * should be offered a font size.
   */
  const words = (el.textContent ?? '').trim();
  if (words) {
    const deeper = Array.from(el.children).some((c) => (c.textContent ?? '').trim());
    if (!deeper) return 'text';
  }

  return 'container';
}

/** What to call it, when the catalogue has no opinion. */
function nameOf(el: HTMLElement, type: ClubType): string {
  if (type === 'image') {
    const alt = trim((el as HTMLImageElement).alt ?? '');
    return alt || 'Image';
  }
  if (type === 'text' || type === 'button') {
    const words = trim(el.textContent ?? '');
    if (words) return words;
  }

  // A frame is named after what it is, the way an unnamed frame is in Figma.
  const tag = el.tagName.toLowerCase();
  if (tag === 'section') return 'Section';
  if (tag === 'header' || tag === 'footer' || tag === 'nav' || tag === 'main') {
    return tag[0].toUpperCase() + tag.slice(1);
  }
  if (tag === 'ul' || tag === 'ol') return 'List';
  if (tag === 'li') return 'List item';
  return 'Frame';
}
