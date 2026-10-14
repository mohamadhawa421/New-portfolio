/**
 * Writes `apps/web/.env.development.local`, by asking rather than by editing.
 *
 *   npm run studio:env
 *
 * The Studio and the migration both need the same three values, and on a new
 * machine there is nothing to read them from — `.env.*.local` is gitignored,
 * deliberately, so it is the one file a fresh clone never has. Making one by
 * hand is a small job with two traps in it that cost an afternoon each:
 *
 *   1. A text editor on Windows saves CRLF. The loaders in this repo split on
 *      "\n" and keep everything after the "=", so every value silently ends in
 *      a carriage return and every request fails somewhere unrelated.
 *   2. Quoting. `SUPABASE_URL="https://x.supabase.co"` is read with the quotes
 *      still attached, which fails the same way.
 *
 * So the file is written here instead: LF, unquoted, one value per line.
 *
 * Nothing is stored that is not already public. The URL and the anon key both
 * ship inside the Studio's own browser bundle — that is what "publishable"
 * means. The password is not asked for here at all; `migrate-to-supabase.js`
 * asks for it at the moment it signs in, and it goes straight to Supabase.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(WEB, '.env.development.local');

/**
 * What the file already has, so this only asks for what it does not.
 *
 * Two of the three can be filled in without the owner present — the project
 * URL is a public address and the email is an email — and neither is worth
 * making somebody re-type. The key is the one value that has to be pasted by
 * the person who can see it, so when the other two are already there this
 * becomes a single question.
 */
function existing() {
  const have = {};
  if (!fs.existsSync(TARGET)) return have;
  for (const line of fs.readFileSync(TARGET, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (m && m[2].trim()) have[m[1]] = m[2].trim();
  }
  return have;
}

const already = existing();

const say = (line = '') => process.stdout.write(`${line}\n`);

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** The same hidden prompt the migration uses, so a key is never left on screen. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let asked = false;
    rl._writeToOutput = (s) => {
      if (!asked && s.startsWith(question)) {
        asked = true;
        rl.output.write(question);
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

const fail = (why) => {
  say(`\n  ${why}\n`);
  process.exit(1);
};

/**
 * Refuses the service-role key.
 *
 * This is the one mistake in this file that would actually matter, and it is
 * an easy one: the two keys sit next to each other on the same dashboard page
 * and look alike. The anon key is public and bound by every RLS policy; the
 * service-role key bypasses all of them, and the whole schema is written on
 * the assumption that nothing outside the server ever holds it.
 *
 * A Supabase JWT carries its own role in the payload, so this can be checked
 * rather than trusted — no network call and no secret needed, just base64 of
 * the middle segment. The newer `sb_secret_…` keys announce themselves in the
 * prefix.
 */
function roleOf(key) {
  if (key.startsWith('sb_secret_')) return 'service_role';
  if (key.startsWith('sb_publishable_')) return 'anon';

  const parts = key.split('.');
  if (parts.length !== 3) return 'unknown';
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : 'unknown';
  } catch {
    return 'unknown';
  }
}

say('');
say('  Portfolio Studio — the three values this machine is missing.');
say('');
say('  All three are already set on the admin Vercel project, which is the');
say('  quickest place to copy them from:');
say('');
say('    vercel.com → the admin project → Settings → Environment Variables');
say('');
say('  Or from Supabase: Project Settings → Data API.');
say('');

let url = already.SUPABASE_URL;
if (url) {
  say(`  1. Project URL — already set: ${url}`);
} else {
  url = await ask('  1. Project URL (https://….supabase.co) : ');
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
  fail(`That does not look like a project URL: ${url || '(empty)'}`);
}

say('');
let key = already.SUPABASE_ANON_KEY;
if (key) {
  say(`  2. Key — already set, ${key.length} characters.`);
} else {
  say('  2. The anon / publishable key. It is long; paste it and press Enter.');
  say('     Nothing is echoed. NOT the service-role key — it is refused below.');
  key = await askHidden('     Key: ');
}
if (!key) fail('No key given.');

/*
 * Is it a key at all, before asking which kind of key it is.
 *
 * This check exists because of what actually happened: the terminal already
 * had an error message in it from a failed run, and that message is what got
 * pasted. It sailed through — `roleOf` could not classify it, and "could not
 * classify" was treated as "a format I have not seen yet" rather than as "this
 * is a sentence". The first sign of trouble was Supabase refusing the key
 * several minutes and one password prompt later, which is a long way from the
 * mistake.
 *
 * A key has no spaces in it and is not short. Neither test can reject a real
 * key, including a format that does not exist yet, and together they reject
 * every piece of prose anybody is likely to paste by accident.
 */
if (/\s/.test(key)) {
  fail(
    'That has spaces in it, so it is not a key — it looks like a line of text ' +
      'copied from somewhere else in the terminal. The key is one unbroken run ' +
      'of characters.'
  );
}
if (key.length < 40) {
  fail(`That is only ${key.length} characters. A Supabase key is far longer.`);
}

const role = roleOf(key);
if (role === 'service_role') {
  fail(
    'That is the service-role key. It bypasses every policy in this database ' +
      'and must never leave the server. Copy the anon / publishable one instead.'
  );
}
if (role === 'unknown') {
  say('');
  say('     Note: that key is not in a shape this could check. If the migration');
  say('     fails to sign in, a wrong key here is the first thing to suspect.');
}

say('');
let email = already.STUDIO_EMAIL;
if (email) {
  say(`  3. Email — already set: ${email}`);
} else {
  email = await ask('  3. The Studio account email : ');
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`That does not look like an email: ${email || '(empty)'}`);

const body = [
  '# Portfolio Studio — this machine only. Gitignored by .env.*.local.',
  '# Written by `npm run studio:env`. Values are unquoted and the file is LF,',
  '# because the loaders keep everything after the "=" exactly as it appears.',
  '',
  `SUPABASE_URL=${url}`,
  `SUPABASE_ANON_KEY=${key}`,
  `STUDIO_EMAIL=${email}`,
  '',
].join('\n');

fs.writeFileSync(TARGET, body, { encoding: 'utf8' });

say('');
say(`  Written: ${path.relative(path.resolve(WEB, '..', '..'), TARGET)}`);
say(`  URL   ${url}`);
say(`  Key   ${key.length} characters, role "${role}"`);
say(`  Email ${email}`);
say('');
say('  Next:  npm run studio:migrate -- --replace');
say('         It will ask for the Studio password, hidden, and sign in with it.');
say('');
