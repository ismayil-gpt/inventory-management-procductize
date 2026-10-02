import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signIn, label } from './support';

// §15 / §17: axe with zero violations also covers what only appears after a
// click — modals, drawers, confirmations — and the two-step sign-in step.
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violationsIn(page: Page, scope: string) {
  await page.waitForTimeout(500); // let the entry animation settle before measuring contrast
  const results = await new AxeBuilder({ page }).withTags(WCAG).include(scope).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length}] e.g. ${v.nodes[0]?.target.join(' ')}`);
}

const OVERLAYS: Array<{ name: string; screen: string; open: (page: Page, lang: 'en' | 'ar') => Promise<void> }> = [
  { name: 'new product form', screen: '/products', open: (p, l) => p.getByRole('button', { name: label(l, 'products.newProduct') }).click() },
  { name: 'product import', screen: '/products', open: (p, l) => p.getByRole('button', { name: label(l, 'products.importBtn'), exact: true }).click() },
  { name: 'new store room', screen: '/locations', open: (p, l) => p.getByRole('button', { name: label(l, 'locations.newRoot') }).click() },
  { name: 'bulk create', screen: '/locations', open: async (p, l) => { await p.locator('main button[aria-expanded]').filter({ hasText: 'SR1' }).first().click(); await p.getByRole('button', { name: new RegExp(label(l, 'locations.bulkCreate')) }).click(); } },
  { name: 'add supplier', screen: '/suppliers', open: (p, l) => p.getByRole('button', { name: label(l, 'suppliers.add') }).click() },
  { name: 'add user', screen: '/users', open: (p, l) => p.getByRole('button', { name: label(l, 'users.add') }).click() },
  { name: 'end sessions confirmation', screen: '/users', open: (p, l) => p.getByRole('button', { name: label(l, 'users.endSessions') }).first().click() },
  { name: 'assistant panel', screen: '/briefing', open: (p, l) => p.locator('nav').getByRole('button', { name: label(l, 'navigation.assistant') }).click() },
];

for (const mode of [{ language: 'en', theme: 'light' }, { language: 'ar', theme: 'dark' }] as const) {
  test(`every overlay passes axe in ${mode.language}/${mode.theme}`, async ({ page, browser }) => {
    test.setTimeout(180_000);
    // A second signed-in session so "End sessions" has someone to end, without ending ours.
    const other = await browser.newPage();
    await signIn(other, { email: 'storekeeper@example.com', password: 'Store@Mizan2026' });
    await other.close();

    await signIn(page, undefined, mode);
    const failures: string[] = [];
    for (const overlay of OVERLAYS) {
      await page.goto(overlay.screen);
      await page.waitForLoadState('networkidle');
      await overlay.open(page, mode.language);
      await expect(page.getByRole('dialog').or(page.getByRole('alertdialog')).first()).toBeVisible();
      failures.push(...(await violationsIn(page, '[role="dialog"], [role="alertdialog"]')).map((f) => `${overlay.name} — ${f}`));
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
}

// The two-step screens appear only when the server has MFA switched on, so
// the sign-in responses are stubbed here; the screen itself is the real one.
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==';
for (const mode of [{ language: 'en', theme: 'light' }, { language: 'ar', theme: 'dark' }] as const) {
  for (const step of ['verify', 'enroll'] as const) {
    test(`two-step sign-in (${step}) passes axe in ${mode.language}/${mode.theme}`, async ({ page }) => {
      await page.route('**/api/v1/auth/login', (route) =>
        route.fulfill({ json: step === 'verify' ? { mfaRequired: true, mfaToken: 'x'.repeat(40) } : { mfaEnrollmentRequired: true, mfaToken: 'x'.repeat(40) } }));
      await page.route('**/api/v1/auth/mfa/enroll/start', (route) =>
        route.fulfill({ json: { otpauthUrl: 'otpauth://totp/Mizan:test', qrDataUrl: TINY_PNG, manualKey: 'ABCD EFGH IJKL MNOP' } }));
      await page.goto('/login');
      await page.evaluate(({ language, theme }) => { localStorage.setItem('mizan.language', language); localStorage.setItem('mizan.theme', theme); }, mode);
      await page.reload();
      await page.fill('#email', 'someone@example.com');
      await page.fill('#password', 'any-password-1');
      await page.click('button[type=submit]');
      await expect(page.locator('#mfa-code')).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help} e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    });
  }
}
