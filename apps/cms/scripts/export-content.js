'use strict';

/**
 * Reads the committed SQLite database and writes a static content snapshot the
 * Astro site builds from.
 *
 *   node scripts/export-content.js
 *
 * Strapi is loaded in-process — no HTTP server, no port, no waiting for a
 * health check — and only read from. Two things are produced:
 *
 *   apps/web/src/data/content.json   every entry, shaped exactly like the REST
 *                                    API returned it, so the site's existing
 *                                    mappers work unchanged
 *   apps/web/public/media/           the uploads, copied out of the CMS so the
 *                                    built site serves its own images
 *
 * Media URLs are rewritten from Strapi's `/uploads/...` to `/media/...` on the
 * way out, which is why the deployed site needs no CMS host at all.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  ensureWorkingDatabase,
  writePublicDatabase,
  assertPublicDatabaseIsClean,
} = require('./db');
const { ensureBuildEnv } = require('./build-env');

const CMS_ROOT = path.join(__dirname, '..');
const WEB_ROOT = path.join(CMS_ROOT, '..', 'web');
const OUT_JSON = path.join(WEB_ROOT, 'src', 'data', 'content.json');
const OUT_MEDIA = path.join(WEB_ROOT, 'public', 'media');
const UPLOADS = path.join(CMS_ROOT, 'public', 'uploads');

/** Everything the site reads, and how to fetch each one. */
const SINGLE_TYPES = {
  siteSetting: 'api::site-setting.site-setting',
  homePage: 'api::home-page.home-page',
  workPage: 'api::work-page.work-page',
  aboutPage: 'api::about-page.about-page',
  contactPage: 'api::contact-page.contact-page',
};

const COLLECTIONS = {
  services: { uid: 'api::service.service', sort: 'order:asc' },
  processSteps: { uid: 'api::process-step.process-step', sort: 'order:asc' },
  projects: { uid: 'api::project.project', sort: 'order:asc' },
};

/**
 * Mirrors the DEFAULT_POPULATE in each controller. Kept here explicitly rather
 * than going through the controllers, because those need an HTTP context.
 */
const POPULATE = {
  'api::site-setting.site-setting': {
    portrait: true,
    logoMark: true,
    logoFull: true,
    seo: { populate: ['shareImage'] },
  },
  'api::home-page.home-page': { stats: true, seo: { populate: ['shareImage'] } },
  'api::work-page.work-page': { seo: { populate: ['shareImage'] } },
  'api::about-page.about-page': {
    stats: true,
    experience: true,
    skills: true,
    seo: { populate: ['shareImage'] },
  },
  'api::contact-page.contact-page': {
    budgetOptions: true,
    seo: { populate: ['shareImage'] },
  },
  'api::project.project': {
    categories: true,
    cover: true,
    approachShot: true,
    gallery: true,
    constraints: true,
    decisions: true,
    metrics: true,
    seo: { populate: ['shareImage'] },
  },
  'api::service.service': {},
  'api::process-step.process-step': {},
};

/** Strapi bookkeeping the site never reads. */
const DROP_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'localizations',
  'documentId',
  'provider',
  'provider_metadata',
  'previewUrl',
  'folderPath',
  'hash',
  'ext',
  'mime',
  'size',
  'formats',
]);

const usedFiles = new Set();

/**
 * Strips Strapi's bookkeeping and rewrites every media URL to the path the
 * built site will actually serve it from.
 */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value === null || typeof value !== 'object') return value;

  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (DROP_KEYS.has(key)) continue;

    if (key === 'url' && typeof raw === 'string' && raw.startsWith('/uploads/')) {
      const filename = raw.slice('/uploads/'.length);
      usedFiles.add(filename);
      out.url = `/media/${filename}`;
      continue;
    }

    out[key] = clean(raw);
  }
  return out;
}

/**
 * Screens exported from a design tool are large PNGs — several megabytes each.
 * WebP at quality 82 is visually indistinguishable for this kind of flat UI
 * artwork and a fraction of the weight, so images are converted on the way out
 * and the snapshot's URLs are rewritten to match. SVGs are copied untouched;
 * they are already small and vector.
 */
