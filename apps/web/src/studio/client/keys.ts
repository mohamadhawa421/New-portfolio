/**
 * From an edit key on the page to the place in the draft it means.
 *
 * The page names content with keys like `page.home.heroTitle` or
 * `item.kanz.decisions.1.title` (see lib/edit.ts for the grammar). This file
 * is the one place that knows how each shape of key maps onto the draft's
 * tables — for reading, for writing, and for the structural things a key
 * implies (a list entry can be moved or removed; a section can be hidden).
 * Everything else in the Studio goes through here, so a key the Studio does
 * not understand fails in one obvious way instead of several subtle ones.
 */

export interface Row {
  [column: string]: any;
}

export interface Draft {
  settings: { fields: Row; seo: Row };
  pages: Row[];
  media: Row[];
  projects: Row[];
  tags: Row[];
  blocks: Row[];
  lists: Row[];
  styles: Row[];
}

export type Kind = 'text' | 'image' | 'project' | 'section';

/** A position in an ordered collection that the toolbar can act on. */
export interface Entry {
  /** e.g. "Service", "Decision" — for labels and confirmations. */
  noun: string;
  index: number;
  count(d: Draft): number;
  move(d: Draft, to: number): void;
  remove(d: Draft): void;
  duplicate(d: Draft): void;
  /** A new, empty entry right after this one. */
  add(d: Draft): void;
}

export interface Target {
  kind: Kind;
  /** Short human label for chips, layers and the inspector. */
  label: string;
  read(d: Draft): any;
  write(d: Draft, value: any): void;
  /** Image targets: the media row. */
  media?(d: Draft): Row | null;
  /** Text inside a list entry: the entry, so it can be moved or removed. */
  entry?: Entry;
  /** Which project this belongs to, when it belongs to one. */
  slug?: string;
  /** Section targets: the block row. */
  block?(d: Draft): Row | undefined;
  /** Multi-line text wants Shift+Enter for a new line, not Enter to finish. */
  multiline?: boolean;
}

const byOrder = (a: Row, b: Row) => a.sort_order - b.sort_order;

export const uuid = () => crypto.randomUUID();

export const projectBySlug = (d: Draft, slug: string) => d.projects.find((p) => p.slug === slug);
export const blockById = (d: Draft, id: string) => d.blocks.find((b) => b.id === id);
export const blockOf = (d: Draft, slug: string, type: string) => {
  const p = projectBySlug(d, slug);
  return p ? d.blocks.find((b) => b.project_id === p.id && b.type === type) : undefined;
};
/** A list's visible entries in the order the page shows them. */
export const listRows = (d: Draft, key: string) => d.lists.filter((l) => l.list_key === key && l.visible).sort(byOrder);
export const projectBlocks = (d: Draft, projectId: string) => d.blocks.filter((b) => b.project_id === projectId).sort(byOrder);

/** "heroTitle" → "Hero title". */
export const humanize = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

const mediaById = (d: Draft, id: string | null | undefined) => (id ? d.media.find((m) => m.id === id) ?? null : null);

export const SECTION_NAMES: Record<string, string> = {
  brief: 'The brief',
  problem: 'The problem',
  approach: 'The approach',
  decisions: 'Decisions',
  gallery: 'What shipped',
  metrics: 'Results',
  reflection: 'Looking back',
  text: 'Text',
  image: 'Image',
  quote: 'Quote',
  'two-column': 'Two columns',
};

/** What a new, empty entry of each list looks like. */
const BLANK: Record<string, Row> = {
  services: { title: 'New service', description: '', ctaLabel: 'Start here', order: 0 },
  process: { title: 'New step', description: '', order: 0 },
  'home.stats': { value: '0', label: 'New stat', animate: false },
  'about.stats': { value: '0', label: 'New stat', animate: false },
  'about.experience': { role: 'Role', organisation: 'Company', period: 'Year — now', order: 0 },
  'about.skills': { label: 'New skill' },
  'contact.budget': { label: 'New option' },
  problem: { title: 'A new constraint', body: '' },
  decisions: { eyebrow: 'Decision', title: 'A new decision', body: '' },
  metrics: { value: '0', label: 'What it measured', animate: false },
};
const NOUN: Record<string, string> = {
  services: 'Service',
  process: 'Step',
  'home.stats': 'Stat',
  'about.stats': 'Stat',
  'about.experience': 'Role',
  'about.skills': 'Skill',
  'contact.budget': 'Budget option',
  problem: 'Constraint',
  decisions: 'Decision',
  metrics: 'Result',
};

