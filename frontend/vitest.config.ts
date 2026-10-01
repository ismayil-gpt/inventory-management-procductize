import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Unit tests for hooks and logic (§15: Vitest + Testing Library). End-to-end
// paths live in e2e/ and run under Playwright.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      // Unmount rendered hooks/components between tests (Testing Library auto-cleanup).
      globals: true,
    },
  }),
);
