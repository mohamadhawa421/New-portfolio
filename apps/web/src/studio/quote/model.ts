/**
 * A quotation, as data.
 *
 * Nothing here is stored on a server. The quote lives in the browser while it
 * is being written, and when it is downloaded the whole of this object is
 * written *into the PDF* (see `pdf.ts`), so the PDF is the save file: opening
 * it in the builder again restores every field. That is why there are no
 * internal-only fields in this shape — everything in it travels to the client
 * inside the file they receive.
 *
 * `v` is the shape's version. A quote made today has to reopen in a builder
 * that has grown since, so a reader checks `v` and fills anything newer from
 * the defaults rather than failing.
 */

export const QUOTE_VERSION = 1;

export type Currency = 'USD' | 'EUR';

export interface Item {
  id: string;
  text: string;
  on: boolean;
}

export interface Section {
  id: string;
  title: string;
  /** One price for the whole section. Line items are scope, not prices. */
  price: number;
  /** A short line under the items, e.g. "Up to 24 desktop screens." */
  note: string;
  items: Item[];
}

export interface Phase {
  id: string;
  name: string;
  weeks: number;
  on: boolean;
}

export interface PayStep {
  id: string;
  label: string;
  percent: number;
  note: string;
}

export interface Term {
  id: string;
  title: string;
  body: string;
  on: boolean;
}

export interface Quote {
  v: number;
  number: string;
  /** ISO dates, yyyy-mm-dd. */
  issued: string;
  validUntil: string;
  currency: Currency;
  client: { name: string; company: string; email: string; phone: string; country: string };
  project: { name: string; summary: string };
  message: string;
  sections: Section[];
  discount: { on: boolean; kind: 'percent' | 'amount'; value: number; code: string };
  tax: { on: boolean; label: string; percent: number };
  timeline: { on: boolean; start: string; phases: Phase[] };
  payment: { on: boolean; steps: PayStep[] };
  terms: Term[];
  signature: boolean;
  from: { name: string; role: string; location: string; email: string; phone: string };
}