function listEntry(list: string, i: number): Entry {
  const rows = (d: Draft) => listRows(d, list);
  const renumber = (xs: Row[]) => xs.forEach((r, k) => (r.sort_order = k));
  return {
    noun: NOUN[list] ?? 'Item',
    index: i,
    count: (d) => rows(d).length,
    move: (d, to) => {
      const xs = rows(d);
      const [r] = xs.splice(i, 1);
      xs.splice(Math.max(0, Math.min(xs.length, to)), 0, r);
      renumber(xs);
    },
    remove: (d) => {
      const r = rows(d)[i];
      d.lists = d.lists.filter((x) => x !== r);
      renumber(rows(d));
    },
    duplicate: (d) => {
      const xs = rows(d);
      xs.splice(i + 1, 0, { id: uuid(), list_key: list, visible: true, sort_order: 0, content: structuredClone(xs[i].content) });
      d.lists.push(xs[i + 1]);
      renumber(xs);
    },
    add: (d) => {
      const xs = rows(d);
      const row = { id: uuid(), list_key: list, visible: true, sort_order: 0, content: structuredClone(BLANK[list] ?? { label: 'New' }) };
      d.lists.push(row);
      xs.splice(i + 1, 0, row);
      renumber(xs);
    },
  };
}

function itemEntry(slug: string, type: string, i: number): Entry {
  const block = (d: Draft) => blockOf(d, slug, type) ?? fail(`item.${slug}.${type}`);
  const set = (d: Draft, fn: (xs: Row[]) => void) => {
    const b = block(d);
    const xs = [...(b.content.items ?? [])];
    fn(xs);
    b.content = { ...b.content, items: xs };
  };
  return {
    noun: NOUN[type] ?? 'Item',
    index: i,
    count: (d) => block(d).content.items?.length ?? 0,
    move: (d, to) => set(d, (xs) => xs.splice(Math.max(0, Math.min(xs.length, to)), 0, ...xs.splice(i, 1))),
    remove: (d) => set(d, (xs) => xs.splice(i, 1)),
    duplicate: (d) => set(d, (xs) => xs.splice(i + 1, 0, structuredClone(xs[i]))),
    add: (d) => set(d, (xs) => xs.splice(i + 1, 0, structuredClone(BLANK[type] ?? { title: 'New' }))),
  };
}

function fail(key: string): never {
  throw new Error(`Studio: no draft location for key "${key}"`);
}

const LONG = /(body|intro|description|summary|lead|quote|left|right|bodyPrimary|bodySecondary)$/i;

