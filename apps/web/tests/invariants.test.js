/**
 * The invariants in CLAUDE.md, enforced.
 *
 * Every rule in that file was arrived at by breaking it first, and each one
 * is written down precisely because nothing else notices when it goes. Three
 * of them couple two files that have to agree and cannot check each other —
 * the reveal stagger, the image ladder, the listener target — and "keep the
 * two in step" as a comment is a hope, not a mechanism.
 *
 * These are deliberately source-text assertions rather than behavioural
 * tests. The behaviour they protect needs a browser and a real display to
 * observe, which is exactly why it went unprotected; what *can* be checked
 * cheaply is the shape of the source, and for this class of bug the shape is
 * where the drift happens.
 *
 * Run with `npm test`. No dependencies — node:test and node:assert are in
 * the runtime.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const REPO = path.resolve(WEB, '..', '..');

const read = (p) => fs.readFileSync(path.resolve(REPO, p), 'utf8');

function walk(dir, exts, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, exts, found);
    else if (exts.some((e) => entry.name.endsWith(e))) found.push(full);
  }
  return found;
}

const SRC = path.join(WEB, 'src');
const sourceFiles = walk(SRC, ['.astro', '.css', '.ts']);

/* ================================================================== */
/* Two files that have to agree                                        */
/* ================================================================== */

test('the reveal cascade matches between chrome.ts and the inline primer', () => {
  /*
   * BaseLayout carries a hand-written copy of the reveal logic that runs
   * before first paint, because waiting for the module leaves the heading
   * blank for a beat. Its comment says "keep the two in step — the stagger
   * numbers below match the ones there", and nothing checked that.
   *
   * If they drift, above-the-fold content cascades at one rhythm and
   * everything scrolled to cascades at another, on the same page.
   */
  const chrome = read('apps/web/src/scripts/chrome.ts');
  const layout = read('apps/web/src/layouts/BaseLayout.astro');

  const stagger = chrome.match(/const STAGGER_MS = (\d+)/)?.[1];
  const cascade = chrome.match(/const CASCADE_MS = (\d+)/)?.[1];
  assert.ok(stagger && cascade, 'STAGGER_MS / CASCADE_MS not found in chrome.ts');

  assert.match(
    layout,
    new RegExp(`Math\\.min\\(${stagger}, ${cascade} / \\(queued - 1\\)\\)`),
    `the inline primer does not use STAGGER_MS=${stagger} / CASCADE_MS=${cascade}`
  );

  // The per-index step, which the primer spells out as literals.
  const riseStep = chrome.match(/isRise \? (\d+) : (\d+)\)/);
  assert.ok(riseStep, 'the per-index stagger step not found in chrome.ts');
  assert.match(
    layout,
    new RegExp(`isRise \\? ${riseStep[1]} : ${riseStep[2]}`),
    'the per-index stagger step differs between chrome.ts and the primer'
  );
});

test('the reveal trigger point matches between chrome.ts and the inline primer', () => {
  const chrome = read('apps/web/src/scripts/chrome.ts');
  const layout = read('apps/web/src/layouts/BaseLayout.astro');
  const at = chrome.match(/const REVEAL_AT = coarse \? ([\d.]+) : ([\d.]+)/);
  assert.ok(at, 'REVEAL_AT not found in chrome.ts');
  assert.match(
    layout,
    new RegExp(`matches \\? ${at[1]} : ${at[2]}`),
    `the primer's revealAt does not match REVEAL_AT (${at[1]} / ${at[2]})`
  );
});

test('the image ladder matches between the exporter and ProjectCard', () => {
  /*
   * The exporter writes `foo-420.webp` and the component asks for it by
   * name. Nothing records the list in content.json — a name that can be
   * derived does not need storing — so the only thing holding the two
   * together is that they use the same numbers.
   *
   * Drift here is silent and asymmetric: widen the exporter and the extra
   * files are dead weight nobody requests; widen the component and every
   * card asks for a 404 and falls back to the full-size file, which is the
   * bug the ladder exists to prevent.
   */
  const exporter = read('apps/cms/scripts/export-content.js');
  const card = read('apps/web/src/components/ProjectCard.astro');

  const widths = (text) =>
    text.match(/const VARIANT_WIDTHS = \[([^\]]+)\]/)?.[1].split(',').map((n) => n.trim());
  const a = widths(exporter);
  const b = widths(card);
  assert.ok(a && b, 'VARIANT_WIDTHS missing from one side');
  assert.deepEqual(a, b, 'the exporter and ProjectCard disagree about the variant widths');

  const gate = (text) => text.match(/at \* (\d+\.\d+)/)?.[1];
  assert.equal(
    gate(exporter),
    gate(card),
    'the exporter and ProjectCard disagree about when a variant exists'
  );
});

/* ================================================================== */
/* Listeners go on document, never on a page element                   */
/* ================================================================== */

