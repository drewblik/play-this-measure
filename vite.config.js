import { defineConfig } from 'vite';

// Static PWA. index.html is the entry; everything in public/ (manifest, icons,
// sw.js) is copied verbatim to the dist root so it keeps a stable URL.
// /api/* is NOT touched by Vite — those are Vercel serverless functions.
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