export function target(key: string): Target {
  const parts = key.split('.');
  const [head] = parts;

  if (head === 'image') return imageTarget(key, parts.slice(1));

  if (head === 'settings' && parts.length === 2) {
    const f = parts[1];
    return {
      kind: 'text',
      label: humanize(f),
      read: (d) => d.settings.fields[f],
      write: (d, v) => void (d.settings.fields[f] = v),
    };
  }

  if (head === 'page' && parts.length === 3) {
    const [, page, f] = parts;
    const row = (d: Draft) => d.pages.find((p) => p.key === page) ?? fail(key);
    return {
      kind: 'text',
      label: humanize(f),
      multiline: LONG.test(f),
      read: (d) => row(d).fields[f],
      write: (d, v) => void (row(d).fields[f] = v),
    };
  }

  if (head === 'project' && parts.length === 2) {
    const slug = parts[1];
    return {
      kind: 'project',
      label: 'Project',
      slug,
      read: (d) => projectBySlug(d, slug),
      write: () => fail(key),
    };
  }

  if (head === 'project' && parts.length === 3) {
    const [, slug, col] = parts;
    const row = (d: Draft) => projectBySlug(d, slug) ?? fail(key);
    return {
      kind: 'text',
      label: humanize(col),
      slug,
      multiline: col === 'summary',
      read: (d) => row(d)[col],
      write: (d, v) => void (row(d)[col] = v),
    };
  }

  // A classic case-study section: section.<slug>.<type>
  if (head === 'section' && parts.length === 3) {
    const [, slug, type] = parts;
    return {
      kind: 'section',
      label: SECTION_NAMES[type] ?? humanize(type),
      slug,
      read: (d) => blockOf(d, slug, type),
      write: () => fail(key),
      block: (d) => blockOf(d, slug, type),
    };
  }

  // A section added in the Studio: xsection.<blockId>
  if (head === 'xsection' && parts.length === 2) {
    const id = parts[1];
    return {
      kind: 'section',
      label: 'Added section',
      read: (d) => blockById(d, id),
      write: () => fail(key),
      block: (d) => blockById(d, id),
    };
  }

  if (head === 'xblock' && parts.length === 3) {
    const [, id, f] = parts;
    const row = (d: Draft) => blockById(d, id) ?? fail(key);
    return {
      kind: 'text',
      label: humanize(f),
      multiline: LONG.test(f),
      read: (d) => row(d).content[f],
      write: (d, v) => void (row(d).content = { ...row(d).content, [f]: v }),
    };
  }

  if (head === 'block' && parts.length === 4) {
    const [, slug, type, f] = parts;
    const row = (d: Draft) => blockOf(d, slug, type) ?? fail(key);
    return {
      kind: 'text',
      label: `${SECTION_NAMES[type] ?? humanize(type)} · ${humanize(f).toLowerCase()}`,
      slug,
      multiline: LONG.test(f),
      read: (d) => row(d).content[f],
      write: (d, v) => void (row(d).content = { ...row(d).content, [f]: v }),
    };
  }

  if (head === 'item' && parts.length === 5) {
    const [, slug, type, iStr, f] = parts;
    const i = Number(iStr);
    const row = (d: Draft) => blockOf(d, slug, type) ?? fail(key);
    return {
      kind: 'text',
      label: `${NOUN[type] ?? 'Item'} ${i + 1} · ${humanize(f).toLowerCase()}`,
      slug,
      multiline: LONG.test(f),
      entry: itemEntry(slug, type, i),
      read: (d) => row(d).content.items?.[i]?.[f],
      write: (d, v) => {
        const items = [...(row(d).content.items ?? [])];
        items[i] = { ...items[i], [f]: v };
        row(d).content = { ...row(d).content, items };
      },
    };
  }

  // list.<list key, which may itself contain dots>.<index>.<field>
  if (head === 'list' && parts.length >= 4) {
    const f = parts[parts.length - 1];
    const i = Number(parts[parts.length - 2]);
    const list = parts.slice(1, -2).join('.');
    const row = (d: Draft) => listRows(d, list)[i] ?? fail(key);
    return {
      kind: 'text',
      label: `${NOUN[list] ?? 'Item'} ${i + 1} · ${humanize(f).toLowerCase()}`,
      multiline: LONG.test(f),
      entry: listEntry(list, i),
      read: (d) => row(d).content[f],
      write: (d, v) => void (row(d).content = { ...row(d).content, [f]: v }),
    };
  }

  return fail(key);
}

function imageTarget(key: string, inner: string[]): Target {
  const [head] = inner;
  let get: (d: Draft) => string | null;
  let set: (d: Draft, id: string | null) => void;
  let label = 'Image';
  let slug: string | undefined;

  if (head === 'settings' && inner.length === 2) {
    const f = inner[1];
    label = humanize(f);
    get = (d) => d.settings.fields[f] ?? null;
    set = (d, id) => void (d.settings.fields[f] = id);
  } else if (head === 'project' && inner.length === 3 && inner[2] === 'cover') {
    slug = inner[1];
    label = 'Cover';
    get = (d) => projectBySlug(d, slug!)?.cover_media_id ?? null;
    set = (d, id) => void ((projectBySlug(d, slug!) ?? fail(key)).cover_media_id = id);
  } else if (head === 'block' && inner.length === 4 && inner[2] === 'approach') {
    slug = inner[1];
    label = 'Opening image';
    get = (d) => blockOf(d, slug!, 'approach')?.content.image ?? null;
    set = (d, id) => {
      const b = blockOf(d, slug!, 'approach') ?? fail(key);
      b.content = { ...b.content, image: id };
    };
  } else if (head === 'block' && inner.length === 4 && inner[2] === 'gallery') {
    slug = inner[1];
    const i = Number(inner[3]);
    label = `Gallery image ${i + 1}`;
    get = (d) => blockOf(d, slug!, 'gallery')?.content.images?.[i] ?? null;
    set = (d, id) => {
      const b = blockOf(d, slug!, 'gallery') ?? fail(key);
      const images = [...(b.content.images ?? [])];
      if (id) images[i] = id;
      else images.splice(i, 1);
      b.content = { ...b.content, images };
    };
  } else if (head === 'xblock' && inner.length === 2) {
    const id = inner[1];
    label = 'Image';
    get = (d) => blockById(d, id)?.content.image ?? null;
    set = (d, v) => {
      const b = blockById(d, id) ?? fail(key);
      b.content = { ...b.content, image: v };
    };
  } else {
    return fail(key);
  }

  return { kind: 'image', label, slug, read: get, write: set, media: (d) => mediaById(d, get(d)) };
}

