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
/**
 * The widths a small rendering of a picture is allowed to ask for.
 *
 * Measured on the work grid: a card's cover is laid out at 364 CSS px and the
 * file behind it is 1440 wide. On a 2x screen the card needs 728, so the
 * browser holds a bitmap with four times the pixels it will draw and rescales
 * it on every raster. Fifteen of those on one page is 88MB of decoded image
 * against the 20MB the page actually shows.
 *
 * The three numbers come from measuring the tile, not from guessing. Across
 * viewports from 390 to 1920 the cover occupies 89% of the width one-up, 44%
 * two-up, and caps at 397 CSS px three-up once the shell stops growing:
 *
 *            1x     2x     3x
 *   phone    351    702   1053
 *   desktop  397    794      -
 *   tablet   563   1126      -
 *
 * 420 / 840 / 1200 is the smallest ladder where every one of those lands on
 * the step above it without overshooting to the next. 840 in particular is
 * the one that matters: a three-up desktop at 2x wants 794, and an earlier
 * ladder of 480/768/1152 missed it by 26 pixels and sent the whole grid to
 * 1152 instead.
 *
 * The full-size file stays exactly as it was and is still what a case study's
 * own hero and the lightbox load — this only gives the small renderings
 * something small to pick.
 *
 * `WIDTHS` is read by the web side too: ProjectCard builds its `srcset` from
 * the same numbers by convention, so a change here is a change there. The
 * gate is the same in both places — a variant is only written, and only
 * referenced, when the original is comfortably wider than it.
 */
const VARIANT_WIDTHS = [420, 840, 1200];

/**
 * No upscaling, and no variant that is barely smaller than the original.
 *
 * 1.15 rather than 1.25: the covers are 1440 wide and the top step is 1200,
 * which at 1.25 would have needed a 1500px original and so would never have
 * been written at all. 1200 out of 1440 is still 31% fewer pixels, which is
 * worth a file.
 */
const wantsVariant = (width, at) => width >= at * 1.15;

async function qualityFor(sharp, file) {
  try {
    const { entropy } = await sharp(file).stats();
    return entropy > 5.5 ? 70 : 82;
  } catch {
    /* An image `stats()` cannot read still deserves the safe setting. */
    return 82;
  }
}

/**
 * Writes the small renderings of one picture, beside the full-size one.
 *
 * Named by convention — `foo.webp` gets `foo-480.webp` and `foo-960.webp` —
 * because that is the contract the web side reads. Nothing records them in
 * content.json: a name that can be derived does not need to be stored, and
 * storing it would mean a schema change for something the filename already
 * says.
 *
 * Returns how many it wrote, for the line the export prints at the end.
 */
async function writeVariants(sharp, from, targetName, quality) {
  const meta = await sharp(from).metadata();
  const full = meta.width || 0;
  const base = targetName.slice(0, -path.extname(targetName).length);
  let made = 0;

  for (const at of VARIANT_WIDTHS) {
    if (!wantsVariant(full, at)) continue;
    await sharp(from)
      .resize({ width: at, withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toFile(path.join(OUT_MEDIA, `${base}-${at}.webp`));
    made += 1;
  }

  return made;
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
  let variants = 0;
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
      const quality = await qualityFor(sharp, from);
      await sharp(from).webp({ quality, effort: 5 }).toFile(to);
      after += fs.statSync(to).size;
      renamed.set(filename, target);
      variants += await writeVariants(sharp, from, target, quality);
    } else {
      const to = path.join(OUT_MEDIA, filename);
      fs.copyFileSync(from, to);
      after += fs.statSync(to).size;
      if (sharp && ext === '.webp') {
        variants += await writeVariants(sharp, from, filename, await qualityFor(sharp, from));
      }
    }

    copied += 1;
  }

  if (missing.length) {
    throw new Error(
      `${missing.length} referenced media file(s) are not in apps/cms/public/uploads — ` +
        'the built site would have broken images. Commit them, or re-upload in the admin.'
    );
  }

  return { copied, before, after, renamed, variants };
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

  /*
   * The stamp only moves when the content does.
   *
   * `generatedAt` is the first line of a committed file, so writing a fresh
   * timestamp on every export made content.json show as modified after every
   * build — which meant `git status` could never answer the one question it
   * is there to answer, and a real content change looked exactly like a
   * rebuild. Compared with the stamp blanked on both sides, so the only thing
   * that can move it is an actual difference.
   *
   * The field is kept rather than dropped: knowing when a snapshot was taken
   * is worth a line, and with this it is finally true — the date is when the
   * content last changed, not when someone last ran a build.
   */
  const blankStamp = (text) => text.replace(/^(\s*"generatedAt":\s*)"[^"]*"/m, '$1""');
  const next = `${json}\n`;
  const prior = fs.existsSync(OUT_JSON) ? fs.readFileSync(OUT_JSON, 'utf8') : null;
  const sameContent = prior !== null && blankStamp(prior) === blankStamp(next);

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, sameContent ? prior : next);

  const copied = media.copied;

  // Refresh the committed, credential-free copy of the database.
  const { cleared, unchanged: dbUnchanged } = writePublicDatabase();
  assertPublicDatabaseIsClean();

  const rel = (p) => path.relative(path.join(CMS_ROOT, '..', '..'), p);
  console.log(
    dbUnchanged
      ? '[export] data/portfolio.public.db unchanged'
      : `[export] refreshed data/portfolio.public.db (stripped ${cleared} credential row(s))`
  );
  console.log(
    `[export] ${snapshot.projects.length} projects, ${snapshot.services.length} services, ` +
      `${snapshot.processSteps.length} process steps, 5 single types`
  );
  console.log(
    `[export] ${sameContent ? 'content.json unchanged' : `wrote ${rel(OUT_JSON)}`}`
  );
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  const saved = media.before ? Math.round((1 - media.after / media.before) * 100) : 0;
  console.log(
    `[export] copied ${copied} media file(s) to ${rel(OUT_MEDIA)} — ` +
      `${mb(media.before)} -> ${mb(media.after)} (${saved}% smaller)` +
      (media.variants ? `, plus ${media.variants} small rendering(s) for srcset` : '')
  );
}

main().catch((error) => {
  console.error(`[export] Failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
