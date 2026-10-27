import { useEffect, useState } from 'react';
import type { InventoryItem } from '@/types/inventory';
import { apiV1Url } from '@/lib/backendUrl';

/**
 * Inventory lives in the backend (MongoDB). localStorage is only a read cache so
 * the many synchronous readers (product cost, overview, order stock) keep working
 * and the page still shows something when the backend is unreachable.
 */
const KEY = 'magnify-inventory';
const endpoint = (path = '') => apiV1Url(`/inventory${path}`);

/* ---------- local cache ---------- */
export function readInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as InventoryItem[]) : [];
  } catch {
    return [];
  }
}

export function writeInventory(list: InventoryItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Could not cache inventory.', e);
  }
}

/* ---------- backend ---------- */
type Raw = Partial<InventoryItem> & { id?: string };

const normalize = (r: Raw): InventoryItem => ({
  id: String(r.id ?? ''),
  name: String(r.name ?? ''),
  stock: Number(r.stock ?? 0),
  unitValue: Number(r.unitValue ?? 0),
  history: Array.isArray(r.history) ? r.history : [],
});

const apiError = async (res: Response, fallback: string) => {
  if (res.status >= 500) return 'Server is not reachable. Check that the backend is running.';
  try {
    const j = await res.json();
    const m = j?.message;
    return Array.isArray(m) ? m.join(', ') : String(m || fallback);
  } catch {
    return fallback;
  }
};

/** null = backend unreachable. */
export async function fetchInventory(): Promise<InventoryItem[] | null> {
  try {
    const res = await fetch(endpoint(), { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    const list: Raw[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
    return list.map(normalize);
  } catch {
    return null;
  }
}

const body = (i: InventoryItem) => ({
  name: i.name,
  stock: i.stock,
  unitValue: i.unitValue,
  history: i.history,
});

let inflight: Promise<InventoryItem[]> | null = null;

/**
 * Loads inventory from the backend and refreshes the cache. If the backend has no
 * items yet but this browser still holds old local items, they are uploaded once.
 */
export function refreshInventory(): Promise<InventoryItem[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const remote = await fetchInventory();
    if (remote === null) return readInventory();
    if (remote.length === 0) {
      const local = readInventory();
      if (local.length) {
        for (const item of local) {
          try {
            await fetch(endpoint(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: item.id, ...body(item) }),
            });
          } catch {
            break;
          }
        }
        const again = await fetchInventory();
        if (again && again.length) {
          writeInventory(again);
          return again;
        }
        return local;
      }
    }
    writeInventory(remote);
    return remote;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function saveInventoryItem(item: InventoryItem, isNew: boolean): Promise<InventoryItem> {
  let res: Response;
  try {
    res = await fetch(isNew ? endpoint() : endpoint(`/${encodeURIComponent(item.id)}`), {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isNew ? { id: item.id, ...body(item) } : body(item)),
    });
  } catch {
    throw new Error('Could not reach the server. Item was not saved.');
  }
  if (!res.ok) throw new Error(await apiError(res, 'Could not save inventory item.'));
  const j = await res.json().catch(() => null);
  const saved = normalize((j?.data ?? j ?? item) as Raw);
  const cache = readInventory().filter((x) => x.id !== saved.id && x.id !== item.id);
  writeInventory([saved, ...cache]);
  return saved;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(endpoint(`/${encodeURIComponent(id)}`), { method: 'DELETE' });
  } catch {
    throw new Error('Could not reach the server. Item was not deleted.');
  }
  if (!res.ok && res.status !== 404) throw new Error(await apiError(res, 'Could not delete inventory item.'));
  writeInventory(readInventory().filter((x) => x.id !== id));
}

/** Pushes stock/history changes (e.g. from order status changes) to the backend. */
export async function pushInventoryChanges(before: InventoryItem[], after: InventoryItem[]): Promise<void> {
  const old = new Map(before.map((i) => [i.id, i]));
  await Promise.all(
    after
      .filter((i) => old.get(i.id)?.stock !== i.stock)
      .map((i) =>
        fetch(endpoint(`/${encodeURIComponent(i.id)}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock: i.stock, history: i.history }),
        }).catch(() => null)
      )
  );
}

/** Cached list first, then the backend copy. */
export function useInventory(): InventoryItem[] {
  const [list, setList] = useState<InventoryItem[]>([]);
  useEffect(() => {
    let alive = true;
    setList(readInventory());
    refreshInventory().then((l) => alive && setList(l));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}
