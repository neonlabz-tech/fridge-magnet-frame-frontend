import { DEMO_SESSION_KEY, readDemoTeams, type DemoSession } from '@/lib/demoAuth';
import { apiV1Url } from '@/lib/backendUrl';

export const LEADS_KEY = 'magnify-crm-leads';
export const TARGETS_KEY = 'magnify-crm-targets';
const CHANNEL = 'magnify-crm';

export const SOURCES = ['Google Maps', 'Referral', 'Facebook', 'Instagram', 'Walk-in', 'Other'] as const;
export const CALL_STATUSES = ['Not Contacted', 'Answered', 'No Answer'] as const;
export const RESULTS = ['Callback', 'Order Discussion', 'No Response', 'Interested', 'Converted'] as const;
export const LEAD_STATUSES = ['New', 'Connected', 'Follow Up', 'Converted', 'Lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface FollowUp {
  n: number; // 0 = system entry (reassign etc.)
  at: string; // ISO
  by: string; // username or 'admin'
  callStatus: string;
  result: string;
  product: string;
  notes: string;
  nextFollowUp: string;
  system?: boolean;
  edits?: { at: string; by: string; before: string }[]; // audit trail for edited records
}

export interface OrderInfo {
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
  address: string;
  phone: string;
  convertedAt: string;
}

export interface Lead {
  id: string; // ML001
  dateAdded: string; // ISO
  business: string;
  phone: string;
  source: string;
  callStatus: string;
  result: string;
  product: string;
  status: LeadStatus;
  nextFollowUp: string; // ISO or ''
  owner: string; // username or ''
  email: string;
  address: string;
  notes: string;
  history: FollowUp[];
  customerId?: string;
  order?: OrderInfo;
}

export interface Target {
  monthlyOrders: number;
  salesAmount: number;
  dailyCalls: number;
  dailyLeads: number;
}
export const DEFAULT_TARGET: Target = { monthlyOrders: 0, salesAmount: 0, dailyCalls: 0, dailyLeads: 0 };

