/**
 * The whole draft, plus the current release to diff it against.
 *
 * Same shape as a release snapshot (see portfolio.draft_snapshot), so the
 * Studio can hold the draft and the published version side by side and say
 * exactly what publishing would change.
 */

import type { APIRoute } from 'astro';
import { loadDraft } from '../draft';
import { db, fail, json } from './_shared';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const [draft, current] = await Promise.all([
      loadDraft(context.locals.studio.client!),
      db(context).from('releases').select('id, created_at, snapshot').eq('is_current', true).maybeSingle(),
    ]);
    if (current.error) return fail(502, current.error.message);
    return json({
      draft,
      release: current.data ? { id: current.data.id, createdAt: current.data.created_at, snapshot: current.data.snapshot } : null,
    });
  } catch (e) {
    return fail(502, e instanceof Error ? e.message : String(e));
  }
};
