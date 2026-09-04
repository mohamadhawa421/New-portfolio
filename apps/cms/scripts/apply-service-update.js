'use strict';

/**
 * Re-cuts the offering around five services, and re-files every project under
 * the ones it actually belongs to.
 *
 *   - the service list (which is also the Work page's filter chips and the
 *     enquiry form's "What do you need?" options)
 *   - each project's categories — a project can sit under more than one now,
 *     so a redesign that shipped as a web app appears under both
 *   - each project's discipline, so the row tag matches the same vocabulary
 *   - the two headings that counted the old list
 *
 * Timeline and scope are gone from the model entirely, so the six imported
 * projects that still carried them now read like the rest.
 *
 *   node scripts/apply-service-update.js
 *
 * Run with Strapi stopped, then `npm run export` from the repo root.
 */

const { ensureWorkingDatabase } = require('./db');
const { ensureBuildEnv } = require('./build-env');

const ignoreKnexTeardown = (error) => {
  if (error instanceof Error && error.message === 'aborted') return;
  throw error;
};
process.on('unhandledRejection', ignoreKnexTeardown);
process.on('uncaughtException', ignoreKnexTeardown);

/**
 * The offering, in the order it is shown. These strings are the single source
 * of the filter chips and the form's service options, so a project category
 * that is not one of them would produce a chip with nothing behind it.
 */
const SERVICES = [
  {
    title: 'Landing page / showcase website',
    description:
      'One page — or a short set of them — that says the right thing in the right order and asks for one action.',
    order: 0,
  },
  {
    title: 'Mobile app',
    description:
      'iOS and Android products designed thumb-first: the model underneath, the flows on top, and every state in between.',
    order: 1,
  },
  {
    title: 'Web app',
    description:
      'Dashboards, portals and internal tools where a lot of data has to stay readable and a lot of people have to stay oriented.',
    order: 2,
  },
  {
    title: 'Design system',
    description: 'Components, tokens, and rules so the tenth screen looks like the first.',
    order: 3,
  },
  {
    title: 'Redesign web / mobile',
    description:
      'An existing product taken apart and rebuilt around what people are actually trying to do with it.',
    order: 4,
  },
];

const SERVICE_TITLES = new Set(SERVICES.map((service) => service.title));

/**
 * First entry is the primary — it leads the card label and the case study's
 * meta line. Every entry is a filter the project answers to.
 */
const PROJECTS = {
  kanz: { categories: ['Mobile app'], discipline: 'Mobile app design' },
  tahweel: {
    categories: ['Redesign web / mobile'],
    discipline: 'Mobile app redesign',
  },
  rowad: {
    categories: ['Redesign web / mobile', 'Web app'],
    discipline: 'Web app redesign',
  },
  'lebanese-prime-minister': {
    categories: ['Redesign web / mobile', 'Web app'],
    discipline: 'Web app redesign',
  },
  apamea: { categories: ['Web app'], discipline: 'Web app design' },
  mylebpass: { categories: ['Web app'], discipline: 'Web app design' },
  'wise-academy': { categories: ['Web app'], discipline: 'Web app design' },
  'kabbara-office': { categories: ['Mobile app'], discipline: 'Mobile app design' },
  'coding-lebanon': {
    categories: ['Landing page / showcase website'],
    discipline: 'Landing page design',
  },
  'wfk-law-firm': { categories: ['Web app'], discipline: 'Web app design' },
  'shipment-share': { categories: ['Mobile app'], discipline: 'Mobile app design' },
  shareb: { categories: ['Web app'], discipline: 'Web app design' },
};

/** Copy that counted the old four-item list, or described the old filters. */
const HOME_PAGE = {
  servicesHeading: 'Five ways to work together.',
};

const WORK_PAGE = {
  intro:
    'With a question about the person who has to use it. Filter by the kind of work, or read straight through.',
  seo: {
    metaTitle: 'Work — Mohamad Hawa',
    metaDescription:
      'Selected UI/UX projects — landing pages, mobile apps, web apps, design systems and redesigns.',
  },
};

/** Every category listed above must be one of the services. */
function assertCategoriesAreServices() {
  const unknown = new Set();
  for (const { categories } of Object.values(PROJECTS)) {
    for (const category of categories) {
      if (!SERVICE_TITLES.has(category)) unknown.add(category);
    }
  }
  if (unknown.size) {
    throw new Error(`Categories that are not services: ${[...unknown].join(', ')}`);
  }
}

async function main() {
  assertCategoriesAreServices();
  ensureBuildEnv();
  ensureWorkingDatabase();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'error';

  try {
    // ---- Services ---------------------------------------------------------
    const serviceDocs = strapi.documents('api::service.service');
    for (const service of await serviceDocs.findMany({ status: 'draft', limit: 100 })) {
      await serviceDocs.delete({ documentId: service.documentId });
    }
    for (const service of SERVICES) {
      await serviceDocs.create({
        data: { ...service, ctaLabel: 'Start here' },
        status: 'published',
      });
    }
    console.log(`[services] ${SERVICES.map((s) => s.title).join(' · ')}`);

    // ---- Projects ---------------------------------------------------------
    const projectDocs = strapi.documents('api::project.project');
    const projects = await projectDocs.findMany({ status: 'draft', limit: 500 });

    const seen = new Set();
    for (const project of projects) {
      const update = PROJECTS[project.slug];
      if (!update) {
        console.warn(`[projects] no mapping for "${project.slug}" — left as it was`);
        continue;
      }
      seen.add(project.slug);

      await projectDocs.update({
        documentId: project.documentId,
        data: {
          categories: update.categories.map((label) => ({ label })),
          discipline: update.discipline,
        },
        status: 'published',
      });
      console.log(`[projects] ${project.title} -> ${update.categories.join(' + ')}`);
    }

    const missing = Object.keys(PROJECTS).filter((slug) => !seen.has(slug));
    if (missing.length) console.warn(`[projects] not in the database: ${missing.join(', ')}`);

    // ---- Copy that counted the old list -----------------------------------
    const homeDocs = strapi.documents('api::home-page.home-page');
    const home = await homeDocs.findFirst({ status: 'draft' });
    if (home) {
      await homeDocs.update({
        documentId: home.documentId,
        data: HOME_PAGE,
        status: 'published',
      });
      console.log(`[home] servicesHeading -> ${HOME_PAGE.servicesHeading}`);
    }

    const workDocs = strapi.documents('api::work-page.work-page');
    const work = await workDocs.findFirst({ status: 'draft' });
    if (work) {
      await workDocs.update({
        documentId: work.documentId,
        data: WORK_PAGE,
        status: 'published',
      });
      console.log('[work] intro and SEO description updated');
    }
  } finally {
    try {
      await strapi.destroy();
    } catch {
      /* knex tears its pool down noisily */
    }
  }

  console.log('\n[update] Done. Run `npm run export` from the repo root.');
}

main().catch((error) => {
  console.error(`[update] Failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
