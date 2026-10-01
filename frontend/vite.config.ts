import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { readFileSync } from 'node:fs';

// DESC #13 — `vite preview` serves the built app with the same Content-Security-Policy
// nginx will send in production (infrastructure/nginx/security-headers.conf), so
// the policy is tested as it ships. The dev server is exempt: hot reload needs inline code.
const nginxSecurityHeaders = readFileSync(path.resolve(__dirname, '../infrastructure/nginx/security-headers.conf'), 'utf8');
const contentSecurityPolicy = /add_header Content-Security-Policy "([^"]+)"/.exec(nginxSecurityHeaders)?.[1] ?? '';

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
  build: {
    // Fonts always ship as files, never inlined as data: URLs, so the CSP's
    // font-src can stay 'self' (DESC #13).
    assetsInlineLimit: (filePath: string) => (/\.(woff2?|ttf|otf)$/.test(filePath) ? false : undefined),
  },
  preview: {
    headers: { 'Content-Security-Policy': contentSecurityPolicy },
  },
  server: {
    port: 5173,
    host: true,
    // Allow importing files from the repo root (../shared).
    fs: { allow: [path.resolve(__dirname, '..')] },
    proxy: {
      '/api': {
        // Overridable so a second backend (e.g. one with MFA_ENABLED=true) can be tried side by side.
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
