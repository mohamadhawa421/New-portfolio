/**
 * What the build actually shipped, checked against what the source meant.
 *
 * ── Why this exists ───────────────────────────────────────────────────
 *
 * Twice now the build has silently changed the meaning of the source, and
 * both times it cost a debugging session because the difference only exists
 * in production — the dev server does not minify, so localhost was correct
 * and the deployed site was not:
 *
 *   1. `backdrop-filter` written above `-webkit-backdrop-filter`. The
 *      minifier drops the earlier of two declarations it reads as
 *      equivalent, so the deployed nav had its tint and no blur behind it.
 *      Measured on the built output: `backdrop-filter: none`.
 *
 *   2. `transform: translate3d(0, 14px, 0)` on every waiting reveal, written
 *      in 3D specifically to promote the element for the length of its fade.
 *      The minifier rewrites it to `translateY(14px)`, because in two
 *      dimensions they compute the same thing — and a 2D transform promotes
 *      nothing, so every entrance repainted instead of compositing.
 *
 * Neither is visible to `astro check`, to the type system, or to a person
 * reading the source. Both are one grep away from the built file. So this
 * runs after every build and turns that class of regression into an error.
 *
 * ── What belongs here ────────────────────────────────────────────────
 *
 * Only invariants that (a) can be decided from the built output alone and
 * (b) have a known way of breaking silently. This is not a linter and it is
 * not a style guide — every check below is either a bug that has already
 * happened or a property something else in the codebase depends on. A check
 * that would need judgement to interpret does not belong in a build gate.
 *
 * Each one carries the reason it is here, because a failing assertion whose
 * point nobody remembers gets deleted rather than fixed.
 *
 * No dependencies, deliberately: this guards the build, so it must not be
 * able to fail because of something it installed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'dist');

/* ---------------------------------------------------------------- */
/* Reading the output                                                */
/* ---------------------------------------------------------------- */

function walk(dir, ext, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, found);
    else if (entry.name.endsWith(ext)) found.push(full);
  }
  return found;
}

const rel = (p) => path.relative(DIST, p);

if (!fs.existsSync(DIST)) {
  console.error('[verify] no dist/ — run the build first.');
  process.exit(1);
}

const pages = walk(DIST, '.html');
const scripts = walk(DIST, '.js');

/*
 * Stylesheets are inlined (`build.inlineStylesheets: 'always'`), so the CSS
 * to check is inside the HTML rather than beside it. Both are read anyway, so
 * that turning inlining off later does not quietly empty every CSS check.
 */
