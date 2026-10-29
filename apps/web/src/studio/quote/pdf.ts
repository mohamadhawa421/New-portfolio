/**
 * The quote, drawn as a PDF.
 *
 * This is the only renderer. The preview in the builder is this file's output
 * in a frame, not an HTML imitation of it, so what is on screen is the PDF
 * byte for byte — there is no second layout to drift out of step with.
 *
 * Every measurement below is in the approved template's pixels: an A4 sheet
 * drawn 794 wide, 56 of margin, type from 7.5 to 34. `S` turns them into PDF
 * points at the last moment, so the numbers here can be checked against the
 * template by eye rather than by arithmetic.
 *
 * The quote itself rides inside the file (`MHQuote` in the document info),
 * which is what lets an old PDF be opened in the builder and edited. A client
 * printing it never sees it; a client reading the file's properties sees a
 * line of JSON, which holds nothing that is not already on the page.
 */

import fontkit from '@pdf-lib/fontkit';
import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
  rgb,
  setCharacterSpacing,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import interRegular from './fonts/Inter-Regular.ttf?url';
import interMedium from './fonts/Inter-Medium.ttf?url';
import interSemiBold from './fonts/Inter-SemiBold.ttf?url';
import interBold from './fonts/Inter-Bold.ttf?url';
import {
  QUOTE_VERSION,
  fillTerm,
  money,
  placePhases,
  printDate,
  printDay,
  stepAmounts,
  totals,
  type Defaults,
  type Quote,
} from './model';

/* ------------------------------------------------------------------ */
/* The sheet                                                           */
/* ------------------------------------------------------------------ */

const PT_W = 595.28;
const PT_H = 841.89;
/** One template pixel, in points. */
const S = PT_W / 794;
const PX_H = PT_H / S;

const MARGIN = 56;
const LEFT = MARGIN;
const RIGHT = 794 - MARGIN;
const WIDTH = RIGHT - LEFT;

/* Footer: text sits on the bottom margin, its rule 12 above it. */
const FOOT_TEXT_TOP = PX_H - MARGIN - 7.5 * 1.5;
const FOOT_RULE = FOOT_TEXT_TOP - 12 - 1;
/** Nothing in the flow goes below this. */
const LIMIT = FOOT_RULE - 22;

const T = { xxs: 7.5, xs: 8.5, sm: 9.5, base: 10.5, md: 12.5, lg: 17, xl: 34 };

const hex = (h: string): RGB =>
  rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/* The portfolio's light theme. The paper never follows a dark mode. */
const C = {
  ink: hex('#1d1d1f'),
  muted: hex('#6e6e73'),
  faint: hex('#86868b'),
  rule: hex('#e8e8ea'),
  wash: hex('#f5f5f7'),
  accent: hex('#0066cc'),
  accentWash: hex('#e8f1fb'),
  paper: hex('#ffffff'),
};

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

interface Logo {
  paths: string[];
  w: number;
  h: number;
}

export interface Assets {
  fonts: { regular: ArrayBuffer; medium: ArrayBuffer; semibold: ArrayBuffer; bold: ArrayBuffer };
  full: Logo | null;
  mark: Logo | null;
}

const bytes = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.arrayBuffer();
  });

/**
 * The logo as path data, read out of the site's own SVG.
 *
 * Drawn as vectors rather than embedded as an image so it stays sharp at any
 * zoom and costs a few hundred bytes. The SVGs have plain absolute paths and
 * no transforms, which is what makes reading `d` straight off them enough; a
 * logo that stops being that shape falls back to the name in type.
 */
async function logo(url: string): Promise<Logo | null> {
  if (!url) return null;
  try {
    const svg = new DOMParser().parseFromString(await (await fetch(url)).text(), 'image/svg+xml');
    const root = svg.documentElement;
    const box = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
    const w = box.length === 4 ? box[2] : Number(root.getAttribute('width'));
    const h = box.length === 4 ? box[3] : Number(root.getAttribute('height'));
    const paths = [...svg.querySelectorAll('path')]
      .filter((p) => p.getAttribute('fill') !== 'none')
      .map((p) => p.getAttribute('d') ?? '')
      .filter(Boolean);
    if (svg.querySelector('[transform]') || !paths.length || !(w > 0 && h > 0)) return null;
    return { paths, w, h };
  } catch {
    return null;
  }
}

let assets: Promise<Assets> | null = null;

