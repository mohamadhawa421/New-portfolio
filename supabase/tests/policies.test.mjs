/**
 * The database's security, attacked from the three places a request can come
 * from: a visitor (anon), somebody with an app.mohamadhawa.com account
 * (authenticated, not staff), and the owner (authenticated, in admins).
 *
 * Runs the real migrations in PGlite — Postgres compiled to WebAssembly — so
 * it needs no Docker and no Supabase project. What PGlite does not have is
 * Supabase's own scaffolding, so `stubSupabase` below recreates the parts the
 * migrations lean on: the anon/authenticated roles, auth.users, auth.uid()
 * reading the JWT claim the way GoTrue sets it, and the two Storage tables.
 * The stub is deliberately minimal — anything it gets wrong would show up as
 * a migration that fails to apply on the real project, not as a false pass.
 *
 * Every assertion that something is *refused* was checked by removing the
 * rule it guards and watching the test fail.
 *
 *   npm run test:db
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { stubSupabase, OWNER, APP_USER } from './stub.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = process.env.MIGRATIONS_DIR || path.resolve(HERE, '..', 'migrations');


let db;

/** Run `fn` as a given caller, the way PostgREST does: role + JWT claim. */
async function as(who, fn) {
  const role = who === 'anon' ? 'anon' : 'authenticated';
  const sub = who === 'owner' ? OWNER : who === 'app' ? APP_USER : '';
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}; select set_config('request.jwt.claim.sub', '${sub}', true);`);
    return fn(tx);
  });
}

/** Resolves to the error message, or fails the test if the call succeeded. */
async function refused(promise) {
  try {
    await promise;
  } catch (e) {
    return e.message;
  }
  assert.fail('expected this to be refused, and it was allowed');
}

before(async () => {
  db = new PGlite();
  await stubSupabase(db);
  for (const file of fs.readdirSync(MIGRATIONS).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'));
  }
  await db.exec(`
    insert into auth.users values ('${OWNER}', 'owner@example.test'), ('${APP_USER}', 'someone@example.test');
    insert into public.admins (user_id) values ('${OWNER}');
  `);
});

/* ------------------------------------------------------------------ */

test('the owner can write the draft', async () => {
  await as('owner', async (tx) => {
    await tx.exec(`
      insert into portfolio.settings (fields) values ('{"siteName": "Mohamad Hawa"}');
      insert into portfolio.pages (key, fields) values ('home', '{"heroTitle": "Draft headline"}');
      insert into portfolio.projects (kind, slug, title) values ('case', 'kanz', 'Kanz');
    `);
    const { rows } = await tx.query(`select count(*)::int as n from portfolio.projects`);
    assert.equal(rows[0].n, 1);
  });
});

test('a visitor cannot see the draft at all', async () => {
  for (const table of ['settings', 'pages', 'projects', 'blocks', 'media', 'lists', 'styles', 'project_tags']) {
    const message = await refused(as('anon', (tx) => tx.query(`select * from portfolio.${table}`)));
    assert.match(message, /permission denied/, table);
  }
});

test('an app user sees an empty draft and cannot write to it', async () => {
  await as('app', async (tx) => {
    const { rows } = await tx.query(`select * from portfolio.projects`);
    assert.equal(rows.length, 0, 'RLS should hide every draft row from a non-admin');
  });
  const message = await refused(
    as('app', (tx) => tx.exec(`insert into portfolio.projects (kind, slug, title) values ('case', 'x', 'X')`))
  );
  assert.match(message, /row-level security/);

  // Updates and deletes do not error under RLS — they match nothing. Check
  // that nothing changed rather than that something threw.
  await as('app', (tx) => tx.exec(`update portfolio.projects set title = 'Hacked'; delete from portfolio.projects;`));
  await as('owner', async (tx) => {
    const { rows } = await tx.query(`select title from portfolio.projects`);
    assert.deepEqual(rows, [{ title: 'Kanz' }]);
  });
});

test('nobody can make themselves an admin', async () => {
  for (const who of ['anon', 'app', 'owner']) {
    await refused(
      as(who, (tx) => tx.exec(`insert into public.admins (user_id) values ('${APP_USER}')`))
    );
  }
  await as('app', async (tx) => {
    const { rows } = await tx.query(`select public.is_admin() as yes`);
    assert.equal(rows[0].yes, false);
  });
});

test('an app user cannot read the list of admins', async () => {
  await as('app', async (tx) => {
    const { rows } = await tx.query(`select * from public.admins`);
    assert.equal(rows.length, 0);
  });
  await as('owner', async (tx) => {
    const { rows } = await tx.query(`select user_id from public.admins`);
    assert.deepEqual(rows, [{ user_id: OWNER }], 'the owner sees exactly their own row');
  });
});

test('only an admin can publish', async () => {
  assert.match(await refused(as('anon', (tx) => tx.query(`select portfolio.publish()`))), /permission denied/);
  assert.match(await refused(as('app', (tx) => tx.query(`select portfolio.publish()`))), /not allowed/);
  const { rows } = await as('owner', (tx) => tx.query(`select portfolio.publish('["first"]') as id`));
  assert.ok(rows[0].id > 0);
});

test('a visitor reads the current release and nothing else', async () => {
  await as('owner', (tx) => tx.exec(`
    update portfolio.pages set fields = '{"heroTitle": "Second headline"}' where key = 'home';
    select portfolio.publish('["second"]');
  `));
  const { rows } = await as('anon', (tx) =>
    tx.query(`select snapshot -> 'pages' -> 0 -> 'fields' ->> 'heroTitle' as title from portfolio.releases`)
  );
  assert.deepEqual(rows, [{ title: 'Second headline' }], 'exactly one release, the current one');

  const history = await as('owner', (tx) => tx.query(`select id from portfolio.releases`));
  assert.equal(history.rows.length, 2, 'staff see the history');
});

test('draft edits do not reach the public release until published', async () => {
  await as('owner', (tx) => tx.exec(`update portfolio.pages set fields = '{"heroTitle": "Unpublished"}' where key = 'home'`));
  const { rows } = await as('anon', (tx) =>
    tx.query(`select snapshot -> 'pages' -> 0 -> 'fields' ->> 'heroTitle' as title from portfolio.releases`)
  );
  assert.equal(rows[0].title, 'Second headline');
});

test('nobody writes releases directly', async () => {
  for (const who of ['anon', 'app', 'owner']) {
    await refused(as(who, (tx) => tx.exec(`insert into portfolio.releases (snapshot, is_current) values ('{}', true)`)));
    await refused(as(who, (tx) => tx.exec(`update portfolio.releases set is_current = true`)));
  }
});

test('rollback restores the release and resets the draft to it', async () => {
  const first = (await as('owner', (tx) => tx.query(`select min(id) as id from portfolio.releases`))).rows[0].id;
  assert.match(await refused(as('app', (tx) => tx.query(`select portfolio.rollback(${first})`))), /not allowed/);

  await as('owner', (tx) => tx.query(`select portfolio.rollback(${first})`));

  const pub = await as('anon', (tx) =>
    tx.query(`select snapshot -> 'pages' -> 0 -> 'fields' ->> 'heroTitle' as title, restored_from from portfolio.releases`)
  );
  assert.deepEqual(pub.rows, [{ title: 'Draft headline', restored_from: first }]);

  const draft = await as('owner', (tx) => tx.query(`select fields ->> 'heroTitle' as title from portfolio.pages where key = 'home'`));
  assert.equal(draft.rows[0].title, 'Draft headline', 'the unpublished edit is gone from the draft too');
});

test('releases are capped, so history cannot grow without bound', async () => {
  await as('owner', async (tx) => {
    for (let i = 0; i < 25; i += 1) await tx.query(`select portfolio.publish()`);
    const { rows } = await tx.query(`select count(*)::int as n, count(*) filter (where is_current)::int as current from portfolio.releases`);
    assert.deepEqual(rows[0], { n: 20, current: 1 });
  });
});

test('content rules hold whoever writes', async () => {
  const cases = [
    `insert into portfolio.projects (kind, slug, title) values ('case', 'Bad Slug', 'X')`,
    `insert into portfolio.projects (kind, slug, title) values ('case', 'ok', '   ')`,
    `insert into portfolio.projects (kind, slug, title) values ('blog', 'ok', 'X')`,
    `insert into portfolio.styles (element_key, prop, token) values ('home.heroTitle', 'color', 'red; background: url(x)')`,
    `insert into portfolio.styles (element_key, prop, token) values ('home.heroTitle', 'css', 'blue')`,
    `insert into portfolio.pages (key) values ('admin')`,
  ];
  for (const sql of cases) await refused(as('owner', (tx) => tx.exec(sql)));
});

test('storage: only staff can upload to the portfolio bucket', async () => {
  const put = `insert into storage.objects (bucket_id, name) values ('portfolio-media', 'a/cover.webp')`;
  await refused(as('anon', (tx) => tx.exec(put)));
  await refused(as('app', (tx) => tx.exec(put)));
  await as('owner', (tx) => tx.exec(put));

  // An app user cannot list, rename or delete the portfolio's files either.
  await as('app', async (tx) => {
    assert.equal((await tx.query(`select * from storage.objects`)).rows.length, 0);
    await tx.exec(`update storage.objects set name = 'x'; delete from storage.objects;`);
  });
  await as('owner', async (tx) => {
    assert.deepEqual((await tx.query(`select name from storage.objects`)).rows, [{ name: 'a/cover.webp' }]);
  });
});

test('the reserved app schema is closed', async () => {
  for (const who of ['anon', 'app']) {
    const message = await refused(as(who, (tx) => tx.exec(`create table app.probe (id int)`)));
    assert.match(message, /permission denied/);
  }
});
