/**
 * The quote builder: a form on the left, the real PDF on the right.
 *
 * State is one `Quote` object. Typing writes into it by path (`data-path` on
 * every input) and redraws the PDF; only adding, removing or reordering
 * rebuilds the form, so a field never loses the caret while it is being
 * typed in.
 *
 * Nothing goes to a server. The quote in progress is kept in this browser
 * (so a closed tab is not lost work), and the download is the record: open
 * it here again and every field comes back.
 */

import {
  PAYMENT_PRESETS,
  SECTION_PRESETS,
  TERM_PRESETS,
  VALIDITY_DAYS,
  addDays,
  blankQuote,
  money,
  normalise,
  paymentFromPreset,
  placePhases,
  sectionFromPreset,
  totals,
  uid,
  type Defaults,
  type Quote,
} from './model';
import { loadAssets, readQuote, renderQuote } from './pdf';

const DRAFT = 'mh-quote-draft';
const SEQ = 'mh-quote-seq';

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

/** The next number in this browser's series: MH-2026-001, MH-2026-002… */
function nextNumber(): string {
  const year = new Date().getFullYear();
  let n = 0;
  try {
    const seq = JSON.parse(store.get(SEQ) ?? '{}');
    if (seq.year === year && Number.isFinite(seq.n)) n = seq.n;
  } catch {}
  return `MH-${year}-${String(n + 1).padStart(3, '0')}`;
}

/** A downloaded number is used: the next quote gets the one after it. */
function commitNumber(number: string): void {
  const m = /^MH-(\d{4})-(\d+)$/.exec(number.trim());
  if (!m) return;
  const year = Number(m[1]);
  const n = Number(m[2]);
  let seq = { year, n: 0 };
  try {
    seq = { ...seq, ...JSON.parse(store.get(SEQ) ?? '{}') };
  } catch {}
  if (seq.year !== year) seq = { year, n: 0 };
  if (n > seq.n) store.set(SEQ, JSON.stringify({ year, n }));
}

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/* ------------------------------------------------------------------ */
/* Paths                                                               */
/* ------------------------------------------------------------------ */

function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj: any, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const parent = keys.reduce((o, k) => o[k], obj);
  parent[last] = value;
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

const icon = {
  x: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8"/></svg>',
  up: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 12 4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>',
  plus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5v10M5 10h10"/></svg>',
};

interface FieldOpts {
  label?: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'number';
  placeholder?: string;
  rows?: number;
  hint?: string;
  cls?: string;
  step?: string;
}

function field(q: Quote, path: string, o: FieldOpts = {}): string {
  const value = getPath(q, path);
  const attrs = `data-path="${esc(path)}"${o.type === 'number' ? ' data-type="number"' : ''} placeholder="${esc(o.placeholder ?? '')}"${o.label ? '' : ` aria-label="${esc(o.placeholder ?? path)}"`}`;
  const input =
    o.rows != null
      ? `<textarea class="field__input" rows="${o.rows}" ${attrs}>${esc(value)}</textarea>`
      : `<input class="field__input" type="${o.type ?? 'text'}"${o.type === 'number' ? ` inputmode="decimal" min="0" step="${o.step ?? 'any'}"` : ''} value="${esc(value)}" ${attrs} autocomplete="off" />`;
  if (!o.label) return input;
  return `<label class="field ${o.cls ?? ''}"><span class="field__label">${esc(o.label)}</span>${input}${o.hint ? `<span class="field__hint">${esc(o.hint)}</span>` : ''}</label>`;
}

function check(q: Quote, path: string, label = ''): string {
  return `<label class="tick"${label ? '' : ' title="Include"'}><input type="checkbox" data-path="${esc(path)}" data-type="bool"${getPath(q, path) ? ' checked' : ''} />${label ? `<span>${esc(label)}</span>` : '<span class="sr-only">Include</span>'}</label>`;
}

function toggle(q: Quote, path: string, label: string): string {
  return `<label class="switch"><input type="checkbox" data-path="${esc(path)}" data-type="bool" data-rebuild${getPath(q, path) ? ' checked' : ''} /><span class="switch__track"></span><span>${esc(label)}</span></label>`;
}

