/**
 * Autosave: the difference between what the server has and what the editor
 * holds, as three lists.
 *
 *   inserts  new rows (a project, a section, a list entry), parents first
 *   changes  column values of existing rows
 *   deletes  rows that are gone, children first
 *
 * Whole column values, never deep paths — the editor holds the full row and
 * sends each changed column's new value, which keeps this endpoint dumb and
 * the result unambiguous. Only the tables and columns listed here are
 * accepted; RLS then decides whether the caller may write at all.
 *
 * Applied in that order and reported per step, so a failure part-way says
 * exactly how far it got; the editor keeps everything that did not land and
 * retries it on the next save.
 */

import type { APIRoute } from 'astro';
import { WRITABLE, db, fail, json, readJson, sameOrigin } from './_shared';

export const prerender = false;

interface Change {
  table: string;
  key: string | boolean;
  patch: Record<string, unknown>;
}
interface Insert {
  table: string;
  row: Record<string, unknown>;
}
interface Delete {
  table: string;
  key: string;
}

const INSERTABLE: Record<string, string[]> = {
  projects: ['id', 'kind', 'slug', 'title', 'summary', 'discipline', 'role', 'template', 'sort_order', 'selected_order', 'featured', 'visible', 'cover_media_id', 'chip', 'fields', 'seo'],
  project_tags: ['id', 'project_id', 'label', 'sort_order'],
  blocks: ['id', 'project_id', 'type', 'sort_order', 'visible', 'content', 'settings'],
  lists: ['id', 'list_key', 'sort_order', 'visible', 'content'],
};
const INSERT_ORDER = ['projects', 'project_tags', 'blocks', 'lists'];
const DELETE_ORDER = ['blocks', 'project_tags', 'lists', 'projects'];
const MAX_OPS = 400;

export const POST: APIRoute = async (context) => {
  if (!sameOrigin(context)) return fail(403, 'cross-origin');
  const body = await readJson<{ changes?: Change[]; inserts?: Insert[]; deletes?: Delete[] }>(context);
  const changes = Array.isArray(body?.changes) ? body!.changes : [];
  const inserts = Array.isArray(body?.inserts) ? body!.inserts : [];
  const deletes = Array.isArray(body?.deletes) ? body!.deletes : [];
  const total = changes.length + inserts.length + deletes.length;
  if (!total || total > MAX_OPS) return fail(400, 'expected { changes, inserts, deletes }');

  for (const c of changes) {
    const rule = WRITABLE[c?.table];
    const cols = Object.keys(c?.patch ?? {});
    if (!rule || !cols.length || cols.some((col) => !rule.columns.includes(col))) {
      return fail(400, `not writable: ${c?.table} ${cols.join(', ')}`);
    }
  }
  for (const i of inserts) {
    const allowed = INSERTABLE[i?.table];
    const cols = Object.keys(i?.row ?? {});
    if (!allowed || !cols.length || cols.some((col) => !allowed.includes(col))) {
      return fail(400, `not insertable: ${i?.table} ${cols.filter((c) => !allowed?.includes(c)).join(', ')}`);
    }
  }
  for (const d of deletes) {
    if (!DELETE_ORDER.includes(d?.table) || typeof d?.key !== 'string') return fail(400, `not deletable: ${d?.table}`);
  }

  const portfolio = db(context);
  const done = { inserts: 0, changes: 0, deletes: 0 };

  for (const table of INSERT_ORDER) {
    const rows = inserts.filter((i) => i.table === table).map((i) => i.row);
    if (!rows.length) continue;
    const { error } = await portfolio.from(table).upsert(rows, { onConflict: 'id' });
    if (error) return json({ done, error: `${table}: ${error.message}` }, 409);
    done.inserts += rows.length;
  }

  for (const c of changes) {
    const rule = WRITABLE[c.table];
    const { data, error } = await portfolio.from(c.table).update(c.patch).eq(rule.key, c.key).select(rule.key);
    if (error) return json({ done, error: `${c.table}: ${error.message}` }, 409);
    if (!data?.length) return json({ done, error: `no ${c.table} row ${String(c.key)}` }, 404);
    done.changes += 1;
  }

  for (const table of DELETE_ORDER) {
    const keys = deletes.filter((d) => d.table === table).map((d) => d.key);
    if (!keys.length) continue;
    const { error } = await portfolio.from(table).delete().in('id', keys);
    if (error) return json({ done, error: `${table}: ${error.message}` }, 409);
    done.deletes += keys.length;
  }

  return json({ done });
};
