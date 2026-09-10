// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Only used for canonical URLs and sitemap.xml. Content and media come from the
// snapshot in src/data/content.json and public/media, so the build needs no
// network access and no database.
//
// Defaults to the live Vercel domain, so nothing has to be configured in the
// dashboard. If a custom domain is added later, either change this line or set
// SITE_URL in Vercel's environment variables — the variable wins.
const site = process.env.SITE_URL || 'https://mohamadhawa.vercel.app';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
  build: {
    /*
     * 'auto' leaves larger stylesheets as separate <link> requests. Those are
     * render-blocking, and on a cold connection the gap between the HTML
     * arriving and the CSS arriving is a frame of unstyled markup piled in the
     * top-left corner.
     *
     * The whole site's CSS is ~27KB raw and ~6KB over the wire, which is small
     * enough to ship inside the document. Inlining removes three round-trips
     * from the critical path and makes that unstyled frame structurally
     * impossible, because the styles cannot arrive after the markup.
     */
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      /*
       * Old enough that the vendor prefixes survive minification.
       *
       * The CSS minifier removes whichever of two declarations for the same
       * thing it decides is redundant, and what it decides depends on the
       * browsers it is told to support. With the default target it treated
       * `-webkit-backdrop-filter` and `backdrop-filter` as interchangeable and
       * kept exactly one — so the production build shipped the nav with a tint
       * and no blur behind it, while the dev server, which does not minify,
       * looked correct. Measured on the built output: `backdrop-filter: none`
       * on the deployed menu against a full filter on localhost.
       *
       * Naming a Safari old enough that the prefix is necessary rather than
       * redundant is what keeps both. Unprefixed `backdrop-filter` only
       * arrived in Safari 18, so anything below that does the job.
       *
       * 16.4 rather than 15, because 15 was not the truth. The stylesheets
       * use `color-mix()` in 139 places — it is how every translucent ink,
       * border and wash in the site is written — and `color-mix()` is
       * Baseline May 2023, which is Safari 16.2. Declaring 15 did not make it
       * work there; it only meant the declared floor and the real one
       * disagreed, and a floor nobody can meet is not a floor. 16.4 is the
       * first Safari that supports everything actually used here.
       *
       * The other targets are named so the floor is a decision rather than
       * whatever esbuild happens to default to.
       */
      cssTarget: ['safari16.4', 'chrome111', 'firefox113', 'edge111'],
    },
  },
});
