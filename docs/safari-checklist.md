# Checking Safari before a release

Everything else about this site is checked automatically — `npm run check`
for types, `npm test` for the invariants in CLAUDE.md, and `verify-build.js`
for what the minifier did to the output. None of that can see Safari, and
Safari is where this site's remaining risk actually is: there is a
WebKit-specific rendering path in the storm, a declared CSS floor of Safari
16.4, and a dozen features whose support arrived near that line.

This is the list that makes a manual pass cheap. It is not "click around the
site" — it is the eleven places where the two engines are known to diverge
*here*, derived from an audit of the actual feature usage. Ten minutes, once
per release that touches CSS or the storm.

## Why not WebKit in CI

Playwright ships a WebKit build that runs on Linux, and it was considered.
It was left out on purpose:

- The divergences that matter here are **compositing and paint** — the tear
  filter, `backdrop-filter`, layer promotion — and Playwright's WebKit is
  furthest from real Safari in exactly those areas. It would be green while
  the real thing was wrong.
- Everything it *would* reliably catch — feature support, layout, prefixes —
  is already asserted by `verify-build.js` and `tests/invariants.test.js`,
  from the built output, with no browser at all.
- A green WebKit job reads as "Safari is fine". That claim would be false,
  and a false safety net is worse than a documented manual one.

If it is ever added, it should be a *separate* job with a name that does not
say Safari.

## The list

Run each on **macOS Safari** and, where marked 📱, on **iOS Safari**. Note
the Safari version — several of these only fail below 17.

### 1. The nav's glass 📱

Scroll down any page. The pill should condense and pick up a blurred,
saturated backdrop — not a flat tint.

*Why:* unprefixed `backdrop-filter` only arrived in Safari 18, so below that
the site depends entirely on `-webkit-backdrop-filter` surviving
minification. This shipped broken once. `verify-build.js` now asserts the
pair exists, but only the eye can confirm it renders.

### 2. Ultimate Control — the tear

Click the hero portrait. As the wave passes, text should tear into red and
cyan fringes.

*Why:* this is the one place the two engines run **different code**. Blink
resolves the SVG reference filters (`dm-tear-1..3`); WebKit never paints them
and gets the same three separations from an inherited `text-shadow`. If the
fringe is missing in Safari and present in Chrome, the painted path is the
one that broke — see `PAINTED_TEAR` in `designer-mode.ts`.

### 3. Ultimate Control — the whole event 📱

The wave should cross the page once, continuously. Watch for anything that
stops and restarts, or arrives late and snaps into place.

*Why:* the choreography depends on Web Animations behaviour that is not
identical across engines, and CLAUDE.md's invariants about velocity and
final keyframes are written against Blink.

### 4. Theme switching, both directions

Toggle light/dark. The circular wipe should sweep from the button, and the
link blue should cross-fade rather than snapping.

*Why:* the colour interpolation needs `@property`, which is Safari 16.4 —
exactly the declared floor. On 16.0–16.3 the swap is instant, which is the
intended degradation; anything else is a bug.

### 5. Super designer mode

Press and hold the theme toggle for 1.4s.

*Why:* it locks the toggle, changes a third palette, and the exit paths
include a device-motion shake on mobile — `DeviceMotionEvent` needs explicit
permission on iOS and silently does nothing without it.

### 6. The before/after slider 📱

On `/design-lab/spotify-session`: drag the divider with a finger, then tab to
it and use the arrow keys.

*Why:* the control is a stripped `<input type="range">`. Its thumb is styled
through `::-webkit-slider-thumb`, and the 48px touch target lives there. If
the drag needs a precise grab, the thumb rule is not applying.

### 7. The lightbox

Open a case-study image, press Escape, then Tab a few times.

*Why:* focus containment uses `inert`, which is Safari 15.5+. Tab should
never reach the page behind the picture, and closing should put focus back on
the thumbnail you opened.

### 8. Long-press the artwork 📱

Long-press a lightbox image or the Figma invitation face. Nothing should be
selected or offered for copy.

*Why:* unprefixed `user-select` is Safari 17. Below that the guard is
entirely `-webkit-user-select`, which was missing from two components until
recently.

### 9. Landscape text size 📱

Turn the phone sideways on a long page. No paragraph should come back a size
larger than the one above it.

*Why:* iOS Safari inflates text per-block unless
`-webkit-text-size-adjust: 100%` is set, which it now is.

### 10. Corner shapes

Compare a button or card against Chrome.

*Why:* `corner-shape: squircle` is Chrome-only and behind `@supports`. Safari
should show plain rounded corners — **that is correct**, not a bug. Listed so
nobody "fixes" it.

### 11. Reduced motion

Turn on System Settings → Accessibility → Display → Reduce Motion, then
reload and use the site.

*Why:* every effect has a quiet variant rather than being switched off. If
something still moves at full speed, it is reaching past the blanket reset in
`global.css`.

## What to record

If something fails, note **the Safari version** and **which of the eleven**.
That pair is usually enough to identify the feature, because each item above
is a single support boundary.
