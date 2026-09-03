'use strict';

/**
 * One-off import of the real project content from the previous portfolio
 * (github.com/mohamadhawa421/New-portfolio) into this CMS.
 *
 *   node scripts/import-legacy.js --data <project-data.ts> --images <dir>
 *
 * The old site kept everything in a single `lib/project-data.ts`. That file is
 * parsed rather than retyped, so the copy that lands in the database is exactly
 * what was on the old site. Images are uploaded from the old `public/projects`
 * tree. Run with Strapi stopped.
 *
 * Fields the design owns — category, discipline, chip colours, order, featured —
 * are left alone; only the case study content and imagery are replaced.
 */

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const DATA_FILE = argOf('--data');
const IMAGE_DIR = argOf('--images');

if (!DATA_FILE || !IMAGE_DIR) {
  console.error('Usage: node scripts/import-legacy.js --data <project-data.ts> --images <dir>');
  process.exit(1);
}

/** Pulls the `projects` array out of the old TypeScript module. */
function parseLegacyProjects(file) {
  const source = fs.readFileSync(file, 'utf8');

  const decl = source.indexOf('export const projects');
  if (decl < 0) throw new Error('Could not find the projects declaration.');

  // Skip past the type annotation — `: ProjectDetail[] =` contains a `[]` that
  // would otherwise look like an empty array literal.
  const assign = source.indexOf('=', decl);
  const start = source.indexOf('[', assign);
  if (assign < 0 || start < 0) throw new Error('Could not find the projects array.');

  // Walk to the matching bracket so trailing exports are ignored.
  let depth = 0;
  let end = -1;
  let inString = null;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    const prev = source[i - 1];
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') inString = ch;
    else if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error('Unbalanced projects array.');

  const literal = source.slice(start, end + 1);
  // Plain object literals only — no calls, no identifiers to resolve.
  return new Function(`return ${literal};`)();
}

/** Splits prose into sentences, leaving decimals and abbreviations intact. */
function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Improved Efficiency: Reduced time..." -> { title, body } */
function splitLabelled(line) {
  const text = String(line || '').trim();
  const at = text.indexOf(': ');
  if (at > 0 && at < 60) {
    return { title: text.slice(0, at).trim(), body: text.slice(at + 2).trim() };
  }
  return { title: text, body: '' };
}

/** The lead sentence of a design-process block, and its bullet list. */
function leadAndBullets(block) {
  const text = String(block || '').trim();
  const nl = text.indexOf('\n');
  if (nl < 0) return { lead: text, bullets: '' };
  return { lead: text.slice(0, nl).trim(), bullets: text.slice(nl + 1).trim() };
}

/**
 * Per-project bits that cannot be derived mechanically: which old slug maps to
 * which project here, which image is the card thumbnail, and the headline
 * figure buried in the old `endResults.efficiencyBoost` sentence. The metric
 * labels restate that sentence — nothing is invented.
 */
const MAP = {
  'wise-academy': {
    slug: 'wise-academy',
    cover: 'wise/wise.png',
    metric: { value: '50%', label: 'less time spent managing student data' },
  },
  kabbara: {
    slug: 'kabbara-office',
    cover: 'kabbara/kabbara-thumb.png',
    metric: { value: '60%', label: 'less time to process each request' },
  },
  'coding-clebanon': {
    slug: 'coding-lebanon',
    cover: 'codingclebanon/thumb.png',
    metric: { value: '35%', label: 'more session bookings after the redesign' },
  },
  'wfk-law-firm': {
    slug: 'wfk-law-firm',
    cover: 'wfk/thumb.png',
    metric: { value: '40%', label: 'reduction in task handling time' },
  },
  'shipment-share': {
    slug: 'shipment-share',
    cover: 'shipment-share/thumb.png',
    metric: { value: '2 min', label: 'from choosing a trip to a confirmed shipment' },
  },
  shareb: {
    slug: 'shareb',
    cover: 'shareb/thumb.png',
    metric: { value: '5 sec', label: 'to enter the draw after scanning the QR code' },
  },
};

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const uploadCache = new Map();

