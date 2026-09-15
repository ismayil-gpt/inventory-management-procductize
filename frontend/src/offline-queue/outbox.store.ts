import Dexie, { Table } from 'dexie';
import { create } from 'zustand';
import { createMovement, ApiError, type MovementPayload } from '../api-client/client';

// Ref: CLAUDE.md §6 (offline operation), §4 (Dexie). Every scan is written to an
// IndexedDB outbox FIRST, then synced. A scan is never silently dropped; failures
// surface in a review list. Idempotency (clientId) makes retries safe (§5).

export type OutboxStatus = 'pending' | 'synced' | 'error';

export interface OutboxItem {
  clientId: string;
  payload: MovementPayload;
  status: OutboxStatus;
  createdAt: number;
  syncedAt?: number;
  errorMessage?: string;
  // Display metadata captured at enqueue time (so the log reads well offline).
  typeLabel: string;
  productName: string;
  sku: string;
  fromDesignator?: string | null;
  toDesignator?: string | null;
  quantity: number;
}

class OutboxDatabase extends Dexie {
  items!: Table<OutboxItem, string>;
  constructor() {
    super('mizan-outbox');
    this.version(1).stores({ items: 'clientId, status, createdAt' });
  }
}
const db = new OutboxDatabase();

interface OutboxState {
  items: OutboxItem[];
  pendingCount: number;
  refresh: () => Promise<void>;
  enqueue: (item: OutboxItem) => Promise<void>;
  flush: () => Promise<void>;
}

let isFlushing = false;

export const useOutbox = create<OutboxState>((set, get) => ({
  items: [],
  pendingCount: 0,

  refresh: async () => {
    const items = await db.items.orderBy('createdAt').reverse().toArray();
    set({ items, pendingCount: items.filter((i) => i.status === 'pending').length });
  },

  enqueue: async (item) => {
    await db.items.put(item);
    await get().refresh();
    await get().flush();
  },

  flush: async () => {
    if (isFlushing) return;
    isFlushing = true;
    try {
      // Process oldest-first; re-query each loop so items added mid-flush are picked up.
      // Stop on a network error (offline) but keep going past per-item business errors.
      for (;;) {
        const next = await db.items.where('status').equals('pending').sortBy('createdAt');
        if (next.length === 0) break;
        const item = next[0];
        try {
          await createMovement(item.payload);
          await db.items.update(item.clientId, { status: 'synced', syncedAt: Date.now() });
        } catch (error) {
          if (error instanceof ApiError) {
            // 4xx/5xx business or auth error — it won't succeed on blind retry; flag it.
            await db.items.update(item.clientId, { status: 'error', errorMessage: error.body.messageEn ?? `Error ${error.status}` });
          } else {
            // Network failure / offline — leave pending and stop; retry later.
            break;
          }
        }
        await get().refresh();
      }
    } finally {
      isFlushing = false;
      await get().refresh();
    }
  },
}));

/** Clear items that have already synced (housekeeping for the activity log). */
export async function clearSyncedOutbox(): Promise<void> {
  await db.items.where('status').equals('synced').delete();
  await useOutbox.getState().refresh();
}

// Load persisted items and try to sync on startup, on reconnect, and periodically.
void useOutbox.getState().refresh().then(() => useOutbox.getState().flush());
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void useOutbox.getState().flush());
  window.setInterval(() => void useOutbox.getState().flush(), 20000);
}
