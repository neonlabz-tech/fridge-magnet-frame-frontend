import { apiV1Url } from '@/lib/backendUrl';

export interface CommissionTier {
  id: string;
  minSales: number;
  rate: number;
}

const endpoint = (path = '') => apiV1Url(`/leads/commission-tiers${path}`);

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

const sorted = (list: CommissionTier[]) => [...list].sort((a, b) => a.minSales - b.minSales);

export async function fetchTiers(): Promise<CommissionTier[] | null> {
  try {
    const res = await fetch(endpoint(), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const j = await res.json();
    const list: Partial<CommissionTier>[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
    return sorted(
      list.map((t) => ({ id: String(t.id ?? ''), minSales: Number(t.minSales ?? 0), rate: Number(t.rate ?? 0) })),
    );
  } catch {
    return null;
  }
}

export async function saveTier(t: { id?: string; minSales: number; rate: number }): Promise<void> {
  let res: Response;
  try {
    res = await fetch(t.id ? endpoint(`/${encodeURIComponent(t.id)}`) : endpoint(), {
      method: t.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minSales: t.minSales, rate: t.rate }),
    });
  } catch {
    throw new Error('Could not reach the server. The tier was not saved.');
  }
  if (!res.ok) throw new Error(await apiError(res, 'Could not save the tier.'));
}

export async function deleteTier(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(endpoint(`/${encodeURIComponent(id)}`), { method: 'DELETE' });
  } catch {
    throw new Error('Could not reach the server. The tier was not deleted.');
  }
  if (!res.ok && res.status !== 404) throw new Error(await apiError(res, 'Could not delete the tier.'));
}

const money = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-US')}`;

/** "Rs. 270,000 - Rs. 309,999", "Below Rs. 270,000" or "Rs. 310,000 and above". */
export function rangeLabel(tiers: CommissionTier[], index: number): string {
  const list = sorted(tiers);
  const t = list[index];
  const next = list[index + 1];
  if (!t) return '';
  if (index === 0 && t.minSales <= 0 && next) return `Below ${money(next.minSales)}`;
  if (!next) return `${money(t.minSales)} and above`;
  return `${money(t.minSales)} - ${money(next.minSales - 1)}`;
}

export interface CommissionResult {
  rate: number;
  amount: number;
  index: number; // -1 when below every tier
  next: CommissionTier | null;
  toNext: number;
}

export function commissionFor(tiers: CommissionTier[], sales: number): CommissionResult {
  const list = sorted(tiers);
  let index = -1;
  list.forEach((t, i) => {
    if (sales >= t.minSales) index = i;
  });
  const rate = index >= 0 ? list[index].rate : 0;
  const next = list[index + 1] ?? null;
  return {
    rate,
    amount: Math.round((sales * rate) / 100),
    index,
    next,
    toNext: next ? Math.max(0, next.minSales - sales) : 0,
  };
}