async function copyMedia() {
  fs.rmSync(OUT_MEDIA, { recursive: true, force: true });
  fs.mkdirSync(OUT_MEDIA, { recursive: true });

  if (!fs.existsSync(UPLOADS)) {
    console.warn(`[export] No uploads directory at ${UPLOADS}`);
    return { copied: 0, before: 0, after: 0, renamed: new Map() };
  }

  let sharp = null;
  try {
    sharp = require('sharp');
  } catch {
    console.warn('[export] sharp not available — copying images without conversion.');
  }

  const renamed = new Map();
  let copied = 0;
  let before = 0;
  let after = 0;
  const missing = [];

  for (const filename of usedFiles) {
    const from = path.join(UPLOADS, filename);
    if (!fs.existsSync(from)) {
      missing.push(filename);
      continue;
    }

    const ext = path.extname(filename).toLowerCase();
    const convertible = sharp && (ext === '.png' || ext === '.jpg' || ext === '.jpeg');
    before += fs.statSync(from).size;

    if (convertible) {
      const target = `${filename.slice(0, -ext.length)}.webp`;
      const to = path.join(OUT_MEDIA, target);
      await sharp(from).webp({ quality: 82, effort: 5 }).toFile(to);
      after += fs.statSync(to).size;
      renamed.set(filename, target);
    } else {
      const to = path.join(OUT_MEDIA, filename);
      fs.copyFileSync(from, to);
      after += fs.statSync(to).size;
    }

    copied += 1;
  }

  if (missing.length) {
    throw new Error(
      `${missing.length} referenced media file(s) are not in apps/cms/public/uploads — ` +
        'the built site would have broken images. Commit them, or re-upload in the admin.'
    );
  }

  return { copied, before, after, renamed };
}

async function main() {
  ensureBuildEnv();
  ensureWorkingDatabase();

  const dbFile = path.join(CMS_ROOT, process.env.DATABASE_FILENAME);
  if (!fs.existsSync(dbFile)) {
    throw new Error(`No database at ${dbFile}. Run \`npm run seed\` first.`);
  }

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'warn';

  const snapshot = { generatedAt: new Date().toISOString() };

  try {
    for (const [key, uid] of Object.entries(SINGLE_TYPES)) {
      const entry = await strapi.documents(uid).findFirst({
        populate: POPULATE[uid],
        status: 'published',
      });
      if (!entry) console.warn(`[export] ${uid} has no published entry.`);
      snapshot[key] = entry ? clean(entry) : null;
    }

    for (const [key, { uid, sort }] of Object.entries(COLLECTIONS)) {
      const entries = await strapi.documents(uid).findMany({
        populate: POPULATE[uid],
        sort,
        status: 'published',
        limit: 500,
      });
      snapshot[key] = entries.map(clean);
      if (!entries.length) console.warn(`[export] ${uid} has no published entries.`);
    }
  } finally {
    await strapi.destroy();
  }

  const media = await copyMedia();

  // Point the snapshot at the converted files.
  let json = JSON.stringify(snapshot, null, 2);
  for (const [from, to] of media.renamed) {
    json = json.split(`/media/${from}`).join(`/media/${to}`);
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${json}\n`);

  const copied = media.copied;

  // Refresh the committed, credential-free copy of the database.
  const cleared = writePublicDatabase();
  assertPublicDatabaseIsClean();

  const rel = (p) => path.relative(path.join(CMS_ROOT, '..', '..'), p);
  console.log(
    `[export] refreshed data/portfolio.public.db (stripped ${cleared} credential row(s))`
  );
  console.log(
    `[export] ${snapshot.projects.length} projects, ${snapshot.services.length} services, ` +
      `${snapshot.processSteps.length} process steps, 5 single types`
  );
  console.log(`[export] wrote ${rel(OUT_JSON)}`);
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  const saved = media.before ? Math.round((1 - media.after / media.before) * 100) : 0;
  console.log(
    `[export] copied ${copied} media file(s) to ${rel(OUT_MEDIA)} — ` +
      `${mb(media.before)} -> ${mb(media.after)} (${saved}% smaller)`
  );
}

main().catch((error) => {
  console.error(`[export] Failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