export function loadAssets(defaults: Defaults): Promise<Assets> {
  assets ??= Promise.all([
    bytes(interRegular),
    bytes(interMedium),
    bytes(interSemiBold),
    bytes(interBold),
    logo(defaults.logoFull),
    logo(defaults.logoMark),
  ]).then(([regular, medium, semibold, bold, full, mark]) => ({
    fonts: { regular, medium, semibold, bold },
    full,
    mark,
  }));
  // A failed load is not cached, so the next keystroke tries again.
  assets.catch(() => (assets = null));
  return assets;
}

/* ------------------------------------------------------------------ */
/* Drawing in template pixels                                          */
/* ------------------------------------------------------------------ */

interface Fonts {
  r: PDFFont;
  m: PDFFont;
  sb: PDFFont;
  b: PDFFont;
}

interface Style {
  size: number;
  font: PDFFont;
  color?: RGB;
  /** Letter-spacing in em, as in the CSS. */
  track?: number;
  lh?: number;
}

/* Inter's ascent and descent, per em: where CSS puts the baseline in a line box. */
const ASCENT = 0.96875;
const CONTENT = 0.96875 + 0.2421875;

const baseline = (top: number, s: Style): number => top + (((s.lh ?? 1.5) - CONTENT) / 2 + ASCENT) * s.size;
const lineH = (s: Style): number => s.size * (s.lh ?? 1.5);

function measure(text: string, s: Style): number {
  const n = [...text].length;
  return s.font.widthOfTextAtSize(text, s.size) + (s.track ?? 0) * s.size * Math.max(0, n - 1);
}

/** Greedy wrapping, by words, breaking a word only when it is wider than the line. */
function wrap(text: string, s: Style, max: number): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next, s) <= max || !line) {
        line = next;
      } else {
        out.push(line);
        line = word;
      }
      while (measure(line, s) > max && [...line].length > 1) {
        const chars = [...line];
        let cut = chars.length - 1;
        while (cut > 1 && measure(chars.slice(0, cut).join(''), s) > max) cut--;
        out.push(chars.slice(0, cut).join(''));
        line = chars.slice(cut).join('');
      }
    }
    out.push(line);
  }
  return out;
}

class Sheet {
  constructor(readonly page: PDFPage) {}

  /** One line of text, its line box starting at `top`. */
  text(str: string, x: number, top: number, s: Style, align: 'left' | 'right' | 'center' = 'left'): void {
    if (!str) return;
    const w = measure(str, s);
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    if (s.track) this.page.pushOperators(setCharacterSpacing(s.track * s.size * S));
    this.page.drawText(str, {
      x: left * S,
      y: PT_H - baseline(top, s) * S,
      size: s.size * S,
      font: s.font,
      color: s.color ?? C.ink,
    });
    if (s.track) this.page.pushOperators(setCharacterSpacing(0));
  }

  lines(lines: string[], x: number, top: number, s: Style): number {
    lines.forEach((l, i) => this.text(l, x, top + i * lineH(s), s));
    return lines.length * lineH(s);
  }

  rect(x: number, top: number, w: number, h: number, color: RGB): void {
    this.page.drawRectangle({ x: x * S, y: PT_H - (top + h) * S, width: w * S, height: h * S, color });
  }

  /** A rounded box; a border is drawn inside the box, as CSS draws it. */
  round(
    x: number,
    top: number,
    w: number,
    h: number,
    r: number,
    o: { fill?: RGB; border?: RGB; borderOpacity?: number; bw?: number }
  ): void {
    const i = o.border ? (o.bw ?? 1) / 2 : 0;
    const [X, Y, W, H, R] = [i, i, w - 2 * i, h - 2 * i, Math.max(0, Math.min(r - i, (h - 2 * i) / 2, (w - 2 * i) / 2))];
    const d =
      `M${X + R} ${Y}H${X + W - R}A${R} ${R} 0 0 1 ${X + W} ${Y + R}V${Y + H - R}` +
      `A${R} ${R} 0 0 1 ${X + W - R} ${Y + H}H${X + R}A${R} ${R} 0 0 1 ${X} ${Y + H - R}` +
      `V${Y + R}A${R} ${R} 0 0 1 ${X + R} ${Y}Z`;
    this.page.drawSvgPath(d, {
      x: x * S,
      y: PT_H - top * S,
      scale: S,
      color: o.fill,
      borderColor: o.border,
      borderWidth: o.border ? (o.bw ?? 1) : undefined,
      borderOpacity: o.borderOpacity,
    });
  }

