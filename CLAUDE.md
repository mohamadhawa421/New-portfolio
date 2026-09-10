# Working on this repo

A portfolio site. Astro 7 with the client router in `apps/web`, and a small CMS
in `apps/cms` whose job is to export content the site builds from. npm
workspaces; run everything from the root.

```bash
npm run dev          # the site, on :4321
npm run dev:lan      # the same, reachable from a phone on the network
npm run edit         # the CMS
npm run refresh      # export content, then serve
npm run build        # export content, then build the site
npm run build:web    # the site only, when content has not changed
```

Typecheck with `npx astro check` from `apps/web`. **Read its whole output** —
piping it to `tail -3` hides the error count and has already let a broken build
through once.

## Where things are

Content comes out of the CMS as data the pages read through `src/lib/content`.
Nothing in `apps/web` should ever hardcode copy that belongs to the CMS.

`apps/web/src/scripts/` holds the behaviour that is not a component:

| | |
|---|---|
| `chrome.ts` | the nav's ink and pill, section reveals, scroll restoration |
| `theme.ts` | light/dark, and the circular wipe between them |
| `designer-mode.ts` | the Ultimate Control easter egg — the shockwave |
| `designer-sound.ts` | every sound the site makes, synthesised, no files |
| `punish.ts` | the small purple consequence for a refused action |
| `super.ts` | super designer mode, the third theme |
| `void-field.ts` | the 404's well |

## The two easter eggs

**Ultimate Control** — click the hero portrait. A shockwave crosses the page
and takes the interface apart. It is one continuous physical event and the code
is written to keep it that way; see the next section before changing any of it.

**Super designer mode** — press and hold the light/dark toggle for 1.4s. A
third theme, found rather than chosen. It does not survive a reload (there is
no storage anywhere in `super.ts`, deliberately), it locks the theme toggle
while it runs, and it carries a 5% discount that appears in the enquiry form
and in the generated message. Ways out: reload, hold `M`, hold the
`SUPER DESIGNER` badge in the footer, or shake an Android phone.

## Invariants that cost real work to establish

These are not preferences. Each one was arrived at by breaking it first.

**One animation per element, and the last frame is the layout position.** Every
piece and every letter in the storm is a single Web Animations flight from
struck to home. Three animations in a row cannot be continuous: each starts
from a standstill, so between any two there is a frame where nothing moves, and
that frame reads as floating. The final keyframe must equal the position the
element has after cleanup, or removing the transform is a visible snap.

**Nothing is both a block and its letters.** An element that shatters is not
also thrown whole — its letters carry the movement. Controls with a surface of
their own (`SHELLS` in `designer-mode.ts`) are the exception: the shell flies
and the label bursts out of it.

**Splitting text changes layout, so the box is pinned.** Inline-blocks lose
every kerning pair, which moves everything laid out against that width. Each
shattered element keeps its measured box, and each letter carries a
`position: relative` offset to the place its character was actually drawn —
measured with a Range *before* anything is touched. That offset is layout, not
transform, so the animation can end on `transform: none` and the glyphs
rasterise like text rather than staying on a composited layer.

**Velocity is continuous across keyframes.** An easing that ends at zero
followed by one that starts at zero is a stop. Where two segments meet, the
closing slope of one is chosen to equal the opening slope of the next *in
absolute terms* — which means accounting for the different distance and
duration of each segment. The comments carry the arithmetic.

**Motion needs a named force.** No idle floating, no bobbing, no oscillation,
no rotation that reverses. The shudder exists only while the field is holding
something. The one still moment is the far point, where the outward speed
reaches zero.

**The sound is measured from the picture, not guessed.** `run()` returns the
beat it actually used, with the first release and last arrival read off the
flights it created, and `play()` writes the rewind between exactly those two
numbers. Retime the visuals and the audio follows. Do not hardcode either end.

