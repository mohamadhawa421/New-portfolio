/**
 * What the Designers Club lets you touch, and nothing else.
 *
 * This file is the whole of the answer to "which parts of the portfolio are
 * editable". It is a catalogue rather than a traversal: the sandbox does not
 * walk the DOM looking for things that seem editable, it looks up exactly
 * these selectors inside exactly these sections and adopts what it finds.
 *
 * That is the difference between a design tool and a page with contenteditable
 * on it. A traversal produces thousands of anonymous divs, a layer tree nobody
 * can read, and properties that half work because the element underneath was
 * never meant to carry them. A catalogue produces a layer list that reads like
 * the page reads — Hero, Name, Headline, the two buttons, the portrait — and
 * every property offered is one the element can actually honour.
 *
 * It is also the extension point. A new editable thing is an entry here and
 * nothing else: the layers panel, the properties panel, selection, undo and
 * the export all derive from this. Adding a page later means adding a second
 * `SECTIONS`-shaped table and pointing the sandbox at it.
 *
 * Every selector is scoped to its section and resolved against the *sandbox
 * document* — the iframe — never against the editor's own document. The real
 * page is read; it is never the thing being written to.
 */

/** What kind of thing this is, which decides the properties it is offered. */
export type ClubType = 'text' | 'image' | 'button' | 'surface' | 'container';

export interface NodeSpec {
  /** Stable within its section. The node id is `${section}.${key}`. */
  key: string;
  /** What the layers panel calls it. */
  label: string;
  /** Resolved with `querySelectorAll` inside the section element. */
  selector: string;
  type: ClubType;
  /**
   * Adopt every match rather than the first, numbering them.
   *
   * The five project rows and the five service rows are the reason this
   * exists: they are one entry here and five layers on screen, so the
   * catalogue does not have to be rewritten when a sixth project ships.
   */
  all?: boolean;
  /** What each numbered layer is called. `%n` becomes the 1-based index. */
  eachLabel?: string;
}

export interface SectionSpec {
  key: string;
  label: string;
  /** Resolved against the sandbox document root. */
  selector: string;
  children: NodeSpec[];
}

/**
 * The home page, in the order it is read.
 *
 * Deliberately shallow. Figma's tree can nest as deep as the document does;
 * this one stops at the first level that is worth selecting, because a
 * designer looking for the headline wants it under Hero rather than six
 * groups down. Anything not listed is still *rendered* — the canvas is the
 * whole real page — it simply is not selectable.
 */
export const SECTIONS: SectionSpec[] = [
  {
    key: 'hero',
    label: 'Hero',
    selector: 'section.hero',
    children: [
      { key: 'meta', label: 'Role · Location', selector: '.hero__meta', type: 'text' },
      { key: 'title', label: 'Name', selector: '.hero__title', type: 'text' },
      { key: 'lead', label: 'Headline', selector: '.hero__subtitle', type: 'text' },
      { key: 'intro', label: 'Description', selector: '.hero__intro', type: 'text' },
      { key: 'cta1', label: 'Button · See the work', selector: '.btn--primary', type: 'button' },
      { key: 'cta2', label: 'Button · Start a project', selector: '.btn--secondary', type: 'button' },
      {
        key: 'portrait',
        label: 'Character',
        selector: '.hero__portrait-frame img:not(.hero__portrait-alt)',
        type: 'image',
      },
      { key: 'aura', label: 'Glow', selector: '.hero__aura', type: 'surface' },
    ],
  },
  {
    key: 'work',
    label: 'Selected Work',
    selector: 'section.work',
    children: [
      { key: 'eyebrow', label: 'Eyebrow', selector: '.work__header .eyebrow', type: 'text' },
      /*
       * The "15 projects." line. Its class is `work__heading`, not
       * `work__count` — the second dead selector this table has had (the
       * headline pointed at `.hero__lead` for a while), and both were invisible
       * because a name that resolves to nothing simply leaves the layer
       * unnamed rather than failing.
       */
      { key: 'count', label: 'Count', selector: '.work__heading', type: 'text' },
      {
        key: 'row',
        label: 'Projects',
        selector: '[data-work-row]',
        type: 'container',
        all: true,
        eachLabel: 'Project %n',
      },
      {
        key: 'shot',
        label: 'Previews',
        selector: '.index__frame img',
        type: 'image',
        all: true,
        eachLabel: 'Preview %n',
      },
    ],
  },
  {
    key: 'services',
    label: 'Five ways to work together',
    selector: 'section.services',
    children: [
      { key: 'eyebrow', label: 'Eyebrow', selector: '.eyebrow', type: 'text' },
      { key: 'title', label: 'Heading', selector: 'h2', type: 'text' },
      {
        key: 'row',
        label: 'Rows',
        selector: '.service',
        type: 'container',
        all: true,
        eachLabel: 'Row %n',
      },
    ],
  },
  {
    key: 'manifesto',
    label: 'Manifesto',
    selector: 'section.manifesto',
    children: [
      { key: 'title', label: 'Statement', selector: 'h2', type: 'text' },
      { key: 'body', label: 'Body', selector: 'p', type: 'text' },
    ],
  },
  {
    key: 'process',
    label: 'Process',
    selector: 'section.process',
    children: [
      { key: 'eyebrow', label: 'Eyebrow', selector: '.eyebrow', type: 'text' },
      {
        key: 'step',
        label: 'Steps',
        selector: '.process__step',
        type: 'container',
        all: true,
        eachLabel: 'Step %n',
      },
    ],
  },
  {
    key: 'about',
    label: 'About',
    selector: 'section.about',
    children: [
      { key: 'title', label: 'Heading', selector: 'h2', type: 'text' },
      {
        key: 'portrait',
        label: 'Portrait',
        selector: '.about__portrait-frame img:not(.about__portrait-alt)',
        type: 'image',
      },
    ],
  },
  {
    key: 'contact',
    label: 'Contact',
    selector: 'section.contact',
    children: [
      { key: 'title', label: 'Heading', selector: 'h2', type: 'text' },
      { key: 'lead', label: 'Lead', selector: 'p', type: 'text' },
    ],
  },
];

