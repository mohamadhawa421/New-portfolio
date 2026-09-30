/**
 * The door.
 *
 * Every request under /studio is checked here, on the server, before the
 * route runs. The login page and its endpoint are the only ways through
 * without a staff session; everything else redirects to the login page, or
 * answers 401 if it is an API call, so a script does not receive a page of
 * HTML it did not ask for.
 *
 * The public pages are prerendered and never reach this — Vercel serves them
 * as files — which is correct: they are the live site, and the check exists
 * for editing, not for looking.
 */

import { defineMiddleware } from 'astro:middleware';
import { safeNext, serverClient, staffUser, studioEnv } from './supabase';

const OPEN = new Set(['/studio/login', '/studio/api/login']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  if (!pathname.startsWith('/studio') || context.isPrerendered) return next();

  const env = studioEnv();
  let staff = null;
  if (env) {
    const client = serverClient(env, context.request, context.cookies);
    staff = await staffUser(client);
    context.locals.studio = { env, client, staff };
  } else {
    context.locals.studio = { env: null, client: null, staff: null };
  }

  const path = pathname.replace(/\/$/, '') || '/';

  // Already in, and asked for the door: go straight through it.
  if (path === '/studio/login' && staff) {
    return context.redirect(safeNext(context.url.searchParams.get('next')), 303);
  }

  if (!OPEN.has(path) && !staff) {
    if (path.startsWith('/studio/api/')) {
      return new Response(JSON.stringify({ error: 'unauthorised' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    const target = new URL('/studio/login', context.url);
    if (path !== '/studio') target.searchParams.set('next', path + search);
    return context.redirect(target.pathname + target.search, 303);
  }

  const response = await next();

  // Nothing in the Studio is cached, indexed or framed by another site.
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  response.headers.set('x-frame-options', 'SAMEORIGIN');
  response.headers.set('referrer-policy', 'same-origin');
  return response;
});
