'use strict';

/**
 * Puts every project back under a service, after they all lost their filing.
 *
 * The Work page's filter chips are the service list, and a service with no
 * project behind it is left out — so when the project↔service links went, the
 * chips went with them and the page showed nothing but "All". The services
 * themselves were fine; what was empty was `categories` on all twelve
 * projects, which is a required, min-1 field the database was nonetheless
 * holding none of.
 *
 * The filing is derived rather than invented. Every project already carries a
 * `discipline` written by whoever entered it — "Landing page", "Web app
 * design", "Product Design — concept" — and the rules below map that
 * vocabulary onto the four services now offered. Nothing here decides what a
 * project is; it reads what the CMS already says it is and files it
 * accordingly.
 *
 *   node scripts/refile-projects.js
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
 * Discipline to service, first match wins — and the order is the whole of it.
 *
 * "Web app design" contains both "web" and "app". It is a web experience, so
 * the web rule has to be reached first; "Mobile app design" never reaches it
 * and falls to product. Anything that names a design system or a landing page
 * says so plainly and is caught before either.
 */
const RULES = [
  [/design system/i, 'Design System'],
  [/landing page/i, 'Landing Page'],
  [/web/i, 'Web Experience'],
  [/product|mobile|app/i, 'Product Design'],
];

/** The fallback, for a discipline none of the rules recognise. */
const DEFAULT_SERVICE = 'Product Design';

function fileUnder(discipline) {
  const said = String(discipline || '');
  for (const [pattern, service] of RULES) {
    if (pattern.test(said)) return service;
  }
  return DEFAULT_SERVICE;
}

async function main() {
  ensureBuildEnv();
  ensureWorkingDatabase();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'error';

  try {
    /*
     * The services as they actually are, not as this script imagines them.
     *
     * The previous version of this job rewrote the offering as well as the
     * filing, which is how a rename of the four services in the admin ended up
     * fighting a hardcoded list of five. This one only reads them — the
     * offering is the CMS's to decide.
     */
    const services = await strapi.documents('api::service.service').findMany({
      status: 'published',
      limit: 100,
    });
    const offered = new Set(services.map((service) => service.title));
    if (!offered.size) throw new Error('No published services — nothing to file projects under.');

    const named = new Set([...RULES.map(([, title]) => title), DEFAULT_SERVICE]);
    const unknown = [...named].filter((title) => !offered.has(title));
    if (unknown.length) {
      throw new Error(
        `These rules name services that do not exist: ${unknown.join(', ')}. ` +
          `Offered: ${[...offered].join(', ')}`
      );
    }

    const projectDocs = strapi.documents('api::project.project');
    const projects = await projectDocs.findMany({ status: 'draft', limit: 500 });

    for (const project of projects) {
      const service = fileUnder(project.discipline);
      await projectDocs.update({
        documentId: project.documentId,
        data: { categories: [{ label: service }] },
        status: 'published',
      });
      console.log(`[projects] ${project.slug} (${project.discipline || '—'}) -> ${service}`);
    }

    const tally = new Map();
    for (const project of projects) {
      const service = fileUnder(project.discipline);
      tally.set(service, (tally.get(service) || 0) + 1);
    }
    console.log('');
    for (const title of offered) {
      console.log(`[chips] ${title}: ${tally.get(title) || 0}`);
    }
    const empty = [...offered].filter((title) => !tally.get(title));
    if (empty.length) {
      console.warn(`[chips] no project behind: ${empty.join(', ')} — these chips will not show.`);
    }
  } finally {
    try {
      await strapi.destroy();
    } catch {
      /* knex tears its pool down noisily */
    }
  }

  console.log('\n[refile] Done. Run `npm run export` from the repo root.');
}

main().catch((error) => {
  console.error(`[refile] Failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
