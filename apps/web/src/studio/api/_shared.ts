/**
 * What every Studio endpoint needs, once.
 *
 * The middleware has already refused anyone who is not staff before any of
 * these run, so what is left here is the request itself: that it came from the
 * Studio's own page (an Origin check, on top of SameSite=Lax cookies and the
 * JSON content type, which a cross-site form cannot send), and that its body
 * is a reasonable size. Every query then runs as the signed-in owner, under
 * RLS — the endpoints hold no privilege the browser does not already have.
 *
 * They exist at all only because the session cookie is httpOnly, so the page's
 * script cannot talk to Supabase itself. That is the right trade: a stolen XSS
 * foothold in the Studio cannot read the session token.
 */

import type { APIContext } from 'astro';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export const fail = (status: number, error: string) => json({ error }, status);

/** Same-origin writes only. */
export function sameOrigin(context: APIContext): boolean {
  const origin = context.request.headers.get('origin');
  return origin !== null && origin === context.url.origin;
}

const MAX_JSON = 512 * 1024;

export async function readJson<T>(context: APIContext): Promise<T | null> {
  if (!(context.request.headers.get('content-type') ?? '').includes('application/json')) return null;
  const text = await context.request.text();
  if (text.length > MAX_JSON) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** The signed-in client, typed as present: the middleware guarantees it here. */
export function db(context: APIContext) {
  const client = context.locals.studio.client;
  if (!client) throw new Error('Studio endpoint reached without a session');
  return client.schema('portfolio');
}

/** The draft tables the Studio may write, and the columns of each it may touch. */
export const WRITABLE: Record<string, { key: string; columns: string[] }> = {
  settings: { key: 'id', columns: ['fields', 'seo'] },
  pages: { key: 'key', columns: ['fields', 'seo'] },
  projects: {
    key: 'id',
    columns: ['title', 'summary', 'discipline', 'role', 'slug', 'sort_order', 'selected_order', 'featured', 'visible', 'cover_media_id', 'chip', 'fields', 'seo', 'template'],
  },
  project_tags: { key: 'id', columns: ['label', 'sort_order'] },
  blocks: { key: 'id', columns: ['content', 'settings', 'sort_order', 'visible'] },
  lists: { key: 'id', columns: ['content', 'sort_order', 'visible'] },
  media: { key: 'id', columns: ['alt', 'focus'] },
};
