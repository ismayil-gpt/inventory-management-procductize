import { test, expect } from '@playwright/test';
import { signIn, apiAs, productOnTestShelf, quantityOnTestShelf, enterBarcode, TEST_SHELF, KEEPER } from './support';

// §15 critical path: login → scan location → scan product → verify stock.
// The test puts back what it adds, so the demo data is unchanged afterwards.
test('a store keeper records goods in by scanning shelf and product, and stock goes up', async ({ page, request }) => {
  const api = await apiAs(request);
  const before = await productOnTestShelf(api);

  await signIn(page, KEEPER);
  await page.goto('/stock');
  await page.getByRole('button', { name: 'Goods In' }).click();
  await enterBarcode(page, 'To location', TEST_SHELF);
  await expect(page.getByText('Accepted').first()).toBeVisible();
  await enterBarcode(page, 'Scan or enter a product', before.barcode);
  await page.locator('input[type=number]').fill('2');
  await page.getByRole('button', { name: 'Record movement' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'recorded' })).toBeVisible();

  await expect.poll(() => quantityOnTestShelf(api, before.productId)).toBe(before.quantity + 2);

  // Put the stock back.
  const restore = await api.post('/stock-movements', { clientId: crypto.randomUUID(), type: 'GOODS_OUT', productId: before.productId, fromLocationNodeId: before.shelfId, quantity: 2 });
  expect(restore.ok()).toBeTruthy();
});
