'use strict';

/**
 * Two pieces of copy that were shipping broken.
 *
 *   lebanese-prime-minister  its meta description was exactly 200 characters
 *                            and stopped mid-word — "...into a clearer and more
 *                            accessible experie". Not an authoring slip: the
 *                            importer took a hard `.slice(0, 200)` of the
 *                            summary. It was Google's snippet and every share
 *                            card for the flagship government project.
 *
 *   wise-academy             its summary had no main verb ("WISE Academy a high
 *                            standard school..."), wanted two hyphens, and was
 *                            written in the client's voice — "our students" — in
 *                            a portfolio that is meant to be Mohamad's. It sat
 *                            on the home page, the work index and the case
 *                            study, so it was the first sentence a lot of
 *                            visitors read.
 *
 * The replacement describes the work rather than the school, and every claim in
 * it is taken from that project's own approach section: an enrolment dashboard,
 * student and parent records with search and filters, a calendar for interviews,
 * and the notifications that go with them.
 *
 * Descriptions are written for the slot rather than pasted from the summary,
 * and kept under 160 characters, which is roughly what Google renders.
 *
 *   node scripts/fix-copy.js
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

const FIXES = {
  'lebanese-prime-minister': {
    seo: {
      metaTitle: 'Lebanese Prime Minister — Mohamad Hawa',
      metaDescription:
        "A redesigned digital home for the Lebanese Prime Minister's Office, bringing government information, legislation and national history into one accessible place.",
    },
  },
  'wise-academy': {
    summary:
      'An admin system for a private school in the US: one place to follow enrolments, search student and parent records, schedule interviews, and send the messages that go with them.',
    seo: {
      metaTitle: 'Wise Academy — Mohamad Hawa',
      metaDescription:
        'An admin system for a private school in the US — enrolments, student and parent records, interviews and messaging, in one place.',
    },
  },
};

/**
 * Alt text that is a filename, not a description.
 *
 * Six of the twelve covers carry their project's name and six carry the raw
 * slug, so a screen reader on the home page reads half the grid as "wise dash
 * academy", "wfk dash law dash firm". The portrait is worse, because it is the
 * first image on the page and it announces as "mohamad dash avatar".
 *
 * These are the strings Google indexes the covers by as well. Keyed by the
 * upload's own name, which is what the slug-derived ones were named after.
 */
const ALT = {
  'wise-academy-cover-v2': 'Wise Academy',
  'kabbara-office-cover-v2': 'Kabbara Office',
  'coding-lebanon-cover-v2': 'CodingCLebanon',
  'wfk-law-firm-cover-v2': 'WFK Law Firm',
  'shipment-share-cover-v2': 'Shipment Share',
  'shareb-cover-v2': 'Shareb',
  'mohamad-avatar': 'Mohamad Hawa',
};

async function main() {
  for (const [slug, fix] of Object.entries(FIXES)) {
    const d = fix.seo?.metaDescription;
    if (d && d.length > 160) {
      throw new Error(`${slug}: description is ${d.length} characters, over the 160 ceiling`);
    }
    if (d && !/[.!?]$/.test(d)) {
      throw new Error(`${slug}: description does not end on a full stop`);
    }
  }

  ensureBuildEnv();
  ensureWorkingDatabase();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'error';

  try {
    const projectDocs = strapi.documents('api::project.project');
    const projects = await projectDocs.findMany({ status: 'draft', limit: 500 });

    for (const [slug, fix] of Object.entries(FIXES)) {
      const project = projects.find((p) => p.slug === slug);
      if (!project) {
        console.warn(`[copy] no project "${slug}" — nothing changed`);
        continue;
      }

      await projectDocs.update({
        documentId: project.documentId,
        data: fix,
        status: 'published',
      });

      if (fix.summary) console.log(`[copy] ${slug} summary → ${fix.summary.slice(0, 60)}…`);
      console.log(`[copy] ${slug} description → ${fix.seo.metaDescription.length} chars, ends clean`);
    }

    const files = strapi.db.query('plugin::upload.file');
    for (const [name, alternativeText] of Object.entries(ALT)) {
      const file = await files.findOne({ where: { name } });
      if (!file) {
        console.warn(`[alt] no upload named "${name}" — nothing changed`);
        continue;
      }
      if (file.alternativeText === alternativeText) {
        console.log(`[alt] ${name} already "${alternativeText}"`);
        continue;
      }
      await files.update({ where: { id: file.id }, data: { alternativeText } });
      console.log(`[alt] ${name} → "${alternativeText}"`);
    }
  } finally {
    await strapi.destroy();
  }
}

main().catch((error) => {
  // Knex tears its SQLite pool down by rejecting anything still queued, so a
  // clean run ends with this. Everything above it has already been written.
  if (error instanceof Error && error.message === 'aborted') return;
  console.error(error);
  process.exit(1);
});
