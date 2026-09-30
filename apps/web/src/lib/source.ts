/**
 * The site's content source.
 *
 * Content is read from `src/data/content.json`, a snapshot exported from the
 * Strapi SQLite database that lives in this repo (`apps/cms/data/portfolio.db`).
 * Regenerate it with `npm run export` after editing in the local admin.
 *
 * Nothing here talks to a server. That is the point: the deployed site is fully
 * static and has no CMS to reach, so a build on Vercel needs no database, no
 * environment variables and no network.
 */

import snapshot from '../data/content.json';

export interface Snapshot {
  generatedAt?: string;
  siteSetting?: unknown;
  homePage?: unknown;
  workPage?: unknown;
  aboutPage?: unknown;
  contactPage?: unknown;
  services?: unknown;
  processSteps?: unknown;
  projects?: unknown;
}

const content = snapshot as Snapshot;

/*
 * The Studio's draft, for the one request that is rendering it.
 *
 * The admin deployment renders pages on demand, and a staff request with
 * `?draft=1` is rendered from the draft instead of this snapshot — so a new
 * project or a deleted one shows on the canvas as the real page, not as a
 * patch over the old one. The Studio middleware installs an AsyncLocalStorage
 * on globalThis and runs the render inside it; nothing is imported from here,
 * so the public build has no reference to it and never sees a draft. Outside
 * such a request `getStore()` is undefined and this file behaves exactly as
 * it always has.
 */
export function draftOverride(): Snapshot | undefined {
  return (globalThis as { __mhDraft?: { getStore(): Snapshot | undefined } }).__mhDraft?.getStore();
}

export const generatedAt = content.generatedAt ?? null;

/**
 * One slice of the snapshot, or null when it is missing or empty — in which
 * case the caller falls back to `fallback.ts` so the site still builds.
 */
export function read<T>(key: keyof Snapshot): T | null {
  const value = (draftOverride() ?? content)[key];
  if (value == null) return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return value as T;
}

interface RawMedia {
  url?: string;
  alternativeText?: string | null;
  width?: number;
  height?: number;
}

export interface ResolvedMedia {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

/**
 * Media paths are rewritten to `/media/...` by the export script and the files
 * are copied into `public/`, so they are already site-relative and need no host
 * prepended. Fallback content points at `/assets/...`, which is equally
 * site-relative.
 */
export function toMedia(
  raw: RawMedia | null | undefined,
  fallbackAlt = ''
): ResolvedMedia | null {
  const url = raw?.url;
  if (!url) return null;
  return {
    url,
    alt: raw?.alternativeText ?? fallbackAlt,
    width: raw?.width,
    height: raw?.height,
  };
}

export function toMediaList(
  raw: RawMedia[] | null | undefined,
  fallbackAlt = ''
): ResolvedMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => toMedia(item, fallbackAlt))
    .filter((item): item is ResolvedMedia => Boolean(item));
}