/** What the page knows about the designer and the site, passed in by the server. */
export interface Defaults {
  from: Quote['from'];
  /** The five process steps, by title, in order. */
  phases: string[];
  site: string;
  logoFull: string;
  logoMark: string;
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

/*
 * The ready-made scope.
 *
 * Grouped the way the portfolio sells its work, so the sections a client sees
 * on a quote are the services they saw on the site. Numbers in an item ("up
 * to 5") are plain text: change them where they are.
 */
export const SECTION_PRESETS: { title: string; items: string[] }[] = [
  {
    title: 'Discovery & strategy',
    items: [
      'Kick-off workshop',
      'Stakeholder interviews',
      'User interviews, up to 5',
      'Competitor & market review',
      'UX audit of the current product',
      'Information architecture',
      'User flows & journeys',
    ],
  },
  {
    title: 'Website design',
    items: [
      'Homepage',
      'Inner pages, up to 6',
      'Tablet & mobile versions',
      'Content structure & copy guidance',
      'Interaction & motion specs',
    ],
  },
  {
    title: 'Mobile app design',
    items: [
      'Core screens, up to 30',
      'Onboarding',
      'iOS & Android adaptation',
      'Empty, error & loading states',
      'Notifications & system states',
    ],
  },
  {
    title: 'Web app design',
    items: [
      'Dashboard',
      'Tables, filters & data views',
      'Forms & workflows',
      'Roles, settings & admin',
      'Empty, error & loading states',
    ],
  },
  {
    title: 'Design system',
    items: [
      'Foundations: colour, type, spacing, tokens',
      'Component library with variants',
      'Light & dark themes',
      'Usage documentation',
      'Figma library setup',
    ],
  },
  {
    title: 'Prototyping & testing',
    items: ['Clickable prototype', 'Usability testing, up to 5 sessions', 'Findings & one iteration round'],
  },
  {
    title: 'Handoff & support',
    items: [
      'Developer-ready Figma files',
      'Design QA during development',
      'Asset export',
      'Post-launch review',
      'Support, up to 10 hours a month',
    ],
  },
];

export const PAYMENT_PRESETS: { name: string; steps: Omit<PayStep, 'id'>[] }[] = [
  {
    name: '50 / 50',
    steps: [
      { label: 'On signing', percent: 50, note: 'Reserves the start date' },
      { label: 'On delivery', percent: 50, note: 'With the final files' },
    ],
  },
  {
    name: '30 / 40 / 30',
    steps: [
      { label: 'On signing', percent: 30, note: 'Reserves the start date' },
      { label: 'At design approval', percent: 40, note: 'When the main screens are signed off' },
      { label: 'On delivery', percent: 30, note: 'With the final files' },
    ],
  },
  {
    name: '100% upfront',
    steps: [{ label: 'On signing', percent: 100, note: 'Before work starts' }],
  },
  {
    name: 'Monthly',
    steps: [
      { label: 'Month 1', percent: 34, note: 'Invoiced at the start of the month' },
      { label: 'Month 2', percent: 33, note: 'Invoiced at the start of the month' },
      { label: 'Month 3', percent: 33, note: 'Invoiced at the start of the month' },
    ],
  },
];

/*
 * The standard terms.
 *
 * Every one can be switched off or rewritten for a client. `{client}` and
 * `{validUntil}` are filled in when the PDF is drawn, so a term written once
 * stays right on the next quote.
 */
export const TERM_PRESETS: Omit<Term, 'id'>[] = [
  {
    title: 'Invoices',
    body: 'Due within 7 days of issue, by bank transfer or Wise. Details come with the first invoice.',
    on: true,
  },
  {
    title: 'Revisions',
    body: 'Two rounds of revisions per deliverable. Further rounds are billed by the hour.',
    on: true,
  },
  {
    title: 'Scope changes',
    body: 'Anything outside the scope above is quoted separately before work starts.',
    on: true,
  },
  {
    title: 'Not included',
    body: 'Development, copywriting, stock imagery, font licences and hosting.',
    on: true,
  },
  {
    title: 'Your part',
    body: 'Content and access by the agreed dates, and feedback within 3 working days. Delays move the timeline by the same amount.',
    on: true,
  },
  {
    title: 'Ownership',
    body: 'Full rights to the final designs transfer to {client} on final payment.',
    on: true,
  },
  {
    title: 'Portfolio',
    body: 'The work may appear in my portfolio after launch, unless it is covered by an NDA.',
    on: true,
  },
  {
    title: 'Cancellation',
    body: 'If the project stops early, work completed to that date is billed.',
    on: true,
  },
  {
    title: 'Validity',
    body: 'This quote is valid until {validUntil}.',
    on: false,
  },
];

/** How long a quote stays open, offered as one-click choices. */
export const VALIDITY_DAYS = [14, 30, 60];

const DEFAULT_WEEKS = [2, 1, 4, 1, 2];

/* ------------------------------------------------------------------ */
/* Building and reading                                                */
/* ------------------------------------------------------------------ */

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export const isoToday = (): string => toIso(new Date());

export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** yyyy-mm-dd as a local date, never shifted by the time zone. */
export function fromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso) ?? new Date();
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** The next Monday on or after a date, which is when projects start. */
export function nextMonday(iso: string): string {
  const d = fromIso(iso) ?? new Date();
  const shift = (8 - d.getDay()) % 7;
  d.setDate(d.getDate() + shift);
  return toIso(d);
}

export function sectionFromPreset(title: string): Section {
  const preset = SECTION_PRESETS.find((p) => p.title === title);
  return {
    id: uid(),
    title: preset?.title ?? 'New section',
    price: 0,
    note: '',
    items: (preset?.items ?? []).map((text) => ({ id: uid(), text, on: true })),
  };
}

export function paymentFromPreset(name: string): PayStep[] {
  const preset = PAYMENT_PRESETS.find((p) => p.name === name) ?? PAYMENT_PRESETS[0];
  return preset.steps.map((s) => ({ ...s, id: uid() }));
}

