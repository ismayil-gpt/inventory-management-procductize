import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const translations = {
  en: JSON.parse(readFileSync(path.resolve(here, '../../shared/translations/english.json'), 'utf8')),
  ar: JSON.parse(readFileSync(path.resolve(here, '../../shared/translations/arabic.json'), 'utf8')),
};
/** The on-screen text for a translation key, so tests work in both languages. */
export function label(language: 'en' | 'ar', key: string): string {
  return key.split('.').reduce((node: Record<string, unknown>, part) => node[part] as Record<string, unknown>, translations[language]) as unknown as string;
}

export const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com', password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin@Mizan2026' };
export const KEEPER = { email: process.env.E2E_KEEPER_EMAIL ?? 'storekeeper@example.com', password: process.env.E2E_KEEPER_PASSWORD ?? 'Store@Mizan2026' };
export const TEST_SHELF = 'LOC-SR1-R1-L1';

/** Sign in through the real login screen with chosen language and theme. */
export async function signIn(page: Page, account = ADMIN, preferences: { language?: 'en' | 'ar'; theme?: 'light' | 'dark' } = {}) {
  await page.goto('/login');
  await page.evaluate(({ language, theme }) => {
    localStorage.setItem('mizan.language', language);
    localStorage.setItem('mizan.theme', theme);
  }, { language: preferences.language ?? 'en', theme: preferences.theme ?? 'light' });
  await page.reload();
  await page.fill('#email', account.email);
  await page.fill('#password', account.password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/briefing');
}

/** API access for setting up and checking state behind the UI. */
export async function apiAs(request: APIRequestContext, account = ADMIN) {
  const login = await request.post('/api/v1/auth/login', { data: account });
  expect(login.ok()).toBeTruthy();
  const { accessToken } = await login.json();
  const headers = { Authorization: `Bearer ${accessToken}` };
  return {
    get: async (path: string) => (await request.get(`/api/v1${path}`, { headers })).json(),
    post: async (path: string, data: unknown) => request.post(`/api/v1${path}`, { headers, data }),
  };
}

/** The first product on the test shelf: its id, barcode and current quantity there. */
export async function productOnTestShelf(api: Awaited<ReturnType<typeof apiAs>>) {
  const shelf = await api.get(`/storage-locations/resolve/${TEST_SHELF}`);
  const row = shelf.stock[0];
  const product = await api.get(`/products/${row.productId}`);
  return { shelfId: shelf.id as string, productId: row.productId as string, barcode: product.barcode as string, quantity: row.quantity as number };
}

export async function quantityOnTestShelf(api: Awaited<ReturnType<typeof apiAs>>, productId: string) {
  const shelf = await api.get(`/storage-locations/resolve/${TEST_SHELF}`);
  return (shelf.stock.find((s: { productId: string }) => s.productId === productId)?.quantity ?? 0) as number;
}

/** Fill a barcode field (manual entry) identified by its section label and press Find. */
export async function enterBarcode(page: Page, sectionLabel: string, code: string) {
  const section = page.locator('section').filter({ hasText: sectionLabel }).first();
  await section.getByPlaceholder('Enter or scan a barcode').fill(code);
  await section.getByRole('button', { name: 'Find' }).click();
}