  dot(x: number, top: number, d: number, color: RGB): void {
    this.page.drawCircle({ x: (x + d / 2) * S, y: PT_H - (top + d / 2) * S, size: (d / 2) * S, color });
  }

  logo(l: Logo, x: number, top: number, h: number): number {
    const scale = (h / l.h) * S;
    for (const d of l.paths) this.page.drawSvgPath(d, { x: x * S, y: PT_H - top * S, scale, color: C.ink });
    return (l.w / l.h) * h;
  }
}

/* ------------------------------------------------------------------ */
/* Blocks and pages                                                    */
/* ------------------------------------------------------------------ */

interface Block {
  h: number;
  /** Space above, when the block is not the first thing on its page. */
  gap: number;
  /** Starts a new page, unless the page it would start on is still empty. */
  breakBefore?: boolean;
  draw: (s: Sheet, top: number) => void;
}

/** Two blocks that must stay on the same page, as one. */
function together(a: Block, b: Block): Block {
  return {
    h: a.h + b.gap + b.h,
    gap: a.gap,
    breakBefore: a.breakBefore,
    draw: (s, top) => {
      a.draw(s, top);
      b.draw(s, top + a.h + b.gap);
    },
  };
}

/* ------------------------------------------------------------------ */
/* The document                                                        */
/* ------------------------------------------------------------------ */

const KEY = 'MHQuote';

