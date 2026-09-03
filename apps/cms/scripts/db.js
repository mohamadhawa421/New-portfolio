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

  fs.copyFileSync(WORKING_DB, PUBLIC_DB);

  const Database = require('better-sqlite3');
  const db = new Database(PUBLIC_DB);

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

  // Reclaim the pages the deleted rows occupied, so the values are not
  // recoverable from free space in the committed file.
  db.exec('VACUUM');
  db.close();

  return cleared;
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
