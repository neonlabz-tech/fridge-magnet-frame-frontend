'use client';

import StatCard from '@/components/dashboard/shared/StatCard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, FileUp, PhoneCall, Pencil, Plus, Search, Trash2, Users, CalendarClock, ListChecks } from 'lucide-react';
import type { DemoSession } from '@/lib/demoAuth';
import { useToastStore } from '@/store/toastStore';
import { ConfirmModal, TableFooter, btnGhost, btnPrimary, inputCls } from '@/components/dashboard/shared/UiKit';
import { Skeleton } from '@/components/dashboard/shared/Skeleton';
import DirectOrderModal from '@/components/dashboard/orders/DirectOrderModal';
import {
  DEFAULT_TARGET,
  SOURCES,
  metricsFor,
  nextCustomerId,
  nextLeadId,
  readCrmUsers,
  readLeads,
  readSession,
  readTargets,
  refreshLeads,
  refreshTargets,
  saveTarget,
  subscribeCrm,
  syncLeads,
  type CrmUser,
  LEAD_STATUSES,
  type Lead,
  type Target,
} from '@/lib/crm';
import { refreshTeam } from '@/lib/teamApi';
import LeadProfileModal, { type ProfileSave } from './LeadProfileModal';
import ImportLeadsModal from './ImportLeadsModal';
import TeamPanel from './TeamPanel';

