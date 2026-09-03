'use strict';

/**
 * Publish content changes in one step.
 *
 *   npm run publish
 *   npm run publish -- "Added the Acme project"
 *
 * Editing in the Strapi admin only writes to the local database. Three more
 * things have to happen before the live site changes, and doing them by hand is
 * easy to get half-right — commit without exporting first and the push succeeds
 * while the site stays exactly the same. So this does all of it:
 *
 *   1. export   read the database -> content.json, media, sanitised db copy
 *   2. build    prove the site still builds before anything is pushed
 *   3. commit   stage everything and commit
 *   4. push     to the branch you are on
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });

const capture = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();

function step(n, text) {
  console.log(`\n\x1b[1m[${n}/4] ${text}\x1b[0m`);
}

function main() {
  const message = process.argv.slice(2).join(' ').trim() || 'Update content';

  let branch;
  try {
    branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  } catch {
    console.error('Not a git repository.');
    process.exit(1);
  }

  step(1, 'Reading the CMS database');
  run('npm', ['run', 'export']);

  step(2, 'Building the site to check nothing is broken');
  run('npm', ['run', 'build:web']);

  step(3, 'Committing');
  run('git', ['add', '-A']);

  const staged = capture('git', ['diff', '--cached', '--name-only']);
  if (!staged) {
    console.log('\nNothing changed — the site is already up to date. Not pushing.');
    return;
  }

  console.log(`${staged.split('\n').length} file(s) changed`);
  run('git', ['commit', '-m', message]);

  step(4, `Pushing to ${branch}`);
  run('git', ['push', 'origin', branch]);

  console.log(
    `\n\x1b[32mDone.\x1b[0m Vercel is building now — it usually takes about a minute.\n` +
      (branch === 'main'
        ? '  Your live site will update when it finishes.\n'
        : `  This updates the preview for the "${branch}" branch, not the live site.\n`)
  );
}

try {
  main();
} catch (error) {
  console.error(`\n\x1b[31mStopped.\x1b[0m ${error.message}`);
  console.error('Nothing was pushed. Fix the problem above and run it again.');
  process.exit(1);
}