test('module listeners are bound to document or window', () => {
  /*
   * The client router replaces the page on every navigation, so a listener
   * bound to an element in it is bound to a node that is about to be
   * detached — and a binding guarded to run once per tab never comes back.
   * This is how the lightbox's zoom shipped working only after a hard
   * refresh.
   *
   * The allowlist is for elements a module creates and owns for their whole
   * life, which the router never touches because they were never in the
   * page markup.
   */
  const OWNED = new Set([
    'frame', // figma-explorer builds the iframe itself
    'button', // designer-sound's own control, created and held by the module
    'audio', // the AudioContext's element, likewise
  ]);

  const offenders = [];
  for (const file of walk(path.join(SRC, 'scripts'), ['.ts'])) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/([A-Za-z_$][\w$]*)\??\.addEventListener\(/g)) {
      const target = m[1];
      if (target === 'document' || target === 'window' || OWNED.has(target)) continue;
      const line = text.slice(0, m.index).split('\n').length;
      offenders.push(`${path.relative(REPO, file)}:${line} → ${target}.addEventListener`);
    }
  }
  assert.deepEqual(offenders, [], `listeners bound to a page element:\n${offenders.join('\n')}`);
});

/* ================================================================== */
/* Prefixed property first, standard property last                     */
/* ================================================================== */

test('every prefixed property is written before its standard form', () => {
  /*
   * The minifier drops the earlier of two declarations that set the same
   * thing, so the standard property written first is the one that
   * disappears — and the dev server does not minify, so the difference only
   * exists in production. It shipped a nav with its tint and no blur.
   *
   * This checks the source; verify-build.js checks that the output of the
   * two that are load-bearing at the declared floor actually survived. Both
   * are needed: this one catches the mistake at the moment it is written,
   * whatever the floor happens to be that week.
   */
  const PAIRED = ['backdrop-filter', 'mask-image', 'user-select', 'appearance', 'user-drag'];
  const offenders = [];

  for (const file of sourceFiles) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const std = line.trim().match(/^([a-z-]+)\s*:/);
      if (!std || !PAIRED.includes(std[1])) return;
      // Look back a few lines for the prefixed form; a comment may sit between.
      const before = lines.slice(Math.max(0, i - 12), i).join('\n');
      const after = lines.slice(i + 1, i + 3).join('\n');
      const prefixedBefore = before.includes(`-webkit-${std[1]}:`);
      const prefixedAfter = after.includes(`-webkit-${std[1]}:`);
      if (prefixedAfter && !prefixedBefore) {
        offenders.push(`${path.relative(REPO, file)}:${i + 1} → ${std[1]} written above its -webkit- form`);
      }
    });
  }
  assert.deepEqual(offenders, [], `prefix written after the standard property:\n${offenders.join('\n')}`);
});

/* ================================================================== */
/* Reduced motion is honoured throughout                               */
/* ================================================================== */

test('the blanket reduced-motion reset is still in global.css', () => {
  /*
   * Every component relies on this existing: it is why a new animation does
   * not need its own guard to be safe for someone who asked the site to
   * stop moving. It has been mistaken for missing before, and four
   * redundant guards were added and then reverted on the strength of that.
   */
  const css = read('apps/web/src/styles/global.css');
  const block = css.match(
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\*,\s*\*::before,\s*\*::after \{[\s\S]*?\}/
  );
  assert.ok(block, 'the universal reduced-motion reset is gone from global.css');
  assert.match(block[0], /animation-duration:\s*0\.001ms\s*!important/);
  assert.match(block[0], /transition-duration:\s*0\.001ms\s*!important/);
});

/* ================================================================== */
/* The two rendering paths for the storm's tear                        */
/* ================================================================== */

test('both tear paths are present and use the same three levels', () => {
  /*
   * Blink resolves the SVG reference filters; WebKit never paints them and
   * gets the same separations from an inherited text-shadow. They are
   * alternatives, not layers, and they must describe the same effect — two
   * rounds went into establishing that, and losing one silently removes the
   * effect on exactly one engine.
   */
  const egg = read('apps/web/src/components/DesignerEgg.astro');
  const mode = read('apps/web/src/scripts/designer-mode.ts');

  for (const id of ['dm-tear-1', 'dm-tear-2', 'dm-tear-3']) {
    assert.ok(egg.includes(id), `${id} is missing from DesignerEgg.astro`);
  }
  assert.match(mode, /const SPLIT = \[/, 'the painted path lost its offset table');
  assert.match(mode, /AppleWebKit/, 'the engine test for the painted path is gone');
  assert.match(mode, /const fringe = /, 'the text-shadow fringe is gone');
});

/* ================================================================== */
/* Nothing in apps/web hardcodes copy that belongs to the CMS          */
/* ================================================================== */

test('the role title is not hardcoded anywhere in the web app', () => {
  /*
   * A narrow instance of the CLAUDE.md rule, and the one that has actually
   * gone wrong: the title appears in the CMS, and a copy left in a component
   * means renaming it in the admin changes the site everywhere except the
   * one place somebody typed it.
   */
  const offenders = [];
  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8');
    // Comments are allowed to name it; markup and strings are not.
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/Product (Designer|Owner)/.test(stripped)) {
      offenders.push(path.relative(REPO, file));
    }
  }
  assert.deepEqual(offenders, [], `role title hardcoded in:\n${offenders.join('\n')}`);
});