const PAGE_SIZE = 8;
const STATUS_TONE: Record<string, string> = {
  New: 'bg-blue-50 text-blue-600',
  Connected: 'bg-violet-50 text-violet-600',
  Lost: 'bg-slate-100 text-slate-500',
  'Follow Up': 'bg-amber-50 text-amber-600',
  Converted: 'bg-emerald-50 text-emerald-600',
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
const toInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function LeadsView() {
  const { addToast } = useToastStore();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [ready, setReady] = useState(false);

  const [tab, setTab] = useState<'leads' | 'team'>('leads');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [owner, setOwner] = useState('all');
  const [source, setSource] = useState('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'custom'>('all');
  const [from, setFrom] = useState(toInput(new Date()));
  const [to, setTo] = useState(toInput(new Date()));
  const [page, setPage] = useState(1);

  const [profile, setProfile] = useState<{ lead: Lead; isNew: boolean } | null>(null);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  // Lead that was just converted: opens the Direct Order popup with the client's details.
  const [orderFor, setOrderFor] = useState<Lead | null>(null);

  const isAdmin = session?.role === 'admin';
  const me = session?.username ?? '';

  const reload = useCallback(() => {
    setSession(readSession());
    setLeads(readLeads());
    setTargets(readTargets());
    setUsers(readCrmUsers());
    setReady(true);
    // Cached copy shown first; the backend copy replaces it as soon as it answers.
    Promise.all([refreshLeads(), refreshTargets(), refreshTeam()]).then(([l, t]) => {
      setLeads(l);
      setTargets(t);
      setUsers(readCrmUsers());
    });
  }, []);

  useEffect(() => {
    reload();
    return subscribeCrm(reload);
  }, [reload]);

  /* Each user only ever sees their own leads; admin sees all. */
  const visible = useMemo(() => (isAdmin ? leads : leads.filter((l) => l.owner === me)), [leads, isAdmin, me]);
  const nameOf = (u: string) => (u === 'admin' ? 'Admin' : users.find((x) => x.username === u)?.name ?? u);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    let start: Date | null = null;
    let end: Date | null = null;
    if (dateRange === 'today') {
      start = sod;
      end = new Date(sod.getTime() + 86400000 - 1);
    } else if (dateRange === 'week') {
      start = new Date(sod);
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
      end = new Date(sod.getTime() + 86400000 - 1);
    } else if (dateRange === 'custom') {
      start = from ? new Date(`${from}T00:00:00`) : null;
      end = to ? new Date(`${to}T23:59:59.999`) : null;
    }
    const inDate = (iso: string) => {
      if (!start && !end) return true;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return false;
      return (!start || t >= start.getTime()) && (!end || t <= end.getTime());
    };
    return visible.filter(
      (l) =>
        inDate(l.dateAdded) &&
        (status === 'all' || l.status === status) &&
        (source === 'all' || l.source === source) &&
        (owner === 'all' || (owner === '' ? !l.owner : l.owner === owner)) &&
        (!q || [l.id, l.business, l.phone].some((v) => v.toLowerCase().includes(q)))
    )
      // ML001, ML002, ML003 ... (ascending by lead number)
      .sort((a, b) => (Number(a.id.replace(/\D/g, '')) || 0) - (Number(b.id.replace(/\D/g, '')) || 0));
  }, [visible, search, status, source, owner, dateRange, from, to]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const eod = new Date();
  eod.setHours(23, 59, 59, 999);
  const stats = [
    { label: 'Visible Leads', value: visible.length, icon: Users, tone: 'bg-blue-50 text-[#2563EB]' },
    { label: 'Follow Ups', value: visible.filter((l) => l.status === 'Follow Up' || l.status === 'Connected').length, icon: ListChecks, tone: 'bg-amber-50 text-amber-500' },
    { label: 'Due Today', value: visible.filter((l) => l.status !== 'Converted' && l.status !== 'Lost' && l.nextFollowUp && new Date(l.nextFollowUp) <= eod).length, icon: CalendarClock, tone: 'bg-rose-50 text-rose-500' },
    { label: 'Converted', value: visible.filter((l) => l.status === 'Converted').length, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  ];

  /* ---------- mutations (always re-read from the backend first so other users' edits are not overwritten) ---------- */
  const mutate = async (fn: (all: Lead[]) => Lead[], msg?: string): Promise<boolean> => {
    try {
      const before = await refreshLeads();
      const next = fn(before);
      await syncLeads(before, next);
      setLeads(await refreshLeads());
      if (msg) addToast(msg, 'success');
      return true;
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save changes.', 'error');
      return false;
    }
  };

  const openNew = () => {
    const base = readLeads();
    setProfile({
      isNew: true,
      lead: {
        id: nextLeadId(base),
        dateAdded: new Date().toISOString(),
        business: '',
        phone: '',
        source: SOURCES[0],
        callStatus: 'Not Contacted',
        result: '',
        product: '',
        status: 'New',
        nextFollowUp: '',
        owner: isAdmin ? '' : me,
        email: '',
        address: '',
        notes: '',
        history: [],
      },
    });
  };

  const saveProfile = async ({ lead: v, converting }: ProfileSave) => {
    const isNew = profile?.isNew;
    const now = new Date().toISOString();
    const converted: { lead: Lead | null } = { lead: null };
    const ok = await mutate((all) => {
      if (isNew) {
        const id = all.some((l) => l.id === v.id) ? nextLeadId(all) : v.id;
        let lead: Lead = { ...v, id, owner: isAdmin ? v.owner : me };
        if (converting) {
          lead = applySale(lead, all);
          converted.lead = lead;
        }
        return [lead, ...all];
      }
      return all.map((l) => {
        if (l.id !== v.id) return l;
        let next: Lead = { ...v, owner: isAdmin ? v.owner : l.owner };
        if (isAdmin && v.owner !== l.owner) {
          next = {
            ...next,
            history: [...next.history, { n: 0, at: now, by: 'admin', callStatus: '', result: '', product: '', nextFollowUp: '', system: true, notes: `Reassigned from ${l.owner ? nameOf(l.owner) : 'Unassigned'} to ${v.owner ? nameOf(v.owner) : 'Unassigned'}.` }],
          };
        }
        if (converting) {
          next = applySale(next, all);
          converted.lead = next;
        }
        return next;
      });
    }, isNew ? 'Lead added.' : 'Lead saved.');
    if (!ok) return;
    if (isNew) setPage(1);
    setProfile(null);
    if (converted.lead) setOrderFor(converted.lead);
  };

  const applySale = (l: Lead, all: Lead[]): Lead => {
    const n = l.history.filter((h) => !h.system).length + 1;
    const now = new Date().toISOString();
    return {
      ...l,
      status: 'Converted',
      result: 'Converted',
      callStatus: 'Answered',
      nextFollowUp: '',
      customerId: l.customerId ?? nextCustomerId(all),
      history: [...l.history, { n, at: now, by: me || 'admin', callStatus: 'Answered', result: 'Converted', product: l.product, notes: 'Lead converted to a client.', nextFollowUp: '' }],
    };
  };

  const reassign = async (from: string, to: string) => {
    let moved = 0;
    const ok = await mutate((all) =>
      all.map((l) => {
        if (l.owner !== from || l.status === 'Converted') return l;
        moved += 1;
        return { ...l, owner: to, history: [...l.history, { n: 0, at: new Date().toISOString(), by: 'admin', callStatus: '', result: '', product: '', nextFollowUp: '', system: true, notes: `Reassigned from ${nameOf(from)} to ${nameOf(to)}.` }] };
      })
    );
    if (ok) addToast(`${moved} lead(s) reassigned.`, 'success');
  };

  const setTarget = async (u: string, t: Target) => {
    try {
      await saveTarget(u, t);
      setTargets((prev) => ({ ...prev, [u]: t }));
      addToast('Targets saved.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save targets.', 'error');
    }
  };

  const myMetrics = metricsFor(leads, me);
  const myTarget = targets[me] ?? DEFAULT_TARGET;

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-6 lg:px-8">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="compact-ui relative mx-auto flex w-full max-w-7xl flex-col px-3 pb-6 pt-2 sm:px-6 sm:pt-3 lg:px-8 lg:pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#0F172A]">Leads & Followups</h1>
        <p className="text-xs text-[#64748B]">
          {isAdmin ? 'Add and assign leads, set targets and monitor the whole team.' : 'Add your own leads or work the ones assigned to you: call, update the result, schedule follow-ups and convert to sales.'}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon, tone }) => (
          <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />
        ))}
      </div>

      {!isAdmin && (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ['Calls today', myMetrics.callsToday, myTarget.dailyCalls],
            ['New leads today', myMetrics.leadsToday, myTarget.dailyLeads],
            ['Orders this month', myMetrics.convertedMonth, myTarget.monthlyOrders],
            ['Sales this month (LKR)', myMetrics.salesMonth, myTarget.salesAmount],
          ] as const).map(([l, v, t]) => {
            const p = t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0;
            return (
              <div key={l}>
                <div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-[#64748B]">{l}</span><span className="font-bold text-[#0F172A]">{v.toLocaleString('en-US')} / {t > 0 ? t.toLocaleString('en-US') : 'target not set'}</span></div>
                <div className="h-2 rounded-full bg-[#F1F5F9]"><div className={`h-2 rounded-full ${p >= 100 ? 'bg-emerald-500' : 'bg-[#2563EB]'}`} style={{ width: `${p}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <div className="mb-3 inline-flex w-fit rounded-xl border border-[#E2E8F0] bg-white p-1">
          {([['leads', 'All Leads'], ['team', 'Team & Targets']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`h-9 rounded-lg px-4 text-xs font-bold ${tab === k ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-slate-50'}`}>{l}</button>
          ))}
        </div>
      )}

      {isAdmin && tab === 'team' ? (
        <TeamPanel users={users} leads={leads} targets={targets} onSetTarget={setTarget} onReassign={reassign} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
          <div className="flex flex-col gap-2 border-b border-[#E2E8F0] p-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by lead ID, name or phone..." className={`${inputCls} pl-9`} />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={`${inputCls} lg:w-36`}>
              <option value="all">All Status</option>
              {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className={`${inputCls} lg:w-36`}>
              <option value="all">All Sources</option>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={dateRange} onChange={(e) => { setDateRange(e.target.value as typeof dateRange); setPage(1); }} className={`${inputCls} lg:w-36`}>
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="custom">Custom Range</option>
            </select>
            {dateRange === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={`${inputCls} lg:w-36`} />
                <span className="text-xs text-[#94A3B8]">to</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={`${inputCls} lg:w-36`} />
              </div>
            )}
            {isAdmin && (
              <select value={owner} onChange={(e) => { setOwner(e.target.value); setPage(1); }} className={`${inputCls} lg:w-40`}>
                <option value="all">All Users</option>
                <option value="">Unassigned</option>
                {users.map((u) => <option key={u.username} value={u.username}>{u.name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => setImportOpen(true)} className={btnGhost}><FileUp size={14} /> Import CSV</button>
            <button type="button" onClick={openNew} className={btnPrimary}><Plus size={14} /> Add Lead</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  {['#', 'Lead ID', 'Customer', 'Date Added', 'Source', 'Status', 'Call / Result', 'Next follow-up', ...(isAdmin ? ['Owner'] : []), 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {rows.length === 0 ? (
                  <tr><td colSpan={10} className="py-14 text-center text-xs text-[#94A3B8]">{filtered.length === 0 && visible.length > 0 ? 'No leads match the selected filters.' : isAdmin ? 'No leads match. Click "Add Lead" to create one.' : 'No leads yet. Click "Add Lead" to create one.'}</td></tr>
                ) : (
                  rows.map((l, idx) => {
                    const overdue = l.status !== 'Converted' && l.nextFollowUp && new Date(l.nextFollowUp) < new Date();
                    return (
                      <tr key={l.id} className="hover:bg-[#F8FAFC]/80">
                        <td className="px-4 py-3 text-xs font-semibold text-[#64748B]">{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-4 py-3"><span className="rounded-md bg-[#EFF6FF] px-2 py-1 text-xs font-bold text-[#2563EB]">{l.id}</span></td>
                        <td className="px-4 py-3"><p className="text-xs font-bold text-[#0F172A]">{l.business}</p><p className="text-xs text-[#94A3B8]">{l.phone}</p></td>
                        <td className="whitespace-nowrap px-4 py-3"><p className="text-xs font-semibold text-[#0F172A]">{l.dateAdded ? fmtDate(l.dateAdded) : '-'}</p><p className="text-xs text-[#94A3B8]">{l.dateAdded ? fmtTime(l.dateAdded) : ''}</p></td>
                        <td className="px-4 py-3 text-xs text-[#475569]">{l.source}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[l.status]}`}>{l.status}</span></td>
                        <td className="px-4 py-3"><p className="text-xs font-semibold text-[#0F172A]">{l.callStatus}</p><p className="text-xs text-[#94A3B8]">{l.result || '-'}</p></td>
                        <td className={`whitespace-nowrap px-4 py-3 text-xs ${overdue ? 'font-bold text-rose-600' : 'text-[#475569]'}`}>{l.nextFollowUp ? fmt(l.nextFollowUp) : '-'}</td>
                        {isAdmin && <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">{l.owner ? nameOf(l.owner) : <span className="text-[#94A3B8]">Unassigned</span>}</td>}
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button type="button" title={l.status === 'Converted' ? 'View' : 'Call & follow-up'} aria-label="Open lead" onClick={() => setProfile({ lead: l, isNew: false })} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]">
                              {l.status === 'Converted' ? <Eye size={15} /> : <PhoneCall size={15} />}
                            </button>
                            <button type="button" title="Edit" aria-label="Edit lead" onClick={() => setProfile({ lead: l, isNew: false })} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]"><Pencil size={15} /></button>
                            {isAdmin && <button type="button" title="Delete" aria-label="Delete lead" onClick={() => setDeleting(l)} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TableFooter page={safePage} pageSize={PAGE_SIZE} total={filtered.length} noun="leads" onPage={setPage} />
        </section>
      )}

      <DirectOrderModal
        isOpen={!!orderFor}
        prefill={
          orderFor
            ? {
                name: orderFor.business,
                phone: orderFor.phone,
                email: orderFor.email,
                address: orderFor.address,
                clientId: orderFor.customerId,
                products: orderFor.product.split(',').map((x) => x.trim()).filter(Boolean),
              }
            : null
        }
        onClose={() => setOrderFor(null)}
        onOrderCreated={() => undefined}
      />

      <LeadProfileModal
        open={!!profile}
        lead={profile?.lead ?? null}
        isNew={!!profile?.isNew}
        isAdmin={!!isAdmin}
        me={me}
        users={users}
        onClose={() => setProfile(null)}
        onSave={saveProfile}
        onDelete={(l) => { setProfile(null); setDeleting(l); }}
      />
      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        isAdmin={isAdmin}
        me={me}
        users={users}
        onDone={async (r) => {
          if ('error' in r) {
            addToast(r.error, 'error');
            setLeads(await refreshLeads());
            return;
          }
          setLeads(await refreshLeads());
          setPage(1);
          addToast(`${r.created} lead(s) imported${r.skipped ? `, ${r.skipped} skipped` : ''}.`, 'success');
        }}
      />

      <ConfirmModal
        open={!!deleting}
        title="Delete lead?"
        message={<>Lead <b>{deleting?.id}</b> ({deleting?.business}) and its follow-up history will be removed.</>}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) await mutate((all) => all.filter((l) => l.id !== deleting.id), 'Lead deleted.'); setDeleting(null); }}
      />
    </div>
  );
}
