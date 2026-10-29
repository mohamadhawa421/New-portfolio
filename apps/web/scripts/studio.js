/**
 * Runs astro with STUDIO=1, on any shell.
 *
 *   npm run dev:studio      →  node scripts/studio.js dev
 *   npm run build:studio    →  node scripts/studio.js build
 *
 * `STUDIO=1 astro dev` is POSIX syntax: it works on Vercel's builders and in
 * Git Bash, and npm on Windows hands it to cmd.exe, which reads `STUDIO=1`
 * as the name of a program. Setting the variable here and starting astro as
 * a child is the same thing on every shell, without a dependency for it.
 */

import { spawn } from 'node:child_process';

const child = spawn('astro', process.argv.slice(2), {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, STUDIO: '1' },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
