import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'web',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'web/index.html'),
        privacy: path.resolve(__dirname, 'web/privacy.html'),
        terms: path.resolve(__dirname, 'web/terms.html'),
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
