/**
 * The portfolio's content, both ways.
 *
 *   toRows(content)    content.json (the shape the pages read) → Supabase rows
 *   fromRows(snapshot) a release snapshot → content.json
 *
 * One file, so the two directions cannot drift: the migration writes with
 * `toRows`, the build reads with `fromRows`, and the round-trip test proves
 * `fromRows(toRows(x))` is `x` for the real content. Nothing in apps/web's
 * pages changes, because the pages keep reading the same content.json.
 *
 * What is *not* carried: Strapi's numeric ids, and three media fields —
 * `name`, `caption`, `focalPoint` — that no page reads (source.ts `toMedia`
 * takes url, alternativeText, width and height, and nothing else). The
 * round-trip test compares with those stripped, and the built HTML is compared
 * byte for byte on top, so "not carried" is checked rather than assumed.
 *
 * Ids are derived, not random: the same content always produces the same
 * uuids, so running the migration twice is a no-op rather than a duplicate.
 */

import crypto from 'node:crypto';

/** A stable uuid for a name — sha1-based, RFC 4122 shaped (version 5 bits). */
export function uuidFor(name) {
  const h = crypto.createHash('sha1').update(`mohamadhawa.portfolio:${name}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

/** Storage object name for a file the site serves at /media/<basename>. */
export const legacyPath = (url) => `legacy/${url.replace(/^\/media\//, '')}`;
/** And back: every object is served under /media by its basename. */
export const mediaUrl = (path) => `/media/${path.split('/').pop()}`;

const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4' };
export const mimeOf = (file) => MIME[file.split('.').pop().toLowerCase()] ?? 'application/octet-stream';

const omit = (obj, keys) => Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !keys.includes(k)));

/* ------------------------------------------------------------------ */
/* content.json → rows                                                 */
/* ------------------------------------------------------------------ */

/**
 * @param content  the parsed content.json
 * @param describe (url) => { bytes, sha256 } for the file behind a media url
 */
export function toRows(content, describe) {
  const media = new Map();
  const ref = (m) => {
    if (!m?.url) return null;
    const id = uuidFor(`media:${m.url}`);
    if (!media.has(m.url)) {
      const file = describe(m.url);
      media.set(m.url, {
        id,
        path: legacyPath(m.url),
        mime: mimeOf(m.url),
        bytes: file.bytes,
        width: m.width ?? null,
        height: m.height ?? null,
        alt: m.alternativeText ?? '',
        focus: null,
        sha256: file.sha256,
      });
    }
    return id;
  };
  const seo = (s) => (s ? { metaTitle: s.metaTitle ?? null, metaDescription: s.metaDescription ?? null, shareImage: ref(s.shareImage) } : {});

  const s = content.siteSetting;
  const settings = {
    fields: {
      ...omit(s, ['id', 'seo', 'portrait', 'logoMark', 'logoFull']),
      portrait: ref(s.portrait),
      logoMark: ref(s.logoMark),
      logoFull: ref(s.logoFull),
    },
    seo: seo(s.seo),
  };

  const lists = [];
  const list = (key, items) =>
    (items ?? []).forEach((item, i) =>
      lists.push({ id: uuidFor(`list:${key}:${i}`), list_key: key, sort_order: i, visible: true, content: omit(item, ['id']) })
    );

  const page = (key, obj, listKeys) => {
    for (const [field, listKey] of Object.entries(listKeys)) list(listKey, obj[field]);
    return { key, fields: omit(obj, ['id', 'seo', ...Object.keys(listKeys)]), seo: seo(obj.seo) };
  };

  const pages = [
    page('home', content.homePage, { stats: 'home.stats' }),
    page('work', content.workPage, {}),
    page('about', content.aboutPage, { stats: 'about.stats', experience: 'about.experience', skills: 'about.skills' }),
    page('contact', content.contactPage, { budgetOptions: 'contact.budget' }),
  ];
  list('services', content.services);
  list('process', content.processSteps);

  const projects = [];
  const tags = [];
  const blocks = [];
  (content.projects ?? []).forEach((p, i) => {
    const id = uuidFor(`project:${p.slug}`);
    projects.push({
      id,
      kind: 'case',
      slug: p.slug,
      title: p.title,
      summary: p.summary ?? '',
      discipline: p.discipline ?? '',
      role: p.role ?? '',
      template: 'classic',
      sort_order: i,
      selected_order: null,
      featured: Boolean(p.featured),
      visible: true,
      cover_media_id: ref(p.cover),
      chip: { bg: p.chipBg ?? null, ink: p.chipInk ?? null },
      fields: {},
      seo: seo(p.seo),
    });
    (p.categories ?? []).forEach((c, j) =>
      tags.push({ id: uuidFor(`tag:${p.slug}:${j}`), project_id: id, label: c.label, sort_order: j })
    );
    const block = (type, content) =>
      blocks.push({ id: uuidFor(`block:${p.slug}:${type}`), project_id: id, type, sort_order: blocks.filter((b) => b.project_id === id).length, visible: true, content, settings: {} });
    const items = (xs) => (xs ?? []).map((x) => omit(x, ['id']));

    block('brief', { lead: p.briefLead, body: p.briefBody });
    block('problem', { lead: p.problemLead, items: items(p.constraints) });
    block('approach', { lead: p.approachLead, body: p.approachBody, image: ref(p.approachShot), caption: p.approachCaption });
    block('decisions', { items: items(p.decisions) });
    block('gallery', { heading: p.shippedHeading, images: (p.gallery ?? []).map(ref) });
    block('metrics', { items: items(p.metrics) });
    block('reflection', { lead: p.reflectionLead, body: p.reflectionBody });
  });

  return { settings, pages, media: [...media.values()], projects, tags, blocks, lists, styles: [] };
}

/* ------------------------------------------------------------------ */
/* snapshot → content.json                                             */
/* ------------------------------------------------------------------ */

export function fromRows(snap, { generatedAt = null } = {}) {
  const mediaById = new Map((snap.media ?? []).map((m) => [m.id, m]));
  const media = (id) => {
    const m = id ? mediaById.get(id) : null;
    return m ? { alternativeText: m.alt, width: m.width, height: m.height, url: mediaUrl(m.path) } : null;
  };
  const seo = (s) => ({ metaTitle: s?.metaTitle ?? null, metaDescription: s?.metaDescription ?? null, shareImage: media(s?.shareImage) });
  const byOrder = (a, b) => a.sort_order - b.sort_order;
  // Position is the order. A list item that carries an `order` of its own
  // (services, process, experience — content.ts sorts on it) gets its index,
  // so reordering in the Studio is moving a row and nothing else.
  const listOf = (key) =>
    (snap.lists ?? [])
      .filter((l) => l.list_key === key && l.visible)
      .sort(byOrder)
      .map((l, i) => ('order' in l.content ? { ...l.content, order: i } : l.content));
  const pageOf = (key) => (snap.pages ?? []).find((p) => p.key === key) ?? { fields: {}, seo: {} };

  const sf = snap.settings?.fields ?? {};
  const siteSetting = {
    ...omit(sf, ['portrait', 'logoMark', 'logoFull']),
    portrait: media(sf.portrait),
    logoMark: media(sf.logoMark),
    logoFull: media(sf.logoFull),
    seo: seo(snap.settings?.seo),
  };

  const home = pageOf('home');
  const work = pageOf('work');
  const about = pageOf('about');
  const contact = pageOf('contact');

  const blocksOf = (id) => (snap.blocks ?? []).filter((b) => b.project_id === id && b.visible).sort(byOrder);

  const projects = (snap.projects ?? [])
    .filter((p) => p.kind === 'case' && p.visible)
    .sort(byOrder)
    .map((p, i) => {
      const b = Object.fromEntries(blocksOf(p.id).map((x) => [x.type, x.content]));
      return {
        title: p.title,
        slug: p.slug,
        discipline: p.discipline,
        summary: p.summary,
        role: p.role,
        order: i,
        featured: p.featured,
        chipBg: p.chip?.bg ?? null,
        chipInk: p.chip?.ink ?? null,
        briefLead: b.brief?.lead ?? null,
        briefBody: b.brief?.body ?? null,
        problemLead: b.problem?.lead ?? null,
        approachLead: b.approach?.lead ?? null,
        approachBody: b.approach?.body ?? null,
        approachCaption: b.approach?.caption ?? null,
        shippedHeading: b.gallery?.heading ?? null,
        reflectionLead: b.reflection?.lead ?? null,
        reflectionBody: b.reflection?.body ?? null,
        categories: (snap.tags ?? []).filter((t) => t.project_id === p.id).sort(byOrder).map((t) => ({ label: t.label })),
        cover: media(p.cover_media_id),
        approachShot: media(b.approach?.image),
        gallery: (b.gallery?.images ?? []).map(media).filter(Boolean),
        constraints: b.problem?.items ?? [],
        decisions: b.decisions?.items ?? [],
        metrics: b.metrics?.items ?? [],
        seo: seo(p.seo),
      };
    });

  return {
    generatedAt,
    siteSetting,
    homePage: { ...home.fields, stats: listOf('home.stats'), seo: seo(home.seo) },
    workPage: { ...work.fields, seo: seo(work.seo) },
    aboutPage: {
      ...about.fields,
      stats: listOf('about.stats'),
      experience: listOf('about.experience'),
      skills: listOf('about.skills'),
      seo: seo(about.seo),
    },
    contactPage: { ...contact.fields, budgetOptions: listOf('contact.budget'), seo: seo(contact.seo) },
    services: listOf('services'),
    processSteps: listOf('process'),
    projects,
  };
}

/**
 * The comparison the round-trip is held to: content.json with the fields no
 * page reads taken out, and object keys in a fixed order so key order is not
 * mistaken for a difference.
 */
export function comparable(content) {
  const DROP = new Set(['id', 'name', 'caption', 'focalPoint', 'generatedAt']);
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v).filter((k) => !DROP.has(k)).sort().map((k) => [k, walk(v[k])])
      );
    }
    return v;
  };
  return walk(content);
}