export async function renderQuote(q: Quote, a: Assets, site: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  /*
   * Inter's single-storey a and open digits (cv11, ss01) — the same features
   * the site sets, so the quote reads in the portfolio's voice.
   *
   * Not `tnum`, although the template asked for tabular figures. Inter's tnum
   * also swaps the hyphen and the space for figure-width versions, and a
   * whole-document feature cannot be scoped to the digits the way CSS scopes
   * it to an element: "MH-2026-014" came out as "MH - 2026 - 014", and every
   * "Kick-off" with it. Every figure here is right-aligned or stands alone,
   * so proportional digits cost nothing.
   */
  const features = { cv11: true, ss01: true };
  const embed = (b: ArrayBuffer) => doc.embedFont(b, { subset: true, features });
  const f: Fonts = {
    r: await embed(a.fonts.regular),
    m: await embed(a.fonts.medium),
    sb: await embed(a.fonts.semibold),
    b: await embed(a.fonts.bold),
  };

  const eyebrow: Style = { size: T.xxs, font: f.sb, color: C.faint, track: 0.12 };
  const t = totals(q);
  const client = q.client.company || q.client.name;
  const title = q.project.name || (client ? `Quotation for ${client}` : 'Quotation');

  /* -------------------------------- page 1 -------------------------------- */

  const blocks: Block[] = [];

  // Head: the wordmark, and the reference on the right.
  {
    const dt: Style = { size: T.xs, font: f.r, color: C.faint };
    const dd: Style = { size: T.xs, font: f.m, color: C.ink };
    const rows: [string, string][] = [
      ['Quotation', q.number],
      ['Issued', printDate(q.issued)],
      ['Valid until', printDate(q.validUntil)],
    ].filter(([, v]) => v) as [string, string][];
    const ddW = Math.max(0, ...rows.map(([, v]) => measure(v, dd)));
    const rowH = lineH(dd);
    const refH = rows.length * rowH + Math.max(0, rows.length - 1) * 3;
    blocks.push({
      h: Math.max(17, refH),
      gap: 0,
      draw: (s, top) => {
        if (a.full) s.logo(a.full, LEFT, top, 17);
        else s.text(q.from.name, LEFT, top, { size: T.md, font: f.sb, track: -0.01 });
        rows.forEach(([k, v], i) => {
          const y = top + i * (rowH + 3);
          s.text(v, RIGHT, y, dd, 'right');
          s.text(k, RIGHT - ddW - 18, y, dt, 'right');
        });
      },
    });
  }

  // Title.
  {
    const h2: Style = { size: T.xl, font: f.sb, track: -0.03, lh: 1.05 };
    const sum: Style = { size: T.md, font: f.r, color: C.muted };
    const brow = client ? `Proposal for ${client}`.toUpperCase() : 'PROPOSAL';
    const h2Lines = wrap(title, h2, WIDTH);
    const sumLines = q.project.summary.trim() ? wrap(q.project.summary.trim(), sum, 490) : [];
    const h =
      lineH(eyebrow) + 8 + h2Lines.length * lineH(h2) + (sumLines.length ? 8 + sumLines.length * lineH(sum) : 0);
    blocks.push({
      h,
      gap: 44,
      draw: (s, top) => {
        s.text(brow, LEFT, top, eyebrow);
        let y = top + lineH(eyebrow) + 8;
        y += s.lines(h2Lines, LEFT, y, h2);
        if (sumLines.length) s.lines(sumLines, LEFT, y + 8, sum);
      },
    });
  }

  // Parties.
  {
    const who: Style = { size: T.md, font: f.sb, track: -0.01 };
    const ln: Style = { size: T.sm, font: f.r, color: C.muted, lh: 1.55 };
    const col = (WIDTH - 32) / 2;
    const forWho = q.client.name || q.client.company;
    const forLines = [q.client.name ? q.client.company : '', q.client.email, q.client.phone, q.client.country]
      .filter(Boolean)
      .flatMap((l) => wrap(l, ln, col));
    const byLines = [[q.from.role, q.from.location].filter(Boolean).join(', '), q.from.email, q.from.phone]
      .filter(Boolean)
      .flatMap((l) => wrap(l, ln, col));
    const partyH = (lines: string[]) => lineH(eyebrow) + 5 + lineH(who) + (lines.length ? 5 + lines.length * lineH(ln) : 0);
    const party = (s: Sheet, x: number, top: number, label: string, name: string, lines: string[]) => {
      s.text(label, x, top, eyebrow);
      const y = top + lineH(eyebrow) + 5;
      s.text(name, x, y, who);
      s.lines(lines, x, y + lineH(who) + 5, ln);
    };
    blocks.push({
      h: 1 + 16 + Math.max(partyH(forLines), partyH(byLines)),
      gap: 28,
      draw: (s, top) => {
        s.rect(LEFT, top, WIDTH, 1, C.rule);
        party(s, LEFT, top + 17, 'PREPARED FOR', forWho || '—', forLines);
        party(s, LEFT + col + 32, top + 17, 'PREPARED BY', q.from.name, byLines);
      },
    });
  }

  // The message.
  if (q.message.trim()) {
    const st: Style = { size: T.base, font: f.r };
    const lines = wrap(q.message.trim(), st, 430);
    blocks.push({ h: lines.length * lineH(st), gap: 22, draw: (s, top) => s.lines(lines, LEFT, top, st) });
  }

  // Scope: a header, then one block per section so a long scope can turn the page.
  const sections = q.sections.filter((s) => s.title.trim() || s.items.some((i) => i.on && i.text.trim()));
  if (sections.length) {
    const head: Block = {
      h: lineH(eyebrow) + 8 + 1.5,
      gap: 26,
      draw: (s, top) => {
        s.text('SCOPE', LEFT, top, eyebrow);
        s.text(`PRICE, ${q.currency}`, RIGHT, top, eyebrow, 'right');
        s.rect(LEFT, top + lineH(eyebrow) + 8, WIDTH, 1.5, C.ink);
      },
    };

    const no: Style = { size: T.xs, font: f.sb, color: C.faint };
    const h3: Style = { size: T.md, font: f.sb, track: -0.01 };
    const price: Style = { size: T.md, font: f.sb };
    const item: Style = { size: T.sm, font: f.r, color: C.muted };
    const aside: Style = { size: T.xs, font: f.r, color: C.faint };
    const X = LEFT + 28 + 10;
    const inner = RIGHT - X;
    const colW = (inner - 20) / 2;

    const rows = sections.map((sec, index) => {
      const priceText = sec.price > 0 ? money(sec.price) : 'Included';
      const titleLines = wrap(sec.title.trim() || 'Untitled', h3, inner - measure(priceText, price) - 16);
      const items = sec.items.filter((i) => i.on && i.text.trim()).map((i) => wrap(i.text.trim(), item, colW - 10));
      const pairs: string[][][] = [];
      for (let i = 0; i < items.length; i += 2) pairs.push(items.slice(i, i + 2));
      const pairH = pairs.map((p) => Math.max(...p.map((l) => l.length * lineH(item))));
      const itemsH = pairs.length ? 6 + pairH.reduce((x, y) => x + y, 0) + (pairs.length - 1) * 2 : 0;
      const asideLines = sec.note.trim() ? wrap(sec.note.trim(), aside, inner) : [];
      const asideH = asideLines.length ? 5 + asideLines.length * lineH(aside) : 0;
      const h = 12 + titleLines.length * lineH(h3) + itemsH + asideH + 12 + 1;

      const block: Block = {
        h,
        gap: 0,
        draw: (s, top) => {
          const y0 = top + 12;
          // The number is optically lowered to sit on the title's line.
          s.text(String(index + 1).padStart(2, '0'), LEFT, y0 + 2, no);
          s.lines(titleLines, X, y0, h3);
          s.text(priceText, RIGHT, y0, sec.price > 0 ? price : { ...price, font: f.m, color: C.muted }, 'right');
          let y = y0 + titleLines.length * lineH(h3);
          if (pairs.length) {
            y += 6;
            pairs.forEach((pair, r) => {
              pair.forEach((lines, c) => {
                const x = X + c * (colW + 20);
                s.dot(x, y + 0.62 * T.sm + (lineH(item) - T.sm) / 2 - 1.5, 3, C.faint);
                s.lines(lines, x + 10, y, item);
              });
              y += pairH[r] + 2;
            });
            y -= 2;
          }
          if (asideLines.length) s.lines(asideLines, X, y + 5, aside);
          s.rect(LEFT, top + h - 1, WIDTH, 1, C.rule);
        },
      };
      return block;
    });

    blocks.push(together(head, rows[0]), ...rows.slice(1));
  }

  // Totals, with the fine print beside them.
  {
    const line: Style = { size: T.sm, font: f.r, color: C.muted };
    const val: Style = { size: T.sm, font: f.r, color: C.ink };
    const grandL: Style = { size: T.sm, font: f.sb, color: C.ink };
    const grandV: Style = { size: T.lg, font: f.b, color: C.accent, track: -0.02 };
    const chip: Style = { size: T.xxs, font: f.sb, color: C.ink, track: 0.04 };
    const fine: Style = { size: T.xs, font: f.r, color: C.faint };

    const adjust: { label: string; chip?: string; value: string }[] = [];
    if (t.discount > 0) {
      const pct = q.discount.kind === 'percent' ? `${q.discount.value}%` : '';
      adjust.push({
        label: q.discount.code.trim() ? 'Discount' : pct ? `Discount, ${pct}` : 'Discount',
        chip: q.discount.code.trim().toUpperCase() || undefined,
        value: money(-t.discount),
      });
    }
    if (q.tax.on && q.tax.percent > 0) {
      adjust.push({ label: `${q.tax.label.trim() || 'Tax'}, ${q.tax.percent}%`, value: money(t.tax) });
    }
    const showSub = adjust.length > 0;
    const lh = lineH(line);
    const grandH = lineH(grandV);
    const boxInner = (showSub ? (1 + adjust.length) * lh + adjust.length * 5 + 5 + 6 + 9 + 1 : 0) + grandH;
    const boxH = 14 + boxInner + 14;
    const boxW = 290;

    const currencyName = q.currency === 'EUR' ? 'euros' : 'US dollars';
    const later = [q.payment.on && q.payment.steps.length ? 'payment schedule' : '', q.timeline.on ? 'timeline' : '', q.terms.some((x) => x.on) ? 'terms' : '']
      .filter(Boolean);
    const laterText = later.length
      ? ` ${(later.length === 1 ? later[0] : `${later.slice(0, -1).join(', ')} and ${later[later.length - 1]}`).replace(/^./, (c) => c.toUpperCase())} ${later.length === 1 ? 'is' : 'are'} on the next page.`
      : '';
    const fineText =
      `Prices are in ${currencyName} and ${q.tax.on && q.tax.percent > 0 ? `include ${q.tax.label.trim() || 'tax'}` : 'exclude local taxes'}.` +
      laterText;
    const fineLines = wrap(fineText, fine, Math.min(211 * 1.3, WIDTH - boxW - 28));
    const fineH = fineLines.length * lineH(fine);

    const totalsBlock: Block = {
      h: Math.max(boxH, fineH),
      gap: 16,
      draw: (s, top) => {
        const h = Math.max(boxH, fineH);
        s.lines(fineLines, LEFT, top + h - fineH, fine);
        const bx = RIGHT - boxW;
        const by = top + h - boxH;
        s.round(bx, by, boxW, boxH, 12, { fill: C.wash });
        const l = bx + 16;
        const r = RIGHT - 16;
        let y = by + 14;
        if (showSub) {
          s.text('Subtotal', l, y, line);
          s.text(money(t.subtotal), r, y, val, 'right');
          for (const row of adjust) {
            y += lh + 5;
            s.text(row.label, l, y, line);
            if (row.chip) {
              const cx = l + measure(row.label, line) + 6;
              const cw = measure(row.chip, chip) + 10;
              const ch = lineH(chip);
              s.round(cx, y + (lh - ch) / 2, cw, ch, 4, { fill: C.paper });
              s.text(row.chip, cx + 5, y + (lh - ch) / 2, chip);
            }
            s.text(row.value, r, y, val, 'right');
          }
          y += lh + 5 + 6;
          s.rect(l, y, r - l, 1, C.rule);
          y += 1 + 9;
        }
        // "Total" on the big figure's baseline, as `align-items: baseline` puts it.
        const b = baseline(y, grandV);
        const labelTop = b - (baseline(0, grandL));
        s.text('Total', l, labelTop, grandL);
        s.text(money(t.total, q.currency), r, y, grandV, 'right');
      },
    };
    // The total travels with the last section, never alone at the top of a page.
    blocks.push(sections.length ? together(blocks.pop()!, totalsBlock) : totalsBlock);
  }

  /* -------------------------------- page 2 -------------------------------- */

  const blockHead = (name: string, aside: string): Block => {
    const h3: Style = { size: T.lg, font: f.sb, track: -0.02 };
    const side: Style = { size: T.xs, font: f.r, color: C.faint };
    return {
      h: lineH(h3) + 12,
      gap: 26,
      draw: (s, top) => {
        s.text(name, LEFT, top, h3);
        if (aside) s.text(aside, RIGHT, baseline(top, h3) - baseline(0, side), side, 'right');
      },
    };
  };

  let breakNext = true;
  const push = (b: Block) => {
    if (breakNext) b.breakBefore = true;
    breakNext = false;
    blocks.push(b);
  };

  // Timeline, to scale: one column per week.
  const placed = placePhases(q);
  if (q.timeline.on && placed.phases.length) {
    const wk: Style = { size: T.xxs, font: f.r, color: C.faint };
    const name: Style = { size: T.sm, font: f.sb, lh: 1.3 };
    const dates: Style = { size: T.xxs, font: f.r, color: C.faint, lh: 1.3 };
    const lead = 168;
    const weeks = placed.weeks;
    const colW = (WIDTH - lead) / weeks;
    const every = Math.max(1, Math.ceil(14 / colW));
    const longest = Math.max(...placed.phases.map((p) => p.to - p.from));
    const rows = placed.phases.map((p) => ({ p, lines: wrap(p.name, name, lead - 10) }));
    const rowH = rows.map((r) => 4 + r.lines.length * lineH(name) + lineH(dates) + 4);
    const headH = lineH(wk) + 4 + 1;
    const h = headH + rowH.reduce((x, y) => x + y + 5, 0);
    const aside = `${weeks} ${weeks === 1 ? 'week' : 'weeks'}${q.timeline.start ? ` · starts ${printDay(q.timeline.start)}` : ''}`;

    push(
      together(blockHead('Timeline', aside), {
        h,
        gap: 0,
        draw: (s, top) => {
          s.text('Phase', LEFT, top, wk);
          for (let w = 1; w <= weeks; w++) {
            if ((w - 1) % every === 0) s.text(String(w), LEFT + lead + (w - 0.5) * colW, top, wk, 'center');
          }
          s.rect(LEFT, top + lineH(wk) + 4, WIDTH, 1, C.rule);
          let y = top + headH;
          rows.forEach(({ p, lines }, i) => {
            y += 5;
            s.lines(lines, LEFT, y + 4, name);
            s.text(p.dates, LEFT, y + 4 + lines.length * lineH(name), dates);
            const bx = LEFT + lead + (p.from - 1) * colW + 1.5;
            const bw = (p.to - p.from + 1) * colW - 3;
            const core = p.to - p.from === longest;
            s.round(bx, y + (rowH[i] - 16) / 2, bw, 16, 4, {
              fill: core ? C.accent : C.accentWash,
              border: C.accent,
              borderOpacity: core ? 1 : 0.35,
            });
            y += rowH[i];
          });
        },
      })
    );
  }

  // Payment.
  const steps = q.payment.steps.filter((s) => s.label.trim() || s.percent);
  if (q.payment.on && steps.length) {
    const amt: Style = { size: T.lg, font: f.sb, track: -0.02 };
    const when: Style = { size: T.sm, font: f.r, color: C.muted };
    const amounts = stepAmounts({ ...q, payment: { ...q.payment, steps } }, t.total);
    const cols = Math.min(3, steps.length);
    const cardW = (WIDTH - (cols - 1) * 12) / cols;
    const cards = steps.map((st, i) => {
      const note = st.note.trim();
      const text = `${st.percent}%${note ? `, ${note.charAt(0).toLowerCase()}${note.slice(1)}` : ''}`;
      const lines = wrap(text, when, cardW - 28);
      return { label: (st.label.trim() || `Step ${i + 1}`).toUpperCase(), amount: money(amounts[i], q.currency), lines };
    });
    const cardH = (c: (typeof cards)[number]) => 12 + lineH(eyebrow) + 3 + lineH(amt) + 3 + c.lines.length * lineH(when) + 12;
    const rows: (typeof cards)[] = [];
    for (let i = 0; i < cards.length; i += cols) rows.push(cards.slice(i, i + cols));
    const rowH = rows.map((r) => Math.max(...r.map(cardH)));
    const sum = steps.reduce((x, s) => x + s.percent, 0);
    const aside = Math.abs(sum - 100) > 0.001 ? `${sum}% of the total` : steps.length === 1 ? 'In full' : steps.map((s) => s.percent).join(' / ');

    push(
      together(blockHead('Payment', aside), {
        h: rowH.reduce((x, y) => x + y, 0) + (rows.length - 1) * 12,
        gap: 0,
        draw: (s, top) => {
          let y = top;
          rows.forEach((row, r) => {
            row.forEach((c, i) => {
              const x = LEFT + i * (cardW + 12);
              s.round(x, y, cardW, rowH[r], 10, { border: C.rule });
              let cy = y + 12;
              s.text(c.label, x + 14, cy, eyebrow);
              cy += lineH(eyebrow) + 3;
              s.text(c.amount, x + 14, cy, amt);
              cy += lineH(amt) + 3;
              s.lines(c.lines, x + 14, cy, when);
            });
            y += rowH[r] + 12;
          });
        },
      })
    );
  }

  // Terms, two to a row, each row kept whole.
  const terms = q.terms.filter((x) => x.on && (x.title.trim() || x.body.trim()));
  if (terms.length) {
    const num: Style = { size: T.xs, font: f.sb, color: C.faint };
    const head: Style = { size: T.sm, font: f.sb, color: C.ink, lh: 1.45 };
    const body: Style = { size: T.sm, font: f.r, color: C.muted, lh: 1.45 };
    const colW = (WIDTH - 28) / 2;
    const textW = colW - 18;
    const laid = terms.map((x, i) => ({
      n: String(i + 1),
      title: x.title.trim() ? wrap(x.title.trim(), head, textW) : [],
      body: x.body.trim() ? wrap(fillTerm(x.body.trim(), q), body, textW) : [],
    }));
    const termH = (x: (typeof laid)[number]) => x.title.length * lineH(head) + x.body.length * lineH(body);
    const rows: Block[] = [];
    for (let i = 0; i < laid.length; i += 2) {
      const pair = laid.slice(i, i + 2);
      rows.push({
        h: Math.max(...pair.map(termH)),
        gap: 9,
        draw: (s, top) => {
          pair.forEach((x, c) => {
            const cx = LEFT + c * (colW + 28);
            s.text(x.n, cx, baseline(top, head) - baseline(0, num), num);
            const y = top + s.lines(x.title, cx + 18, top, head);
            s.lines(x.body, cx + 18, y, body);
          });
        },
      });
    }
    push(together(blockHead('Terms', ''), { ...rows[0], gap: 0 }));
    blocks.push(...rows.slice(1));
  }

  // Agreement.
  if (q.signature) {
    const nameS: Style = { size: T.md, font: f.m };
    const meta: Style = { size: T.xs, font: f.r, color: C.muted };
    const col = (WIDTH - 28) / 2;
    const clientLine = [q.client.name, q.client.company].filter(Boolean).join(', ') || 'Client';
    push(
      together(blockHead('Agreement', 'Signing confirms the scope, price and terms above.'), {
        h: 46 + 1 + 4 + lineH(meta),
        gap: 0,
        draw: (s, top) => {
          [
            { name: q.from.name, left: q.from.role, right: printDate(q.issued) },
            { name: '', left: clientLine, right: 'Date' },
          ].forEach((sig, i) => {
            const x = LEFT + i * (col + 28);
            if (sig.name) s.text(sig.name, x, top + 46 - 4 - lineH(nameS), nameS);
            s.rect(x, top + 46, col, 1, C.ink);
            s.text(sig.left, x, top + 47 + 4, meta);
            s.text(sig.right, x + col, top + 47 + 4, meta, 'right');
          });
        },
      })
    );
  }

  /* ------------------------------ pagination ------------------------------ */

  const sheets: Sheet[] = [];
  let sheet!: Sheet;
  let cursor = 0;
  let empty = true;

  const newPage = () => {
    sheet = new Sheet(doc.addPage([PT_W, PT_H]));
    sheets.push(sheet);
    empty = true;
    cursor = MARGIN;
    if (sheets.length > 1) {
      // The running header: the mark, and which quote this page belongs to.
      const st: Style = { size: T.xs, font: f.r, color: C.faint };
      const h = Math.max(16, lineH(st));
      if (a.mark) sheet.logo(a.mark, LEFT, MARGIN + (h - 16) / 2, 16);
      else sheet.text(q.from.name, LEFT, MARGIN + (h - lineH(st)) / 2, { ...st, font: f.sb, color: C.ink });
      const label = ['Quotation ' + q.number, client].filter((x) => x.trim() && x !== 'Quotation ').join(' · ');
      sheet.text(label, RIGHT, MARGIN + (h - lineH(st)) / 2, st, 'right');
      sheet.rect(LEFT, MARGIN + h + 14, WIDTH, 1, C.rule);
      cursor = MARGIN + h + 14 + 1;
    }
  };

  newPage();
  for (const b of blocks) {
    if (b.breakBefore && !(empty && sheets.length > 1)) newPage();
    // The first thing under a running header always gets the block spacing.
    const gap = empty ? (sheets.length > 1 ? 26 : 0) : b.gap;
    if (!empty && cursor + gap + b.h > LIMIT) {
      newPage();
      b.draw(sheet, cursor + 26);
      cursor += 26 + b.h;
    } else {
      b.draw(sheet, cursor + gap);
      cursor += gap + b.h;
    }
    empty = false;
  }

  // Footers last, once the page count is known.
  const foot: Style = { size: T.xxs, font: f.r, color: C.faint };
  const left = [q.number, q.project.name].filter((x) => x.trim()).join(' · ');
  sheets.forEach((s, i) => {
    s.rect(LEFT, FOOT_RULE, WIDTH, 1, C.rule);
    s.text(left, LEFT, FOOT_TEXT_TOP, foot);
    s.text(site, LEFT + WIDTH / 2, FOOT_TEXT_TOP, foot, 'center');
    s.text(`${i + 1} / ${sheets.length}`, RIGHT, FOOT_TEXT_TOP, foot, 'right');
  });

  /* ------------------------------- metadata ------------------------------- */

  doc.setTitle([`Quotation ${q.number}`, client].filter((x) => x.trim()).join(' · '));
  doc.setAuthor(q.from.name);
  doc.setSubject(q.project.name || 'Quotation');
  doc.setCreator('Portfolio Studio');
  doc.setProducer('Portfolio Studio');
  doc.setCreationDate(new Date());
  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  info.set(PDFName.of(KEY), PDFHexString.fromText(JSON.stringify({ v: QUOTE_VERSION, quote: q })));

  return doc.save();
}

/**
 * The quote a PDF from this builder carries, or null for any other PDF.
 *
 * Returned raw: `normalise()` in the model decides what of it to trust.
 */
export async function readQuote(data: ArrayBuffer): Promise<unknown | null> {
  const doc = await PDFDocument.load(data, { updateMetadata: false, ignoreEncryption: true });
  const ref = doc.context.trailerInfo.Info;
  if (!ref) return null;
  const info = doc.context.lookup(ref);
  if (!(info instanceof PDFDict)) return null;
  const raw = info.get(PDFName.of(KEY));
  if (!(raw instanceof PDFHexString || raw instanceof PDFString)) return null;
  try {
    const payload = JSON.parse(raw.decodeText());
    return payload && typeof payload === 'object' && 'quote' in payload ? payload.quote : null;
  } catch {
    return null;
  }
}