async function upload(strapi, relPath, alt) {
  if (uploadCache.has(relPath)) return uploadCache.get(relPath);

  const filePath = path.join(IMAGE_DIR, relPath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image not found: ${relPath}`);
  }

  // Flatten "wfk/showcase1.png" to "wfk-showcase1" so names stay unique.
  const name = relPath.replace(/\.[^.]+$/, '').replace(/[\/\s]+/g, '-').toLowerCase();

  const existing = await strapi.db.query('plugin::upload.file').findOne({ where: { name } });
  if (existing) {
    uploadCache.set(relPath, existing.id);
    return existing.id;
  }

  const stats = fs.statSync(filePath);
  const [file] = await strapi.plugin('upload').service('upload').upload({
    data: { fileInfo: { name, alternativeText: alt, caption: '' } },
    files: {
      filepath: filePath,
      originalFilename: path.basename(relPath),
      mimetype: MIME[path.extname(relPath).toLowerCase()] || 'application/octet-stream',
      size: stats.size,
    },
  });

  console.log(`  uploaded ${relPath}`);
  uploadCache.set(relPath, file.id);
  return file.id;
}

const normalise = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

function buildContent(legacy) {
  const problem = sentences(legacy.problemStatement);

  // On some entries the old `aboutProject` ends with the whole of
  // `problemStatement` pasted onto it. Left alone that prints the same sentence
  // twice — once under "The brief" and again under "The problem" — so drop the
  // overlap from the brief and let the problem section own it.
  const problemSet = new Set(problem.map(normalise));
  const about = sentences(legacy.aboutProject).filter((s) => !problemSet.has(normalise(s)));

  // With only one sentence left there is nothing to say under "The brief" that
  // the summary has not already said, so leave it empty and let the page skip
  // the section rather than repeat itself.
  const hasBrief = about.length > 1;
  const wire = leadAndBullets(legacy.designProcess.wireframes);
  const proto = leadAndBullets(legacy.designProcess.prototypes);
  const final = leadAndBullets(legacy.designProcess.finalUI);

  const approachBody = [
    wire.bullets,
    [proto.lead, proto.bullets].filter(Boolean).join('\n'),
    [final.lead, final.bullets].filter(Boolean).join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    title: legacy.name,
    summary: about[0] || '',
    briefLead: hasBrief ? about[1] : '',
    briefBody: hasBrief ? about.slice(2).join(' ') : '',
    problemLead: problem[0] || '',
    constraints: legacy.research.keyFindings.map((finding) => ({ title: finding, body: '' })),
    approachLead: wire.lead,
    approachBody,
    decisions: legacy.finalSolutions.map((line) => {
      const { title, body } = splitLabelled(line);
      return { eyebrow: 'Outcome', title, body };
    }),
    reflectionLead: legacy.endResults.positiveFeedback,
    reflectionBody: legacy.endResults.clientSatisfaction,
  };
}

async function main() {
  const legacyProjects = parseLegacyProjects(DATA_FILE);
  console.log(`[import] parsed ${legacyProjects.length} projects from the old repo\n`);

  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'error';

  let updated = 0;

  try {
    for (const legacy of legacyProjects) {
      const mapping = MAP[legacy.slug];
      if (!mapping) {
        console.warn(`[import] No mapping for "${legacy.slug}" — skipped.`);
        continue;
      }

      const target = await strapi.documents('api::project.project').findFirst({
        filters: { slug: mapping.slug },
        status: 'draft',
      });

      if (!target) {
        console.warn(`[import] No project with slug "${mapping.slug}" — skipped.`);
        continue;
      }

      console.log(`[import] ${legacy.name} -> ${mapping.slug}`);

      const content = buildContent(legacy);

      const coverId = await upload(strapi, mapping.cover, legacy.name);
      const shots = [];
      for (const image of legacy.images) {
        shots.push(await upload(strapi, image.replace(/^\/projects\//, ''), `${legacy.name} screen`));
      }

      // `details.results` is sometimes two facts joined by a pipe, e.g.
      // "20+ Screens | Power Apps Compatible". The metric value is rendered at
      // up to 42px, so keep the figure there and move the qualifier to the label.
      const [figure, ...qualifiers] = String(legacy.details.results).split('|');
      const metrics = [
        { value: legacy.details.timeline, label: 'Timeline', animate: false },
        {
          value: figure.trim(),
          label: qualifiers.length ? qualifiers.join('|').trim() : 'Delivered',
          animate: false,
        },
        { ...mapping.metric, animate: true },
      ];

      await strapi.documents('api::project.project').update({
        documentId: target.documentId,
        status: 'published',
        data: {
          ...content,
          cover: coverId,
          approachShot: shots[0] ?? null,
          // The old site had no image captions. Clear the seeded placeholder
          // rather than shipping it; the page omits the caption when empty.
          approachCaption: '',
          gallery: shots.slice(1),
          metrics,
          seo: {
            metaTitle: `${legacy.name} — Mohamad Hawa`,
            metaDescription: content.summary.slice(0, 200),
          },
        },
      });

      updated += 1;
    }
  } finally {
    await strapi.destroy();
  }

  console.log(`\n[import] updated ${updated} project(s).`);
}

main().catch((error) => {
  console.error(`[import] Failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
