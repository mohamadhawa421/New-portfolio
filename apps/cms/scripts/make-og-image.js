'use strict';

/**
 * Generates the social share card at apps/web/public/og.png.
 *
 *   node scripts/make-og-image.js
 *
 * Run locally and commit the result. It is deliberately not part of the build:
 * text is rasterised with whatever fonts the machine has, so generating it on a
 * build server would produce a different image from the one that was reviewed.
 *
 * 1200x630 is the size Open Graph, Twitter, LinkedIn, WhatsApp and Slack all
 * crop from without cutting anything important.
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', '..', 'web', 'public', 'og.png');
const PORTRAIT = path.join(__dirname, '..', 'public', 'uploads');

const W = 1200;
const H = 630;

const escapeXml = (s) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]
  );

async function main() {
  const name = 'Mohamad Hawa';
  const role = 'Product Owner';
  const line = 'Designing intuitive experiences for web and mobile.';

  // Matches the site: near-black ground, white type, the same blue accent.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#1d1d1f"/>
  <circle cx="1010" cy="120" r="420" fill="#0066cc" opacity="0.10"/>
  <g font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif">
    <text x="90" y="300" fill="#ffffff" font-size="86" font-weight="600"
          letter-spacing="-2.2">${escapeXml(name)}</text>
    <text x="90" y="374" fill="#2997ff" font-size="38" font-weight="500"
          letter-spacing="-0.6">${escapeXml(role)}</text>
    <text x="90" y="452" fill="#c7c7cc" font-size="30" font-weight="300"
          letter-spacing="-0.3">${escapeXml(line)}</text>
    <rect x="90" y="506" width="72" height="4" rx="2" fill="#0066cc"/>
    <text x="90" y="566" fill="#8e8e93" font-size="24"
          letter-spacing="-0.2">mohamadhawa.vercel.app</text>
  </g>
</svg>`;

  const layers = [];

  // Drop the portrait in on the right if it is available.
  const portrait = fs
    .readdirSync(PORTRAIT)
    .find((f) => f.startsWith('mohamad_avatar') && !f.startsWith('thumbnail_'));

  if (portrait) {
    const avatar = await sharp(path.join(PORTRAIT, portrait))
      .resize(300, 300, { fit: 'cover' })
      .composite([
        {
          input: Buffer.from(
            `<svg><rect x="0" y="0" width="300" height="300" rx="66" ry="66"/></svg>`
          ),
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();
    layers.push({ input: avatar, left: W - 300 - 90, top: Math.round((H - 300) / 2) });
  } else {
    console.warn('[og] No portrait found in uploads — generating text only.');
  }

  await sharp(Buffer.from(svg)).composite(layers).png().toFile(OUT);

  const size = fs.statSync(OUT).size;
  console.log(`[og] wrote apps/web/public/og.png (${W}x${H}, ${Math.round(size / 1024)} KB)`);
}

main().catch((error) => {
  console.error(`[og] Failed: ${error.message}`);
  process.exit(1);
});
