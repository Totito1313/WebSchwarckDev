import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const page = (p) => resolve(import.meta.dirname, p);

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        home: page('index.html'),
        cerofiao: page('cerofiao/index.html'),
        privacidad: page('cerofiao/privacidad/index.html'),
        lionfitness: page('lionfitness/index.html'),
        notFound: page('404.html'),
      },
    },
  },
});
