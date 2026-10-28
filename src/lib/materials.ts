import { useEffect, useState } from 'react';
import type { InventoryItem } from '@/types/inventory';
import { apiV1Url } from '@/lib/backendUrl';

/** One inventory item used to make 1 unit of a product (Bill of Materials). */
export interface Material {
  inventoryId: string;
  qty: number;
}

/**
 * Product materials (bill of materials) live in the backend (MongoDB). localStorage is only a
 * read cache so the sync readers (product cost, producible units, order stock) keep working.
 */
const KEY = 'magnify-product-materials';
const MIGRATED_KEY = 'magnify-product-materials-migrated';
const endpoint = (path = '') => apiV1Url(`/materials${path}`);
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function readAll(): Record<string, Material[]> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Material[]>) : {};
  } catch {
    return {};
  }
}

export function readMaterials(productKey: string): Material[] {
  return readAll()[productKey] ?? [];
}

/** Cache-only write (the backend copy is saved by saveMaterials). */
export function writeMaterials(productKey: string, list: Material[]): void {
  if (!productKey) return;
  try {
    const all = readAll();
    if (list.length) all[productKey] = list;
    else delete all[productKey];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Could not save product materials.', e);
  }
}

function writeAll(all: Record<string, Material[]>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Could not cache product materials.', e);
  }
}

const clean = (list: unknown): Material[] =>
  Array.isArray(list)
    ? list
        .map((m) => ({ inventoryId: String((m as Material).inventoryId ?? ''), qty: Number((m as Material).qty ?? 0) }))
        .filter((m) => m.inventoryId && m.qty > 0)
    : [];

/** null = backend unreachable. */
async function fetchAllMaterials(): Promise<Record<string, Material[]> | null> {
  try {
    const res = await fetch(endpoint(), { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    const raw: Record<string, unknown> = j?.data && typeof j.data === 'object' ? j.data : {};
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, clean(v)]));
  } catch {
    return null;
  }
}

let inflight: Promise<Record<string, Material[]>> | null = null;

/** Loads all product materials from the backend into the cache. Old local data is uploaded once. */
export function refreshMaterials(): Promise<Record<string, Material[]>> {
  if (inflight) return inflight;
  inflight = (async () => {
    const remote = await fetchAllMaterials();
    if (remote === null) return readAll();
    let migrated = false;
    try {
      migrated = localStorage.getItem(MIGRATED_KEY) === '1';
    } catch {}
    if (!migrated) {
      const local = readAll();
      if (Object.keys(remote).length === 0 && Object.keys(local).length) {
        for (const [k, list] of Object.entries(local)) {
          await fetch(endpoint(`/${encodeURIComponent(k)}`), {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ items: clean(list) }),
          }).catch(() => null);
        }
        const again = await fetchAllMaterials();
        if (again) {
          try {
            localStorage.setItem(MIGRATED_KEY, '1');
          } catch {}
          writeAll(again);
          return again;
        }
        return local;
      }
      try {
        localStorage.setItem(MIGRATED_KEY, '1');
      } catch {}
    }
    writeAll(remote);
    return remote;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Saves the materials of one product to the backend (an empty list clears them) and updates the cache. */
export async function saveMaterials(productKey: string, list: Material[]): Promise<void> {
  if (!productKey) return;
  const items = clean(list);
  let res: Response;
  try {
    res = await fetch(endpoint(`/${encodeURIComponent(productKey)}`), {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ items }),
    });
  } catch {
    throw new Error('Could not reach the server. Product materials were not saved.');
  }
  if (!res.ok) {
    throw new Error(res.status >= 500 ? 'Server is not reachable. Check that the backend is running.' : 'Could not save product materials.');
  }
  writeMaterials(productKey, items);
}

/** Re-renders the component once the backend copy of the materials has been loaded. */
export function useMaterialsSync(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    refreshMaterials().then(() => alive && setTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, []);
}

/** Material cost of 1 product = sum(unit value x qty). */
export function materialCost(list: Material[], inventory: InventoryItem[]): number {
  return list.reduce((sum, m) => {
    const item = inventory.find((i) => i.id === m.inventoryId);
    return sum + (item ? item.unitValue * m.qty : 0);
  }, 0);
}

/** How many products can be made right now with the current stock (the scarcest item decides). */
export function producibleUnits(list: Material[], inventory: InventoryItem[]): number {
  const usable = list.filter((m) => m.qty > 0);
  if (!usable.length) return 0;
  return Math.max(
    0,
    Math.min(
      ...usable.map((m) => {
        const item = inventory.find((i) => i.id === m.inventoryId);
        return item ? Math.floor(item.stock / m.qty) : 0;
      })
    )
  );
}

/** Reduce inventory stock for `units` products made/sold. Returns the updated inventory. */
export function consumeMaterials(list: Material[], units: number, inventory: InventoryItem[]): InventoryItem[] {
  return inventory.map((item) => {
    const m = list.find((x) => x.inventoryId === item.id);
    return m ? { ...item, stock: Math.max(0, item.stock - m.qty * units) } : item;
  });
}
