import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
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
