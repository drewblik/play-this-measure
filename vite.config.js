import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// Static PWA. Two entry pages: the app shell (index.html) and the M0 engine
// fixtures page (fixtures.html). Everything in public/ (manifest, icons, sw.js)
// is copied verbatim to the dist root; /api/* is left for Vercel functions.
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: r('./index.html'),
        fixtures: r('./fixtures.html'),
      },
    },
  },
});
