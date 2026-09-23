import { useQuery } from '@tanstack/react-query';
import { useAuthStore, Session } from '../features/authentication/auth.store';

// Typed calls to the backend (§3.1). Locally the Vite dev server proxies /api ->
// :3000, so this stays '/api/v1'. A hosted build can point at another origin by
// setting VITE_API_BASE_URL at build time; unset = unchanged local behaviour.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

// ---- Error shape from the backend's localised error envelope (§14) ----
export interface ApiErrorBody {
  code?: string;
  messageEn?: string;
  messageAr?: string;
  lockedMinutes?: number;
}
export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.messageEn ?? `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

// ---- Public (unauthenticated) endpoints ----
export interface HealthResponse {
  status: string; service: string; version: string; environment: string;
  database: 'connected' | 'disconnected'; uptimeSeconds: number; timestamp: string;
}
export interface DemoLogin { role: string; email: string; password: string; }
export interface SystemInfo {
  appName: string; organizationCode: string;
  organizationName: string | null; organizationNameAr: string | null;
  environment: string;
  apiVersion: string; nodeVersion: string; serverTime: string; timezone: string;
  demoLogins?: DemoLogin[];
}
export interface DashboardSummary {
  products: number; shelves: number; storeRooms: number; suppliers: number; totalUnits: number;
  stockStatus: { inStock: number; low: number; critical: number; outOfStock: number };
  needsReorder: number;
  movements30d: number;
  movementTrend: Array<{ date: string; goodsIn: number; goodsOut: number }>;
  categoryBreakdown: Array<{ categoryId: string; nameEn: string; nameAr: string; units: number }>;
  recommendationsPipeline: Array<{ status: string; count: number }>;
  recentActivity: Array<{
    id: string; type: string; quantity: number; createdAt: string;
    sku: string; productNameEn: string; productNameAr: string;
    designator: string | null; userDisplayName: string;
  }>;
}

async function getPublic<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => ({})));
  return (await response.json()) as T;
}

// ---- Authentication ----
export async function loginRequest(email: string, password: string): Promise<Session> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body as ApiErrorBody);
  return body as Session;
}

async function tryRefresh(): Promise<boolean> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) return false;
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    clearSession();
    return false;
  }
  setSession((await response.json()) as Session);
  return true;
}

/** Authenticated request with one automatic refresh-and-retry on 401. */
export async function authFetch<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401 && allowRetry) {
    if (await tryRefresh()) return authFetch<T>(path, options, false);
    useAuthStore.getState().clearSession();
    throw new ApiError(401, { code: 'UNAUTHENTICATED' });
  }
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => ({})));
  return (await response.json()) as T;
}

export async function logoutRequest(): Promise<void> {
  try {
    await authFetch('/auth/logout', { method: 'POST' }, false);
  } catch {
    /* best effort — clear locally regardless */
  }
  useAuthStore.getState().clearSession();
}

// ---- Query hooks ----
export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: () => getPublic<HealthResponse>('/health'), refetchInterval: 5000, retry: false });
}
export function useSystemInfo() {
  return useQuery({ queryKey: ['system-info'], queryFn: () => getPublic<SystemInfo>('/system/info'), retry: false });
}
export function useDashboardSummary() {
  return useQuery({ queryKey: ['dashboard-summary'], queryFn: () => authFetch<DashboardSummary>('/dashboard/summary'), retry: false });
}

// ---- Organization / white-label settings ----
export interface Organization {
  id: string; code: string; nameEn: string; nameAr: string;
  defaultLanguage: string; timezone: string; logoObjectKey: string | null;
}
export type OrganizationWrite = Partial<Pick<Organization, 'nameEn' | 'nameAr' | 'defaultLanguage' | 'timezone'>>;
export function useOrganization() {
  return useQuery({ queryKey: ['organization'], queryFn: () => authFetch<Organization>('/organization'), retry: false });
}
export function updateOrganization(payload: OrganizationWrite) {
  return authFetch<Organization>('/organization', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

// ---- Products & locations (Phase 1) ----
export type StockStatus = 'IN_STOCK' | 'LOW' | 'CRITICAL' | 'OUT';

export interface ProductListItem {
  id: string; sku: string; barcode: string; barcodeSource: 'MANUFACTURER' | 'INTERNAL';
  nameEn: string; nameAr: string;
  categoryId: string | null; categoryNameEn: string | null; categoryNameAr: string | null;
  baseUnitCode: string | null; packSize: number;
  supplierId: string | null; supplierName: string | null;
  reorderPoint: number; minLevel: number; maxLevel: number;
  totalStock: number; status: StockStatus;
}
export interface ProductsResponse { total: number; items: ProductListItem[]; }
export interface ProductStockPosition { locationNodeId: string; designator: string; barcode: string | null; quantity: number; }
export interface ProductDetail extends ProductListItem {
  baseUnitNameEn: string | null; supplierLeadTimeDays: number | null; isActive: boolean;
  positions: ProductStockPosition[];
}
export interface Category { id: string; code: string; nameEn: string; nameAr: string; parentId: string | null; }
export interface LocationTreeNode {
  id: string; code: string; designator: string; depth: number; parentId: string | null;
  typeCode: string; typeNameEn: string; typeNameAr: string; canHoldStock: boolean; barcode: string | null;
  itemCount: number; unitCount: number; children: LocationTreeNode[];
}
export interface LocationStockRow { productId: string; sku: string; nameEn: string; nameAr: string; barcode: string | null; quantity: number; }
export interface LocationResolved {
  id: string; code: string; designator: string; segments: string[]; depth: number;
  typeCode: string; typeNameEn: string; typeNameAr: string; canHoldStock: boolean; barcode: string | null;
  itemCount: number; unitCount: number; stock: LocationStockRow[];
}

export function useProducts(params: { search?: string; categoryId?: string; lowStock?: boolean }) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.categoryId) q.set('categoryId', params.categoryId);
  if (params.lowStock) q.set('lowStock', 'true');
  const qs = q.toString();
  return useQuery({ queryKey: ['products', params], queryFn: () => authFetch<ProductsResponse>(`/products${qs ? `?${qs}` : ''}`), retry: false });
}
export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: ['product', id], enabled: Boolean(id), queryFn: () => authFetch<ProductDetail>(`/products/${id}`), retry: false });
}
export function useProductCategories() {
  return useQuery({ queryKey: ['product-categories'], queryFn: () => authFetch<Category[]>('/product-categories'), retry: false, staleTime: 300000 });
}
export function useLocationsTree() {
  return useQuery({ queryKey: ['locations-tree'], queryFn: () => authFetch<LocationTreeNode[]>('/storage-locations'), retry: false });
}
export function useLocation(id: string | undefined) {
  return useQuery({ queryKey: ['location', id], enabled: Boolean(id), queryFn: () => authFetch<LocationResolved>(`/storage-locations/${id}`), retry: false });
}
export function resolveProductByBarcode(code: string) {
  return authFetch<ProductDetail>(`/products/resolve/${encodeURIComponent(code)}`);
}
export function resolveLocationByBarcode(code: string) {
  return authFetch<LocationResolved>(`/storage-locations/resolve/${encodeURIComponent(code)}`);
}

// ---- Users (ADMIN) ----
export interface UserRow { id: string; email: string; displayName: string; role: 'ADMIN' | 'STORE_KEEPER'; isActive: boolean; lastLoginAt: string | null; preferredLanguage: string; createdAt: string; }
export interface UserWrite { email: string; displayName: string; role: 'ADMIN' | 'STORE_KEEPER'; password?: string; isActive?: boolean; preferredLanguage?: string; }
export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => authFetch<UserRow[]>('/users'), retry: false });
}
export function createUser(payload: UserWrite) {
  return authFetch<UserRow>('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
export function updateUser(id: string, payload: Partial<UserWrite>) {
  return authFetch<UserRow>(`/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
