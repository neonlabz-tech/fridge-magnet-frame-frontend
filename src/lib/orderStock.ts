import type { Order, OrderStatus } from '@/types/order';
import type { InventoryItem } from '@/types/inventory';
import { refreshInventory, writeInventory, pushInventoryChanges } from '@/lib/inventoryStore';
import { type Material, readMaterials, refreshMaterials, producibleUnits } from '@/lib/materials';
import { apiV1Url } from '@/lib/backendUrl';

const KEY = 'magnify-order-stock-applied';
/** Statuses where the order's materials are taken out of inventory. */
const CONSUMING: OrderStatus[] = ['processing', 'shipped', 'delivered'];
/** Statuses that give the materials back (if they were already taken). */
const RELEASING: OrderStatus[] = ['pending', 'canceled'];

const readApplied = (): string[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
};
const writeApplied = (list: string[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
};

const stockStatus = (n: number) => (n > 10 ? 'In Stock' : n > 4 ? 'Low Stock' : 'Out of Stock');

/** Find the materials of an order line. Materials are saved under the product SKU (e.g. MG-01). */
async function materialsFor(item: NonNullable<Order['items']>[number]): Promise<Material[]> {
  await refreshMaterials().catch(() => null);
  const direct = (item.sku && readMaterials(item.sku)) || (item.productId && readMaterials(item.productId)) || [];
  if (direct.length || !item.productId) return direct;
  try {
    const res = await fetch(apiV1Url(`/products/${item.productId}`), { cache: 'no-store' });
    if (!res.ok) return [];
    const json = (await res.json()) as Record<string, any>;
    const sku = json.productId ?? json.data?.productId ?? json.product?.productId;
    return sku ? readMaterials(String(sku)) : [];
  } catch {
    return [];
  }
}

/**
 * Keeps inventory and product stock in step with the order status.
 * Returns a short message when something changed, otherwise null.
 */
export async function syncOrderStock(order: Order, next: OrderStatus): Promise<string | null> {
  const key = String(order._id || order.id || order.orderId);
  const applied = readApplied();
  const wasApplied = applied.includes(key);

  let sign = 0; // +1 = consume, -1 = give back
  if (CONSUMING.includes(next) && !wasApplied) sign = 1;
  else if (RELEASING.includes(next) && wasApplied) sign = -1;
  if (!sign) return null;

  const items = order.items ?? [];
  const before: InventoryItem[] = await refreshInventory();
  let inventory: InventoryItem[] = before;
  const touched: { productId?: string; materials: Material[] }[] = [];
  const now = new Date().toISOString();

  for (const line of items) {
    const materials = (await materialsFor(line)).filter((m) => m.qty > 0);
    if (!materials.length) continue;
    const units = Number(line.quantity) || 1;
    inventory = inventory.map((inv) => {
      const m = materials.find((x) => x.inventoryId === inv.id);
      if (!m) return inv;
      const stock = Math.max(0, inv.stock - sign * m.qty * units);
      const change = stock - inv.stock;
      if (!change) return inv;
      return {
        ...inv,
        stock,
        history: [
          {
            at: now,
            role: 'Admin/Director' as const,
            change,
            totalValue: stock * inv.unitValue,
            reason: sign > 0 ? ('Used' as const) : ('Returned' as const),
          },
          ...inv.history,
        ],
      };
    });
    touched.push({ productId: line.productId, materials });
  }

  writeInventory(inventory);
  await pushInventoryChanges(before, inventory);
  writeApplied(sign > 0 ? [...applied, key] : applied.filter((k) => k !== key));
  if (!touched.length) return null;

  // Product stock = how many can still be made from the (now updated) inventory.
  await Promise.all(
    touched
      .filter((t) => t.productId)
      .map((t) => {
        const stock = producibleUnits(t.materials, inventory);
        return fetch(apiV1Url(`/products/${t.productId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stock, status: stockStatus(stock) }),
        }).catch(() => null);
      })
  );

  return sign > 0 ? 'Inventory and product stock reduced.' : 'Inventory and product stock restored.';
}
