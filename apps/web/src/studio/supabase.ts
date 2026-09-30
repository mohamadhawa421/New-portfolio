/**
 * The Studio's server-side Supabase client.
 *
 * Built per request from the request's cookies, so the session is the
 * visitor's and every query runs under *their* RLS — never the service role.
 * The service-role key does not appear anywhere in this app; the few things
 * that need it (making someone an admin) are done in the Supabase dashboard.
 *
 * Three server-only variables, set on the admin Vercel project only:
 *
 *   SUPABASE_URL           https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY      the publishable key — safe in a browser, and RLS
 *                          is what makes it safe, not its secrecy
 *   STUDIO_EMAIL           the owner's Auth email. The login page asks for a
 *                          password only; the address stays on the server, so
 *                          the page does not tell a stranger whose account to
 *                          guess at.
 */

import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

export interface StudioEnv {
  url: string;
  anonKey: string;
  email: string;
}

/** The configuration, or null when this deployment has not been connected yet. */
export function studioEnv(): StudioEnv | null {
  const url = import.meta.env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const email = import.meta.env.STUDIO_EMAIL ?? process.env.STUDIO_EMAIL;
  return url && anonKey && email ? { url, anonKey, email } : null;
}

export function serverClient(env: StudioEnv, request: Request, cookies: AstroCookies) {
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () =>
        parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({
          name,
          value: value ?? '',
        })),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookies.set(name, value, {
            ...options,
            // The session is for this origin's Studio and nothing else.
            path: '/',
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: 'lax',
          });
        }
      },
    },
  });
}

/**
 * Is the caller signed in *and* staff?
 *
 * Signed in is not enough: Auth is shared with app.mohamadhawa.com, which
 * will have public sign-up, so a valid session only proves someone has an
 * account somewhere. The admins table decides, and RLS on it lets a person
 * see only their own row — so this is one select that returns one row or none.
 */
export async function staffUser(client: ReturnType<typeof serverClient>) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const { data: row } = await client
    .from('admins')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle();

  return row ? { id: data.user.id, role: row.role as 'owner' | 'editor' } : null;
}

/** Only ever send someone back inside the Studio — never to another origin. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/studio') || value.startsWith('//') || value.includes('\\')) {
    return '/studio';
  }
  return value.startsWith('/studio/login') || value.startsWith('/studio/api') ? '/studio' : value;
}
