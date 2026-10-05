import { test, expect } from '@playwright/test';
import { signIn, apiAs, productOnTestShelf, quantityOnTestShelf, enterBarcode, label, TEST_SHELF, KEEPER } from './support';

// §15 critical path: offline scan → reconnect → verify synchronisation (§6).
test('a movement recorded offline waits in the queue and syncs on reconnect', async ({ page, context, request }) => {
  const api = await apiAs(request);
  const before = await productOnTestShelf(api);

  await signIn(page, KEEPER);
  await page.goto('/stock');
  await page.getByRole('button', { name: 'Goods In' }).click();
  await enterBarcode(page, 'To location', TEST_SHELF);
  await enterBarcode(page, 'Scan or enter a product', before.barcode);
  await page.locator('input[type=number]').fill('1');

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Record movement' }).click();
  await expect(page.locator('footer')).toContainText('Queue: 1');
  // The strip must say so: the paused health check alone would keep showing "Synced".
  await expect(page.locator('footer')).toContainText(label('en', 'status.offline'));
  expect(await quantityOnTestShelf(api, before.productId)).toBe(before.quantity);

  await context.setOffline(false);
  await expect(page.locator('footer')).toContainText('Queue: 0', { timeout: 20_000 });
  await expect(page.locator('footer')).toContainText(label('en', 'status.synced'));
  await expect.poll(() => quantityOnTestShelf(api, before.productId)).toBe(before.quantity + 1);

  const restore = await api.post('/stock-movements', { clientId: crypto.randomUUID(), type: 'GOODS_OUT', productId: before.productId, fromLocationNodeId: before.shelfId, quantity: 1 });
  expect(restore.ok()).toBeTruthy();
});
