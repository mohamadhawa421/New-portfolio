'use strict';

/**
 * Seeds the CMS with the content from the Claude Design prototype.
 *
 *   npm run seed            # only fills content types that are still empty
 *   npm run seed -- --force # overwrites the single types and re-imports projects
 *
 * Boots Strapi in-process rather than talking to the REST API, so there is no
 * API token to create first. Run it with the server stopped.
 */

const fs = require('node:fs');
const path = require('node:path');

const data = require('./seed-data');

// The design bundle is the single copy of these images in the repo.
const ASSET_DIR = path.join(__dirname, '..', '..', '..', 'design-source', 'assets');
const FORCE = process.argv.includes('--force');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** Uploads a file from scripts/assets once, reusing it on later runs. */
async function uploadOnce(strapi, cache, filename) {
  if (cache.has(filename)) return cache.get(filename);

  const filePath = path.join(ASSET_DIR, filename);
  if (!fs.existsSync(filePath)) {
    strapi.log.warn(`[seed] Missing asset ${filename} — skipping.`);
    cache.set(filename, null);
    return null;
  }

  // Strapi stores the name it was given in fileInfo — the base name, without
  // the extension — so the lookup has to use the same value or every run
  // uploads another copy.
  const name = path.parse(filename).name;

  const existing = await strapi.db
    .query('plugin::upload.file')
    .findOne({ where: { name } });

  if (existing) {
    cache.set(filename, existing.id);
    return existing.id;
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();

  const [uploaded] = await strapi.plugin('upload').service('upload').upload({
    data: { fileInfo: { name, alternativeText: name, caption: '' } },
    files: {
      filepath: filePath,
      originalFilename: filename,
      mimetype: MIME[ext] || 'application/octet-stream',
      size: stats.size,
    },
  });

  strapi.log.info(`[seed] Uploaded ${filename}`);
  cache.set(filename, uploaded.id);
  return uploaded.id;
}

/** Turns the __media map on a seed record into real media ids. */
async function resolveMedia(strapi, cache, media) {
  const resolved = {};
  for (const [field, value] of Object.entries(media || {})) {
    if (Array.isArray(value)) {
      const ids = [];
      for (const filename of value) {
        const id = await uploadOnce(strapi, cache, filename);
        if (id) ids.push(id);
      }
      if (ids.length) resolved[field] = ids;
    } else {
      const id = await uploadOnce(strapi, cache, value);
      if (id) resolved[field] = id;
    }
  }
  return resolved;
}

function hasDraftAndPublish(strapi, uid) {
  return strapi.contentType(uid)?.options?.draftAndPublish === true;
}

async function upsertSingleType(strapi, uid, record) {
  const { __media, ...fields } = record;

  const existing = await strapi.documents(uid).findFirst({ status: 'draft' });

  if (existing && !FORCE) {
    strapi.log.info(`[seed] ${uid} already exists — skipping (use --force to overwrite).`);
    return existing;
  }

  // Only after we know we are writing — no point uploading for a skipped record.
  const media = await resolveMedia(strapi, globalThis.__seedCache, __media);
  const payload = { ...fields, ...media };

  const status = hasDraftAndPublish(strapi, uid) ? 'published' : undefined;

  if (existing) {
    const updated = await strapi.documents(uid).update({
      documentId: existing.documentId,
      data: payload,
      ...(status ? { status } : {}),
    });
    strapi.log.info(`[seed] Updated ${uid}`);
    return updated;
  }

  const created = await strapi.documents(uid).create({
    data: payload,
    ...(status ? { status } : {}),
  });
  strapi.log.info(`[seed] Created ${uid}`);
  return created;
}

async function upsertCollection(strapi, uid, records, matchField) {
  const status = hasDraftAndPublish(strapi, uid) ? 'published' : undefined;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const { __media, ...fields } = record;
    const existing = await strapi.documents(uid).findFirst({
      filters: { [matchField]: fields[matchField] },
      status: 'draft',
    });

    if (existing && !FORCE) {
      skipped += 1;
      continue;
    }

    const media = await resolveMedia(strapi, globalThis.__seedCache, __media);
    const payload = { ...fields, ...media };

    if (existing) {
      await strapi.documents(uid).update({
        documentId: existing.documentId,
        data: payload,
        ...(status ? { status } : {}),
      });
      updated += 1;
    } else {
      await strapi.documents(uid).create({
        data: payload,
        ...(status ? { status } : {}),
      });
      created += 1;
    }
  }

  strapi.log.info(
    `[seed] ${uid}: ${created} created, ${updated} updated, ${skipped} left alone.`
  );
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const strapi = await createStrapi(appContext).load();
  strapi.log.level = 'info';

  globalThis.__seedCache = new Map();

  try {
    await upsertSingleType(strapi, 'api::site-setting.site-setting', data.siteSetting);
    await upsertSingleType(strapi, 'api::home-page.home-page', data.homePage);
    await upsertSingleType(strapi, 'api::work-page.work-page', data.workPage);
    await upsertSingleType(strapi, 'api::about-page.about-page', data.aboutPage);
    await upsertSingleType(strapi, 'api::contact-page.contact-page', data.contactPage);

    await upsertCollection(strapi, 'api::service.service', data.services, 'title');
    await upsertCollection(strapi, 'api::process-step.process-step', data.processSteps, 'title');
    await upsertCollection(strapi, 'api::project.project', data.projects, 'slug');

    strapi.log.info('[seed] Done.');
  } catch (error) {
    strapi.log.error(`[seed] Failed: ${error.message}`);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await strapi.destroy();
  }
}

main();
