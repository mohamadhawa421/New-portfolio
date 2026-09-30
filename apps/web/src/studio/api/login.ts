/**
 * Password in, session cookie out.
 *
 * Server-side on purpose: the Auth email lives in STUDIO_EMAIL and never
 * reaches the browser, and the session lands as an httpOnly cookie that page
 * script cannot read. Astro's origin check (on by default for on-demand
 * routes) refuses a cross-site POST, which is the CSRF protection for a form
 * that sets a session.
 *
 * Works with and without JavaScript. The page's script asks for JSON; a plain
 * form submit gets a redirect, and the message rides on the query string as a
 * code, never as text an attacker could choose.
 *
 * Guessing is rate-limited by Supabase Auth itself. Every attempt comes from
 * this server, so the limit is shared by everyone trying at once — which is
 * the right way round for a door with one key: a stranger hammering it slows
 * *everyone*, including themselves, to a few attempts a minute.
 */

import type { APIRoute } from 'astro';
import { safeNext, serverClient, staffUser } from '../supabase';

export const prerender = false;

type Outcome = 'wrong' | 'slow' | 'offline' | 'unset' | 'not-staff';

export const POST: APIRoute = async (context) => {
  const wantsJson = (context.request.headers.get('accept') ?? '').includes('application/json');
  const form = await context.request.formData().catch(() => null);
  const password = String(form?.get('password') ?? '');
  const next = safeNext(String(form?.get('next') ?? ''));

  const fail = (code: Outcome, status: number) =>
    wantsJson
      ? new Response(JSON.stringify({ error: code }), { status, headers: { 'content-type': 'application/json' } })
      : context.redirect(`/studio/login?e=${code}${next !== '/studio' ? `&next=${encodeURIComponent(next)}` : ''}`, 303);

  const { env } = context.locals.studio;
  if (!env) return fail('unset', 503);
  if (!password || password.length > 256) return fail('wrong', 401);

  const client = serverClient(env, context.request, context.cookies);
  const { error } = await client.auth.signInWithPassword({ email: env.email, password });

  if (error) {
    if (error.status === 429) return fail('slow', 429);
    if (!error.status || error.status >= 500) return fail('offline', 503);
    return fail('wrong', 401);
  }

  // The password was right, but that only proves the account exists. If the
  // account is not staff, it does not get to keep the session either.
  if (!(await staffUser(client))) {
    await client.auth.signOut();
    return fail('not-staff', 403);
  }

  return wantsJson
    ? new Response(JSON.stringify({ ok: true, next }), { headers: { 'content-type': 'application/json' } })
    : context.redirect(next, 303);
};
