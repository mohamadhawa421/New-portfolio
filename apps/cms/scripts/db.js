'use strict';

/**
 * The database is split in two on purpose.
 *
 *   data/portfolio.db          working copy — what Strapi reads and writes.
 *                              Gitignored, because it holds your admin account
 *                              (email + password hash) and any API tokens.
 *
 *   data/portfolio.public.db   committed copy — identical content, with every
 *                              credential-bearing table emptied. This is what
 *                              Vercel builds from.
 *
 * `ensureWorkingDatabase()` seeds the working copy from the committed one, so a
 * fresh clone (or a build machine) just works. `writePublicDatabase()` refreshes
 * the committed copy and is called at the end of every export.
 */

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WORKING_DB = path.join(DATA_DIR, 'portfolio.db');
const PUBLIC_DB = path.join(DATA_DIR, 'portfolio.public.db');

/**
 * Tables holding credentials or personal data. None of them are read by the
 * site, so emptying them costs the build nothing.
 */
const SENSITIVE_TABLES = [
  'admin_users',
  'admin_users_roles_lnk',
  'admin_users_roles_links',
  'strapi_api_tokens',
  'strapi_api_token_permissions',
  'strapi_api_token_permissions_token_lnk',
  'strapi_transfer_tokens',
  'strapi_transfer_token_permissions',
  'strapi_transfer_token_permissions_token_lnk',
  'up_users',
  'up_users_role_lnk',
  'up_permissions_role_lnk',
  'strapi_sessions',
];

function ensureWorkingDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(WORKING_DB)) return false;

  if (!fs.existsSync(PUBLIC_DB)) {
    throw new Error(
      `Neither ${path.basename(WORKING_DB)} nor ${path.basename(PUBLIC_DB)} exists in apps/cms/data.`
    );
  }

  fs.copyFileSync(PUBLIC_DB, WORKING_DB);
  console.log(
    `[db] Created data/${path.basename(WORKING_DB)} from the committed copy. ` +
      'Strapi will ask you to create an admin account on first run.'
  );
  return true;
}

function writePublicDatabase() {
  if (!fs.existsSync(WORKING_DB)) {
    throw new Error(`No working database at ${WORKING_DB}.`);
  }

  /*
   * Built beside the committed copy, not over it.
   *
   * Strapi rewrites `plugin_upload_metrics` with a freshly randomised weekly
   * cron every time it boots, so every export changed one string inside a
   * 1.6MB binary and the committed database showed as modified after every
   * build — with no way to tell that from a real content change without
   * dumping both and diffing them. The same problem content.json had, in a
   * file where `git diff` can only say "Bin 1671168 -> 1671168 bytes".
   *
   * So the new copy is written to one side, the churn is normalised out of
   * it, and it only replaces the committed file if the bytes actually
   * differ. Pinning the schedule is safe: it is Strapi's own telemetry
   * timer, nothing reads it here, and Strapi rolls a new one on next boot
   * regardless.
   */
  const TEMP_DB = `${PUBLIC_DB}.tmp`;
  fs.copyFileSync(WORKING_DB, TEMP_DB);

  const Database = require('better-sqlite3');
  const db = new Database(TEMP_DB);

  const present = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name)
  );

  let cleared = 0;
  for (const table of SENSITIVE_TABLES) {
    if (!present.has(table)) continue;
    const before = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
    if (!before) continue;
    db.prepare(`DELETE FROM "${table}"`).run();
    cleared += before;
  }

  /*
   * The one value Strapi randomises on every boot, pinned so that an export
   * which changed nothing produces the same bytes as the last one. Guarded,
   * because the row only exists once the upload plugin has run.
   */
  if (present.has('strapi_core_store_settings')) {
    db.prepare(
      `UPDATE strapi_core_store_settings
          SET value = json_set(value, '$.weeklySchedule', '0 0 0 * * 5')
        WHERE key = 'plugin_upload_metrics'
          AND json_valid(value)`
    ).run();
  }

  // Reclaim the pages the deleted rows occupied, so the values are not
  // recoverable from free space in the committed file. Also what makes the
  // page layout deterministic, which the comparison below depends on.
  db.exec('VACUUM');
  db.close();

  // Only touch the committed file when something in it actually moved.
  const next = fs.readFileSync(TEMP_DB);
  const unchanged =
    fs.existsSync(PUBLIC_DB) && sameDatabase(next, fs.readFileSync(PUBLIC_DB));

  if (unchanged) fs.rmSync(TEMP_DB);
  else fs.renameSync(TEMP_DB, PUBLIC_DB);

  return { cleared, unchanged };
}

/**
 * Two SQLite files holding the same thing.
 *
 * With the telemetry row pinned above, two exports of unchanged content
 * differ in exactly two bytes — measured, not assumed: offsets 27 and 95,
 * the low bytes of the header's *file change counter* (24..27) and
 * *version-valid-for* (92..95). Both are bookkeeping SQLite increments on
 * every write; neither says anything about the contents.
 *
 * Masking those two fields rather than parsing the whole database: the
 * comparison has to be cheap enough to run on every export, and after the
 * VACUUM above the page layout is deterministic, so identical content really
 * does give identical bytes everywhere else. If that ever stops being true
 * the check fails safe — it writes the file, which is what it did before.
 */
function sameDatabase(a, b) {
  if (a.length !== b.length) return false;

  const mask = (buf) => {
    const copy = Buffer.from(buf);
    copy.fill(0, 24, 28); // file change counter
    copy.fill(0, 92, 96); // version-valid-for
    return copy;
  };

  return Buffer.compare(mask(a), mask(b)) === 0;
}

/** Fails loudly if a credential ever slips into the committed copy. */
function assertPublicDatabaseIsClean() {
  const Database = require('better-sqlite3');
  const db = new Database(PUBLIC_DB, { readonly: true });

  const present = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name)
  );

  const offenders = [];
  for (const table of SENSITIVE_TABLES) {
    if (!present.has(table)) continue;
    const n = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
    if (n) offenders.push(`${table} (${n} rows)`);
  }
  db.close();

  if (offenders.length) {
    throw new Error(`Public database still contains: ${offenders.join(', ')}`);
  }
}

module.exports = {
  DATA_DIR,
  WORKING_DB,
  PUBLIC_DB,
  SENSITIVE_TABLES,
  ensureWorkingDatabase,
  writePublicDatabase,
  assertPublicDatabaseIsClean,
};
