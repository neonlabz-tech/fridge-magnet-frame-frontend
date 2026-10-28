import type { Delivery, DispatchOrder } from '@/types/delivery';
import { apiV1Url } from '@/lib/backendUrl';

/**
 * Deliveries live in the backend (MongoDB). localStorage is only a read cache for the
 * synchronous readers (overview, reports) and for when the backend is unreachable.
 */
const KEY = 'magnify-deliveries';
const endpoint = (path = '') => apiV1Url(`/deliveries${path}`);

/* ---------- local cache ---------- */
export function readDeliveries(): Delivery[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Delivery[]) : [];
  } catch {
    return [];
  }
}

export function writeDeliveries(list: Delivery[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Could not cache deliveries.', e);
  }
}

/* ---------- backend ---------- */
// The backend stores ids as MGD-260913, the dashboard shows #MGD-260913.
const bare = (id: string) => id.replace(/^#/, '');
const withHash = (id: string) => (id.startsWith('#') ? id : `#${id}`);

type Raw = Partial<Delivery> & Record<string, unknown>;

const normalize = (r: Raw): Delivery => ({
  id: withHash(String(r.id ?? '')),
  orderId: String(r.orderId ?? ''),
  orderTotal: Number(r.orderTotal ?? 0),
  method: r.method === 'Courier' ? 'Courier' : 'Standard',
  tracking: String(r.tracking ?? ''),
  driver: String(r.driver ?? ''),
  place: String(r.place ?? ''),
  recipient: String(r.recipient ?? ''),
  phone: String(r.phone ?? ''),
  address: String(r.address ?? ''),
  date: String(r.date ?? ''),
  timeSlot: String(r.timeSlot ?? ''),
  status: (['pending', 'in-transit', 'delivered', 'returned'].includes(String(r.status)) ? r.status : 'pending') as Delivery['status'],
  vehicleType: String(r.vehicleType ?? ''),
  licenseNo: String(r.licenseNo ?? ''),
  plateNo: String(r.plateNo ?? ''),
  emergencyContact: String(r.emergencyContact ?? ''),
  zones: Array.isArray(r.zones) ? (r.zones as string[]) : [],
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

const payload = (d: Delivery) => ({
  orderId: d.orderId,
  orderTotal: d.orderTotal,
  method: d.method,
  tracking: d.tracking,
  driver: d.driver,
  place: d.place,
  recipient: d.recipient,
  phone: d.phone,
  address: d.address,
  date: d.date,
  timeSlot: d.timeSlot,
  status: d.status,
  vehicleType: d.vehicleType,
  licenseNo: d.licenseNo,
  plateNo: d.plateNo,
  emergencyContact: d.emergencyContact,
  zones: d.zones,
});

/** null = backend unreachable. */
export async function fetchDeliveries(): Promise<Delivery[] | null> {
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

let inflight: Promise<Delivery[]> | null = null;

/** Loads deliveries from the backend and refreshes the cache (old local ones are uploaded once). */
export function refreshDeliveries(): Promise<Delivery[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const remote = await fetchDeliveries();
    if (remote === null) return readDeliveries();
    if (remote.length === 0) {
      const local = readDeliveries();
      if (local.length) {
        for (const d of local) {
          try {
            await fetch(endpoint(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: bare(d.id), ...payload(d) }),
            });
          } catch {
            break;
          }
        }
        const again = await fetchDeliveries();
        if (again && again.length) {
          writeDeliveries(again);
          return again;
        }
        return local;
      }
    }
    writeDeliveries(remote);
    return remote;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function saveDelivery(d: Delivery, isNew: boolean): Promise<Delivery> {
  let res: Response;
  try {
    res = await fetch(isNew ? endpoint() : endpoint(`/${encodeURIComponent(bare(d.id))}`), {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isNew ? { id: bare(d.id), ...payload(d) } : payload(d)),
    });
  } catch {
    throw new Error('Could not reach the server. Delivery was not saved.');
  }
  if (!res.ok) throw new Error(await apiError(res, 'Could not save delivery.'));
  const j = await res.json().catch(() => null);
  const saved = normalize((j?.data ?? j ?? d) as Raw);
  writeDeliveries([saved, ...readDeliveries().filter((x) => x.id !== saved.id && x.id !== d.id)]);
  return saved;
}

export async function deleteDelivery(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(endpoint(`/${encodeURIComponent(bare(id))}`), { method: 'DELETE' });
  } catch {
    throw new Error('Could not reach the server. Delivery was not removed.');
  }
  if (!res.ok && res.status !== 404) throw new Error(await apiError(res, 'Could not remove delivery.'));
  writeDeliveries(readDeliveries().filter((x) => x.id !== id));
}

/** Orders that still need a delivery (from the backend). */
export async function fetchDispatchOrders(): Promise<DispatchOrder[]> {
  try {
    const res = await fetch(endpoint('/dispatch-orders'), { cache: 'no-store' });
    if (!res.ok) return [];
    const j = await res.json();
    const list: Partial<DispatchOrder>[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
    return list.map((o) => ({
      orderId: String(o.orderId ?? ''),
      badge: (o.badge as DispatchOrder['badge']) ?? 'Standard',
      total: Number(o.total ?? 0),
      customer: String(o.customer ?? ''),
      phone: String(o.phone ?? ''),
      place: String(o.place ?? ''),
      address: String(o.address ?? ''),
    }));
  } catch {
    return [];
  }
}
