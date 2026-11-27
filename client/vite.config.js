import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

// `vite preview` serves the production build with the same security headers Vercel sends,
// so CSP problems show up locally before deploy.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const productionHeaders = Object.fromEntries(
  vercel.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key, h.value])
);
const apiProxy = { '/api': 'http://localhost:5000' };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
    headers: productionHeaders,
  },
  optimizeDeps: {
    include: [
      '@excalidraw/excalidraw',
      'lodash.throttle',
      'lodash.debounce',
      'roughjs',
      'fuzzy',
    ],
  },
  build: {
    commonjsOptions: {
      include: [/lodash/, /roughjs/, /fuzzy/, /node_modules/],
    },
  },
});
