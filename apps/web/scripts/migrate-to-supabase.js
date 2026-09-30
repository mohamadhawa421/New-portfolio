/**
 * Strapi → Supabase, once.
 *
 *   npm run studio:migrate
 *
 * Reads what production shows today — content.json and the files in
 * public/media — rather than Strapi's API, because that is the exact content
 * the live site is built from, already cleaned by the exporter. Strapi is not
 * touched and stays the source of truth until the build is switched over.
 *
 * It signs in as the owner (the password is asked for here, with the typing
 * hidden, and goes straight to Supabase Auth), so every write goes through the
 * same RLS a Studio edit will — there is no service-role key anywhere in this.
 *
 * Steps, each checked before the next:
 *   1. map content.json to rows (content-map.js — the same code the round-trip
 *      test proves)
 *   2. upload every image to portfolio-media/legacy/, skipping any already there
 *      with the same bytes
 *   3. write the rows (upserts on stable ids, so a second run changes nothing)
 *   4. publish the first release
 *   5. read that release back *as a visitor*, map it back, and compare it with
 *      content.json. Anything different is printed and the run fails.
 *
 * Refuses to run over a draft that already has projects in it unless given
 * --replace, so it cannot quietly overwrite work done in the Studio.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { toRows, fromRows, comparable } from './content-map.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const PUBLIC = path.join(WEB, 'public');
const BUCKET = 'portfolio-media';

/* ---- configuration: the same three variables the Studio uses ---- */

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.join(WEB, '.env.development.local'));
loadEnv(path.join(WEB, '.env'));

const { SUPABASE_URL, SUPABASE_ANON_KEY, STUDIO_EMAIL } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !STUDIO_EMAIL) {
  console.error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or STUDIO_EMAIL (apps/web/.env.development.local).');
  process.exit(1);
}
const REPLACE = process.argv.includes('--replace');

const say = (s) => console.log(s);
const step = (n, s) => console.log(`\n\x1b[1m[${n}/5] ${s}\x1b[0m`);
const fail = (s) => {
  console.error(`\n\x1b[31m✗ ${s}\x1b[0m`);
  process.exit(1);
};

