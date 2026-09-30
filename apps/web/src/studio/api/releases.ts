/**
 * Revisions: the list, and putting an old one back.
 *
 *   GET                      the kept releases, newest first (no snapshots)
 *   POST { id }              portfolio.rollback(id) — makes that snapshot the
 *                            current release *and* the draft, then rebuilds
 */

import type { APIRoute } from 'astro';
import { db, fail, json, readJson, sameOrigin } from './_shared';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { data, error } = await db(context)
    .from('releases')
    .select('id, created_at, summary, is_current, restored_from')
    .order('id', { ascending: false });
  if (error) return fail(502, error.message);
  return json({ releases: data });
};

export const POST: APIRoute = async (context) => {
  if (!sameOrigin(context)) return fail(403, 'cross-origin');
  const body = await readJson<{ id?: unknown }>(context);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, 'expected { id }');

  const { data: releaseId, error } = await db(context).rpc('rollback', { release_id: id });
  if (error) return fail(409, error.message);

  const hook = import.meta.env.STUDIO_DEPLOY_HOOK ?? process.env.STUDIO_DEPLOY_HOOK;
  let deploy: 'triggered' | 'no-hook' | 'failed' = 'no-hook';
  if (hook) {
    try {
      deploy = (await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10000) })).ok ? 'triggered' : 'failed';
    } catch {
      deploy = 'failed';
    }
  }
  return json({ releaseId, deploy });
};
