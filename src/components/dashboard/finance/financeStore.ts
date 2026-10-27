import { INITIAL_TRANSACTIONS } from '@/data/finance';
import type { Transaction } from '@/types/finance';
import { readSession } from '@/lib/crm';
import { apiV1Url } from '@/lib/backendUrl';

const KEY = 'magnify-finance-transactions';

export function readTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return INITIAL_TRANSACTIONS;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Transaction[];
  } catch (e) {
    console.error('Could not read finance records.', e);
  }
  return INITIAL_TRANSACTIONS;
}

export function writeTransactions(list: Transaction[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/* ---------- backend (MongoDB is the source of truth, localStorage is a read cache) ---------- */
const endpoint = (path = '') => apiV1Url(`/finance/transactions${path}`);

type Raw = Partial<Transaction> & Record<string, unknown>;

const normalize = (r: Raw): Transaction => ({
  id: String(r.id ?? ''),
  kind: r.kind === 'expense' ? 'expense' : 'income',
  date: String(r.date ?? ''),
  ref: String(r.ref ?? ''),
  party: String(r.party ?? ''),
  note: String(r.note ?? ''),
  amount: Number(r.amount ?? 0),
  method: (['Bank Transfer', 'Cash', 'Card Payment'].includes(String(r.method)) ? r.method : 'Cash') as Transaction['method'],
  status: r.status === 'pending' ? 'pending' : 'completed',
  createdBy: typeof r.createdBy === 'string' ? r.createdBy : undefined,
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

const body = (t: Transaction) => ({
  kind: t.kind,
  date: t.date,
  ref: t.ref,
  party: t.party,
  note: t.note,
  amount: t.amount,
  method: t.method,
  status: t.status,
});

async function fetchTransactions(): Promise<Transaction[] | null> {
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

let inflight: Promise<Transaction[]> | null = null;

/** Loads all records from the backend and refreshes the cache (old local ones are uploaded once). */
export function refreshTransactions(): Promise<Transaction[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    const remote = await fetchTransactions();
    if (remote === null) return readTransactions();
    if (remote.length === 0) {
      const local = readTransactions();
      if (local.length) {
        for (const t of local) {
          try {
            await fetch(endpoint(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: t.id, ...body(t), createdBy: t.createdBy || 'admin' }),
            });
          } catch {
            break;
          }
        }
        const again = await fetchTransactions();
        if (again && again.length) {
          writeTransactions(again);
          return again;
        }
        return local;
      }
    }
    writeTransactions(remote);
    return remote;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function saveTransaction(t: Transaction, isNew: boolean): Promise<Transaction> {
  let res: Response;
  try {
    res = await fetch(isNew ? endpoint() : endpoint(`/${encodeURIComponent(t.id)}`), {
      method: isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isNew ? { id: t.id, ...body(t), createdBy: t.createdBy || 'admin' } : body(t)),
    });
  } catch {
    throw new Error('Could not reach the server. The record was not saved.');
  }
  if (!res.ok) throw new Error(await apiError(res, 'Could not save the record.'));
  const j = await res.json().catch(() => null);
  const saved = normalize((j?.data ?? j ?? t) as Raw);
  writeTransactions([saved, ...readTransactions().filter((x) => x.id !== saved.id && x.id !== t.id)]);
  return saved;
}

/** Admin sees every record (including the main/seed data). Everyone else sees only the records they added. */
export function visibleTransactions(all: Transaction[]): Transaction[] {
  const s = readSession();
  if (!s || s.role === 'admin') return all;
  return all.filter((t) => t.createdBy === s.username);
}

export function currentUsername(): string {
  return readSession()?.username ?? 'admin';
}
