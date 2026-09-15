import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Ref: CLAUDE.md §3.1, §4. The dev server proxies /api to the NestJS backend so
// the frontend and backend look like one origin during development.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Single source of truth for tokens + translations lives in /shared.
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    host: true,
    // Allow importing files from the repo root (../shared).
    fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
