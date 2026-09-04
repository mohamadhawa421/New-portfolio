'use strict';

/**
 * Traces the avatar's two eyes into SVG paths.
 *
 *   node scripts/trace-avatar-eyes.js
 *
 * The designer-mode easter egg redraws the eyes so they can follow the pointer,
 * which means it needs to know two shapes per eye in the portrait's own 1024px
 * coordinate space:
 *
 *   opening   the whole eye aperture — white sclera and iris together. The egg
 *             fills this with the sclera colour to wipe the painted-in iris,
 *             and clips everything else to it so nothing escapes the eyelid.
 *   iris      the iris silhouette, which the egg redraws in purple and slides
 *             around inside the opening.
 *
 * Both are traced from the artwork rather than eyeballed, so they sit exactly
 * where the painted ones do and the eyes look untouched until they move.
 *
 * Run this again if the portrait is ever replaced — the paths are specific to
 * this drawing, and the egg is the only thing that reads them. It writes
 * `apps/web/src/lib/avatar-eyes.ts`.
 *
 * Rows rather than contours: for each scanline the sclera's own extremes give
 * the aperture, and the dark pixels between them give the iris. A polygon of
 * per-row spans is exact to the pixel, and at the size the portrait is actually
 * displayed — 420px from a 1024px source — a one-pixel step is 0.4 of a device
 * pixel. There is nothing to smooth.
 */

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'public', 'uploads', 'mohamad_avatar_a92d0cc4d7.jpg');
const OUT = path.join(__dirname, '..', '..', 'web', 'src', 'lib', 'avatar-eyes.ts');

/** Generous boxes around each eye. Only has to contain one eye and no other. */
const BOXES = {
  left: { x0: 360, x1: 500, y0: 400, y1: 495 },
  right: { x0: 505, x1: 655, y0: 395, y1: 485 },
};

/** Near-white and unsaturated. Skin is bright too, but nothing like as grey. */
const isSclera = ([r, g, b]) => Math.max(r, g, b) > 175 && Math.max(r, g, b) - Math.min(r, g, b) < 34;
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function polygon(rows, key) {
  const left = rows.map((row) => `${row[key][0]} ${row.y}`);
  const right = rows
    .slice()
    .reverse()
    .map((row) => `${row[key][1] + 1} ${row.y + 1}`);
  return `M${left.join('L')}L${right.join('L')}Z`;
}

async function main() {
  const sharp = require('sharp');
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  const eyes = {};
  let scleraTotal = [0, 0, 0];
  let scleraCount = 0;

  for (const [name, box] of Object.entries(BOXES)) {
    const rows = [];

    for (let y = box.y0; y <= box.y1; y++) {
      let first = -1;
      let last = -1;
      for (let x = box.x0; x <= box.x1; x++) {
        const p = pixel(x, y);
        if (!isSclera(p)) continue;
        if (first < 0) first = x;
        last = x;
        scleraTotal = [scleraTotal[0] + p[0], scleraTotal[1] + p[1], scleraTotal[2] + p[2]];
        scleraCount += 1;
      }
      // A row of two or three pixels is the corner of the lid, not the aperture.
      if (first < 0 || last - first < 14) continue;

      // The iris is whatever is dark *between* the sclera's own extremes. The
      // eyelid and the outline are outside them, which is what keeps them out.
      let irisFirst = -1;
      let irisLast = -1;
      for (let x = first; x <= last; x++) {
        if (luminance(pixel(x, y)) >= 80) continue;
        if (irisFirst < 0) irisFirst = x;
        irisLast = x;
      }

      rows.push({ y, opening: [first, last], iris: irisFirst < 0 ? null : [irisFirst, irisLast] });
    }

    if (!rows.length) throw new Error(`No aperture found for the ${name} eye.`);

    // Drop the slivers at the very top and bottom, where the lid closes over.
    const widest = Math.max(...rows.map((r) => r.opening[1] - r.opening[0]));
    const body = rows.filter((r) => r.opening[1] - r.opening[0] > widest * 0.42);
    const irisRows = body.filter((r) => r.iris && r.iris[1] - r.iris[0] > 4);

    const irisXs = irisRows.flatMap((r) => r.iris);
    const irisYs = irisRows.map((r) => r.y);

    eyes[name] = {
      opening: polygon(body, 'opening'),
      iris: polygon(irisRows, 'iris'),
      centre: [
        (Math.min(...irisXs) + Math.max(...irisXs) + 1) / 2,
        (Math.min(...irisYs) + Math.max(...irisYs) + 1) / 2,
      ],
      // How far the iris can slide before it reaches the corner of the eye.
      travel: [
        Math.max(
          0,
          Math.min(
            Math.min(...irisXs) - Math.min(...body.map((r) => r.opening[0])),
            Math.max(...body.map((r) => r.opening[1])) - Math.max(...irisXs)
          ) - 2
        ),
        3,
      ],
    };

    console.log(
      `${name}: aperture ${body.length} rows, iris ${irisRows.length} rows, ` +
        `centre ${eyes[name].centre.map(Math.round).join(',')}, travel ±${eyes[name].travel[0]}`
    );
  }

  const sclera =
    '#' +
    scleraTotal
      .map((v) => Math.round(v / scleraCount).toString(16).padStart(2, '0'))
      .join('');

  const file = `/**
 * The avatar's eyes, traced from the artwork.
 *
 * GENERATED by \`apps/cms/scripts/trace-avatar-eyes.js\` — run that again if the
 * portrait is ever replaced. Coordinates are in the portrait's own 1024x1024
 * space, which is why the overlay that uses them can be a plain viewBox.
 *
 * Only the designer-mode easter egg reads this.
 */

export interface AvatarEye {
  /** The whole aperture: sclera and iris together, clipped by the eyelid. */
  opening: string;
  /** The iris silhouette. Its highlight is a hole, so the sclera shows through. */
  iris: string;
  /** Where the iris sits at rest. */
  centre: [number, number];
  /** How far it can slide from there before it reaches the corner. */
  travel: [number, number];
}

/** The sclera's own colour, averaged off the drawing. */
export const SCLERA = '${sclera}';

export const AVATAR_EYES: Record<'left' | 'right', AvatarEye> = ${JSON.stringify(eyes, null, 2)
    .replace(/"(opening|iris|centre|travel|left|right)":/g, '$1:')
    .replace(/\n/g, '\n')};
`;

  fs.writeFileSync(OUT, file);
  console.log(`\nsclera ${sclera}\nwrote ${path.relative(process.cwd(), OUT)}`);
}

main().catch((error) => {
  console.error(`[eyes] Failed: ${error.message}`);
  process.exit(1);
});
