// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Only used for canonical URLs and sitemap.xml. Content and media come from the
// snapshot in src/data/content.json and public/media, so the build needs no
// network access and no database.
const site = process.env.SITE_URL || 'https://mohamadhawa.com';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
