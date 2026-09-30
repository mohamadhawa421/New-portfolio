/**
 * The public build's content, from the current Supabase release.
 *
 *   node scripts/fetch-release.js          exit 0: content.json + public/media written
 *                                          exit 2: Supabase unreachable / no release —
 *                                                  nothing was written, fall back
 *
 * It replaces what the Strapi exporter did before a build, and writes the same
 * two things in the same shapes, so no page changes:
 *
 *   src/data/content.json   via fromRows() — the round-trip test proves it is the
 *                           shape the pages read
 *   public/media/           every image the release uses, plus its 420/840/1200
 *                           variants: downloaded as uploaded when they exist,
 *                           generated with the exporter's own rule when not (an
 *                           image added in the Studio)
 *
 * It reads as a visitor — the publishable key and RLS, which let anyone read
 * exactly one thing: the current release. Drafts are not reachable from here
 * by construction, so a build can never publish a draft by accident.
 *
 * Everything is staged in a temporary directory and moved into place only
 * after every file has arrived, so a network failure halfway through leaves the
 * previous content untouched rather than half-replaced.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { fromRows, mediaUrl } from './content-map.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const CONTENT = path.join(WEB, 'src', 'data', 'content.json');
const MEDIA = path.join(WEB, 'public', 'media');
const BUCKET = 'portfolio-media';

/*
 * The project's public address and publishable key. Both are safe to commit —
 * the key exists to be shipped to browsers, and what it can read is decided by
 * RLS, not by keeping it secret — and committing them means the public Vercel
 * project needs no configuration to build. Env wins, for a staging project.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pblwpommaedbqebicanz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_o2WIGT-1MFHu6uec8G3boQ_s4jkyKSi';

/* The exporter's ladder. tests/invariants.test.js keeps all three copies in step. */
const VARIANT_WIDTHS = [420, 840, 1200];
const wantsVariant = (width, at) => width >= at * 1.15;

const TIMEOUT_MS = 20000;
const log = (s) => console.log(`[release] ${s}`);

async function get(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res;
}

async function currentRelease() {
  const res = await get(`${SUPABASE_URL}/rest/v1/releases?select=id,created_at,snapshot&is_current=eq.true`, {
    headers: { apikey: SUPABASE_KEY, 'Accept-Profile': 'portfolio' },
  });
  if (!res.ok) throw new Error(`releases: HTTP ${res.status} ${await res.text()}`);
  const [release] = await res.json();
  if (!release) throw new Error('there is no published release yet');
  return release;
}

const objectUrl = (p) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p.split('/').map(encodeURIComponent).join('/')}`;

async function download(objectPath, to) {
  const res = await get(objectUrl(objectPath));
  if (res.status === 400 || res.status === 404) return false;
  if (!res.ok) throw new Error(`${objectPath}: HTTP ${res.status}`);
  fs.writeFileSync(to, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main() {
  const release = await currentRelease();
  const snap = release.snapshot;
  log(`release ${release.id} from ${release.created_at}`);

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-release-'));
  const stageMedia = path.join(stage, 'media');
  fs.mkdirSync(stageMedia);

  let sharp = null;
  try {
    sharp = createRequire(import.meta.url)('sharp');
  } catch {
    /* only needed for images that arrived without variants */
  }

  // Only what a published page can show; a draft-only image stays in Storage.
  const media = snap.media ?? [];
  let files = 0;
  let generated = 0;
  for (const m of media) {
    const name = path.basename(mediaUrl(m.path));
    const to = path.join(stageMedia, name);
    if (!(await download(m.path, to))) throw new Error(`${m.path} is in the release but not in Storage`);
    files += 1;

    if (!/\.(webp|png|jpe?g|avif)$/i.test(name) || !m.width) continue;
    const base = name.slice(0, -path.extname(name).length);
    const dir = path.posix.dirname(m.path);
    for (const at of VARIANT_WIDTHS) {
      if (!wantsVariant(m.width, at)) continue;
      const variant = `${base}-${at}.webp`;
      if (await download(`${dir}/${variant}`, path.join(stageMedia, variant))) {
        files += 1;
      } else if (sharp) {
        await sharp(to).resize({ width: at, withoutEnlargement: true }).webp({ quality: 82, effort: 5 })
          .toFile(path.join(stageMedia, variant));
        generated += 1;
      }
    }
  }

  const content = fromRows(snap, { generatedAt: release.created_at });

  // Everything arrived; swap it in.
  fs.rmSync(MEDIA, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(MEDIA), { recursive: true });
  fs.cpSync(stageMedia, MEDIA, { recursive: true });
  fs.rmSync(stage, { recursive: true, force: true });

  const next = `${JSON.stringify(content, null, 2)}\n`;
  const prev = fs.existsSync(CONTENT) ? fs.readFileSync(CONTENT, 'utf8') : '';
  fs.writeFileSync(CONTENT, next);

  log(`${content.projects.length} projects, ${media.length} images, ${files} files downloaded` +
      `${generated ? `, ${generated} variants generated` : ''}${prev === next ? ' (content unchanged)' : ''}`);
}

main().catch((e) => {
  console.warn(`[release] could not use Supabase: ${e.message}`);
  process.exit(2);
});