/* ------------------------------------------------------------------ */
/* New things                                                          */
/* ------------------------------------------------------------------ */

export const TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic case study',
    description: 'Brief, problem, approach, decisions, what shipped, results, reflection.',
    visible: ['brief', 'problem', 'approach', 'decisions', 'gallery', 'metrics', 'reflection'],
  },
  {
    id: 'image-led',
    name: 'Image-led',
    description: 'A short brief, then the screens do the talking.',
    visible: ['brief', 'gallery', 'reflection'],
  },
  {
    id: 'feature',
    name: 'Feature exploration',
    description: 'The problem, the decisions that answered it, and what they did.',
    visible: ['brief', 'problem', 'decisions', 'metrics', 'reflection'],
  },
  {
    id: 'custom',
    name: 'Start blank',
    description: 'Just a brief. Add the sections you need.',
    visible: ['brief'],
  },
] as const;

const CLASSIC = ['brief', 'problem', 'approach', 'decisions', 'gallery', 'metrics', 'reflection'];

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** A new case study, with every classic section created and the template's shown. */
export function newProject(
  d: Draft,
  input: { title: string; slug: string; summary: string; discipline: string; template: string; coverId: string | null; tags: string[] }
): Row {
  const t = TEMPLATES.find((x) => x.id === input.template) ?? TEMPLATES[0];
  const cases = d.projects.filter((p) => p.kind === 'case');
  const project: Row = {
    id: uuid(),
    kind: 'case',
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    discipline: input.discipline,
    role: 'UI / UX Design',
    template: t.id === 'custom' ? 'custom' : t.id === 'image-led' ? 'image-led' : t.id === 'feature' ? 'feature' : 'classic',
    sort_order: 0,
    selected_order: null,
    featured: false,
    visible: true,
    cover_media_id: input.coverId,
    chip: { bg: '#efeff1', ink: '#86868b' },
    fields: {},
    seo: { metaTitle: `${input.title} — Mohamad Hawa`, metaDescription: input.summary, shareImage: null },
  };
  // New work goes first: that is where a visitor looks.
  for (const p of cases) p.sort_order += 1;
  d.projects.push(project);
  CLASSIC.forEach((type, i) => {
    d.blocks.push({
      id: uuid(),
      project_id: project.id,
      type,
      sort_order: i,
      visible: (t.visible as readonly string[]).includes(type),
      content: type === 'gallery' ? { heading: 'The screens that carry the work.', images: [] } : ['problem', 'decisions', 'metrics'].includes(type) ? { lead: '', items: [] } : { lead: '', body: '' },
      settings: {},
    });
  });
  input.tags.forEach((label, i) => d.tags.push({ id: uuid(), project_id: project.id, label, sort_order: i }));
  return project;
}

/** Deleting a project takes its sections and tags with it (the database cascades too). */
export function deleteProject(d: Draft, id: string) {
  d.projects = d.projects.filter((p) => p.id !== id);
  d.blocks = d.blocks.filter((b) => b.project_id !== id);
  d.tags = d.tags.filter((t) => t.project_id !== id);
  d.projects.filter((p) => p.kind === 'case').sort(byOrder).forEach((p, i) => (p.sort_order = i));
}

