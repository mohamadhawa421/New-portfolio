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

**Reduced motion is honoured throughout**, and every effect has a quiet
variant rather than being switched off.

## Environment

The preview pane **does not composite frames**. `requestAnimationFrame`,
IntersectionObserver, CSS animations and view transitions do not advance there,
timers are throttled, and screenshots of scrolled content are often stale. You
can measure geometry and seek animations with `animation.currentTime`; you
cannot watch anything. Say so rather than claiming to have seen it.

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

`requestAnimationFrame` does not advance in the preview pane, so frame pacing
cannot be measured there at all. What can be measured is main-thread blocking:
a `PerformanceObserver` on `longtask` across the run, and `performance.now()`
around the click handler. Zero long tasks is the bar, and the current sequence
meets it — cold, on mobile and desktop.
