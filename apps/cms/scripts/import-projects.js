'use strict';

/**
 * Creates or updates projects from a JSON file, uploading their images.
 *
 *   node scripts/import-projects.js --data scripts/new-projects.json --images <dir>
 *   node scripts/import-projects.js ... --push-existing-back
 *
 * Matches on `slug`: an existing project is updated in place, a new slug is
 * created. `--push-existing-back` renumbers every project *not* in the data file
 * so it sorts after the imported ones, which is how you put new work first
 * without editing the old entries by hand.
 *
 * Run with Strapi stopped.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { ensureWorkingDatabase } = require('./db');
/*
 * Strapi refuses to boot without app keys, and this script never asked for
 * them — it predates build-env.js, so it worked only in a shell that happened
 * to have the environment already set and failed with a middleware error
 * anywhere else. The other maintenance scripts all call this first.
 */
const { ensureBuildEnv } = require('./build-env');

// knex aborts queued pool operations while shutting down, which surfaces as an
// unhandled 'aborted' rejection *after* every write has committed. Ignore that
// one; anything else still crashes the script.
const ignoreKnexTeardown = (error) => {
  if (error instanceof Error && error.message === 'aborted') return;
  throw error;
};
process.on('unhandledRejection', ignoreKnexTeardown);
process.on('uncaughtException', ignoreKnexTeardown);

/**
 * A meta description that ends on a word.
 *
 * This used to be `.slice(0, 200)`, which cut the Lebanese Prime Minister
 * project mid-word — "...into a clearer and more accessible experie" — and
 * shipped it to Google and to every share card. A character count knows nothing
 * about where a sentence can stop.
 *
 * 160 rather than 200 because that is roughly what Google renders and rather
 * less than what a social card shows; the cut falls back to the last sentence
 * end if there is one, and otherwise to the last space, with an ellipsis so the
 * break reads as deliberate.
 */
function describe(summary) {
  const text = (summary || '').trim();
  if (text.length <= 160) return text;

  const window = text.slice(0, 160);
  const sentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  if (sentence > 80) return window.slice(0, sentence + 1);

  const space = window.lastIndexOf(' ');
  return `${window.slice(0, space > 0 ? space : 160).replace(/[,;:]$/, '')}…`;
}

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const DATA_FILE = argOf('--data');
const IMAGE_DIR = argOf('--images');
const PUSH_BACK = args.includes('--push-existing-back');
/*
 * Whether a project may be imported before its pictures exist.
 *
 * Off by default, and it has to stay off by default: a case study whose cover
 * silently failed to upload looks exactly like one that was never given a
 * cover, and the failure would not surface until somebody looked at the Work
 * page. Throwing is the right behaviour for the normal case.
 *
 * The exception is writing the copy first. The text of a case study is worth
 * reviewing on the real page before the images are cut, and refusing to import
 * it until they are makes that impossible. With this flag the project lands
 * with its placeholder tile — the chip colours in the schema exist for exactly
 * that — and re-running the same import once the files are in place fills them
 * in without touching anything else.
 */
const ALLOW_MISSING = args.includes('--allow-missing-images');

