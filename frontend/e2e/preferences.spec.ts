import { test, expect } from '@playwright/test';
import { signIn } from './support';

// §15 critical paths: language switch persists; theme switch persists.
test('switching to Arabic persists across a reload and turns the page right-to-left', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Language' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('header h1')).toHaveText('الملخص الصباحي');
});

test('switching to dark persists across a reload', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
