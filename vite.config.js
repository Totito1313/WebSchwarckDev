import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderChangelog } from './src/changelog-render.js';

const page = (p) => resolve(import.meta.dirname, p);

// Las novedades de CeroFiao salen de data/changelog.json: aquí se pintan en el
// HTML (así se leen sin JS) y el Worker sirve ese mismo archivo hasta que el
// panel guarde una versión propia.
const changelog = () => ({
  name: 'changelog',
  transformIndexHtml(html) {
    if (!html.includes('<!--changelog-->')) return html;
    const entries = JSON.parse(readFileSync(page('data/changelog.json'), 'utf8'));
    return html.replace('<!--changelog-->', renderChangelog(entries));
  },
});

export default defineConfig({
  plugins: [changelog()],
  server: {
    // `npx wrangler dev` sirve la API en 8787; con esto `npm run dev` también la ve.
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        home: page('index.html'),
        cerofiao: page('cerofiao/index.html'),
        privacidad: page('cerofiao/privacidad/index.html'),
        lionfitness: page('lionfitness/index.html'),
        admin: page('admin/index.html'),
        notFound: page('404.html'),
      },
    },
  },
});
