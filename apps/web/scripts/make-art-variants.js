/**
 * Small renderings of the artwork that does not come from the CMS.
 *
 * The character drawings live in `public/` rather than in Strapi — they are
 * part of the interface, not content — so the export script's variant pass
 * never sees them. Measured: `character-thinking.webp` is 560px wide and is
 * drawn at 120 CSS px beside the contact form and 132 in the Design Lab, so
 * even at 2x it carries five times the pixels it paints. It is also one of
 * the few images that fades in, which is when an oversized bitmap costs the
 * most: an entrance repaints, and every repaint re-rescales.
 *
 * One extra width is enough. 320 covers every small placement at 2x (the
 * largest is 132 CSS px, wanting 264) and the original stays for the one
 * genuinely large use — the aside on the work index is 188 CSS px, which
 * wants 564 at 3x and gets the full 560.
 *
 * Output goes to `public/art/`, which is gitignored, because these are
 * derived files: committing them means a stale variant can outlive the
 * drawing it came from with nothing to say so.
 *
 * Runs as a prebuild step, and is a no-op when the variants are newer than
 * their sources, so it costs nothing on a rebuild.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, '..', 'public');
const OUT = path.join(PUBLIC, 'art');

/** The one extra width. See the note above for why it is only one. */
export const ART_WIDTH = 320;

/**
 * Sharp comes in as a build-time dependency of Astro rather than a direct
 * one, so it is required rather than imported — and its absence is a
 * warning rather than a failure, because the page still works without the
 * variants. The srcset simply has one entry.
 */
const require = createRequire(import.meta.url);
let sharp = null;
try {
  sharp = require('sharp');
} catch {
  console.warn('[art] sharp not available — skipping variants; pages fall back to full size.');
  process.exit(0);
}

const sources = fs
  .readdirSync(PUBLIC)
  .filter((f) => /^(character|avatar)-.*\.webp$/.test(f));

if (!sources.length) {
  console.warn('[art] no character artwork found in public/ — nothing to do.');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });

let made = 0;
let skipped = 0;

for (const file of sources) {
  const from = path.join(PUBLIC, file);
  const to = path.join(OUT, `${file.slice(0, -'.webp'.length)}-${ART_WIDTH}.webp`);

  // Nothing to do when the variant is already newer than its source.
  if (fs.existsSync(to) && fs.statSync(to).mtimeMs >= fs.statSync(from).mtimeMs) {
    skipped += 1;
    continue;
  }

  const { width } = await sharp(from).metadata();
  // No upscaling, and no variant that is barely smaller than the original.
  if (!width || width < ART_WIDTH * 1.15) {
    skipped += 1;
    continue;
  }

  await sharp(from)
    .resize({ width: ART_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(to);
  made += 1;
}

console.log(
  `[art] ${made} variant(s) written to public/art${skipped ? `, ${skipped} already current` : ''}`
);
