import { test, expect, type Page } from '@playwright/test';
import { signIn, label, ADMIN } from './support';

// What axe cannot judge: using Mizan with the keyboard alone (WCAG 2.1.1,
// 2.4.7 focus visible) and on a tablet (§9.7: 768–1024px, tap targets ≥ 44px).
const SCREENS = ['/briefing', '/dashboard', '/stock', '/stock?view=history', '/cycle-counting', '/products', '/locations', '/replenishment', '/purchase-orders', '/suppliers', '/insights', '/reports', '/audit-log', '/users', '/compliance', '/settings'];

/** Tab through the page; return a description of each focused element with no visible indicator. */
async function focusWithoutIndicator(page: Page, presses = 45): Promise<string[]> {
  const missing = new Set<string>();
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < presses; i += 1) {
    await page.keyboard.press('Tab');
    const problem = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      // Box shadows do not count: every clay surface carries one at rest, so only an outline proves focus.
      // A ring on the field's own wrapper (e.g. the top-bar search box) is equally visible.
      const wrapper = el.parentElement ? getComputedStyle(el.parentElement) : null;
      const wrapperRing = wrapper && wrapper.outlineStyle !== 'none' && parseFloat(wrapper.outlineWidth) > 0;
      if (outline || wrapperRing) return null;
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} "${name}"`;
    });
    if (problem) missing.add(problem);
  }
  return [...missing];
}

test('sign in, move around and open a dialog with the keyboard alone', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => { localStorage.setItem('mizan.language', 'en'); localStorage.setItem('mizan.theme', 'light'); });
  await page.reload();
  await page.locator('#email').focus();
  await page.keyboard.type(ADMIN.email);
  await page.keyboard.press('Tab');
  await page.keyboard.type(ADMIN.password);
  await page.keyboard.press('Enter');
  await page.waitForURL('**/briefing');

  // Reach "Storage locations" in the menu by Tab and open it with Enter.
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.getAttribute('href'))) === '/locations') break;
  }
  await page.keyboard.press('Enter');
  await page.waitForURL('**/locations');

  // Open a store room in the tree with the keyboard.
  const room = page.locator('main button[aria-expanded]').first();
  await room.focus();
  await page.keyboard.press('Enter');
  await expect(room).toHaveAttribute('aria-expanded', 'true');

  // Open a dialog, close it with Escape, and land back on the button that opened it.
  const opener = page.getByRole('button', { name: label('en', 'locations.newRoot') });
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[role="dialog"] :focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('every screen shows where keyboard focus is', async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page);
  const failures: string[] = [];
  for (const screen of SCREENS) {
    await page.goto(screen);
    await page.waitForLoadState('networkidle');
    failures.push(...(await focusWithoutIndicator(page)).map((f) => `${screen} — ${f}`));
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

for (const viewport of [{ width: 768, height: 1024, name: 'portrait tablet' }, { width: 1024, height: 768, name: 'landscape tablet' }]) {
  test(`${viewport.name} (${viewport.width}px): no sideways scrolling, rail collapsed, tap targets at least 44px`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await signIn(page);
    const failures: string[] = [];
    for (const screen of SCREENS) {
      await page.goto(screen);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      const report = await page.evaluate(() => {
        const issues: string[] = [];
        if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
        const rail = document.querySelector('nav[aria-label="Primary"]') as HTMLElement | null;
        if (rail && rail.getBoundingClientRect().width > 60) issues.push(`rail not collapsed (${Math.round(rail.getBoundingClientRect().width)}px)`);
        const small = new Set<string>();
        document.querySelectorAll<HTMLElement>('button, a[href], input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, summary').forEach((el) => {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return; // hidden
          if (el.closest('table') && el.tagName === 'A') return; // inline links in table text
          if (box.height < 43.5) small.add(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 24)}" ${Math.round(box.height)}px`);
        });
        if (small.size) issues.push(`tap targets under 44px: ${[...small].slice(0, 6).join('; ')}${small.size > 6 ? ` … (${small.size})` : ''}`);
        return issues;
      });
      failures.push(...report.map((r) => `${screen} — ${r}`));
      await page.screenshot({ path: `test-results/tablet-${viewport.width}${screen.replace(/[/?=]/g, '-')}.png` });
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
}
