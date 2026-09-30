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

import { AsyncLocalStorage } from 'node:async_hooks';
import { defineMiddleware } from 'astro:middleware';
import { fromRows } from '../../scripts/content-map.js';
import { draftMediaUrl, loadDraft } from './draft';
import { safeNext, serverClient, staffUser, studioEnv } from './supabase';

/*
 * The store lib/source.ts reads a draft from (see draftOverride there). It
 * lives on globalThis so the site's own modules never import anything from
 * the Studio; in the public build nothing installs it and it is undefined.
 */
const draftStore = new AsyncLocalStorage<unknown>();
(globalThis as { __mhDraft?: AsyncLocalStorage<unknown> }).__mhDraft = draftStore;

/**
 * A page rendered from the draft: `?draft=1`, and only for staff. Anyone else
 * asking for it gets the published page, exactly as if the parameter were
 * not there — the draft is never shown to a visitor, whatever the URL says.
 */
async function renderDraft(context: Parameters<Parameters<typeof defineMiddleware>[0]>[0], next: () => Promise<Response>) {
  const env = studioEnv();
  if (!env) return next();
  const client = serverClient(env, context.request, context.cookies);
  const staff = await staffUser(client);
  if (!staff) return next();
  const draft = await loadDraft(client);
  const content = fromRows(draft, { draft: true, urlFor: draftMediaUrl(env.url) });
  const response = await draftStore.run(content, next);
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
}

const OPEN = new Set(['/studio/login', '/studio/api/login']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  if (!pathname.startsWith('/studio')) {
    return !context.isPrerendered && context.url.searchParams.get('draft') === '1' ? renderDraft(context, next) : next();
  }
  if (context.isPrerendered) return next();

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
