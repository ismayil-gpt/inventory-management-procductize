import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Ref: CLAUDE.md §3.1, §4. The dev server proxies /api to the NestJS backend so
// the frontend and backend look like one origin during development.
export default defineConfig({
  plugins: [
    react(),
    {
      // /shared sits outside the frontend root, so Vite does not watch it by
      // default: edits to tokens or translations were served stale until a
      // manual restart. Watching it lets those edits reload like any other file.
      name: 'watch-shared-folder',
      configureServer(server) {
        server.watcher.add(path.resolve(__dirname, '../shared'));
      },
    },
  ],
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
