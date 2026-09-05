/**
 * The atmosphere on the 404.
 *
 * A scattering of motes falling very slowly towards the well, and — rarely —
 * one thread of purple struck between two of them. That is the whole of it.
 * The mass itself, its shadow and its rings are CSS; this file only draws the
 * things that move.
 *
 * The behaviour that matters is the swallow. A mote's opacity is scaled to
 * nothing across the last stretch of its fall, so nothing ever arrives at the
 * centre — things go into it and are not seen again. Without that the motes
 * pile up on a point and the well reads as a target; with it, the same motes
 * read as a hole. It is one multiplication and it is the entire illusion.
 *
 * The discipline is subtraction. Everything here is tuned to sit just above
 * the threshold of being noticed: if any single part of it is the first thing
 * you see on arriving, it is wrong. The visitor should register that the
 * darkness is not quite still and never be able to say what moved.
 *
 * Deliberately not the easter egg's field, which is a storm and is drawn like
 * one. This shares its palette and its rule about where the hot end of that
 * palette is spent — which here is one thread, for a tenth of a second, every
 * quarter of a minute.
 *
 * Costs: fourteen motes and no allocation per frame, at half the display's
 * rate, and nothing at all while the tab is in the background.
 */

/** Half the display's rate. Nothing here moves fast enough to show it. */
const FRAME_MS = 32;

/** Peak opacity of a mote. The storm's arcs run at 0.45. */
const PEAK = 0.13;

/** How close to the well a mote may be born, as a fraction of vmax. */
const CLEAR = 0.18;

/** Inside this, a mote is being swallowed and is fading to nothing. */
const THROAT = 0.09;

interface Mote {
  x: number;
  y: number;
  /** Seconds lived, and how many it gets. */
  age: number;
  life: number;
  r: number;
  /** Its own phase and sign for the wander and the spiral. */
  phase: number;
  spin: number;
  /** Alpha as drawn last frame, so a flicker can pick two live ones. */
  lit: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let frame = 0;

let width = 0;
let height = 0;
let vmax = 0;
let wx = 0;
let wy = 0;

let motes: Mote[] = [];
let last = 0;
let clock = 0;

/** When the next thread is due, and the one currently on screen. */
let nextArc = 0;
let arc: { at: number; ax: number; ay: number; bx: number; by: number } | null = null;

/**
 * Where the type and the character are, inflated.
 *
 * The thread is only ever struck across empty space. Electricity that happens
 * over the copy is a graphic sitting on top of the page; electricity that only
 * happens where there is nothing is the page's own argument — that the
 * interesting part is the emptiness — stated as a behaviour.
 */
let keepOut: DOMRect[] = [];

let glow = '#8b5cf6';
let arcColour = '#c084fc';
let reduced = false;

function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

/**
 * Puts a mote somewhere it is allowed to be.
 *
 * Rejection sampling rather than a ring: born anywhere on screen except the
 * well's own clearance, so the field is evenly scattered from the first frame
 * instead of arriving as a wave from the edges. Ten tries is plenty — the
 * excluded disc is a fifth of the frame — and the fallback is a corner, which
 * is always outside it.
 */
function place(mote: Mote): void {
  for (let i = 0; i < 10; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    if (Math.hypot(x - wx, y - wy) > CLEAR * vmax) {
      mote.x = x;
      mote.y = y;
      return;
    }
  }
  mote.x = wx > width / 2 ? 0 : width;
  mote.y = wy > height / 2 ? 0 : height;
}

function seed(mote: Mote, fresh: boolean): void {
  place(mote);
  mote.life = rand(24, 52);
  mote.age = fresh ? Math.random() * mote.life : 0;
  mote.r = rand(0.5, 1.2);
  mote.phase = Math.random() * Math.PI * 2;
  mote.spin = Math.random() < 0.5 ? -1 : 1;
  mote.lit = 0;
}

function measure(): void {
  if (!canvas || !ctx) return;

  width = window.innerWidth;
  height = window.innerHeight;
  vmax = Math.max(width, height);

  const root = getComputedStyle(document.documentElement);
  // The composition and the field read the same two numbers, so the hole
  // cannot drift away from the layout that was built around it.
  wx = (parseFloat(root.getPropertyValue('--wx')) || 47) * 0.01 * width;
  wy = (parseFloat(root.getPropertyValue('--wy')) || 38) * 0.01 * height;

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  // Set, never multiplied: a second scale() on a resize compounds silently.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  keepOut = Array.from(document.querySelectorAll<HTMLElement>('[data-void-keep]')).map((el) => {
    const r = el.getBoundingClientRect();
    return new DOMRect(r.x - 40, r.y - 40, r.width + 80, r.height + 80);
  });

  const want = width < 768 ? 8 : 14;
  if (motes.length !== want) {
    motes = Array.from({ length: want }, () => {
      const m: Mote = { x: 0, y: 0, age: 0, life: 30, r: 1, phase: 0, spin: 1, lit: 0 };
      seed(m, true);
      return m;
    });
  }
}

/**
 * How visible a mote is at this moment in its fall.
 *
 * Three things multiplied: it arrives out of nothing, it leaves into nothing,
 * and it is extinguished by the well. The first two stop motes appearing and
 * vanishing in place; the third is the swallow.
 */
function alphaOf(mote: Mote, d: number): number {
  const p = mote.age / mote.life;
  const envelope = Math.min(1, p / 0.12, (1 - p) / 0.22);
  const throat = Math.min(1, d / (THROAT * vmax));
  return PEAK * Math.max(0, envelope) * throat;
}

