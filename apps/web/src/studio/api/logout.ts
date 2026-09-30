import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  await context.locals.studio.client?.auth.signOut();
  return context.redirect('/studio/login?e=bye', 303);
};
