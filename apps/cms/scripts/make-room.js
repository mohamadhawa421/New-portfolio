'use strict';

/**
 * Opens a gap in the project ordering so new work can land in the middle of it.
 *
 * `order` is what numbers the case studies 01, 02, 03 and what decides the
 * "Next project" link, so inserting a project anywhere except the end means
 * every project after it has to move. import-projects.js can already push the
 * whole existing set behind an import — that is how you put new work first —
 * but there was no way to put new work *between* two projects that are both
 * staying where they are.
 *
 * This does only that, and deliberately nothing else: it moves the projects at
 * or after a given position back by a given number of places, leaving a gap the
 * import can then fill by stating its own `order` values. It does not decide
 * what goes in the gap and it does not touch anything but `order`.
 *
 *   node scripts/make-room.js --from 6 --by 3
 *
 * Run with Strapi stopped, then the import, then `npm run export` from the
 * repo root.
 */

const { ensureWorkingDatabase } = require('./db');
const { ensureBuildEnv } = require('./build-env');

// knex aborts queued pool operations while shutting down, which surfaces as an
// unhandled 'aborted' rejection after every write has already committed.
const ignoreKnexTeardown = (error) => {
  if (error instanceof Error && error.message === 'aborted') return;
  throw error;
};
process.on('unhandledRejection', ignoreKnexTeardown);
process.on('uncaughtException', ignoreKnexTeardown);

const args = process.argv.slice(2);
const argOf = (flag) => {
  const at = args.indexOf(flag);
  return at === -1 ? null : args[at + 1];
};

const FROM = Number(argOf('--from'));
const BY = Number(argOf('--by'));

if (!Number.isInteger(FROM) || !Number.isInteger(BY) || BY < 1) {
  console.error('Usage: node scripts/make-room.js --from <order> --by <places>');
  process.exit(1);
}

async function main() {
  ensureBuildEnv();
  ensureWorkingDatabase();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'error';

  try {
    const projectDocs = strapi.documents('api::project.project');
    const projects = await projectDocs.findMany({ status: 'draft', limit: 500 });

    /*
     * Furthest back first.
     *
     * The orders have to stay unique while they are being rewritten one at a
     * time. Moving the lowest first would walk it onto a number still occupied
     * by the project above it, and for one write the two would be tied — which
     * is not fatal here but is exactly the kind of momentary inconsistency
     * that decides a "Next project" link if anything reads the table midway.
     */
    const moving = projects
      .filter((project) => (project.order ?? 0) >= FROM)
      .sort((a, b) => (b.order ?? 0) - (a.order ?? 0));

    if (!moving.length) {
      console.log(`[order] nothing at or after ${FROM} — no gap needed.`);
      return;
    }

    for (const project of moving) {
      const was = project.order ?? 0;
      await projectDocs.update({
        documentId: project.documentId,
        data: { order: was + BY },
        status: 'published',
      });
      console.log(`[order] ${project.slug}: ${was} -> ${was + BY}`);
    }

    console.log(`\n[order] ${moving.length} moved. ${FROM}..${FROM + BY - 1} is now free.`);
  } finally {
    try {
      await strapi.destroy();
    } catch {
      /* knex tears its pool down noisily */
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
