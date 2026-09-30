/**
 * The draft, read as the signed-in owner, in the release snapshot's shape.
 *
 * Shared by the draft endpoint (which hands it to the editor) and the
 * middleware (which renders pages from it), so what the editor holds and what
 * the canvas shows can never be two different readings of the database.
 */

import type { serverClient } from './supabase';

const TABLES = {
  pages: 'key',
  media: 'path',
  projects: 'sort_order',
  project_tags: 'sort_order',
  blocks: 'sort_order',
  lists: 'sort_order',
  styles: 'element_key',
} as const;

export async function loadDraft(client: ReturnType<typeof serverClient>) {
  const portfolio = client.schema('portfolio');
  const [settings, ...rest] = await Promise.all([
    portfolio.from('settings').select('fields, seo').maybeSingle(),
    ...Object.entries(TABLES).map(([t, order]) => portfolio.from(t).select('*').order(order)),
  ]);
  const failed = [settings, ...rest].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const draft: Record<string, unknown> = { version: 1, settings: settings.data ?? { fields: {}, seo: {} } };
  Object.keys(TABLES).forEach((name, i) => {
    draft[name === 'project_tags' ? 'tags' : name] = rest[i].data ?? [];
  });
  return draft;
}

/**
 * Where a media row is served from while it is only a draft.
 *
 * Images that came from Strapi are in the deployment's own /media, exactly
 * where the public site has them. An image uploaded in the Studio is not in
 * any build yet, so the canvas reads it straight from Storage until the next
 * publish copies it into /media.
 */
export const draftMediaUrl = (supabaseUrl: string) => (m: { path: string }) =>
  m.path.startsWith('legacy/')
    ? `/media/${m.path.slice('legacy/'.length)}`
    : `${supabaseUrl}/storage/v1/object/public/portfolio-media/${m.path.split('/').map(encodeURIComponent).join('/')}`;