function step(dt: number): void {
  if (!ctx) return;

  const dmax = vmax * 0.75;

  for (const mote of motes) {
    mote.age += dt;

    let dx = wx - mote.x;
    let dy = wy - mote.y;
    let d = Math.hypot(dx, dy);

    // Spent, or swallowed.
    if (mote.age >= mote.life || d < THROAT * vmax * 0.28) {
      seed(mote, false);
      dx = wx - mote.x;
      dy = wy - mote.y;
      d = Math.hypot(dx, dy) || 1;
    }

    /*
     * Three to nine pixels a second, faster the closer it gets — a mote takes
     * the better part of a minute to cross a third of the screen. Slow enough
     * that the movement is only ever noticed in aggregate.
     */
    const speed = 3.2 + 5.6 * (1 - Math.min(1, d / dmax));
    const ux = dx / d;
    const uy = dy / d;

    /*
     * A perpendicular wander on its own long period, and a tangential push
     * that only appears in the last third. Without the first, fourteen motes
     * converging on a point is a starburst; without the second they arrive on
     * straight spokes rather than curving in.
     */
    const wander = Math.sin(clock * 0.3927 + mote.phase) * 8;
    const swirl = d < dmax * 0.34 ? 0.18 : 0;

    mote.x += (ux * speed + -uy * (wander * 0.06 + speed * swirl * mote.spin)) * dt;
    mote.y += (uy * speed + ux * (wander * 0.06 + speed * swirl * mote.spin)) * dt;

    mote.lit = alphaOf(mote, d);
    if (mote.lit <= 0.002) continue;

    ctx.globalAlpha = mote.lit;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }
}

function clearOf(x: number, y: number): boolean {
  for (const r of keepOut) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return false;
  }
  return true;
}

/**
 * One thread, struck between two motes that happen to be near each other.
 *
 * Between two of them rather than at a random point, so the electricity
 * belongs to the field instead of being drawn on top of it — it is two things
 * already on screen briefly finding each other. It is skipped outright if
 * either end would land on the type or the character.
 */
function strike(): void {
  if (!ctx) return;

  if (!arc && clock > nextArc) {
    nextArc = clock + rand(12, 20);

    const live = motes.filter((m) => m.lit > 0.02);
    outer: for (let i = 0; i < live.length; i += 1) {
      for (let k = i + 1; k < live.length; k += 1) {
        const a = live[i];
        const b = live[k];
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        if (gap < 40 || gap > 110) continue;
        if (!clearOf(a.x, a.y) || !clearOf(b.x, b.y)) continue;
        arc = { at: clock, ax: a.x, ay: a.y, bx: b.x, by: b.y };
        break outer;
      }
    }
  }

  if (!arc) return;

  const age = (clock - arc.at) / 0.13;
  if (age >= 1) {
    arc = null;
    return;
  }

  // Two beats rather than one fade, so it reads as something arcing.
  const k = age < 0.4 ? 1 - age * 1.5 : 0.3 * (1 - (age - 0.4) / 0.6);

  // One kink, seeded off the endpoints so the same strike is drawn the same
  // way every frame it lives.
  const mx = (arc.ax + arc.bx) / 2 + Math.sin(arc.ax) * 7;
  const my = (arc.ay + arc.by) / 2 + Math.cos(arc.by) * 7;

  ctx.globalAlpha = Math.max(0, k) * 0.42;
  ctx.beginPath();
  ctx.moveTo(arc.ax, arc.ay);
  ctx.lineTo(mx, my);
  ctx.lineTo(arc.bx, arc.by);
  ctx.strokeStyle = arcColour;
  ctx.lineWidth = 0.9;
  ctx.stroke();
}

function draw(now: number): void {
  frame = requestAnimationFrame(draw);

  if (now - last < FRAME_MS) return;
  // Capped, so a tab that has been in the background does not resume with one
  // enormous step and throw every mote across the screen.
  const dt = Math.min(now - last, 64) / 1000;
  last = now;
  clock += dt;

  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  step(dt);
  strike();
  // Restored every frame, including the early returns above, so nothing else
  // that ever borrows this context inherits them.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function paintOnce(): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  for (const mote of motes) {
    const d = Math.hypot(wx - mote.x, wy - mote.y);
    const a = alphaOf(mote, d);
    if (a <= 0.002) continue;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

let resizeTimer = 0;
function onResize(): void {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    measure();
    if (reduced) paintOnce();
  }, 150);
}

function onVisibility(): void {
  if (document.hidden) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    return;
  }
  if (!frame && !reduced && canvas) {
    // Reset both clocks, or every event that fell due while the tab was hidden
    // lands on the first frame back.
    last = performance.now();
    nextArc = clock + rand(12, 20);
    frame = requestAnimationFrame(draw);
  }
}

/** Starts the field. Safe to call twice; the second call does nothing. */
export function startField(el: HTMLCanvasElement): void {
  if (frame || canvas === el) return;

  canvas = el;
  ctx = el.getContext('2d', { alpha: true });
  if (!ctx) return;

  const root = getComputedStyle(document.documentElement);
  glow = root.getPropertyValue('--dm-glow').trim() || glow;
  arcColour = root.getPropertyValue('--dm-arc').trim() || arcColour;

  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  clock = 0;
  arc = null;
  measure();

  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  if (reduced) {
    // Still, but not empty: the field exists, it simply is not moving.
    paintOnce();
    return;
  }

  nextArc = 1.18;
  last = performance.now();
  frame = requestAnimationFrame(draw);
}

/** Stops it and lets go of everything, so a swapped-out page leaks nothing. */
export function stopField(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  window.clearTimeout(resizeTimer);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('visibilitychange', onVisibility);
  ctx?.clearRect(0, 0, width, height);
  motes = [];
  keepOut = [];
  arc = null;
  ctx = null;
  canvas = null;
}