**The tear is drawn twice, once per engine.** Blink resolves the SVG reference
filters (`dm-tear-1..3` in `DesignerEgg.astro`); WebKit gets the same three
separations out of an inherited `text-shadow` and never builds a filter for
this at all. Two rounds went into finding which WebKit rule swallows the
filter and neither answer produced colour on screen, so the second path is
there instead of a third guess. They are alternatives, not layers — stacking
coloured `drop-shadow()` filters on top of the reference filter was tried, and
it both costs two more offscreen passes and fringes only the silhouette, which
leaves a button's label untouched. Both paths write the same discrete cuts on
the same timers, because WebKit will not interpolate a `filter` containing a
`url()` and drops the whole animation.

**Eases are per sixtieth of a second, not per frame.** `x += (target - x) * k`
applied once per frame is a refresh-rate dependency: at 144Hz it runs 2.4 times
as often and converges 2.4 times as fast, so the same code gives a different
amount of weight on a different display. The cursor's three smoothers raise the
retained fraction to the number of 16.7ms steps that actually elapsed, which
leaves 60Hz identical to the pixel and brings every faster display onto the
same curve. Any new smoother does the same, and no clamp on the elapsed time —
returning to a tab should put the thing where the pointer is.

**Listeners go on `document`, never on a page element.** The client router
replaces the page on every navigation, so anything bound to an element in it is
bound to a node that is about to be detached — and a binding guarded to run once
per tab never comes back. This is how the lightbox's zoom shipped working only
after a hard refresh: `bindZoom` attached to the dialog, which looks permanent
and is not. `document` is the only node that survives a swap.

**Prefixed property first, standard property last.** The CSS minifier drops the
earlier of two declarations that set the same thing, so `backdrop-filter`
written above `-webkit-backdrop-filter` is the one that disappears — and the dev
server does not minify, so the difference only exists in production. It shipped
a nav with its tint and no blur. `vite.build.cssTarget` in astro.config.mjs
names Safari 15 so the prefix is considered necessary and both survive;
unprefixed `backdrop-filter` only arrived in Safari 18 and the phones this has
to work on are older.

**`data-designer` is the colour; `data-storm` is the fact.** The purple is
let go at `landed + SETTLE_MS`, deliberately, so it drains while the last
pieces are still travelling — which makes it the wrong flag for anything that
has to hold for the whole event. Measured on a real run: the purple cleared at
7.56s and the storm ended at 7.80s, so a lockout keyed to `data-designer`
leaves the portrait live-looking and dead for a quarter of a second. Anything
that must last exactly as long as `isRunning()` uses `data-storm`, which goes
up in `run()` and comes down in `teardown()`.

**A thing the pointer cannot reach is not a thing the pointer leans toward.**
The cursor's magnets are hit-tested against measured rectangles, not against
the document, so `pointer-events: none` does not stop the lean on its own —
`measureMagnets()` filters on the computed value instead. A mode that disables
a control therefore has to say so, by dispatching an event the cursor
remeasures on (`mh:super`, `mh:storm`); the list is otherwise only rebuilt on
load, resize and navigation.

**Reduced motion is honoured throughout**, and every effect has a quiet
variant rather than being switched off.

## Dependencies, and the one command never to run

**Never `npm audit fix --force` in this repo.** npm's "fix" for the Strapi
advisories is `@strapi/strapi@4.26.2` — a downgrade from 5 to 4, which would
take the schema, the export script and the database with it. npm suggests it
because no Strapi 5 release fixes them yet, not because it is a fix.

`npm audit` reports two dozen advisories and every one of them is in
`apps/cms` or in build tooling. None reaches a visitor, and the reason is
structural rather than lucky: `apps/web` has exactly two production
dependencies, `astro` and `@astrojs/sitemap`; `output` is `'static'`; and
Vercel's `buildCommand` is `npm run build:site`, which boots Strapi only to
read a committed SQLite file and write `content.json` and `public/media`
before the build. Nothing of Strapi is deployed and nothing serves untrusted
input. `vite`, `esbuild` and `sharp` are in the web tree as build-time
dependencies of Astro; the esbuild and vite advisories are dev-server issues
that need you browsing a hostile page while `npm run dev` is running.

Plain `npm audit fix` was tried and reverted: it left the count at 24 while
removing 60 packages from the lockfile, including Astro's own dev tooling.
Zero benefit, real risk.

