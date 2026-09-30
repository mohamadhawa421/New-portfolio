/**
 * From an edit key on the page to the place in the draft it means.
 *
 * The page names content with keys like `page.home.heroTitle` or
 * `item.kanz.decisions.1.title` (see lib/edit.ts for the grammar). This file
 * is the one place that knows how each shape of key maps onto the draft's
 * tables, in both directions: `read` for painting the page, `write` for an
 * edit. Everything else in the Studio goes through here, so a key the Studio
 * does not understand fails in one obvious way instead of in several subtle
 * ones.
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

export type Kind = 'text' | 'image' | 'item';

export interface Target {
  kind: Kind;
  /** Short human label for the panel and the layer list. */
  label: string;
  read(d: Draft): any;
  write(d: Draft, value: any): void;
  /** For image targets: which media row, or null. */
  media?(d: Draft): Row | null;
}

const byOrder = (a: Row, b: Row) => a.sort_order - b.sort_order;

export const projectBySlug = (d: Draft, slug: string) => d.projects.find((p) => p.slug === slug);
export const blockOf = (d: Draft, slug: string, type: string) => {
  const p = projectBySlug(d, slug);
  return p ? d.blocks.find((b) => b.project_id === p.id && b.type === type) : undefined;
};
/** A list's visible entries in the order the page shows them. */
export const listRows = (d: Draft, key: string) =>
  d.lists.filter((l) => l.list_key === key && l.visible).sort(byOrder);

/** "heroTitle" → "Hero title", "metaDescription" → "Meta description". */
export const humanize = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()).replace(/ ([A-Z])/g, (_, c) => ` ${c.toLowerCase()}`);

const mediaById = (d: Draft, id: string | null | undefined) => (id ? d.media.find((m) => m.id === id) ?? null : null);

function fail(key: string): never {
  throw new Error(`Studio: no draft location for key "${key}"`);
}

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
      write: (d, v) => {
        d.settings.fields[f] = v;
      },
    };
  }

  if (head === 'page' && parts.length === 3) {
    const [, page, f] = parts;
    const row = (d: Draft) => d.pages.find((p) => p.key === page) ?? fail(key);
    return {
      kind: 'text',
      label: humanize(f),
      read: (d) => row(d).fields[f],
      write: (d, v) => {
        row(d).fields[f] = v;
      },
    };
  }

  if (head === 'project' && parts.length === 2) {
    const slug = parts[1];
    return {
      kind: 'item',
      label: 'Project',
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
      read: (d) => row(d)[col],
      write: (d, v) => {
        row(d)[col] = v;
      },
    };
  }

  if (head === 'block' && parts.length === 4) {
    const [, slug, type, f] = parts;
    const row = (d: Draft) => blockOf(d, slug, type) ?? fail(key);
    return {
      kind: 'text',
      label: `${humanize(type)} · ${humanize(f).toLowerCase()}`,
      read: (d) => row(d).content[f],
      write: (d, v) => {
        row(d).content = { ...row(d).content, [f]: v };
      },
    };
  }

  if (head === 'item' && parts.length === 5) {
    const [, slug, type, iStr, f] = parts;
    const i = Number(iStr);
    const row = (d: Draft) => blockOf(d, slug, type) ?? fail(key);
    return {
      kind: 'text',
      label: `${humanize(type)} ${i + 1} · ${humanize(f).toLowerCase()}`,
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
      label: `${humanize(list.split('.').pop()!)} ${i + 1} · ${humanize(f).toLowerCase()}`,
      read: (d) => row(d).content[f],
      write: (d, v) => {
        row(d).content = { ...row(d).content, [f]: v };
      },
    };
  }

  return fail(key);
}

function imageTarget(key: string, inner: string[]): Target {
  const [head] = inner;
  let get: (d: Draft) => string | null;
  let set: (d: Draft, id: string | null) => void;
  let label = 'Image';

  if (head === 'settings' && inner.length === 2) {
    const f = inner[1];
    label = humanize(f);
    get = (d) => d.settings.fields[f] ?? null;
    set = (d, id) => {
      d.settings.fields[f] = id;
    };
  } else if (head === 'project' && inner.length === 3 && inner[2] === 'cover') {
    const slug = inner[1];
    label = 'Cover';
    get = (d) => projectBySlug(d, slug)?.cover_media_id ?? null;
    set = (d, id) => {
      (projectBySlug(d, slug) ?? fail(key)).cover_media_id = id;
    };
  } else if (head === 'block' && inner.length === 4 && inner[2] === 'approach') {
    const slug = inner[1];
    label = 'Opening image';
    get = (d) => blockOf(d, slug, 'approach')?.content.image ?? null;
    set = (d, id) => {
      const b = blockOf(d, slug, 'approach') ?? fail(key);
      b.content = { ...b.content, image: id };
    };
  } else if (head === 'block' && inner.length === 4 && inner[2] === 'gallery') {
    const slug = inner[1];
    const i = Number(inner[3]);
    label = `Gallery image ${i + 1}`;
    get = (d) => blockOf(d, slug, 'gallery')?.content.images?.[i] ?? null;
    set = (d, id) => {
      const b = blockOf(d, slug, 'gallery') ?? fail(key);
      const images = [...(b.content.images ?? [])];
      images[i] = id;
      b.content = { ...b.content, images };
    };
  } else {
    return fail(key);
  }

  return {
    kind: 'image',
    label,
    read: get,
    write: set,
    media: (d) => mediaById(d, get(d)),
  };
}

/* ------------------------------------------------------------------ */
/* What changed, row by row — for autosave and for the publish summary */
/* ------------------------------------------------------------------ */

export const TABLES: Array<{ name: keyof Draft; table: string; pk: string; columns: string[] }> = [
  { name: 'pages', table: 'pages', pk: 'key', columns: ['fields', 'seo'] },
  { name: 'projects', table: 'projects', pk: 'id', columns: ['title', 'summary', 'discipline', 'role', 'slug', 'sort_order', 'selected_order', 'featured', 'visible', 'cover_media_id', 'chip', 'fields', 'seo', 'template'] },
  { name: 'tags', table: 'project_tags', pk: 'id', columns: ['label', 'sort_order'] },
  { name: 'blocks', table: 'blocks', pk: 'id', columns: ['content', 'settings', 'sort_order', 'visible'] },
  { name: 'lists', table: 'lists', pk: 'id', columns: ['content', 'sort_order', 'visible'] },
  { name: 'media', table: 'media', pk: 'id', columns: ['alt', 'focus'] },
];

export interface Change {
  table: string;
  key: string | boolean;
  patch: Row;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The row patches that turn `from` into `to`. Only rows present in both. */
export function changes(from: Draft, to: Draft): Change[] {
  const out: Change[] = [];
  const s = (['fields', 'seo'] as const).filter((c) => !same(from.settings[c], to.settings[c]));
  if (s.length) out.push({ table: 'settings', key: true, patch: Object.fromEntries(s.map((c) => [c, to.settings[c]])) });

  for (const t of TABLES) {
    const before = new Map((from[t.name] as Row[]).map((r) => [r[t.pk], r]));
    for (const row of to[t.name] as Row[]) {
      const old = before.get(row[t.pk]);
      if (!old) continue;
      const cols = t.columns.filter((c) => c in row && !same(old[c], row[c]));
      if (cols.length) out.push({ table: t.table, key: row[t.pk], patch: Object.fromEntries(cols.map((c) => [c, row[c]])) });
    }
  }
  return out;
}
