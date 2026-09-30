/**
 * Publish: freeze the draft as a release, then rebuild the public site.
 *
 * The release is the part that matters and it is atomic — portfolio.publish()
 * is one transaction that checks is_admin() itself. The rebuild is a Vercel
 * deploy hook, kept in STUDIO_DEPLOY_HOOK on the admin project only (its URL
 * is the secret, so it never reaches the browser). If the hook is missing or
 * fails, the release still stands and the next deploy of the public site —
 * any push — picks it up; the response says which happened.
 */

import type { APIRoute } from 'astro';
import { db, fail, json, readJson, sameOrigin } from './_shared';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!sameOrigin(context)) return fail(403, 'cross-origin');
  const body = await readJson<{ summary?: unknown }>(context);
  const summary = Array.isArray(body?.summary)
    ? body!.summary.filter((s): s is string => typeof s === 'string').slice(0, 50).map((s) => s.slice(0, 200))
    : [];

  const { data: releaseId, error } = await db(context).rpc('publish', { summary });
  if (error) return fail(409, error.message);

  const hook = import.meta.env.STUDIO_DEPLOY_HOOK ?? process.env.STUDIO_DEPLOY_HOOK;
  let deploy: 'triggered' | 'no-hook' | 'failed' = 'no-hook';
  if (hook) {
    try {
      const res = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10000) });
      deploy = res.ok ? 'triggered' : 'failed';
    } catch {
      deploy = 'failed';
    }
  }

  return json({ releaseId, deploy });
};
