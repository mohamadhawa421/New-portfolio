/**
 * The migration, proved before it touches the real project.
 *
 * Takes the real content.json, maps it to rows with `toRows`, writes those
 * rows into Postgres as the owner — through the real migrations and the real
 * policies — publishes, reads the release back as a *visitor*, and maps it
 * back with `fromRows`. The result must equal the original, field for field,
 * apart from the fields no page reads (see `comparable`).
 *
 * If this passes, the only things left unproven about the migration are the
 * network and the files, and both are checked by the migration script itself.
 *
 *   npm run test:db
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { toRows, fromRows, comparable } from '../../apps/web/scripts/content-map.js';
import { stubSupabase, OWNER } from './stub.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MIGRATIONS = path.join(REPO, 'supabase', 'migrations');
const CONTENT = JSON.parse(fs.readFileSync(path.join(REPO, 'apps/web/src/data/content.json'), 'utf8'));
const PUBLIC = path.join(REPO, 'apps/web/public');

const describe = (url) => {
  const buf = fs.readFileSync(path.join(PUBLIC, url));
  return { bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
};

let db;
let rows;

before(async () => {
  db = new PGlite();
  await stubSupabase(db);
  for (const f of fs.readdirSync(MIGRATIONS).sort()) await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
  await db.exec(`insert into auth.users values ('${OWNER}', 'owner@example.test'); insert into public.admins (user_id) values ('${OWNER}');`);
  rows = toRows(CONTENT, describe);
});

async function insertAsOwner(table, list) {
  await db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${OWNER}', true);`);
    for (const row of list) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => (row[c] !== null && typeof row[c] === 'object' ? JSON.stringify(row[c]) : row[c]));
      await tx.query(
        `insert into portfolio.${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
        vals
      );
    }
  });
}

test('every file the content points at exists, once', () => {
  const urls = new Set(JSON.stringify(CONTENT).match(/\/media\/[^"]+/g));
  assert.equal(rows.media.length, urls.size, 'one media row per distinct file');
  for (const m of rows.media) assert.ok(m.bytes > 0 && /^[0-9a-f]{64}$/.test(m.sha256), m.path);
});

test('ids are stable, so a second run is the same run', () => {
  const again = toRows(CONTENT, describe);
  assert.deepEqual(again, rows);
});

test('the content survives the database and comes back unchanged', async () => {
  // Parents before children, as the foreign keys require.
  await insertAsOwner('settings', [{ id: true, ...rows.settings }]);
  await insertAsOwner('pages', rows.pages);
  await insertAsOwner('media', rows.media);
  await insertAsOwner('projects', rows.projects);
  await insertAsOwner('project_tags', rows.tags);
  await insertAsOwner('blocks', rows.blocks);
  await insertAsOwner('lists', rows.lists);

  await db.transaction(async (tx) => {
    await tx.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${OWNER}', true);`);
    await tx.query(`select portfolio.publish('["Migrated from Strapi"]')`);
  });

  // Read back the way the public build will: as a visitor.
  const { rows: [release] } = await db.transaction(async (tx) => {
    await tx.exec(`set local role anon; select set_config('request.jwt.claim.sub', '', true);`);
    return tx.query(`select snapshot from portfolio.releases where is_current`);
  });

  const back = fromRows(release.snapshot);
  assert.deepEqual(comparable(back), comparable(CONTENT));
});

test('the counts match what the site shows', () => {
  assert.equal(rows.projects.length, CONTENT.projects.length);
  assert.equal(rows.blocks.length, CONTENT.projects.length * 7);
  assert.equal(rows.lists.filter((l) => l.list_key === 'services').length, CONTENT.services.length);
  assert.equal(rows.lists.filter((l) => l.list_key === 'process').length, CONTENT.processSteps.length);
  assert.equal(
    rows.tags.length,
    CONTENT.projects.reduce((n, p) => n + (p.categories?.length ?? 0), 0)
  );
});
