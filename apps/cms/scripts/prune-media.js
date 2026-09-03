'use strict';

/**
 * Deletes uploads that nothing references any more.
 *
 *   node scripts/prune-media.js            # list what would go
 *   node scripts/prune-media.js --delete   # actually delete
 *
 * Replacing a project's images leaves the old files behind in the media
 * library. They are invisible on the site — the export only copies files that
 * are actually referenced — but `apps/cms/public/uploads` is committed, so they
 * sit in the repository forever unless something clears them out.
 *
 * A file counts as referenced if it appears in Strapi's polymorphic media link
 * table. Run with Strapi stopped.
 */

const { ensureWorkingDatabase } = require('./db');

const ignoreKnexTeardown = (error) => {
  if (error instanceof Error && error.message === 'aborted') return;
  throw error;
};
process.on('unhandledRejection', ignoreKnexTeardown);
process.on('uncaughtException', ignoreKnexTeardown);

const DELETE = process.argv.includes('--delete');

async function main() {
  ensureWorkingDatabase();

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'error';

  try {
    const knex = strapi.db.connection;

    const referenced = new Set(
      (await knex('files_related_mph').distinct('file_id')).map((row) => row.file_id)
    );
    const all = await knex('files').select('id', 'name', 'size');

    const orphans = all.filter((file) => !referenced.has(file.id));
    const freed = orphans.reduce((sum, file) => sum + (file.size || 0), 0);

    if (!orphans.length) {
      console.log('[prune] Nothing to remove — every upload is in use.');
      return;
    }

    console.log(
      `[prune] ${orphans.length} unused file(s), about ${Math.round(freed)} KB:` +
        `\n${orphans.map((f) => `    ${f.name}`).join('\n')}`
    );

    if (!DELETE) {
      console.log('\n[prune] Nothing deleted. Re-run with --delete to remove them.');
      return;
    }

    const uploads = strapi.plugin('upload').service('upload');
    for (const orphan of orphans) {
      const file = await strapi.db.query('plugin::upload.file').findOne({ where: { id: orphan.id } });
      if (file) await uploads.remove(file);
    }

    console.log(`\n[prune] Removed ${orphans.length} file(s). Run \`npm run export\` next.`);
  } finally {
    try {
      await strapi.destroy();
    } catch {
      /* knex tears its pool down noisily */
    }
  }
}

main().catch((error) => {
  console.error(`[prune] Failed: ${error.message}`);
  process.exit(1);
});
