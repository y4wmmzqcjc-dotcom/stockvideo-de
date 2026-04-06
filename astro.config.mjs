import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://stockvideo.de',
  output: 'static',
  integrations: [
    sitemap({ filter: (page) => !page.includes('/admin') }),
  ],
  i18n: { defaultLocale: 'de', locales: ['de'] },
});
