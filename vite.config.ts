import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// Future TypeScript + Vue 3 frontend lives in src/
// Current vanilla JS frontend stays in public/ (served by Express directly)
// This config is for the incremental migration: new Vue components → src/
// then bundled to public/dist/ and loaded from index.html

export default defineConfig({
  plugins: [vue()],
  root: 'src',
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main.ts'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/wms': 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