const act = (name: string, args: (string | number)[], html: string, title: string, cls = 'icon icon--small') =>
  `<button class="${cls}" type="button" data-act="${name}" data-args="${esc(args.join(','))}" title="${esc(title)}" aria-label="${esc(title)}">${html}</button>`;

function group(id: string, title: string, body: string, aside = ''): string {
  return `<section class="group" id="g-${id}"><header class="group__head"><h2 class="group__title">${esc(title)}</h2>${aside}</header><div class="group__body">${body}</div></section>`;
}

/* ------------------------------------------------------------------ */
/* The form                                                            */
/* ------------------------------------------------------------------ */

function form(q: Quote): string {
  const t = totals(q);
  const out: string[] = [];

  out.push(
    group(
      'quote',
      'Quote',
      `<div class="row row--3">
        ${field(q, 'number', { label: 'Number' })}
        ${field(q, 'issued', { label: 'Issued', type: 'date' })}
        ${field(q, 'validUntil', { label: 'Valid until', type: 'date' })}
      </div>
      <div class="row row--split">
        <div class="chips" role="group" aria-label="Valid for">
          ${VALIDITY_DAYS.map((n) => `<button type="button" class="chip${q.validUntil === addDays(q.issued, n) ? ' chip--on' : ''}" data-act="validity" data-args="${n}">${n} days</button>`).join('')}
        </div>
        <div class="chips" role="group" aria-label="Currency">
          ${(['USD', 'EUR'] as const).map((c) => `<button type="button" class="chip${q.currency === c ? ' chip--on' : ''}" data-act="currency" data-args="${c}">${c}</button>`).join('')}
        </div>
      </div>`
    )
  );

  out.push(
    group(
      'client',
      'Client & project',
      `<div class="row row--2">
        ${field(q, 'client.name', { label: 'Contact name', placeholder: 'Sarah Johnson' })}
        ${field(q, 'client.company', { label: 'Company', placeholder: 'Peal Solutions' })}
      </div>
      <div class="row row--3">
        ${field(q, 'client.email', { label: 'Email', type: 'email' })}
        ${field(q, 'client.phone', { label: 'Phone', type: 'tel' })}
        ${field(q, 'client.country', { label: 'Country' })}
      </div>
      ${field(q, 'project.name', { label: 'Project title', placeholder: 'mon avis patient' })}
      ${field(q, 'project.summary', { label: 'One-line summary', rows: 2, placeholder: 'What is being designed, for whom.' })}`
    )
  );

  out.push(
    group(
      'message',
      'Message',
      field(q, 'message', {
        label: 'A short note to the client',
        rows: 4,
        placeholder: 'Sarah, thank you for walking me through the product. This is the scope we agreed on the call…',
        hint: 'Leave empty to leave it out.',
      })
    )
  );

  // Scope.
  {
    const used = new Set(q.sections.map((s) => s.title));
    const sections = q.sections
      .map((s, i) => {
        const p = `sections.${i}`;
        const items = s.items
          .map(
            (it, j) =>
              `<li class="item${it.on ? '' : ' item--off'}">${check(q, `${p}.items.${j}.on`)}${field(q, `${p}.items.${j}.text`, { placeholder: 'Deliverable' })}${act('removeItem', [i, j], icon.x, 'Remove')}</li>`
          )
          .join('');
        return `<article class="card">
          <header class="card__head">
            <span class="card__no">${String(i + 1).padStart(2, '0')}</span>
            ${field(q, `${p}.title`, { placeholder: 'Section title' })}
            <span class="money">${q.currency}</span>
            ${field(q, `${p}.price`, { type: 'number', placeholder: '0', step: '50' })}
            <span class="card__tools">
              ${act('moveSection', [i, -1], icon.up, 'Move up')}
              ${act('moveSection', [i, 1], icon.down, 'Move down')}
              ${act('removeSection', [i], icon.x, 'Remove section')}
            </span>
          </header>
          <ul class="items">${items}</ul>
          <div class="add-line">
            <input class="field__input" type="text" placeholder="Add a deliverable, press Enter" data-add-item="${i}" aria-label="Add a deliverable" />
          </div>
          ${field(q, `${p}.note`, { placeholder: 'A note under the items, e.g. "Up to 24 desktop screens."' })}
        </article>`;
      })
      .join('');
    const presets = SECTION_PRESETS.filter((p) => !used.has(p.title))
      .map((p) => `<button type="button" class="chip chip--add" data-act="addSection" data-args="${esc(p.title)}">${icon.plus}${esc(p.title)}</button>`)
      .join('');
    out.push(
      group(
        'scope',
        'Scope',
        `${sections || '<p class="empty">Add the services this quote covers. Each comes with its usual deliverables; untick what is not included.</p>'}
        <div class="chips chips--wrap">${presets}<button type="button" class="chip chip--add" data-act="addSection" data-args="">${icon.plus}Blank section</button></div>`,
        `<span class="group__aside">Subtotal <b data-out="subtotal">${money(t.subtotal, q.currency)}</b></span>`
      )
    );
  }

  // Totals.
  out.push(
    group(
      'totals',
      'Discount & tax',
      `<div class="opt">
        ${toggle(q, 'discount.on', 'Discount')}
        ${
          q.discount.on
            ? `<div class="row row--3">
                <div class="chips" role="group" aria-label="Discount kind">
                  <button type="button" class="chip${q.discount.kind === 'percent' ? ' chip--on' : ''}" data-act="discountKind" data-args="percent">%</button>
                  <button type="button" class="chip${q.discount.kind === 'amount' ? ' chip--on' : ''}" data-act="discountKind" data-args="amount">${q.currency}</button>
                </div>
                ${field(q, 'discount.value', { type: 'number', placeholder: '5' })}
                ${field(q, 'discount.code', { placeholder: 'Code, optional' })}
              </div>`
            : ''
        }
      </div>
      <div class="opt">
        ${toggle(q, 'tax.on', 'Tax')}
        ${
          q.tax.on
            ? `<div class="row row--2">${field(q, 'tax.label', { placeholder: 'VAT' })}${field(q, 'tax.percent', { type: 'number', placeholder: '11' })}</div>`
            : ''
        }
      </div>
      <p class="sum">Total <b data-out="total">${money(t.total, q.currency)}</b></p>`
    )
  );

  // Timeline.
  {
    const placed = placePhases(q);
    const rows = q.timeline.phases
      .map((p, i) => {
        const at = placed.phases.find((x) => x.id === p.id);
        return `<li class="phase${p.on ? '' : ' item--off'}">${check(q, `timeline.phases.${i}.on`)}${field(q, `timeline.phases.${i}.name`, { placeholder: 'Phase' })}${field(q, `timeline.phases.${i}.weeks`, { type: 'number', placeholder: '1', step: '1' })}<span class="phase__unit">wk</span><span class="phase__when" data-out="phase-${esc(p.id)}">${esc(at?.dates ?? '')}</span>${act('removePhase', [i], icon.x, 'Remove')}</li>`;
      })
      .join('');
    out.push(
      group(
        'timeline',
        'Timeline',
        `${toggle(q, 'timeline.on', 'Show a timeline')}
        ${
          q.timeline.on
            ? `${field(q, 'timeline.start', { label: 'Starts', type: 'date', hint: 'Leave empty to show week numbers instead of dates.' })}
              <ul class="phases">${rows}</ul>
              <button type="button" class="btn btn--small" data-act="addPhase" data-args="">${icon.plus}Add phase</button>`
            : ''
        }`,
        q.timeline.on ? `<span class="group__aside" data-out="weeks">${placed.weeks} weeks</span>` : ''
      )
    );
  }

  // Payment.
  {
    const sum = q.payment.steps.reduce((x, s) => x + s.percent, 0);
    const rows = q.payment.steps
      .map(
        (_, i) =>
          `<li class="step">${field(q, `payment.steps.${i}.label`, { placeholder: 'On signing' })}${field(q, `payment.steps.${i}.percent`, { type: 'number', placeholder: '50', step: '5' })}<span class="phase__unit">%</span>${field(q, `payment.steps.${i}.note`, { placeholder: 'Reserves the start date' })}${act('removeStep', [i], icon.x, 'Remove')}</li>`
      )
      .join('');
    out.push(
      group(
        'payment',
        'Payment',
        `${toggle(q, 'payment.on', 'Show a payment schedule')}
        ${
          q.payment.on
            ? `<div class="chips">${PAYMENT_PRESETS.map((p) => `<button type="button" class="chip" data-act="paymentPreset" data-args="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div>
              <ul class="steps">${rows}</ul>
              <div class="row row--split">
                <button type="button" class="btn btn--small" data-act="addStep" data-args="">${icon.plus}Add step</button>
                <span class="warn" data-out="pay-warn"${Math.abs(sum - 100) > 0.001 ? '' : ' hidden'}>The steps add up to ${sum}%, not 100%.</span>
              </div>`
            : ''
        }`
      )
    );
  }

  // Terms.
  {
    const rows = q.terms
      .map(
        (term, i) =>
          `<li class="term${term.on ? '' : ' item--off'}">
            <div class="term__head">${check(q, `terms.${i}.on`)}${field(q, `terms.${i}.title`, { placeholder: 'Title' })}
              <span class="card__tools">${act('moveTerm', [i, -1], icon.up, 'Move up')}${act('moveTerm', [i, 1], icon.down, 'Move down')}${act('removeTerm', [i], icon.x, 'Remove')}</span>
            </div>
            ${field(q, `terms.${i}.body`, { rows: 2, placeholder: 'The term, in a sentence or two.' })}
          </li>`
      )
      .join('');
    const missing = TERM_PRESETS.filter((p) => !q.terms.some((t) => t.title === p.title));
    out.push(
      group(
        'terms',
        'Terms',
        `<p class="field__hint">Written for this client: untick, reword or add. <code>{client}</code> and <code>{validUntil}</code> are filled in on the PDF.</p>
        <ul class="terms">${rows}</ul>
        <div class="chips chips--wrap">
          <button type="button" class="chip chip--add" data-act="addTerm" data-args="">${icon.plus}New term</button>
          ${missing.map((p) => `<button type="button" class="chip chip--add" data-act="addTerm" data-args="${esc(p.title)}">${icon.plus}${esc(p.title)}</button>`).join('')}
        </div>`
      )
    );
  }

  out.push(
    group(
      'sign',
      'Sign-off',
      `${toggle(q, 'signature', 'Signature lines')}
      <div class="row row--2">
        ${field(q, 'from.name', { label: 'Your name' })}
        ${field(q, 'from.role', { label: 'Role' })}
      </div>
      <div class="row row--3">
        ${field(q, 'from.location', { label: 'Location' })}
        ${field(q, 'from.email', { label: 'Email', type: 'email' })}
        ${field(q, 'from.phone', { label: 'Phone', type: 'tel' })}
      </div>
      <button type="button" class="btn btn--small" data-act="resetFrom" data-args="">Use the site's details</button>`
    )
  );

  return out.join('');
}

/* ------------------------------------------------------------------ */
/* The app                                                             */
/* ------------------------------------------------------------------ */

export function startQuote(root: HTMLElement, defaults: Defaults): void {
  const formEl = root.querySelector<HTMLElement>('[data-form]')!;
  const frames = [...root.querySelectorAll<HTMLIFrameElement>('[data-pdf]')];
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const toastEl = root.querySelector<HTMLElement>('[data-toast]')!;
  const fileInput = root.querySelector<HTMLInputElement>('[data-file]')!;
  const newDialog = root.querySelector<HTMLDialogElement>('[data-new-dialog]')!;

  let q: Quote = (() => {
    try {
      const saved = store.get(DRAFT);
      if (saved) {
        const n = normalise(JSON.parse(saved), defaults);
        if (n) return n;
      }
    } catch {}
    return blankQuote(defaults, nextNumber());
  })();

  let toastTimer = 0;
  const toast = (msg: string, bad = false) => {
    toastEl.textContent = msg;
    toastEl.classList.toggle('toast--bad', bad);
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastEl.hidden = true), bad ? 6000 : 3200);
  };

  /* ---- the form ---- */

  const rebuild = () => {
    const active = document.activeElement as HTMLElement | null;
    const path = active?.dataset.path;
    const addItem = active?.dataset.addItem;
    const caret = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active.selectionStart : null;
    const scroll = formEl.scrollTop;
    formEl.innerHTML = form(q);
    formEl.scrollTop = scroll;
    const again = path
      ? formEl.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)
      : addItem != null
        ? formEl.querySelector<HTMLElement>(`[data-add-item="${CSS.escape(addItem)}"]`)
        : null;
    if (again) {
      again.focus({ preventScroll: true });
      if (caret != null && (again instanceof HTMLTextAreaElement || (again instanceof HTMLInputElement && again.type === 'text'))) {
        again.setSelectionRange(caret, caret);
      }
    }
  };

  /** The few numbers in the form that follow the quote without a rebuild. */
  const refreshOutputs = () => {
    const t = totals(q);
    const set = (key: string, text: string) => {
      const el = formEl.querySelector<HTMLElement>(`[data-out="${key}"]`);
      if (el) el.textContent = text;
    };
    set('subtotal', money(t.subtotal, q.currency));
    set('total', money(t.total, q.currency));
    const placed = placePhases(q);
    set('weeks', `${placed.weeks} weeks`);
    for (const p of q.timeline.phases) set(`phase-${p.id}`, placed.phases.find((x) => x.id === p.id)?.dates ?? '');
    const sum = q.payment.steps.reduce((x, s) => x + s.percent, 0);
    const warn = formEl.querySelector<HTMLElement>('[data-out="pay-warn"]');
    if (warn) {
      warn.hidden = Math.abs(sum - 100) <= 0.001;
      warn.textContent = `The steps add up to ${sum}%, not 100%.`;
    }
  };

  const changed = (structural = false) => {
    if (structural) rebuild();
    else refreshOutputs();
    store.set(DRAFT, JSON.stringify(q));
    schedule();
  };

  /* ---- the preview ---- */

  let timer = 0;
  let running = false;
  let again = false;
  let shown = 0;
  let url = '';

  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(draw, 350);
  };

  /**
   * Draws the PDF into whichever frame is hidden, and swaps when it has
   * loaded, so the preview never blanks between two versions. One draw at a
   * time: a change during a draw asks for one more when it finishes.
   */
  async function draw() {
    if (running) {
      again = true;
      return;
    }
    running = true;
    status.textContent = 'Updating…';
    try {
      const pdf = await build();
      const next = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }));
      const back = frames[1 - shown];
      const front = frames[shown];
      await new Promise<void>((resolve) => {
        const done = () => {
          back.removeEventListener('load', done);
          resolve();
        };
        back.addEventListener('load', done);
        back.src = `${next}#toolbar=0&navpanes=0&view=FitH`;
        setTimeout(done, 2500);
      });
      back.hidden = false;
      front.hidden = true;
      shown = 1 - shown;
      if (url) URL.revokeObjectURL(url);
      url = next;
      status.textContent = 'Up to date';
    } catch (error) {
      console.error(error);
      status.textContent = 'Could not draw the PDF';
    } finally {
      running = false;
      if (again) {
        again = false;
        draw();
      }
    }
  }

  const build = async () => renderQuote(q, await loadAssets(defaults), defaults.site);

  /* ---- actions ---- */

  const move = <T>(list: T[], i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  };

  const actions: Record<string, (args: string[]) => void> = {
    validity: ([n]) => (q.validUntil = addDays(q.issued, Number(n))),
    currency: ([c]) => (q.currency = c === 'EUR' ? 'EUR' : 'USD'),
    addSection: ([title]) => q.sections.push(sectionFromPreset(title)),
    removeSection: ([i]) => q.sections.splice(Number(i), 1),
    moveSection: ([i, by]) => move(q.sections, Number(i), Number(by)),
    removeItem: ([i, j]) => q.sections[Number(i)].items.splice(Number(j), 1),
    discountKind: ([k]) => (q.discount.kind = k === 'amount' ? 'amount' : 'percent'),
    addPhase: () => q.timeline.phases.push({ id: uid(), name: '', weeks: 1, on: true }),
    removePhase: ([i]) => q.timeline.phases.splice(Number(i), 1),
    paymentPreset: ([name]) => (q.payment.steps = paymentFromPreset(name)),
    addStep: () => q.payment.steps.push({ id: uid(), label: '', percent: 0, note: '' }),
    removeStep: ([i]) => q.payment.steps.splice(Number(i), 1),
    addTerm: ([title]) => {
      const preset = TERM_PRESETS.find((p) => p.title === title);
      q.terms.push(preset ? { ...preset, on: true, id: uid() } : { id: uid(), title: '', body: '', on: true });
    },
    removeTerm: ([i]) => q.terms.splice(Number(i), 1),
    moveTerm: ([i, by]) => move(q.terms, Number(i), Number(by)),
    resetFrom: () => (q.from = { ...defaults.from }),
  };

  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('[data-act]');
    if (!btn || !root.contains(btn)) return;
    const fn = actions[btn.dataset.act!];
    if (!fn) return;
    fn((btn.dataset.args ?? '').split(','));
    changed(true);
  });

  document.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (!formEl.contains(el) || !el.dataset.path) return;
    const type = el.dataset.type;
    const value = type === 'bool' ? el.checked : type === 'number' ? (el.value === '' ? 0 : Number(el.value)) : el.value;
    if (type === 'number' && !Number.isFinite(value as number)) return;
    setPath(q, el.dataset.path, value);
    if (type === 'bool') el.closest('.item, .phase, .term')?.classList.toggle('item--off', !el.checked);
    changed(el.hasAttribute('data-rebuild'));
  });

  document.addEventListener('keydown', (e) => {
    const el = e.target as HTMLInputElement;
    if (e.key !== 'Enter' || el.dataset?.addItem == null || !formEl.contains(el)) return;
    e.preventDefault();
    const text = el.value.trim();
    if (!text) return;
    q.sections[Number(el.dataset.addItem)].items.push({ id: uid(), text, on: true });
    el.value = '';
    changed(true);
  });

  /* ---- the bar ---- */

  const fileName = () => {
    const name = [`Quotation ${q.number}`, q.client.company || q.client.name].filter((x) => x.trim()).join(' - ');
    return `${name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Quotation'}.pdf`;
  };

  root.querySelector('[data-download]')!.addEventListener('click', async () => {
    try {
      const pdf = await build();
      const href = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }));
      const a = Object.assign(document.createElement('a'), { href, download: fileName() });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
      commitNumber(q.number);
      toast(`Downloaded ${fileName()}. Open it here again to edit it.`);
    } catch (error) {
      console.error(error);
      toast('Could not make the PDF. The console has the reason.', true);
    }
  });

  root.querySelector('[data-open]')!.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const raw = await readQuote(await file.arrayBuffer());
      const opened = raw ? normalise(raw, defaults) : null;
      if (!opened) {
        toast('That PDF was not made by this quote builder, so there is nothing in it to fill the form with.', true);
        return;
      }
      q = opened;
      changed(true);
      formEl.scrollTop = 0;
      toast(`Opened ${q.number || file.name}.`);
    } catch (error) {
      console.error(error);
      toast('That file could not be read as a PDF.', true);
    }
  });

  root.querySelector('[data-new]')!.addEventListener('click', () => newDialog.showModal());
  newDialog.addEventListener('close', () => {
    if (newDialog.returnValue !== 'confirm') return;
    q = blankQuote(defaults, nextNumber());
    changed(true);
    formEl.scrollTop = 0;
  });

  rebuild();
  draw();
}
