/**
 * Portfolio Studio, as an Astro integration that only exists in one build.
 *
 * The public site and the Studio are the same code built twice:
 *
 *   npm run build          mohamadhawa.com        static, no adapter, no Studio
 *   npm run build:studio   admin.mohamadhawa.com  the same pages, plus these
 *                                                 routes on the Vercel adapter
 *
 * Nothing in this directory is imported by a public page, and the routes are
 * *injected* rather than living in `src/pages/`, so the public build does not
 * contain them at all — not hidden, not guarded, absent. That is the only way
 * "the public site is locked" survives the Studio growing: the public output
 * cannot change because of code it never sees. verify-build.js asserts it.
 *
 * The public pages are still in the Studio build, prerendered exactly as on
 * the live site, because the Studio's canvas is those pages in a same-origin
 * frame. They are public anyway; what the auth boundary protects is every
 * route under /studio, which is rendered on demand and checked on every
 * request by the middleware.
 */

import type { AstroIntegration } from 'astro';

export function studio(): AstroIntegration {
  return {
    name: 'portfolio-studio',
    hooks: {
      'astro:config:setup': ({ injectRoute, addMiddleware }) => {
        addMiddleware({ entrypoint: new URL('./middleware.ts', import.meta.url), order: 'pre' });

        injectRoute({ pattern: '/studio', entrypoint: new URL('./pages/index.astro', import.meta.url) });
        injectRoute({ pattern: '/studio/login', entrypoint: new URL('./pages/login.astro', import.meta.url) });
        injectRoute({ pattern: '/studio/api/login', entrypoint: new URL('./api/login.ts', import.meta.url) });
        injectRoute({ pattern: '/studio/api/logout', entrypoint: new URL('./api/logout.ts', import.meta.url) });
        injectRoute({ pattern: '/studio/api/draft', entrypoint: new URL('./api/draft.ts', import.meta.url) });
        injectRoute({ pattern: '/studio/api/save', entrypoint: new URL('./api/save.ts', import.meta.url) });
        injectRoute({ pattern: '/studio/api/publish', entrypoint: new URL('./api/publish.ts', import.meta.url) });
        injectRoute({ pattern: '/studio/api/releases', entrypoint: new URL('./api/releases.ts', import.meta.url) });
        injectRoute({ pattern: '/studio/api/upload', entrypoint: new URL('./api/upload.ts', import.meta.url) });
      },
    },
  };
}
