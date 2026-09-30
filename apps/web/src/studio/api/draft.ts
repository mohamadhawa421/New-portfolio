/**
 * The whole draft, plus the current release to diff it against.
 *
 * Same shape as a release snapshot (see portfolio.draft_snapshot), so the
 * Studio can hold the draft and the published version side by side and say
 * exactly what publishing would change.
 */

import type { APIRoute } from 'astro';
import { db, fail, json } from './_shared';

export const prerender = false;

const TABLES = {
  pages: 'key',
  media: 'path',
  projects: 'sort_order',
  project_tags: 'sort_order',
  blocks: 'sort_order',
  lists: 'sort_order',
  styles: 'element_key',
} as const;

export const GET: APIRoute = async (context) => {
  const portfolio = db(context);

  const [settings, current, ...rest] = await Promise.all([
    portfolio.from('settings').select('fields, seo').maybeSingle(),
    portfolio.from('releases').select('id, created_at, snapshot').eq('is_current', true).maybeSingle(),
    ...Object.entries(TABLES).map(([t, order]) => portfolio.from(t).select('*').order(order)),
  ]);

  const failed = [settings, current, ...rest].find((r) => r.error);
  if (failed?.error) return fail(502, failed.error.message);

  const names = Object.keys(TABLES);
  const draft: Record<string, unknown> = { version: 1, settings: settings.data };
  rest.forEach((r, i) => {
    draft[names[i] === 'project_tags' ? 'tags' : names[i]] = r.data ?? [];
  });

  return json({
    draft,
    release: current.data ? { id: current.data.id, createdAt: current.data.created_at, snapshot: current.data.snapshot } : null,
  });
};
