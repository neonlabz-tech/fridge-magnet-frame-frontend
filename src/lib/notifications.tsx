import { apiV1Url } from "@/lib/backendUrl";
import { Package, ShoppingBag } from "lucide-react";
import { getSessionAllowedPages } from "@/lib/roles";

export type NotifItem = {
  id: string;
  type: "order" | "stock-low" | "stock-out";
  title: string;
  sub: string;
  href: string;
  /** Small third line, e.g. "Pending · 2 h ago". */
  meta?: string;
  createdAt?: string;
};

export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

type ApiOrder = {
  _id?: string;
  orderId: string;
  customerName: string;
  status: string;
  createdAt?: string;
};

type ApiProduct = {
  _id?: string;
  productName: string;
  productId: string;
  status: string;
  stock: number;
};

export async function fetchNotifications(): Promise<NotifItem[]> {
  const items: NotifItem[] = [];

  // Only show what the signed-in person can actually open (no order alerts without the Orders page, etc.).
  const allowed = getSessionAllowedPages();
  const canOrders = allowed.includes("/dashboard/orders");
  const canStock = allowed.includes("/dashboard/products") || allowed.includes("/dashboard/inventory");
  if (!canOrders && !canStock) return items;
  const skip = () => Promise.resolve(null as Response | null);

  try {
    const [ordersRes, lowRes, outRes] = await Promise.all([
      canOrders ? fetch(apiV1Url("/orders?status=PENDING"), { cache: "no-store" }) : skip(),
      canStock
        ? fetch(apiV1Url("/products?status=Low+Stock&limit=5"), { cache: "no-store" })
        : skip(),
      canStock
        ? fetch(apiV1Url("/products?status=Out+of+Stock&limit=5"), { cache: "no-store" })
        : skip(),
    ]);

    if (ordersRes && ordersRes.ok) {
      const orders = (await ordersRes.json()) as ApiOrder[];
      const recent = orders.slice(0, 10);
      for (const o of recent) {
        items.push({
          id: `order-${o._id || o.orderId}`,
          type: "order",
          title: `New order · ${o.customerName}`,
          sub: `#${o.orderId}`,
          meta: [o.status.charAt(0) + o.status.slice(1).toLowerCase(), timeAgo(o.createdAt)].filter(Boolean).join(" · "),
          href: `/dashboard/orders`,
          createdAt: o.createdAt,
        });
      }
    }

    const extractProducts = async (res: Response | null): Promise<ApiProduct[]> => {
      if (!res || !res.ok) return [];
      const body = await res.json();
      if (Array.isArray(body)) return body as ApiProduct[];
      return (body?.data?.products ?? body?.products ?? []) as ApiProduct[];
    };

    const [lowProducts, outProducts] = await Promise.all([
      extractProducts(lowRes),
      extractProducts(outRes),
    ]);

    for (const p of outProducts.slice(0, 3)) {
      items.push({
        id: `stock-out-${p._id || p.productId}`,
        type: "stock-out",
        title: `Out of stock: ${p.productName}`,
        sub: `SKU ${p.productId} · 0 units remaining`,
        href: `/dashboard/products`,
      });
    }

    for (const p of lowProducts.slice(0, 3)) {
      items.push({
        id: `stock-low-${p._id || p.productId}`,
        type: "stock-low",
        title: `Low stock: ${p.productName}`,
        sub: `SKU ${p.productId} · ${p.stock} units left`,
        href: `/dashboard/products`,
      });
    }
  } catch {
    // silently return whatever was collected before the error
  }

  return items;
}

export const iconFor = (type: NotifItem["type"]) => {
  if (type === "order") return <ShoppingBag size={15} color="#002B73" />;
  if (type === "stock-out") return <Package size={15} color="#BC0000" />;
  return <Package size={15} color="#D97706" />;
};

export const dotColor = (type: NotifItem["type"]) => {
  if (type === "order") return "#DAE2FF";
  if (type === "stock-out") return "#FFE4E4";
  return "#FEF3C7";
};


const READ_KEY = "admin_notif_read";
const CLEARED_KEY = "admin_notif_cleared";
export const NOTIF_EVENT = "admin-notif-change";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  try {
    // keep the stored list from growing forever
    localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIF_EVENT));
}

export const getReadIds = () => readSet(READ_KEY);
export const getClearedIds = () => readSet(CLEARED_KEY);

export function markRead(ids: string[]) {
  const set = readSet(READ_KEY);
  ids.forEach((id) => set.add(id));
  writeSet(READ_KEY, set);
}

export function markUnread(id: string) {
  const set = readSet(READ_KEY);
  set.delete(id);
  writeSet(READ_KEY, set);
}

/** Hide from the bell dropdown (they stay on the All notifications page). Also marks them read. */
export function clearFromDropdown(ids: string[]) {
  const cleared = readSet(CLEARED_KEY);
  ids.forEach((id) => cleared.add(id));
  writeSet(CLEARED_KEY, cleared);
  markRead(ids);
}
