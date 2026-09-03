'use strict';

/**
 * Applies a batch of content changes that are easier to express as code than to
 * click through the admin:
 *
 *   - the site's role title
 *   - project categories, regrouped around services rather than sectors
 *   - the service list, so the filter chips and the offering match
 *   - replacement cover images
 *
 *   node scripts/apply-updates.js --images <dir>
 *
 * Run with Strapi stopped.
 */

const fs = require('node:fs');
const path = require('node:path');

const { ensureWorkingDatabase } = require('./db');

const ignoreKnexTeardown = (error) => {
  if (error instanceof Error && error.message === 'aborted') return;
  throw error;
};
process.on('unhandledRejection', ignoreKnexTeardown);
process.on('uncaughtException', ignoreKnexTeardown);

const args = process.argv.slice(2);
const IMAGE_DIR = args[args.indexOf('--images') + 1];
if (!IMAGE_DIR || !fs.existsSync(IMAGE_DIR)) {
  console.error('Usage: node scripts/apply-updates.js --images <dir>');
  process.exit(1);
}

const ROLE_TITLE = 'Product Owner';

/**
 * Filters now describe the kind of work rather than the client's industry, so a
 * visitor scanning for "can you do what I need" sees the answer.
 */
const CATEGORY_BY_SLUG = {
  kanz: 'Product Design',
  apamea: 'Product Design',
  'shipment-share': 'Product Design',
  rowad: 'Web Experience',
  'lebanese-prime-minister': 'Web Experience',
  'coding-lebanon': 'Web Experience',
  'wise-academy': 'Web Experience',
  'kabbara-office': 'Landing Page',
  'wfk-law-firm': 'Landing Page',
  shareb: 'Design System',
  mylebpass: 'Product Design',
  tahweel: 'Product Design',
};

/** Kept in step with the categories above, so the two lists read as one story. */
const SERVICES = [
  {
    title: 'Product Design',
    description:
      'End-to-end product work for web and mobile — the model underneath, the flows on top, and the screens people actually use.',
    order: 0,
  },
  {
    title: 'Web Experience',
    description:
      'Sites and portals where a lot of content has to stay findable, readable, and worth coming back to.',
    order: 1,
  },
  {
    title: 'Landing Page',
    description: 'One page that says the right thing in the right order and asks for one action.',
    order: 2,
  },
  {
    title: 'Design System',
    description: 'Components, tokens, and rules so the tenth screen looks like the first.',
    order: 3,
  },
];

const NEW_COVERS = {
  'wise-academy': 'new cover wise academy.png',
  'kabbara-office': 'new cover kabbara office.png',
  'shipment-share': 'new cover shipment share.png',
  'coding-lebanon': 'new cover c coding.png',
  'wfk-law-firm': 'new cover wfk.png',
  shareb: 'new cover shareb.png',
};

async function uploadCover(strapi, slug, filename) {
  const filePath = path.join(IMAGE_DIR, filename);
  if (!fs.existsSync(filePath)) throw new Error(`Missing cover: ${filename}`);

  const name = `${slug}-cover-v2`;
  const existing = await strapi.db.query('plugin::upload.file').findOne({ where: { name } });
  if (existing) return existing.id;

  const [file] = await strapi.plugin('upload').service('upload').upload({
    data: { fileInfo: { name, alternativeText: slug, caption: '' } },
    files: {
      filepath: filePath,
      originalFilename: filename,
      mimetype: 'image/png',
      size: fs.statSync(filePath).size,
    },
  });
  console.log(`    uploaded ${filename}`);
  return file.id;
}

async function main() {
  ensureWorkingDatabase();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'error';

  try {
    // ---- Role title -------------------------------------------------------
    const settingsDocs = strapi.documents('api::site-setting.site-setting');
    const settings = await settingsDocs.findFirst({ status: 'draft' });
    if (settings) {
      await settingsDocs.update({
        documentId: settings.documentId,
        data: {
          roleTitle: ROLE_TITLE,
          seo: {
            metaTitle: `Mohamad Hawa — ${ROLE_TITLE}`,
            metaDescription: settings.seo?.metaDescription,
          },
        },
      });
      console.log(`[updates] roleTitle -> ${ROLE_TITLE}`);
    }

    // ---- Services ---------------------------------------------------------
    const serviceDocs = strapi.documents('api::service.service');
    const existingServices = await serviceDocs.findMany({ status: 'draft', limit: 100 });
    for (const service of existingServices) {
      await serviceDocs.delete({ documentId: service.documentId });
    }
    for (const service of SERVICES) {
      await serviceDocs.create({
        data: { ...service, ctaLabel: 'Start here' },
        status: 'published',
      });
    }
    console.log(`[updates] services -> ${SERVICES.map((s) => s.title).join(', ')}`);

    // ---- Categories + covers ---------------------------------------------
    const projectDocs = strapi.documents('api::project.project');
    const projects = await projectDocs.findMany({ status: 'draft', limit: 500 });

    for (const project of projects) {
      const data = {};

      const category = CATEGORY_BY_SLUG[project.slug];
      if (category && category !== project.category) data.category = category;

      const cover = NEW_COVERS[project.slug];
      if (cover) data.cover = await uploadCover(strapi, project.slug, cover);

      if (!Object.keys(data).length) continue;

      await projectDocs.update({
        documentId: project.documentId,
        data,
        status: 'published',
      });
      console.log(
        `[updates] ${project.title}` +
          (data.category ? ` -> ${data.category}` : '') +
          (data.cover ? ' (new cover)' : '')
      );
    }
  } finally {
    try {
      await strapi.destroy();
    } catch {
      /* knex tears its pool down noisily */
    }
  }

  console.log('\n[updates] Done.');
}

main().catch((error) => {
  console.error(`[updates] Failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
