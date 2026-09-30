/**
 * Autosave: a batch of row patches against the draft.
 *
 *   { changes: [{ table: 'pages', key: 'home', patch: { fields: {...} } }, ...] }
 *
 * Whole column values, not deep paths — the Studio holds the full row and
 * sends the new value of each column it changed, which keeps this endpoint
 * dumb and the result unambiguous. Only the tables and columns in WRITABLE are
 * accepted; RLS then decides whether the caller may write at all.
 *
 * Applied in order and reported per change, so a failure part-way says exactly
 * which edits reached the database and which are still only in the browser.
 */

import type { APIRoute } from 'astro';
import { WRITABLE, db, fail, json, readJson, sameOrigin } from './_shared';

export const prerender = false;

interface Change {
  table: string;
  key: string | boolean;
  patch: Record<string, unknown>;
}

const MAX_CHANGES = 200;

export const POST: APIRoute = async (context) => {
  if (!sameOrigin(context)) return fail(403, 'cross-origin');
  const body = await readJson<{ changes?: Change[] }>(context);
  const changes = body?.changes;
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > MAX_CHANGES) {
    return fail(400, 'expected { changes: [...] }');
  }

  for (const c of changes) {
    const rule = WRITABLE[c?.table];
    if (!rule) return fail(400, `table not writable: ${c?.table}`);
    const cols = Object.keys(c.patch ?? {});
    if (!cols.length || cols.some((col) => !rule.columns.includes(col))) {
      return fail(400, `column not writable on ${c.table}: ${cols.join(', ')}`);
    }
  }

  const portfolio = db(context);
  const saved: number[] = [];
  for (const [i, c] of changes.entries()) {
    const rule = WRITABLE[c.table];
    const { data, error } = await portfolio
      .from(c.table)
      .update(c.patch)
      .eq(rule.key, c.key)
      .select(rule.key);
    if (error) return json({ saved, failedAt: i, error: error.message }, 409);
    if (!data?.length) return json({ saved, failedAt: i, error: `no ${c.table} row ${String(c.key)}` }, 404);
    saved.push(i);
  }

  return json({ saved });
};
