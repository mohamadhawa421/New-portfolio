'use strict';

/**
 * Where the build's content comes from.
 *
 *   Supabase first — the current release, read as a visitor.
 *   Strapi if Supabase cannot answer — the committed SQLite snapshot, exported
 *   exactly as every build did before the migration.
 *
 * The fallback is what makes the switch safe to leave on: a paused free
 * project, an outage, or a network blip during a Vercel build produces the
 * site as it was at the last Strapi export instead of a failed deploy. It says
 * so loudly in the build log, because a fallback that happens silently is a
 * content change nobody asked for.
 *
 *   CONTENT_SOURCE=strapi   skip Supabase entirely — the rollback lever, if a
 *                           release ever needs to be bypassed rather than
 *                           rolled back from the Studio
 *   CONTENT_SOURCE=supabase fail the build instead of falling back — for
 *                           checking that Supabase really is being read
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const source = (process.env.CONTENT_SOURCE || '').toLowerCase();

const run = (cmd, args, cwd = ROOT) => spawnSync(cmd, args, { cwd, stdio: 'inherit' }).status;

function strapi() {
  console.log('[content] exporting from the Strapi snapshot');
  const status = run('npm', ['run', 'export', '--workspace=apps/cms']);
  if (status !== 0) process.exit(status || 1);
}

if (source === 'strapi') {
  strapi();
  process.exit(0);
}

const status = run('node', ['scripts/fetch-release.js'], path.join(ROOT, 'apps', 'web'));
if (status === 0) {
  console.log('[content] built from the Supabase release');
  process.exit(0);
}

if (source === 'supabase') {
  console.error('[content] CONTENT_SOURCE=supabase and Supabase did not answer — failing rather than falling back');
  process.exit(1);
}

console.warn('\n[content] ⚠ Supabase unavailable — FALLING BACK to the Strapi snapshot.');
console.warn('[content] ⚠ The site will show the content as of the last Strapi export, not the last publish.\n');
strapi();
