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
});
