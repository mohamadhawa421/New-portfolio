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
    inlineStylesheets: 'auto',
  },
});