export function deleteUser(id: string) {
  return authFetch<{ deleted: boolean }>(`/users/${id}`, { method: 'DELETE' });
}

// ---- Audit log (ADMIN) ----
export interface AuditRow { id: string; actorName: string; action: string; entityType: string; entityId: string; before: unknown; after: unknown; ipAddress: string | null; createdAt: string; }
export function useAuditLog(filters: { entityType?: string; action?: string; from?: string }) {
  const q = new URLSearchParams();
  if (filters.entityType) q.set('entityType', filters.entityType);
  if (filters.action) q.set('action', filters.action);
  if (filters.from) q.set('from', filters.from);
  const qs = q.toString();
  return useQuery({ queryKey: ['audit-log', filters], queryFn: () => authFetch<AuditRow[]>(`/audit-log${qs ? `?${qs}` : ''}`), retry: false });
}

// ---- Reports ----
export async function downloadReport(name: 'stock-on-hand' | 'stock-movements' | 'replenishment', format: 'pdf' | 'xlsx'): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${API_BASE}/reports/${name}?format=${format}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  if (format === 'pdf') {
    window.open(url, '_blank');
  } else {
    const a = document.createElement('a');
    a.href = url; a.download = `mizan-${name}.xlsx`; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ---- Cycle counts ----
export interface VarianceLine { productId: string; locationNodeId: string; sku: string; nameEn: string; nameAr: string; designator: string; currentQty: number; countedQty: number; variance: number; }
export interface CycleCountReport { id: string; status: string; note: string | null; lines: VarianceLine[]; applied?: number; }
export interface CycleCountSummary { id: string; status: string; note: string | null; lineCount: number; createdAt: string; closedAt: string | null; }
export function useCycleCounts() {
  return useQuery({ queryKey: ['cycle-counts'], queryFn: () => authFetch<CycleCountSummary[]>('/cycle-counts'), retry: false });
}
export function createCycleCount(note?: string) {
  return authFetch<{ id: string }>('/cycle-counts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: note ?? null }) });
}
export function cycleCountGet(id: string) {
  return authFetch<CycleCountReport>(`/cycle-counts/${id}`);
}
export function cycleCountScan(id: string, productId: string, locationNodeId: string, countedQty: number) {
  return authFetch<CycleCountReport>(`/cycle-counts/${id}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, locationNodeId, countedQty }) });
}
export function cycleCountClose(id: string, apply: boolean) {
  return authFetch<CycleCountReport>(`/cycle-counts/${id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apply }) });
}

