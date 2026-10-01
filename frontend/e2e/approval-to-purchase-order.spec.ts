import { test, expect } from '@playwright/test';
import { signIn, apiAs } from './support';

// §15 critical path: recommendation → approve → purchase order. This changes
// data for good (a recommendation is ordered, a PO is created), so it runs only
// when E2E_ALLOW_PURCHASE_ORDERS=1 — e.g. on a scratch database before release.
test.skip(!process.env.E2E_ALLOW_PURCHASE_ORDERS, 'Set E2E_ALLOW_PURCHASE_ORDERS=1 to run (creates a purchase order).');

test('an administrator approves a recommendation and a purchase order is generated for its supplier', async ({ page, request }) => {
  const api = await apiAs(request);
  const ordersBefore = (await api.get('/purchase-orders')).length;

  await signIn(page);
  await page.goto('/replenishment');
  await page.getByRole('button', { name: 'Approve' }).first().click();
  await page.getByRole('button', { name: /Generate purchase orders/ }).click();

  await expect.poll(async () => (await api.get('/purchase-orders')).length).toBe(ordersBefore + 1);
  await page.goto('/purchase-orders');
  await expect(page.locator('tbody tr').first()).toBeVisible();
});