export function moveProject(d: Draft, id: string, dir: -1 | 1) {
  const list = d.projects.filter((p) => p.kind === 'case').sort(byOrder);
  const i = list.findIndex((p) => p.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((p, k) => (p.sort_order = k));
  return true;
}

export const EXTRA_BLANK: Record<string, Row> = {
  text: { heading: 'A heading', body: '' },
  image: { image: null, caption: '' },
  quote: { quote: '', cite: 'Who said it' },
  'two-column': { heading: 'One side', left: '', cite: 'The other', right: '' },
};

/** A Studio section after `afterBlockId` (or at the end), in this project. */
export function addSection(d: Draft, projectId: string, type: string, afterBlockId: string | null): Row {
  const blocks = projectBlocks(d, projectId);
  const at = afterBlockId ? blocks.findIndex((b) => b.id === afterBlockId) + 1 : blocks.length;
  const row: Row = { id: uuid(), project_id: projectId, type, sort_order: 0, visible: true, content: structuredClone(EXTRA_BLANK[type]), settings: {} };
  blocks.splice(at, 0, row);
  blocks.forEach((b, i) => (b.sort_order = i));
  d.blocks.push(row);
  return row;
}

export function moveSection(d: Draft, blockId: string, dir: -1 | 1) {
  const b = blockById(d, blockId);
  if (!b) return false;
  // Only Studio sections move among themselves; the case study's own keep
  // their places, because the page lays them out in a fixed arc.
  const extra = projectBlocks(d, b.project_id).filter((x) => x.type in EXTRA_BLANK);
  const i = extra.indexOf(b);
  const j = i + dir;
  if (j < 0 || j >= extra.length) return false;
  const [a, c] = [extra[i].sort_order, extra[j].sort_order];
  extra[i].sort_order = c;
  extra[j].sort_order = a;
  return true;
}

/* ------------------------------------------------------------------ */
/* What changed — for autosave and for the publish summary             */
/* ------------------------------------------------------------------ */

export const TABLES: Array<{ name: keyof Draft; table: string; pk: string; columns: string[]; insert?: string[] }> = [
  { name: 'pages', table: 'pages', pk: 'key', columns: ['fields', 'seo'] },
  {
    name: 'projects',
    table: 'projects',
    pk: 'id',
    columns: ['title', 'summary', 'discipline', 'role', 'slug', 'sort_order', 'selected_order', 'featured', 'visible', 'cover_media_id', 'chip', 'fields', 'seo', 'template'],
    insert: ['id', 'kind', 'slug', 'title', 'summary', 'discipline', 'role', 'template', 'sort_order', 'selected_order', 'featured', 'visible', 'cover_media_id', 'chip', 'fields', 'seo'],
  },
  { name: 'tags', table: 'project_tags', pk: 'id', columns: ['label', 'sort_order'], insert: ['id', 'project_id', 'label', 'sort_order'] },
  { name: 'blocks', table: 'blocks', pk: 'id', columns: ['content', 'settings', 'sort_order', 'visible'], insert: ['id', 'project_id', 'type', 'sort_order', 'visible', 'content', 'settings'] },
  { name: 'lists', table: 'lists', pk: 'id', columns: ['content', 'sort_order', 'visible'], insert: ['id', 'list_key', 'sort_order', 'visible', 'content'] },
  { name: 'media', table: 'media', pk: 'id', columns: ['alt', 'focus'] },
];

export interface Diff {
  inserts: { table: string; row: Row }[];
  changes: { table: string; key: string | boolean; patch: Row }[];
  deletes: { table: string; key: string }[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Everything that turns `from` into `to`. */
export function diff(from: Draft, to: Draft): Diff {
  const out: Diff = { inserts: [], changes: [], deletes: [] };
  const s = (['fields', 'seo'] as const).filter((c) => !same(from.settings[c], to.settings[c]));
  if (s.length) out.changes.push({ table: 'settings', key: true, patch: Object.fromEntries(s.map((c) => [c, to.settings[c]])) });

  for (const t of TABLES) {
    const before = new Map((from[t.name] as Row[]).map((r) => [r[t.pk], r]));
    const after = new Set((to[t.name] as Row[]).map((r) => r[t.pk]));
    for (const row of to[t.name] as Row[]) {
      const old = before.get(row[t.pk]);
      if (!old) {
        if (t.insert) out.inserts.push({ table: t.table, row: Object.fromEntries(t.insert.map((c) => [c, row[c] ?? null])) });
        continue;
      }
      const cols = t.columns.filter((c) => c in row && !same(old[c], row[c]));
      if (cols.length) out.changes.push({ table: t.table, key: row[t.pk], patch: Object.fromEntries(cols.map((c) => [c, row[c]])) });
    }
    if (t.insert) for (const [k] of before) if (!after.has(k)) out.deletes.push({ table: t.table, key: k });
  }
  return out;
}

export const isEmptyDiff = (x: Diff) => !x.inserts.length && !x.changes.length && !x.deletes.length;
