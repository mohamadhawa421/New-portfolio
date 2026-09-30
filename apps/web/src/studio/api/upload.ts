/**
 * An image into the portfolio bucket, and its row in portfolio.media.
 *
 * The Studio converts to WebP in the browser before sending (see
 * client/media.ts), so what arrives is already the file the site will serve;
 * the build makes the 420/840/1200 variants from it.
 *
 * Checked here rather than trusted from the browser:
 *   - type: raster images only. SVG is refused from the Studio even though the
 *     bucket accepts it (the logos are SVG) — an SVG from a browser upload is
 *     the one case where its contents are not already known to be safe.
 *   - size: 15 MB, the bucket's own limit, checked before reading the body.
 *   - name: reduced to [a-z0-9-], prefixed with random hex so two files called
 *     "cover.webp" never collide under /media.
 *   - dimensions: integers in a sane range; they only size the <img>.
 */

import type { APIRoute } from 'astro';
import { db, fail, json, sameOrigin } from './_shared';

export const prerender = false;

const TYPES: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/avif': 'avif',
  'image/gif': 'gif',
};
const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = 'portfolio-media';

const slugify = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image';

const dim = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 20000 ? n : null;
};

export const POST: APIRoute = async (context) => {
  if (!sameOrigin(context)) return fail(403, 'cross-origin');
  const length = Number(context.request.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES + 64 * 1024) return fail(413, 'image is larger than 15 MB');

  const form = await context.request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail(400, 'expected a file');
  const ext = TYPES[file.type];
  if (!ext) return fail(415, `not an image the site can serve: ${file.type || 'unknown'}`);
  if (file.size > MAX_BYTES) return fail(413, 'image is larger than 15 MB');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const portfolio = db(context);

  // The same file uploaded again is the same media row, not a second copy.
  const { data: existing } = await portfolio.from('media').select('*').eq('sha256', sha256).maybeSingle();
  if (existing) return json({ media: existing, reused: true });

  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const path = `u/${rand}-${slugify(file.name)}.${ext}`;

  const storage = context.locals.studio.client!.storage.from(BUCKET);
  const { error: upError } = await storage.upload(path, bytes, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (upError) return fail(502, upError.message);

  const alt = String(form?.get('alt') ?? '').slice(0, 300);
  const { data: media, error } = await portfolio
    .from('media')
    .insert({ path, mime: file.type, bytes: file.size, width: dim(form!.get('width')), height: dim(form!.get('height')), alt, sha256 })
    .select('*')
    .single();
  if (error) {
    await storage.remove([path]);
    return fail(409, error.message);
  }

  return json({ media, reused: false });
};
