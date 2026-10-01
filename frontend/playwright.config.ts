import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// End-to-end critical paths (§15) and the accessibility pass (axe), run against
// a running Mizan (frontend + backend). Defaults suit the development board;
// override E2E_BASE_URL for another environment. Uses the system Chromium when
// present, so nothing is downloaded at test time.
const systemChromium = ['/usr/bin/chromium-browser', '/usr/bin/chromium'].find((p) => existsSync(p));

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    launchOptions: systemChromium ? { executablePath: systemChromium } : {},
    trace: 'retain-on-failure',
  },
});
