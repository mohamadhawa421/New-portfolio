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

export const generatedAt = content.generatedAt ?? null;

/**
 * One slice of the snapshot, or null when it is missing or empty — in which
 * case the caller falls back to `fallback.ts` so the site still builds.
 */
export function read<T>(key: keyof Snapshot): T | null {
  const value = content[key];
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