/** A blank quote, already filled with everything that has a sensible default. */
export function blankQuote(defaults: Defaults, number: string): Quote {
  const issued = isoToday();
  return {
    v: QUOTE_VERSION,
    number,
    issued,
    validUntil: addDays(issued, 30),
    currency: 'USD',
    client: { name: '', company: '', email: '', phone: '', country: '' },
    project: { name: '', summary: '' },
    message: '',
    sections: [],
    discount: { on: false, kind: 'percent', value: 5, code: 'SUPER-DESIGNER-5' },
    tax: { on: false, label: 'VAT', percent: 11 },
    timeline: {
      on: true,
      start: nextMonday(addDays(issued, 14)),
      phases: defaults.phases.map((name, i) => ({ id: uid(), name, weeks: DEFAULT_WEEKS[i] ?? 1, on: true })),
    },
    payment: { on: true, steps: paymentFromPreset('50 / 50') },
    terms: TERM_PRESETS.map((t) => ({ ...t, id: uid() })),
    signature: true,
    from: { ...defaults.from },
  };
}

/**
 * Reads a quote that came out of a PDF, or out of this browser's draft.
 *
 * Anything missing or the wrong type is filled from a blank quote, so an
 * older file — or one a later version of the builder has added fields to —
 * opens rather than failing. It never trusts the shape it was handed.
 */