// ---- Replenishment / recommendations (Phase 2) ----
export type RecommendationStatus = 'PENDING' | 'APPROVED' | 'AMENDED' | 'REJECTED' | 'ORDERED' | 'RECEIVED';
export interface Recommendation {
  id: string; productId: string; sku: string; nameEn: string; nameAr: string;
  supplierId: string | null; supplierName: string | null;
  suggestedQty: number; approvedQty: number | null; reasonCode: string;
  reasoningEn: string; reasoningAr: string; status: RecommendationStatus;
  generatedAt: string; decidedAt: string | null; purchaseOrderId: string | null;
}
export function useRecommendations(status?: string) {
  return useQuery({ queryKey: ['recommendations', status], queryFn: () => authFetch<Recommendation[]>(`/recommendations${status ? `?status=${status}` : ''}`), retry: false });
}
export function runReview() {
  return authFetch<{ generated: number; reviewedAt: string }>('/recommendations/run', { method: 'POST' });
}
export function approveRecommendation(id: string, approvedQty?: number) {
  return authFetch<Recommendation>(`/recommendations/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(approvedQty != null ? { approvedQty } : {}) });
}
export function rejectRecommendation(id: string, reason: string) {
  return authFetch<Recommendation>(`/recommendations/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
}

// ---- Purchase orders ----
// Approving recommendations still generates + emails POs to suppliers; there is
// no in-app PO viewer (removed by design).
export function generatePurchaseOrders() {
  return authFetch<{ created: Array<{ poNumber: string; supplierName: string; lineCount: number; emailed: boolean }>; skippedNoSupplier: number }>('/purchase-orders/generate', { method: 'POST' });
}

// ---- Supplier writes (ADMIN) ----
export interface SupplierWrite { name: string; email: string; phone?: string | null; leadTimeDays: number; isActive?: boolean; }
export function createSupplier(payload: SupplierWrite) {
  return authFetch<Supplier>('/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
export function updateSupplier(id: string, payload: Partial<SupplierWrite>) {
  return authFetch<Supplier>(`/suppliers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
export function deleteSupplier(id: string) {
  return authFetch<{ deleted: boolean }>(`/suppliers/${id}`, { method: 'DELETE' });
}

// ---- Reference data (form lookups) ----
export interface Unit { id: string; code: string; nameEn: string; nameAr: string; isBaseUnit: boolean; }
export interface Supplier { id: string; name: string; email: string; phone?: string | null; leadTimeDays: number; }
export interface LocationType { id: string; code: string; nameEn: string; nameAr: string; depth: number; canHoldStock: boolean; }

export function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => authFetch<Unit[]>('/units-of-measure'), retry: false, staleTime: 300000 });
}
export function useSuppliers() {
  return useQuery({ queryKey: ['suppliers'], queryFn: () => authFetch<Supplier[]>('/suppliers'), retry: false, staleTime: 300000 });
}
export function useLocationTypes() {
  return useQuery({ queryKey: ['location-types'], queryFn: () => authFetch<LocationType[]>('/location-types'), retry: false, staleTime: 300000 });
}

// ---- Product writes (ADMIN) ----
export interface ProductWrite {
  sku: string; barcode?: string | null; nameEn: string; nameAr: string;
  categoryId?: string | null; baseUnitId: string; packSize: number;
  reorderPoint: number; minLevel: number; maxLevel: number; supplierId?: string | null; isActive?: boolean;
}
export function createProduct(payload: ProductWrite) {
  return authFetch<ProductDetail>('/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
export function updateProduct(id: string, payload: Partial<ProductWrite>) {
  return authFetch<ProductDetail>(`/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
export function deleteProduct(id: string) {
  return authFetch<{ deleted: boolean }>(`/products/${id}`, { method: 'DELETE' });
}

// ---- Location writes (ADMIN) ----
export interface BulkCreatePayload {
  parentId?: string | null;
  levels: Array<{ locationTypeId: string; prefix: string; from: number; to: number }>;
}
export interface BulkPreview { count: number; nodes: Array<{ designator: string; code: string; depth: number; canHoldStock: boolean }> }
export function bulkCreateLocations(payload: BulkCreatePayload, preview: boolean) {
  return authFetch<BulkPreview | { count: number }>(`/storage-locations/bulk-create${preview ? '?preview=true' : ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
export function deleteLocation(id: string) {
  return authFetch<{ deleted: boolean }>(`/storage-locations/${id}`, { method: 'DELETE' });
}

// ---- Barcode labels ----
export interface Label { code: string; title: string; subtitle: string; png: string; }
export function fetchLabelsBatch(type: 'product' | 'location', ids: string[]) {
  return authFetch<Label[]>('/barcode-labels/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ids }) });
}
export function fetchProductLabel(id: string) { return authFetch<Label[]>(`/barcode-labels/product/${id}`); }
export function fetchLocationLabels(id: string, includeDescendants = false) {
  return authFetch<Label[]>(`/barcode-labels/location/${id}${includeDescendants ? '?includeDescendants=true' : ''}`);
}

// ---- Excel import (multipart) ----
export interface ImportReport {
  dryRun: boolean; imported: number;
  summary: { total: number; valid: number; invalid: number };
  rows: Array<{ row: number; status: 'ok' | 'error'; errors: string[]; sku: string; nameEn: string }>;
}
export async function importProductsFile(file: File, dryRun: boolean): Promise<ImportReport> {
  const { accessToken } = useAuthStore.getState();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/products/import${dryRun ? '?dryRun=true' : ''}`, {
    method: 'POST', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, body: form,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  return res.json();
}
export async function downloadImportTemplate(): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${API_BASE}/products/import-template`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'mizan-product-import-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Stock movements ----
export type MovementType = 'GOODS_IN' | 'GOODS_OUT' | 'TRANSFER' | 'ADJUSTMENT';
export interface MovementPayload {
  clientId: string;
  type: MovementType;
  productId: string;
  fromLocationNodeId?: string | null;
  toLocationNodeId?: string | null;
  quantity: number;
  reason?: string | null;
}
export interface EnrichedMovement {
  id: string; clientId: string; type: MovementType; productId: string;
  sku: string; nameEn: string; nameAr: string;
  fromDesignator: string | null; toDesignator: string | null;
  quantity: number; reason: string | null; userName: string; createdAt: string;
}
export interface MovementResult { movement: EnrichedMovement; idempotent: boolean; }

export function createMovement(payload: MovementPayload): Promise<MovementResult> {
  return authFetch<MovementResult>('/stock-movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ---- Assistant (§8.4) ----
export interface AssistantSource { type: string; id: string; label: string; value: unknown }
export interface AssistantQueryResponse { answer: string; sources: AssistantSource[]; isDevelopmentModel: boolean }

export function queryAssistant(text: string, language: 'en' | 'ar'): Promise<AssistantQueryResponse> {
  return authFetch<AssistantQueryResponse>('/assistant/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
}