const styleBlocks = pages
  .flatMap((p) => [...fs.readFileSync(p, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => ({ file: p, css: m[1] })))
  .concat(walk(DIST, '.css').map((p) => ({ file: p, css: fs.readFileSync(p, 'utf8') })));

const allCss = styleBlocks.map((b) => b.css).join('\n');
const allJs = scripts.map((p) => fs.readFileSync(p, 'utf8')).join('\n');

/* ---------------------------------------------------------------- */
/* The checks                                                        */
/* ---------------------------------------------------------------- */

const failures = [];
const checks = [];

function check(name, why, fn) {
  checks.push({ name, why, fn });
}

/**
 * A prefixed property that must survive next to its standard form.
 *
 * Counting rather than parsing: the minifier's failure mode is dropping one
 * of the pair, so the prefixed count falling below the standard count is
 * exactly the symptom. Written as its own helper because the same shape of
 * bug applies to four different properties.
 */
function prefixPairing(prop) {
  const standard = (allCss.match(new RegExp(`(?<!-)\\b${prop}\\s*:`, 'g')) || []).length;
  const prefixed = (allCss.match(new RegExp(`-webkit-${prop}\\s*:`, 'g')) || []).length;
  return { standard, prefixed, ok: prefixed >= standard };
}

/*
 * Only the prefixes that are actually load-bearing.
 *
 * The first version of this checked `mask-image` and `appearance` too, and
 * failed on the first run — correctly reporting that the build ships 8
 * `appearance: none` and zero `-webkit-appearance`. That turned out to be
 * the minifier being right rather than wrong, and the check being wrong.
 *
 * The rule is the declared floor. `vite.build.cssTarget` names safari16.4,
 * so a prefix is only necessary for a property whose *unprefixed* form
 * arrived after that:
 *
 *   backdrop-filter   unprefixed in Safari 18     above the floor   needed
 *   user-select       unprefixed in Safari 17.0   above the floor   needed
 *   mask-image        unprefixed in Safari 15.4   below the floor   redundant
 *   appearance        unprefixed in Safari 15.4   below the floor   redundant
 *
 * For the bottom two the minifier is entitled to drop the prefixed form and
 * does, and asserting otherwise would be a build gate that fails on correct
 * output — the fastest way to teach everyone to ignore it.
 *
 * The source still writes the prefix first for all four, because the order
 * is what decides which one survives if the floor ever moves down. This only
 * asserts the two where losing it would ship a visible bug today.
 */
for (const prop of ['backdrop-filter', 'user-select']) {
  check(
    `${prop} keeps its -webkit- pair`,
    prop === 'backdrop-filter'
      ? 'This one shipped broken once: the nav went out with a tint and no blur.'
      : 'Unprefixed user-select is Safari 17, above the declared floor — ' +
        'without the prefix the rule does nothing on Safari 16.4.',
    () => {
      const { standard, prefixed, ok } = prefixPairing(prop);
      return ok || `${standard} × \`${prop}\` but only ${prefixed} × \`-webkit-${prop}\``;
    }
  );
}

check(
  'the reveal entrance is still promoted',
  'The 3D transform that asked for a compositor layer is rewritten to 2D by ' +
    'the minifier, so the promotion is requested in JS instead. If this rule ' +
    'goes, every fade repaints per frame again and nothing says so.',
  () =>
    /\[data-lifting\]\s*\{[^}]*will-change\s*:\s*opacity\s*,\s*transform/.test(allCss) ||
    'no `[data-lifting] { will-change: opacity, transform }` in the built CSS'
);

check(
  'linear() easings stay behind @supports',
  'An invalid timing function invalidates the whole declaration, so an ' +
    'unguarded linear() removes the animation entirely on Safari below 17.2 ' +
    '— silently, and only there.',
  () => {
    const guarded = [...allCss.matchAll(/@supports[^{]*\{/g)];
    if (!allCss.includes('linear(')) return true;
    // Every `linear(` must sit inside an @supports block. Cheapest sound test:
    // strip the @supports blocks and see whether any survive outside them.
    let stripped = allCss;
    for (const m of guarded) {
      const start = m.index + m[0].length;
      let depth = 1;
      let i = start;
      while (i < stripped.length && depth > 0) {
        if (stripped[i] === '{') depth++;
        else if (stripped[i] === '}') depth--;
        i++;
      }
      stripped = stripped.slice(0, m.index) + ' '.repeat(i - m.index) + stripped.slice(i);
    }
    return !stripped.includes('linear(') || 'a `linear()` easing is outside any @supports block';
  }
);

check(
  'both storm tear paths shipped',
  'Blink resolves the SVG reference filters; WebKit never paints them and ' +
    'gets the same three separations out of an inherited text-shadow. They ' +
    'are alternatives, not layers — losing either one silently removes the ' +
    'effect on exactly one engine, which is the hardest kind of bug to see.',
  () => {
    const filters = ['dm-tear-1', 'dm-tear-2', 'dm-tear-3'].filter((id) =>
      pages.some((p) => fs.readFileSync(p, 'utf8').includes(id))
    );
    const painted = /rgba\(255,\s*42,\s*92/.test(allJs) && /rgba\(0,\s*228,\s*255/.test(allJs);
    if (filters.length !== 3) return `only ${filters.length}/3 dm-tear filters in the markup`;
    return painted || 'the WebKit text-shadow fringe is missing from the bundle';
  }
);

check(
  'no framework islands crept in',
  'Two production dependencies and no hydration is the reason this site ' +
    'ships no framework runtime. A single client:* directive changes that ' +
    'and nothing else would report it.',
  () => {
    const hits = pages.filter((p) => /\sclient:(load|idle|visible|media|only)/.test(fs.readFileSync(p, 'utf8')));
    return hits.length === 0 || `hydration directive in ${hits.map(rel).join(', ')}`;
  }
);

check(
  'every page has exactly one h1, in order',
  'Heading level is the structure a screen reader navigates by. It is easy ' +
    'to pick one because a size looked right, and nothing visible changes ' +
    'when it is wrong.',
  () => {
    const bad = [];
    for (const p of pages) {
      const body = fs.readFileSync(p, 'utf8').replace(/<(script|style)\b[\s\S]*?<\/\1>/g, '');
      const levels = [...body.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
      const ones = levels.filter((l) => l === 1).length;
      if (ones !== 1) bad.push(`${rel(p)}: ${ones} × h1`);
      for (let i = 1; i < levels.length; i++) {
        if (levels[i] > levels[i - 1] + 1) {
          bad.push(`${rel(p)}: h${levels[i - 1]} → h${levels[i]}`);
          break;
        }
      }
    }
    return bad.length === 0 || bad.join('; ');
  }
);

check(
  'every image carries an alt',
  'A missing alt is invisible until somebody reaches the page with a screen ' +
    'reader, and images arrive from the CMS where nothing enforces it.',
  () => {
    const bad = [];
    for (const p of pages) {
      const html = fs.readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
      for (const m of html.matchAll(/<img\b[^>]*>/g)) {
        if (!/\salt\s*=/.test(m[0])) bad.push(`${rel(p)}: ${m[0].slice(0, 70)}`);
      }
    }
    return bad.length === 0 || bad.join('; ');
  }
);

check(
  'zoom is not disabled',
  'A viewport meta with user-scalable=no or a maximum-scale fails WCAG ' +
    '1.4.4 outright, and it is the kind of line that gets pasted in while ' +
    'chasing a mobile layout problem.',
  () => {
    const bad = pages.filter((p) => {
      const m = fs.readFileSync(p, 'utf8').match(/<meta[^>]+name="viewport"[^>]*>/);
      return m && /user-scalable\s*=\s*no|maximum-scale\s*=\s*[12]?\.?0?\b/.test(m[0]);
    });
    return bad.length === 0 || `zoom disabled in ${bad.map(rel).join(', ')}`;
  }
);

check(
  'every page is reachable and declares a language',
  'A missing lang makes a screen reader read English with whatever voice it ' +
    'defaults to, and the skip link is the only way past the nav by keyboard.',
  () => {
    const bad = [];
    for (const p of pages) {
      const html = fs.readFileSync(p, 'utf8');
      if (!/<html[^>]+lang=/.test(html)) bad.push(`${rel(p)}: no lang`);
      if (!html.includes('class="skip-link"')) bad.push(`${rel(p)}: no skip link`);
      if (!/id="main"/.test(html)) bad.push(`${rel(p)}: no #main for the skip link`);
    }
    return bad.length === 0 || bad.join('; ');
  }
);

check(
  'the work grid asks for a small cover',
  'The covers are 1440px files drawn at 364. Without srcset the browser ' +
    'holds four times the pixels it paints and rescales them on every ' +
    'raster — and a fading card rasters every frame.',
  () => {
    const grid = pages.find((p) => rel(p) === path.join('work', 'index.html'));
    if (!grid) return true; // page renamed or gone; not this check's business
    const html = fs.readFileSync(grid, 'utf8');

    /*
     * Matched on `src="/media/..."` rather than on a class.
     *
     * The first version looked for `<img ... class="...">` and quietly
     * matched nothing, because the cover img carries no class — so the check
     * compared 0 against 0 and passed however broken the page was. It only
     * came out because deliberately stripping every srcset from this page
     * failed to trip it. A check that cannot fail is worse than no check: it
     * reports a guarantee it is not making.
     */
    /*
     * Raster only. An SVG has no bitmap to oversize — it rasterises at
     * whatever size it is drawn — so asking it for a srcset is asking for
     * nothing. The footer wordmark is the one that caught this: it is an
     * <img> under /media/ at a declared 1695x285, which looks like a five-
     * times-oversized cover and is in fact a viewBox.
     */
    const covers = [...html.matchAll(/<img\b[^>]*src="\/media\/[^"]*"[^>]*>/g)].filter(
      (m) => /src="\/media\/[^"]*\.(webp|png|jpe?g|avif)"/.test(m[0])
    );
    if (!covers.length) return 'no raster /media/ covers found on the work grid at all';
    const withSrcset = covers.filter((m) => m[0].includes('srcset='));
    return (
      withSrcset.length === covers.length ||
      `${covers.length - withSrcset.length}/${covers.length} covers have no srcset`
    );
  }
);

/* ---------------------------------------------------------------- */
/* Running them                                                      */
/* ---------------------------------------------------------------- */

for (const { name, why, fn } of checks) {
  let result;
  try {
    result = fn();
  } catch (error) {
    result = `the check itself threw: ${error.message}`;
  }
  if (result === true) {
    console.log(`  ok   ${name}`);
  } else {
    failures.push({ name, why, detail: result });
    console.log(`  FAIL ${name}`);
  }
}

console.log('');

if (failures.length) {
  for (const f of failures) {
    console.error(`[verify] ${f.name}`);
    console.error(`         ${f.detail}`);
    console.error(`         why it matters: ${f.why}`);
    console.error('');
  }
  console.error(
    `[verify] ${failures.length} of ${checks.length} build invariant(s) broken in apps/web/dist.`
  );
  process.exit(1);
}

console.log(
  `[verify] ${checks.length} build invariants hold across ${pages.length} page(s).`
);