/* ---------- storage ---------- */
function bc(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

export function readLeads(): Lead[] {
  try {
    const raw = localStorage.getItem(LEADS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return (parsed as Lead[]).map((l) => ({
      ...l,
      email: l.email ?? '',
      address: l.address ?? '',
      notes: l.notes ?? '',
    }));
  } catch (e) {
    console.error('Could not read leads.', e);
  }
  return [];
}

export function writeLeads(leads: Lead[]): void {
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  const ch = bc();
  ch?.postMessage('leads');
  ch?.close();
}

export function readTargets(): Record<string, Target> {
  try {
    const raw = localStorage.getItem(TARGETS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Target>) : {};
  } catch {
    return {};
  }
}

export function writeTargets(t: Record<string, Target>): void {
  localStorage.setItem(TARGETS_KEY, JSON.stringify(t));
  const ch = bc();
  ch?.postMessage('targets');
  ch?.close();
}

/* ---------- backend (MongoDB) ----------
 * Leads and targets live in the backend. localStorage is only a read cache so the sync
 * readers (reports, finance, overview) keep working and the page shows something offline. */
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const LEADS_MIGRATED_KEY = 'magnify-crm-leads-migrated';
const TARGETS_MIGRATED_KEY = 'magnify-crm-targets-migrated';

/** Cache write without a cross-tab ping (so refreshes do not trigger each other). */
function cacheLeads(leads: Lead[]): void {
  try {
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  } catch (e) {
    console.error('Could not cache leads.', e);
  }
}
function cacheTargets(t: Record<string, Target>): void {
  try {
    localStorage.setItem(TARGETS_KEY, JSON.stringify(t));
  } catch (e) {
    console.error('Could not cache targets.', e);
  }
}

const flag = (k: string) => {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};
const setFlag = (k: string) => {
  try {
    localStorage.setItem(k, '1');
  } catch {}
};

const normalizeLead = (r: Partial<Lead>): Lead => ({
  id: String(r.id ?? ''),
  dateAdded: String(r.dateAdded ?? ''),
  business: String(r.business ?? ''),
  phone: String(r.phone ?? ''),
  source: String(r.source ?? ''),
  callStatus: String(r.callStatus ?? 'Not Contacted'),
  result: String(r.result ?? ''),
  product: String(r.product ?? ''),
  status: (LEAD_STATUSES as readonly string[]).includes(String(r.status)) ? (r.status as LeadStatus) : 'New',
  nextFollowUp: String(r.nextFollowUp ?? ''),
  owner: String(r.owner ?? ''),
  email: String(r.email ?? ''),
  address: String(r.address ?? ''),
  notes: String(r.notes ?? ''),
  history: Array.isArray(r.history) ? (r.history as FollowUp[]) : [],
  ...(r.customerId ? { customerId: String(r.customerId) } : {}),
  ...(r.order ? { order: r.order as OrderInfo } : {}),
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
export async function fetchLeads(): Promise<Lead[] | null> {
  try {
    const res = await fetch(apiV1Url('/leads'), { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    const list: Partial<Lead>[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
    return list.map(normalizeLead);
  } catch {
    return null;
  }
}

/** Fields the backend accepts when saving a lead (id and dateAdded never change). */
const leadBody = (l: Lead) => ({
  business: l.business,
  phone: l.phone,
  source: l.source,
  callStatus: l.callStatus,
  result: l.result,
  product: l.product,
  status: l.status,
  nextFollowUp: l.nextFollowUp,
  owner: l.owner,
  email: l.email,
  address: l.address,
  notes: l.notes,
  history: l.history,
  ...(l.customerId ? { customerId: l.customerId } : {}),
  ...(l.order ? { order: l.order } : {}),
});

let leadsInflight: Promise<Lead[]> | null = null;

/** Loads leads from the backend into the cache. Old local leads are uploaded once. */
export function refreshLeads(): Promise<Lead[]> {
  if (leadsInflight) return leadsInflight;
  leadsInflight = (async () => {
    const remote = await fetchLeads();
    if (remote === null) return readLeads();
    if (!flag(LEADS_MIGRATED_KEY)) {
      const local = readLeads();
      if (remote.length === 0 && local.length) {
        for (const l of [...local].reverse()) {
          try {
            await fetch(apiV1Url('/leads'), {
              method: 'POST',
              headers: JSON_HEADERS,
              body: JSON.stringify({ id: l.id, dateAdded: l.dateAdded, ...leadBody(l) }),
            });
          } catch {
            break;
          }
        }
        const again = await fetchLeads();
        if (again) {
          setFlag(LEADS_MIGRATED_KEY);
          cacheLeads(again);
          return again;
        }
        return local;
      }
      setFlag(LEADS_MIGRATED_KEY);
    }
    cacheLeads(remote);
    return remote;
  })().finally(() => {
    leadsInflight = null;
  });
  return leadsInflight;
}

/** Applies the difference between two lead lists to the backend (create / update / delete). Throws on failure. */
export async function syncLeads(before: Lead[], after: Lead[]): Promise<void> {
  const old = new Map(before.map((l) => [l.id, l]));
  const kept = new Set(after.map((l) => l.id));
  const call = async (url: string, method: string, body: unknown, fallback: string) => {
    let res: Response;
    try {
      res = await fetch(url, { method, headers: JSON_HEADERS, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new Error('Could not reach the server. Changes were not saved.');
    }
    if (!res.ok && !(method === 'DELETE' && res.status === 404)) throw new Error(await apiError(res, fallback));
  };

  for (const l of [...after].reverse()) {
    const prev = old.get(l.id);
    if (!prev) {
      await call(apiV1Url('/leads'), 'POST', { id: l.id, dateAdded: l.dateAdded, ...leadBody(l) }, 'Could not save lead.');
    } else if (JSON.stringify(leadBody(prev)) !== JSON.stringify(leadBody(l))) {
      await call(apiV1Url(`/leads/${encodeURIComponent(l.id)}`), 'PATCH', leadBody(l), 'Could not save lead.');
    }
  }
  for (const l of before) {
    if (!kept.has(l.id)) await call(apiV1Url(`/leads/${encodeURIComponent(l.id)}`), 'DELETE', undefined, 'Could not delete lead.');
  }
  cacheLeads(after);
  const ch = bc();
  ch?.postMessage('leads');
  ch?.close();
}

/** Uploads imported leads in chunks. Leads whose ID already exists in the database are skipped. */
export async function importLeads(
  leads: Lead[],
  onProgress?: (done: number, total: number) => void
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  const SIZE = 100;
  for (let i = 0; i < leads.length; i += SIZE) {
    const chunk = leads.slice(i, i + SIZE).map((l) => ({
      ...(l.id ? { id: l.id } : {}),
      dateAdded: l.dateAdded,
      ...leadBody(l),
    }));
    let res: Response;
    try {
      res = await fetch(apiV1Url('/leads/import'), {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ leads: chunk }),
      });
    } catch {
      throw new Error(`Could not reach the server. ${created} lead(s) were imported before it stopped.`);
    }
    if (!res.ok) throw new Error(`${await apiError(res, 'Import failed.')} (${created} lead(s) imported before it stopped.)`);
    const j = await res.json().catch(() => null);
    created += Number(j?.created ?? 0);
    skipped += Number(j?.skipped ?? 0);
    onProgress?.(Math.min(i + SIZE, leads.length), leads.length);
  }
  const fresh = await fetchLeads();
  if (fresh) {
    cacheLeads(fresh);
    const ch = bc();
    ch?.postMessage('leads');
    ch?.close();
  }
  return { created, skipped };
}

export async function fetchTargets(): Promise<Record<string, Target> | null> {
  try {
    const res = await fetch(apiV1Url('/leads/targets'), { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    const raw: Record<string, Partial<Target>> = j?.data && typeof j.data === 'object' ? j.data : {};
    return Object.fromEntries(
      Object.entries(raw).map(([u, t]) => [
        u,
        {
          monthlyOrders: Number(t.monthlyOrders ?? 0),
          salesAmount: Number(t.salesAmount ?? 0),
          dailyCalls: Number(t.dailyCalls ?? 0),
          dailyLeads: Number(t.dailyLeads ?? 0),
        },
      ])
    );
  } catch {
    return null;
  }
}

async function putTarget(username: string, t: Target): Promise<Response> {
  return fetch(apiV1Url(`/leads/targets/${encodeURIComponent(username)}`), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(t),
  });
}

let targetsInflight: Promise<Record<string, Target>> | null = null;

export function refreshTargets(): Promise<Record<string, Target>> {
  if (targetsInflight) return targetsInflight;
  targetsInflight = (async () => {
    const remote = await fetchTargets();
    if (remote === null) return readTargets();
    if (!flag(TARGETS_MIGRATED_KEY)) {
      const local = readTargets();
      if (Object.keys(remote).length === 0 && Object.keys(local).length) {
        for (const [u, t] of Object.entries(local)) await putTarget(u, t).catch(() => null);
        const again = await fetchTargets();
        if (again) {
          setFlag(TARGETS_MIGRATED_KEY);
          cacheTargets(again);
          return again;
        }
        return local;
      }
      setFlag(TARGETS_MIGRATED_KEY);
    }
    cacheTargets(remote);
    return remote;
  })().finally(() => {
    targetsInflight = null;
  });
  return targetsInflight;
}

export async function saveTarget(username: string, t: Target): Promise<void> {
  let res: Response;
  try {
    res = await putTarget(username, t);
  } catch {
    throw new Error('Could not reach the server. Targets were not saved.');
  }
  if (!res.ok) throw new Error(await apiError(res, 'Could not save targets.'));
  writeTargets({ ...readTargets(), [username]: t });
}

/** Re-fetch triggers: other tabs, tab focus/visibility, reconnect, and a 30s fallback poll. */
export function subscribeCrm(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === LEADS_KEY || e.key === TARGETS_KEY) cb();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') cb();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener('online', cb);
  window.addEventListener('focus', cb);
  document.addEventListener('visibilitychange', onVisible);
  const ch = bc();
  if (ch) ch.onmessage = cb;
  const timer = window.setInterval(cb, 30000);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('online', cb);
    window.removeEventListener('focus', cb);
    document.removeEventListener('visibilitychange', onVisible);
    ch?.close();
    window.clearInterval(timer);
  };
}

/* ---------- helpers ---------- */
export function readSession(): DemoSession | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
}

export interface CrmUser {
  username: string;
  name: string;
  active: boolean;
}
export function readCrmUsers(): CrmUser[] {
  try {
    return readDemoTeams()
      .flatMap((t) => t.members)
      .map((m) => ({ username: m.username, name: m.name, active: m.status === 'Active' }));
  } catch {
    return [];
  }
}

export const nextLeadId = (leads: Lead[]) => {
  const max = leads.reduce((m, l) => Math.max(m, Number(l.id.replace(/\D/g, '')) || 0), 0);
  return `ML${String(max + 1).padStart(3, '0')}`;
};
export const nextCustomerId = (leads: Lead[]) => {
  const max = leads.reduce((m, l) => Math.max(m, Number(l.customerId?.replace(/\D/g, '')) || 0), 0);
  return `CL-${String(max + 1).padStart(3, '0')}`;
};

export const sameDay = (iso: string, d = new Date()) => {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
};
export const sameMonth = (iso: string, d = new Date()) => {
  const x = new Date(iso);
  return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
};

export interface UserMetrics {
  leads: number;
  pendingFollowUps: number;
  callsToday: number;
  answeredToday: number;
  leadsToday: number;
  convertedMonth: number;
  salesMonth: number;
  dueToday: number;
}
export function metricsFor(leads: Lead[], username: string): UserMetrics {
  const mine = leads.filter((l) => l.owner === username);
  const calls = leads.flatMap((l) => l.history).filter((h) => !h.system && h.by === username && sameDay(h.at));
  const eod = new Date();
  eod.setHours(23, 59, 59, 999);
  const converted = mine.filter((l) => l.status === 'Converted' && l.order && sameMonth(l.order.convertedAt));
  return {
    leads: mine.length,
    pendingFollowUps: mine.filter((l) => l.status === 'Follow Up' || l.status === 'Connected').length,
    callsToday: calls.length,
    answeredToday: calls.filter((h) => h.callStatus === 'Answered').length,
    leadsToday: mine.filter((l) => sameDay(l.dateAdded)).length,
    convertedMonth: converted.length,
    salesMonth: converted.reduce((s, l) => s + (l.order?.total ?? 0), 0),
    dueToday: mine.filter((l) => l.status !== 'Converted' && l.status !== 'Lost' && l.nextFollowUp && new Date(l.nextFollowUp) <= eod).length,
  };
}