/**
 * Every other page, described by shape rather than by name.
 *
 * The table above is the home page, hand-written, because that is the page a
 * visitor is most likely to redesign and the one worth naming properly —
 * "Name", "Headline", "Button · See the work" read like a designer's own
 * layer list. Writing three more of those by hand would be three more things
 * to keep in step with the templates, and they would rot the first time a
 * section moved.
 *
 * So the rest of the site is adopted structurally: every `section` becomes a
 * group, and inside it the headings, the paragraphs, the pictures and the
 * buttons become layers. The labels come from the content itself. It is a
 * plainer tree than the home page's, and it is right for the same reason the
 * catalogue is right for the home page — it exposes the things somebody would
 * actually want to change, and nothing else.
 *
 * This is also the extension point the brief asks for: a new page needs no
 * code at all, and a page that deserves better names gets its own entry above.
 */
export const GENERIC: NodeSpec[] = [
  { key: 'h', label: 'Heading', selector: 'h1, h2', type: 'text', all: true, eachLabel: 'Heading %n' },
  { key: 'sub', label: 'Subheading', selector: 'h3, .eyebrow', type: 'text', all: true, eachLabel: 'Label %n' },
  { key: 'p', label: 'Text', selector: 'p', type: 'text', all: true, eachLabel: 'Text %n' },
  { key: 'img', label: 'Images', selector: 'img', type: 'image', all: true, eachLabel: 'Image %n' },
  { key: 'btn', label: 'Buttons', selector: '.btn', type: 'button', all: true, eachLabel: 'Button %n' },
];

/**
 * The most layers one generic section may contribute.
 *
 * A long page of body copy would otherwise produce a hundred `Text 87` rows,
 * which is the failure the catalogue exists to avoid — a tree nobody can read
 * is no more useful than no tree. Past this the section still renders in full
 * on the canvas; it simply stops offering every last paragraph as a layer.
 */
export const GENERIC_CAP = 14;

/** The hand-written catalogue for a path, or nothing if it has none. */
export function catalogueFor(path: string): SectionSpec[] | null {
  return path === '/' ? SECTIONS : null;
}

/**
 * Which properties each kind of thing is offered.
 *
 * The right panel renders from this and from nothing else, so a property that
 * is not listed here cannot appear — which is the rule the brief asks for and
 * the one that keeps the panel honest. Offering a font size on an image is how
 * an editor stops feeling real.
 */
export const PROPS_FOR: Record<ClubType, readonly string[]> = {
  /*
   * Text carries a width and not a height.
   *
   * A text layer's width is a real decision — it is where the lines break, and
   * it is the control a designer reaches for after changing a font size. Its
   * height is not: it is whatever the words came to, and offering a field that
   * fights the content is how a panel starts lying.
   */
  text: ['text', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'align', 'w', 'x', 'y', 'opacity', 'visible'],
  /*
   * A button is a frame, and a frame has one fill.
   *
   * It used to offer both `bg` and `color`, which put two swatches under Fill
   * and left the designer guessing which was the button — and it is not how
   * the tool this imitates works. In Figma a button is a frame with a text
   * layer inside it: the frame has a fill, the text has its own, and you reach
   * the text by double-clicking into the frame. So the label is adopted as a
   * child of type `text` (see `ensureLabel` in sandbox.ts) and carries the
   * typography and the text colour, and the button keeps only what a frame
   * has.
   */
  button: [
    'bg',
    'radius',
    'w',
    'h',
    'flow',
    'justify',
    'items',
    'gap',
    'padX',
    'padY',
    'x',
    'y',
    'opacity',
    'visible',
  ],
  image: ['src', 'w', 'h', 'fit', 'radius', 'opacity', 'x', 'y', 'visible'],
  surface: ['bg', 'radius', 'w', 'h', 'x', 'y', 'opacity', 'visible'],
  /*
   * The auto-layout keys are a ceiling here, not a promise.
   *
   * `PROPS_FOR` says what a *kind* of thing may ever be offered; whether a
   * particular frame gets flow, alignment and gap is decided from the element
   * itself, because they mean nothing on a frame that is not laid out that
   * way. A gap field on a `display: block` div is a control that does nothing,
   * which is the failure this table exists to prevent — so the panel narrows
   * this list per selection rather than widening it.
   */
  container: [
    'w',
    'h',
    'flow',
    'justify',
    'items',
    'gap',
    'padX',
    'padY',
    'bg',
    'radius',
    'x',
    'y',
    'opacity',
    'visible',
  ],
};
