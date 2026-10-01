import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn } from './support';

// §15: axe-core with zero violations, WCAG 2.1 A and AA, on every screen in
// English/light and Arabic/dark (§17: both languages and both themes).
const SCREENS = ['/briefing', '/dashboard', '/stock', '/stock?view=history', '/cycle-counting', '/products', '/locations', '/replenishment', '/purchase-orders', '/suppliers', '/insights', '/reports', '/audit-log', '/users', '/compliance', '/settings'];
const MODES = [
  { language: 'en', theme: 'light' },
  { language: 'ar', theme: 'dark' },
] as const;

for (const mode of MODES) {
  test(`every screen passes axe in ${mode.language}/${mode.theme}`, async ({ page }) => {
    test.setTimeout(240_000);
    await signIn(page, undefined, mode);
    const failures: string[] = [];
    for (const screen of SCREENS) {
      await page.goto(screen);
      await page.waitForLoadState('networkidle');
      // Let entry animations finish so contrast is measured on the settled page.
      await page.waitForTimeout(700);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of results.violations) {
        failures.push(`${screen} — ${v.id} (${v.impact}): ${v.help} [${v.nodes.length}] e.g. ${v.nodes[0]?.target.join(' ')}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
}

test('the sign-in screen passes axe', async ({ page }) => {
  await page.goto('/login');
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