if (!DATA_FILE || !IMAGE_DIR) {
  console.error(
    'Usage: node scripts/import-projects.js --data <file.json> --images <dir> ' +
      '[--push-existing-back] [--allow-missing-images]'
  );
  process.exit(1);
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

const uploadCache = new Map();

/**
 * Filenames become slug-ish so URLs stay ASCII even for Arabic originals.
 *
 * Stripping non-ASCII can leave nothing behind — every Arabic filename reduces
 * to an empty string — and two such files would then collide on the same name,
 * silently reusing the first upload for both. So when the readable part does not
 * survive, fall back to a short digest of the path, which is always distinct.
 */
function mediaName(projectSlug, relPath) {
  const base = path.parse(relPath).name;
  const ascii = base
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  if (ascii) return `${projectSlug}-${ascii}`;

  const digest = crypto.createHash('sha1').update(relPath).digest('hex').slice(0, 8);
  return `${projectSlug}-${digest}`;
}

async function upload(strapi, projectSlug, relPath, alt) {
  const key = `${projectSlug}::${relPath}`;
  if (uploadCache.has(key)) return uploadCache.get(key);

  const filePath = path.join(IMAGE_DIR, relPath);
  if (!fs.existsSync(filePath)) {
    if (!ALLOW_MISSING) throw new Error(`Image not found: ${relPath}`);
    console.warn(`    missing ${relPath} — imported without it`);
    uploadCache.set(key, null);
    return null;
  }

  const name = mediaName(projectSlug, relPath);

  const existing = await strapi.db.query('plugin::upload.file').findOne({ where: { name } });
  if (existing) {
    uploadCache.set(key, existing.id);
    return existing.id;
  }

  const stats = fs.statSync(filePath);
  const [file] = await strapi.plugin('upload').service('upload').upload({
    data: { fileInfo: { name, alternativeText: alt, caption: '' } },
    files: {
      filepath: filePath,
      originalFilename: path.basename(relPath),
      mimetype: MIME[path.extname(relPath).toLowerCase()] || 'application/octet-stream',
      size: stats.size,
    },
  });

  console.log(`    uploaded ${relPath}  ->  ${name}`);
  uploadCache.set(key, file.id);
  return file.id;
}

async function main() {
  ensureBuildEnv();
  ensureWorkingDatabase();

  const { projects } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  console.log(`[projects] ${projects.length} project(s) in ${path.basename(DATA_FILE)}\n`);

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'error';

  const docs = strapi.documents('api::project.project');
  let created = 0;
  let updated = 0;

  try {
    for (const p of projects) {
      const existing = await docs.findFirst({ filters: { slug: p.slug }, status: 'draft' });
      console.log(`[projects] ${p.title}  (${existing ? 'update' : 'create'})`);

      const coverId = p.cover ? await upload(strapi, p.slug, p.cover, p.title) : null;
      const shotId = p.approachShot
        ? await upload(strapi, p.slug, p.approachShot, `${p.title} screen`)
        : null;
      const galleryIds = [];
      for (const image of p.gallery || []) {
        const id = await upload(strapi, p.slug, image, `${p.title} screen`);
        // A hole in the gallery is not a gallery entry.
        if (id) galleryIds.push(id);
      }

      const data = {
        title: p.title,
        slug: p.slug,
        // A project can be filed under several services. A single `category`
        // string is still accepted so older payloads keep importing.
        categories: (p.categories ?? (p.category ? [p.category] : [])).map((label) => ({ label })),
        discipline: p.discipline,
        role: p.role,
        order: p.order,
        featured: Boolean(p.featured),
        chipBg: p.chipBg,
        chipInk: p.chipInk,
        summary: p.summary,
        briefLead: p.briefLead || '',
        briefBody: p.briefBody || '',
        problemLead: p.problemLead || '',
        constraints: (p.constraints || []).map((c) =>
          typeof c === 'string' ? { title: c, body: '' } : { title: c.title, body: c.body || '' }
        ),
        approachLead: p.approachLead || '',
        approachBody: p.approachBody || '',
        approachCaption: p.approachCaption || '',
        decisions: (p.decisions || []).map((d) => ({
          eyebrow: d.eyebrow || 'Outcome',
          title: d.title,
          body: d.body || '',
        })),
        shippedHeading: p.shippedHeading || 'The screens that carry the work.',
        // The "what shipped" highlights reuse the metric component: the name is
        // the headline, the sentence is the caption. Never animated — these are
        // words, not figures.
        metrics: (p.shipped || []).map((s) => ({
          value: s.title,
          label: s.body || '',
          animate: false,
        })),
        reflectionLead: p.reflectionLead || '',
        reflectionBody: p.reflectionBody || '',
        cover: coverId,
        approachShot: shotId,
        gallery: galleryIds,
        seo: {
          metaTitle: `${p.title} — Mohamad Hawa`,
          metaDescription: describe(p.summary),
        },
      };

      if (existing) {
        await docs.update({ documentId: existing.documentId, data, status: 'published' });
        updated += 1;
      } else {
        await docs.create({ data, status: 'published' });
        created += 1;
      }
    }

    if (PUSH_BACK) {
      const incoming = new Set(projects.map((p) => p.slug));
      const highest = Math.max(...projects.map((p) => p.order ?? 0));
      const others = (await docs.findMany({ status: 'draft', limit: 500 }))
        .filter((d) => !incoming.has(d.slug))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      console.log(`\n[projects] moving ${others.length} existing project(s) after the new ones`);
      let next = highest + 1;
      for (const other of others) {
        await docs.update({
          documentId: other.documentId,
          // Exactly one project may be featured — it is the large item at the
          // top of the home page — so clear the flag on everything else.
          data: { order: next, featured: false },
          status: 'published',
        });
        console.log(`    ${other.title} -> order ${next}`);
        next += 1;
      }
    }
  } finally {
    try {
      await strapi.destroy();
    } catch {
      // knex tears its connection pool down noisily; the work is already committed.
    }
  }

  console.log(`\n[projects] ${created} created, ${updated} updated.`);
}

main().catch((error) => {
  console.error(`[projects] Failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