The honest state is that these wait on upstream Strapi. Check again when
Strapi ships fixes; do not fight it in the meantime.

## Environment

The preview pane is **unreliable, not uniformly dead**, and the difference
matters because assuming either extreme has wasted a session.

What is reliably broken: IntersectionObserver does not fire, so reveals and
lazy images stay in their initial state; view transitions do not run; timers
are throttled hard, so a `setTimeout(40)` can land well past a 420ms
animation; screenshots of scrolled content are often stale — take a second
one before believing the first; and `PerformanceObserver` on `longtask`
reports nothing at all (see "Profiling the storm").

What does work, sometimes: `requestAnimationFrame` and CSS transitions. Both
have been measured running normally here at ~144Hz. **Test the instrument
before you use it** — record a handful of rAF gaps, or read a transition's
target off `getAnimations()` rather than trusting a computed value that may
never have advanced.

What always works: geometry, computed styles, seeking an animation with
`animation.currentTime`, and reading keyframes off `getAnimations()`. Prefer
those. And say which of these you used rather than claiming to have watched
anything.

The dev server serves stale files often enough to waste a debugging session.
Restart it when a change does not appear.

## Profiling the storm

Measure the **first** press on a fresh load. Warm runs are not representative:
the second storm on a page produces no long tasks at all, so profiling one
tells you nothing and suggests there is nothing to find.

Fire `pointerenter` on the portrait before the click, or don't, but know which
you are doing. Hovering runs `sound.warm()`, which opens the audio device and
builds the buffers; a synthetic `dispatchEvent(new MouseEvent('click'))` never
fires it, so a naive harness measures a cost a hovering visitor never pays. The
buffers are also built on idle now (`sound.prime()`, an OfflineAudioContext so
no device is opened), which is what covers touch and keyboard — neither gets a
useful hover.

**Check your instrument before you trust it.** Two claims that used to be
here were wrong, and both were wrong in the direction of a false all-clear.

`PerformanceObserver` on `longtask` reports *nothing* in the preview pane,
even though `supportedEntryTypes` lists it. Verified with a control: a
deliberate 120ms block produced zero entries. Any "zero long tasks" result
measured there means the observer is silent, not that the page is fast — so
do not use it as a bar, and do not repeat the claim that the storm meets one.

`requestAnimationFrame` *does* advance in the pane, at least sometimes — 6.9ms
gaps, ~144Hz, measured. So frame pacing can be measured there after all, and
recording rAF timestamps across an interaction is the honest way to do it.
Check it with a few frames first rather than assuming either way.

### What the storm actually costs, and why it is not a bug

Measured on the production build served by `astro preview`, cold, with a
synthetic click. The stall people describe as the wave "freezing for a second"
is two frames of 105–139ms at roughly +130ms and +250ms, plus a handful of
34–56ms frames — five frames over 33ms out of 426.

Four things it is **not**, each ruled out by measurement rather than by
reading:

- **Not the audio.** With `AudioContext` replaced by a constructor that
  throws — 70 blocked constructions — the same stalls appear in the same
  places.
- **Not the click handler**, which finishes in 11–13ms, long before.
- **Not scheduled JavaScript.** Wrapping every `setTimeout` callback the
  storm runs: exactly one exceeded 3ms across the whole sequence, and that
  was the 26ms teardown at +8.2s.
- **Not a `will-change` or filter blowup.** At impact only 5 elements carry
  `will-change` and only 3 have a filter.

What it *is*: at +120ms there are **850 concurrent animations** across **260
split letters and 5 pieces** — and 820 of those 850 animate `transform` or
`opacity` alone. So the storm is already doing the compositable thing; the
30 that are not are the nav's own colour and padding transitions, unrelated.

Cheap script and very long frames means the time is going where script cannot
see it: the browser's style, layer and first-raster pass over 800-odd newly
animated elements. That is the shatter working as designed, not a defect.
There is no property to swap and no listener to fix.

**So do not "optimise" this without being asked.** The only lever that would
move it is the number of elements that shatter, and fewer letters is a
different wave — a design decision, not a performance fix. If it ever has to
come down, that is the knob, and the cost scales with it.