/** Asks for the password without echoing it. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let asked = false;
    rl._writeToOutput = (s) => {
      // Print the question once and nothing the user types after it.
      if (!asked && s.startsWith(question)) {
        asked = true;
        rl.output.write(question);
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const describe = (url) => {
  const buf = fs.readFileSync(path.join(PUBLIC, url));
  return { bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
};

async function main() {
  const content = JSON.parse(fs.readFileSync(path.join(WEB, 'src/data/content.json'), 'utf8'));

  step(1, 'Mapping content.json');
  const rows = toRows(content, describe);
  say(`  ${rows.projects.length} projects, ${rows.blocks.length} sections, ${rows.tags.length} tags, ` +
      `${rows.lists.length} list items, ${rows.pages.length} pages, ${rows.media.length} images`);

  const password = await askHidden(`\nStudio password for ${STUDIO_EMAIL}: `);
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: authError } = await db.auth.signInWithPassword({ email: STUDIO_EMAIL, password });
  if (authError) fail(`Sign-in refused: ${authError.message}`);
  const { data: staff } = await db.from('admins').select('role').maybeSingle();
  if (!staff) fail('Signed in, but this account is not in public.admins.');
  say(`  signed in as ${STUDIO_EMAIL} (${staff.role})`);

  const portfolio = db.schema('portfolio');
  const { count } = await portfolio.from('projects').select('id', { count: 'exact', head: true });
  if (count && !REPLACE && !process.argv.includes('--media-only')) {
    fail(`The draft already has ${count} projects. Re-run with --replace to overwrite it with content.json.`);
  }

  step(2, `Uploading ${rows.media.length} images`);
  const { data: existing } = await db.storage.from(BUCKET).list('legacy', { limit: 1000 });
  const have = new Map((existing ?? []).map((o) => [o.name, o.metadata?.size]));
  let uploaded = 0;
  for (const m of rows.media) {
    const name = m.path.slice('legacy/'.length);
    if (have.get(name) === m.bytes) continue;
    const body = fs.readFileSync(path.join(PUBLIC, 'media', name));
    const { error } = await db.storage.from(BUCKET).upload(m.path, body, {
      contentType: m.mime,
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) fail(`Upload of ${name} failed: ${error.message}`);
    uploaded += 1;
    process.stdout.write(`\r  ${uploaded} uploaded`);
  }
  // The 420/840/1200 variants the exporter made from the original uploads.
  // Carried as they are, because regenerating them from the full-size webp
  // would re-encode an already-encoded image and lose a little every time.
  for (const m of rows.media) {
    const name = m.path.slice('legacy/'.length);
    const base = name.slice(0, -path.extname(name).length);
    for (const at of [420, 840, 1200]) {
      const variant = `${base}-${at}.webp`;
      const file = path.join(PUBLIC, 'media', variant);
      if (!fs.existsSync(file)) continue;
      const body = fs.readFileSync(file);
      if (have.get(variant) === body.length) continue;
      const { error } = await db.storage.from(BUCKET).upload(`legacy/${variant}`, body, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '31536000',
      });
      if (error) fail(`Upload of ${variant} failed: ${error.message}`);
      uploaded += 1;
      process.stdout.write(`\r  ${uploaded} uploaded`);
    }
  }
  say(`${uploaded ? '\n' : ''}  ${uploaded} file(s) uploaded; the rest were already there`);

  step(3, 'Writing the draft');
  if (REPLACE) {
    // Children first. Only what this script owns is cleared; media rows are
    // upserted below, so an image uploaded in the Studio is not lost.
    for (const t of ['blocks', 'project_tags', 'lists', 'projects', 'pages']) {
      // PostgREST refuses an unfiltered delete; "key/id is not null" is every row.
      const { error } = await portfolio.from(t).delete().not(t === 'pages' ? 'key' : 'id', 'is', null);
      if (error) fail(`Clearing ${t}: ${error.message}`);
    }
  }
  const write = async (table, list, onConflict = 'id') => {
    if (!list.length) return;
    const { error } = await portfolio.from(table).upsert(list, { onConflict });
    if (error) fail(`Writing ${table}: ${error.message}`);
    say(`  ${table}: ${list.length}`);
  };
  await write('settings', [{ id: true, ...rows.settings }]);
  await write('pages', rows.pages, 'key');
  await write('media', rows.media);
  await write('projects', rows.projects);
  await write('project_tags', rows.tags);
  await write('blocks', rows.blocks);
  await write('lists', rows.lists);

  step(4, 'Publishing');
  const { data: releaseId, error: pubError } = await portfolio.rpc('publish', {
    summary: ['Migrated from Strapi'],
  });
  if (pubError) fail(`Publish failed: ${pubError.message}`);
  say(`  release ${releaseId} is current`);

  step(5, 'Reading it back as a visitor and comparing');
  const visitor = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: rel, error: readError } = await visitor
    .schema('portfolio')
    .from('releases')
    .select('id, snapshot')
    .maybeSingle();
  if (readError || !rel) fail(`Could not read the release as a visitor: ${readError?.message ?? 'none'}`);

  const back = comparable(fromRows(rel.snapshot));
  const want = comparable(content);
  if (!isDeepStrictEqual(back, want)) {
    for (const key of Object.keys(want)) {
      if (!isDeepStrictEqual(back[key], want[key])) say(`  differs: ${key}`);
    }
    fail('The published content does not match content.json. Nothing on the live site has changed.');
  }

  // Every image must be publicly reachable at the URL the build will fetch.
  let broken = 0;
  for (const m of rows.media) {
    const { data } = db.storage.from(BUCKET).getPublicUrl(m.path);
    const res = await fetch(data.publicUrl, { method: 'HEAD' });
    const size = Number(res.headers.get('content-length'));
    if (!res.ok || (size && size !== m.bytes)) {
      broken += 1;
      say(`  ✗ ${m.path}: ${res.status}`);
    }
  }
  if (broken) fail(`${broken} image(s) are not reachable.`);

  say(`\n\x1b[32m✓ Supabase now holds exactly what the live site shows.\x1b[0m`);
  say(`  ${rows.projects.length} projects · ${rows.media.length} images, all reachable · release ${rel.id}`);
  say(`  The next build of the public site will use this release.`);
  await db.auth.signOut();
}

main().catch((e) => fail(e.stack || String(e)));
