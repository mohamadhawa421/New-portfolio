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
 * WebP is a fraction of the weight, so images are converted on the way out and
 * the snapshot's URLs are rewritten to match. SVGs are copied untouched; they
 * are already small and vector.
 *
 * The quality is chosen from the picture rather than fixed, because the two
 * kinds of image here want opposite things. See `qualityFor`.
 */
/*
 * Flat UI screens and photographs want opposite settings, and this set has
 * both.
 *
 * Quality 82 was chosen for the screens, and it is right for them: what fails
 * first in flat artwork is a gradient banding or a letterform going soft, and
 * both are cheap to encode, so a high quality costs almost nothing. Fifty-three
 * of the fifty-four converted files are that kind of picture and the median
 * comes out at 0.03 bytes per pixel.
 *
 * The fifty-fourth is a photograph — a courtyard, foliage, dappled light,
 * cobblestones — and at the same setting it lands at 0.32 bytes per pixel: ten
 * times the median, three and a half times the next worst, and on its own 59%
 * of every image byte the home page asks for. Nothing is wrong with the
 * encoder. The bytes are going into leaf and stone detail that no viewer is
 * inspecting, which is exactly the content a lower quality is for.
 *
 * Entropy separates the two cleanly and by a wide margin: the photograph reads
 * 6.56, the next highest file 5.25, and the quietest 0.06. So the threshold
 * sits in open space rather than being tuned to a filename — a photograph added
 * later lands above it and a screen below it, without anyone editing this.
 *
 * 70 rather than lower because it was checked rather than felt: 82, 70 and 62
 * were encoded and compared at 1:1 on the hardest region of that image, the
 * body copy over foliage. The three are indistinguishable. 70 takes 453KB to
 * 341KB and keeps a margin above the point where the dark leaves start to go
 * mushy.
 */
async function qualityFor(sharp, file) {
  try {
    const { entropy } = await sharp(file).stats();
    return entropy > 5.5 ? 70 : 82;
  } catch {
    /* An image `stats()` cannot read still deserves the safe setting. */
    return 82;
  }
}

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
      await sharp(from)
        .webp({ quality: await qualityFor(sharp, from), effort: 5 })
        .toFile(to);
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