export function normalise(raw: unknown, defaults: Defaults): Quote | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Quote>;
  if (typeof r.v !== 'number') return null;
  const base = blankQuote(defaults, typeof r.number === 'string' ? r.number : '');

  const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
  const list = <T>(v: unknown, map: (x: any) => T): T[] => (Array.isArray(v) ? v.map(map) : []);

  return {
    v: QUOTE_VERSION,
    number: str(r.number, base.number),
    issued: str(r.issued, base.issued),
    validUntil: str(r.validUntil, base.validUntil),
    currency: r.currency === 'EUR' ? 'EUR' : 'USD',
    client: {
      name: str(r.client?.name, ''),
      company: str(r.client?.company, ''),
      email: str(r.client?.email, ''),
      phone: str(r.client?.phone, ''),
      country: str(r.client?.country, ''),
    },
    project: { name: str(r.project?.name, ''), summary: str(r.project?.summary, '') },
    message: str(r.message, ''),
    sections: list(r.sections, (s) => ({
      id: str(s?.id, uid()),
      title: str(s?.title, ''),
      price: num(s?.price, 0),
      note: str(s?.note, ''),
      items: list(s?.items, (i) => ({ id: str(i?.id, uid()), text: str(i?.text, ''), on: bool(i?.on, true) })),
    })),
    discount: {
      on: bool(r.discount?.on, false),
      kind: r.discount?.kind === 'amount' ? 'amount' : 'percent',
      value: num(r.discount?.value, base.discount.value),
      code: str(r.discount?.code, ''),
    },
    tax: {
      on: bool(r.tax?.on, false),
      label: str(r.tax?.label, base.tax.label),
      percent: num(r.tax?.percent, base.tax.percent),
    },
    timeline: {
      on: bool(r.timeline?.on, true),
      start: str(r.timeline?.start, ''),
      phases: Array.isArray(r.timeline?.phases)
        ? list(r.timeline?.phases, (p) => ({
            id: str(p?.id, uid()),
            name: str(p?.name, ''),
            weeks: num(p?.weeks, 1),
            on: bool(p?.on, true),
          }))
        : base.timeline.phases,
    },
    payment: {
      on: bool(r.payment?.on, true),
      steps: Array.isArray(r.payment?.steps)
        ? list(r.payment?.steps, (s) => ({
            id: str(s?.id, uid()),
            label: str(s?.label, ''),
            percent: num(s?.percent, 0),
            note: str(s?.note, ''),
          }))
        : base.payment.steps,
    },
    terms: Array.isArray(r.terms)
      ? list(r.terms, (t) => ({
          id: str(t?.id, uid()),
          title: str(t?.title, ''),
          body: str(t?.body, ''),
          on: bool(t?.on, true),
        }))
      : base.terms,
    signature: bool(r.signature, true),
    from: {
      name: str(r.from?.name, base.from.name),
      role: str(r.from?.role, base.from.role),
      location: str(r.from?.location, base.from.location),
      email: str(r.from?.email, base.from.email),
      phone: str(r.from?.phone, base.from.phone),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export interface Totals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  tax: number;
  total: number;
}

/** Cents, so 33% of 11,400 does not drift by a fraction of a cent. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function totals(q: Quote): Totals {
  const subtotal = round2(q.sections.reduce((sum, s) => sum + (Number.isFinite(s.price) ? s.price : 0), 0));
  const discount = !q.discount.on
    ? 0
    : round2(
        Math.min(subtotal, q.discount.kind === 'percent' ? (subtotal * q.discount.value) / 100 : q.discount.value)
      );
  const afterDiscount = round2(subtotal - discount);
  const tax = q.tax.on ? round2((afterDiscount * q.tax.percent) / 100) : 0;
  return { subtotal, discount, afterDiscount, tax, total: round2(afterDiscount + tax) };
}

/**
 * What each payment step comes to.
 *
 * The last step takes whatever rounding left over, so the steps always add up
 * to the total exactly — a schedule whose amounts disagree with the total by a
 * cent is the first thing an accounts department writes back about.
 */
export function stepAmounts(q: Quote, total: number): number[] {
  const steps = q.payment.steps;
  const amounts = steps.map((s) => round2((total * s.percent) / 100));
  const pct = steps.reduce((sum, s) => sum + s.percent, 0);
  if (amounts.length && Math.abs(pct - 100) < 0.001) {
    const rest = round2(total - amounts.slice(0, -1).reduce((a, b) => a + b, 0));
    amounts[amounts.length - 1] = rest;
  }
  return amounts;
}

export function money(n: number, currency?: Currency): string {
  const whole = Math.abs(n % 1) < 0.005;
  const body = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const sign = n < 0 ? '−' : '';
  return currency ? `${sign}${currency} ${body}` : `${sign}${body}`;
}

/* ------------------------------------------------------------------ */
/* Dates as printed                                                    */
/* ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "29 Oct 2026" — day first, which reads the same in Beirut, Paris and London. */
export function printDate(iso: string): string {
  const d = fromIso(iso);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

export function printDay(iso: string): string {
  const d = fromIso(iso);
  return d ? `${DAYS[d.getDay()]} ${printDate(iso)}` : '';
}

/** "16 – 27 Nov", or "30 Nov – 4 Dec" across a month. */
export function printRange(fromIsoDate: string, toIsoDate: string): string {
  const a = fromIso(fromIsoDate);
  const b = fromIso(toIsoDate);
  if (!a || !b) return '';
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}`
    : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

export interface PlacedPhase extends Phase {
  /** 1-based week the phase starts in. */
  from: number;
  to: number;
  dates: string;
}

/** Phases laid end to end, each starting the week after the last ends. */
export function placePhases(q: Quote): { phases: PlacedPhase[]; weeks: number } {
  let week = 1;
  const phases: PlacedPhase[] = [];
  for (const p of q.timeline.phases) {
    if (!p.on || p.weeks <= 0) continue;
    const from = week;
    const to = week + Math.max(1, Math.round(p.weeks)) - 1;
    let dates = from === to ? `Week ${from}` : `Weeks ${from} – ${to}`;
    if (q.timeline.start) {
      const start = addDays(q.timeline.start, (from - 1) * 7);
      const end = addDays(q.timeline.start, (to - 1) * 7 + 4);
      dates = printRange(start, end);
    }
    phases.push({ ...p, from, to, dates });
    week = to + 1;
  }
  return { phases, weeks: week - 1 };
}

/** `{client}` and `{validUntil}` in a term, filled in. */
export function fillTerm(body: string, q: Quote): string {
  return body
    .replaceAll('{client}', q.client.company || q.client.name || 'the client')
    .replaceAll('{validUntil}', printDate(q.validUntil));
}
