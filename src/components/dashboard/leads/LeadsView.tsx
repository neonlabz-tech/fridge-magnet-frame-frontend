'use client';

import { canDo } from '@/lib/roles';
import StatCard from '@/components/dashboard/shared/StatCard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckSquare, X, FileText, CheckCircle2, Eye, FileUp, Pencil, Plus, Search, Trash2, Users, CalendarClock, ListChecks } from 'lucide-react';
import type { DemoSession } from '@/lib/demoAuth';
import { useToastStore } from '@/store/toastStore';
import type { Order } from '@/types/order';
import { ConfirmModal, TableFooter, btnGhost, btnPrimary, inputCls } from '@/components/dashboard/shared/UiKit';
import { Skeleton } from '@/components/dashboard/shared/Skeleton';
import DirectOrderModal from '@/components/dashboard/orders/DirectOrderModal';
import {
  CLOSED_STATUSES,
  SOURCES,
  displayPerson,
  isInProgress,
  samePhone,
  nextCustomerId,
  nextLeadId,
  salesOf,
  readCrmUsers,
  readLeads,
  readSession,
  refreshLeads,
  subscribeCrm,
  syncLeads,
  type CrmUser,
  LEAD_STATUSES,
  type Lead,
} from '@/lib/crm';
import { refreshTeam } from '@/lib/teamApi';
import LeadProfileModal, { type ProfileSave } from './LeadProfileModal';
import ImportLeadsModal from './ImportLeadsModal';
import { downloadReportPdf } from '@/components/dashboard/reports/reportPdf';

const PAGE_SIZE = 8;
const STATUS_TONE: Record<string, string> = {
  New: 'bg-blue-50 text-blue-600',
  Connected: 'bg-violet-50 text-violet-600',
  Lost: 'bg-slate-100 text-slate-500',
  'Follow Up': 'bg-amber-50 text-amber-600',
  Interested: 'bg-sky-50 text-sky-600',
  'Not interested': 'bg-slate-100 text-slate-500',
  'Call back': 'bg-orange-50 text-orange-600',
  'Order discussion': 'bg-indigo-50 text-indigo-600',
  'No response': 'bg-rose-50 text-rose-500',
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
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [ready, setReady] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [owner, setOwner] = useState('all');
  const [source, setSource] = useState('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'custom'>('all');
  const [from, setFrom] = useState(toInput(new Date()));
  const [to, setTo] = useState(toInput(new Date()));
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

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
    setUsers(readCrmUsers());
    setReady(true);
    // Cached copy shown first; the backend copy replaces it as soon as it answers.
    Promise.all([refreshLeads(), refreshTeam()]).then(([l]) => {
      setLeads(l);
      setUsers(readCrmUsers());
    });
  }, []);

  useEffect(() => {
    reload();
    return subscribeCrm(reload);
  }, [reload]);

  /* Admin sees every lead. A team member only sees the leads assigned to them
     (the full list is still loaded so a duplicate phone number and the next lead ID are checked against everyone's leads). */
  const visible = useMemo(() => (isAdmin ? leads : leads.filter((l) => l.owner.toLowerCase() === me.toLowerCase())), [leads, isAdmin, me]);
  const downloadPdf = () => {
    const today = new Date().toISOString().slice(0, 10);
    void downloadReportPdf({
      title: 'Leads List',
      period: `${filtered.length} lead${filtered.length === 1 ? '' : 's'} - ${today}`,
      fileName: `leads-${today}.pdf`,
      blocks: [
        {
          type: 'table',
          columns: [
            { header: 'Lead ID', w: 1.3 },
            { header: 'Phone', w: 1.8 },
            { header: 'Customer', w: 2.2 },
            { header: 'Date', w: 1.6 },
            { header: 'Source', w: 1.5 },
            { header: 'Status', w: 1.6 },
            { header: 'Call status', w: 1.6 },
            { header: 'Next follow-up', w: 1.8 },
          ],
          rows: filtered.map((l) => [
            l.id,
            l.phone,
            l.business || '-',
            l.dateAdded ? fmtDate(l.dateAdded) : '-',
            l.source || '-',
            l.status,
            l.history.some((h) => !h.system) ? l.callStatus : '-',
            l.nextFollowUp ? fmt(l.nextFollowUp) : '-',
          ]),
          empty: 'No leads to export.',
        },
      ],
    });
  };

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
      // Newest lead first (by date added, then by lead number).
      .sort((a, b) => {
        const byDate = (Date.parse(b.dateAdded) || 0) - (Date.parse(a.dateAdded) || 0);
        return byDate || (Number(b.id.replace(/\D/g, '')) || 0) - (Number(a.id.replace(/\D/g, '')) || 0);
      });
  }, [visible, search, status, source, owner, dateRange, from, to]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const rows = showAll ? filtered : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Bulk delete (admin only): only leads that are still in the filtered list count as selected.
  const canBulk = isAdmin && canDo('/dashboard/leads', 'delete');
  const filteredIds = new Set(filtered.map((l) => l.id));
  const chosen = selected.filter((id) => filteredIds.has(id));
  const allRowsChosen = rows.length > 0 && rows.every((l) => chosen.includes(l.id));
  const toggleRows = () =>
    setSelected((prev) => (allRowsChosen ? prev.filter((id) => !rows.some((l) => l.id === id)) : [...new Set([...prev, ...rows.map((l) => l.id)])]));
  const toggleOne = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const eod = new Date();
  eod.setHours(23, 59, 59, 999);
  const stats = [
    { label: 'Visible Leads', value: visible.length, icon: Users, tone: 'bg-blue-50 text-[#2563EB]' },
    { label: 'Follow Ups', value: visible.filter((l) => isInProgress(l.status)).length, icon: ListChecks, tone: 'bg-amber-50 text-amber-500' },
    { label: 'Due Today', value: visible.filter((l) => !CLOSED_STATUSES.includes(l.status) && l.nextFollowUp && new Date(l.nextFollowUp) <= eod).length, icon: CalendarClock, tone: 'bg-rose-50 text-rose-500' },
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
        addedBy: me || 'admin',
        email: '',
        address: '',
        notes: '',
        history: [],
      },
    });
  };

  const saveProfile = async ({ lead: v, converting }: ProfileSave) => {
    const isNew = profile?.isNew;
    // A phone number can only belong to one lead (checked against the latest data).
    const latest = await refreshLeads();
    const clash = latest.find((l) => l.id !== v.id && samePhone(l.phone, v.phone));
    if (clash) {
      addToast(`This phone number is already added in lead ${clash.id}.`, 'error');
      return;
    }
    const now = new Date().toISOString();
    const converted: { lead: Lead | null } = { lead: null };
    const ok = await mutate((all) => {
      if (isNew) {
        const id = all.some((l) => l.id === v.id) ? nextLeadId(all) : v.id;
        let lead: Lead = { ...v, id, owner: isAdmin ? v.owner : me, addedBy: v.addedBy || me || 'admin' };
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
    // A lead that was just converted opens the Direct Order popup with the client's details.
    if (converted.lead) setOrderFor(converted.lead);
  };

  /** Records the order just created for a client on the lead, so it counts towards sales, targets and commission. */
  const recordSale = async (leadId: string, o: Order) => {
    const items = o.items ?? [];
    const qty = items.reduce((n, it) => n + (Number(it.quantity) || 0), 0) || Number(o.qty) || 0;
    const total = items.reduce((n, it) => n + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0) || Number(o.subtotal) || 0;
    const product = items.map((it) => it.name).filter(Boolean).join(', ');
    if (!qty || !total) return;
    const now = new Date();
    await mutate((all) =>
      all.map((l) => {
        if (l.id !== leadId) return l;
        const sale = { product, quantity: qty, unitPrice: Math.round(total / qty), total, address: l.address, phone: l.phone, convertedAt: now.toISOString() };
        return { ...l, order: sale, sales: [...salesOf(l), sale] };
      })
    );
  };

  const applySale = (l: Lead, all: Lead[]): Lead => {
    const n = l.history.filter((h) => !h.system).length + 1;
    const now = new Date().toISOString();
    return {
      ...l,
      // The person who converts the lead gets the sale (and the commission).
      owner: isAdmin ? l.owner : me || l.owner,
      status: 'Converted',
      result: 'Converted',
      callStatus: 'Answered',
      nextFollowUp: '',
      customerId: l.customerId ?? nextCustomerId(all),
      history: [...l.history, { n, at: now, by: me || 'admin', callStatus: 'Answered', result: 'Converted', product: l.product, notes: 'Lead converted to a client.', nextFollowUp: '' }],
    };
  };


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
          {isAdmin ? 'Add and assign leads and monitor the whole team.' : 'Add your own leads or work the ones assigned to you: call, update the result, schedule follow-ups and convert to sales.'}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon, tone }) => (
          <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />
        ))}
      </div>

      {(
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
            {isAdmin && canDo('/dashboard/leads', 'create') && <button type="button" onClick={() => setImportOpen(true)} className={btnGhost}><FileUp size={14} /> Import CSV</button>}
            {isAdmin && <button type="button" onClick={downloadPdf} className={btnGhost}><FileText size={14} /> Download PDF</button>}
            {canDo('/dashboard/leads', 'create') && <button type="button" onClick={openNew} className={btnPrimary}><Plus size={14} /> Add Lead</button>}
          </div>

          {/* With "All" the table scrolls inside its own box so the pagination bar stays in view. */}
          <div className={`overflow-x-auto ${showAll ? 'max-h-[65vh] overflow-y-auto' : ''}`}>
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  {canBulk && (
                    <th className="sticky top-0 z-10 w-10 bg-[#F8FAFC] px-4 py-3">
                      <input type="checkbox" aria-label="Select all leads on this page" checked={allRowsChosen} onChange={toggleRows} className="size-4 accent-[#2563EB]" />
                    </th>
                  )}
                  {['#', 'Lead ID', 'Phone / Customer', 'Date Added', 'Source', 'Status', 'Call status', 'Next follow-up', 'Follow-ups', 'Person', 'Actions'].map((h) => (
                    <th key={h} className="sticky top-0 z-10 bg-[#F8FAFC] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {rows.length === 0 ? (
                  <tr><td colSpan={canBulk ? 12 : 11} className="py-14 text-center text-xs text-[#94A3B8]">{filtered.length === 0 && visible.length > 0 ? 'No leads match the selected filters.' : isAdmin ? 'No leads match. Click "Add Lead" to create one.' : 'No leads yet. Click "Add Lead" to create one.'}</td></tr>
                ) : (
                  rows.map((l, idx) => {
                    const overdue = !CLOSED_STATUSES.includes(l.status) && l.nextFollowUp && new Date(l.nextFollowUp) < new Date();
                    const records = l.history.filter((h) => !h.system);
                    const lastBy = records.length ? records[records.length - 1].by : '';
                    return (
                      <tr key={l.id} className="hover:bg-[#F8FAFC]/80">
                        {canBulk && (
                          <td className="w-10 px-4 py-3">
                            <input type="checkbox" aria-label={`Select ${l.id}`} checked={chosen.includes(l.id)} onChange={() => toggleOne(l.id)} className="size-4 accent-[#2563EB]" />
                          </td>
                        )}
                        <td className="px-4 py-3 text-xs font-semibold text-[#64748B]">{(showAll ? 0 : (safePage - 1) * PAGE_SIZE) + idx + 1}</td>
                        <td className="px-4 py-3"><button type="button" title="Open lead" onClick={() => setProfile({ lead: l, isNew: false })} className="rounded-md bg-[#EFF6FF] px-2 py-1 text-xs font-bold text-[#2563EB] hover:bg-[#DBEAFE] hover:underline">{l.id}</button></td>
                        <td className="px-4 py-3"><p className="text-xs font-bold text-[#0F172A]">{l.phone}</p><p className="text-xs text-[#94A3B8]">{l.business}</p></td>
                        <td className="whitespace-nowrap px-4 py-3"><p className="text-xs font-semibold text-[#0F172A]">{l.dateAdded ? fmtDate(l.dateAdded) : '-'}</p><p className="text-xs text-[#94A3B8]">{l.dateAdded ? fmtTime(l.dateAdded) : ''}</p></td>
                        <td className="px-4 py-3 text-xs text-[#475569]">{l.source}</td>
                        <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[l.status]}`}>{l.status}</span></td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">{records.length ? l.callStatus : '-'}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-xs ${overdue ? 'font-bold text-rose-600' : 'text-[#475569]'}`}>{l.nextFollowUp ? fmt(l.nextFollowUp) : '-'}</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-[#0F172A]">{records.length}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">{lastBy ? displayPerson(lastBy) : <span className="text-[#94A3B8]">-</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button type="button" title={l.status === 'Converted' ? 'View' : 'Edit / follow-up'} aria-label="Open lead" onClick={() => setProfile({ lead: l, isNew: false })} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]">{l.status === 'Converted' || !canDo('/dashboard/leads', 'edit') ? <Eye size={15} /> : <Pencil size={15} />}</button>
                            {isAdmin && canDo('/dashboard/leads', 'delete') && <button type="button" title="Delete" aria-label="Delete lead" onClick={() => setDeleting(l)} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TableFooter
            page={safePage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            noun="leads"
            onPage={(p) => {
              setShowAll(false);
              setPage(p);
            }}
            onAll={() => setShowAll(true)}
            allActive={showAll}
          />
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
        onOrderCreated={(o) => { if (orderFor) void recordSale(orderFor.id, o); }}
      />

      <LeadProfileModal
        open={!!profile}
        lead={profile?.lead ?? null}
        isNew={!!profile?.isNew}
        isAdmin={!!isAdmin}
        me={me}
        users={users}
        leads={leads}
        onClose={() => setProfile(null)}
        onSave={saveProfile}
        onDelete={(l) => { setProfile(null); setDeleting(l); }}
        onNewOrder={canDo('/dashboard/orders', 'create') ? (l) => { setProfile(null); setOrderFor(l); } : undefined}
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

      {/* Bulk actions floating bar (admin): shows when leads are ticked, same style as the Orders page. */}
      {canBulk && chosen.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-1.5rem)] -translate-x-1/2 sm:bottom-6 sm:w-auto">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700 bg-[#071C40] px-4 py-3 text-white shadow-2xl sm:gap-3 sm:px-6">
            <div className="flex items-center gap-2 border-r border-slate-700 pr-2">
              <CheckSquare size={15} className="text-[#38BDF8]" />
              <span className="whitespace-nowrap text-[12px] font-bold text-white">{chosen.length} selected</span>
            </div>
            <button
              type="button"
              disabled={chosen.length === filtered.length}
              onClick={() => setSelected(filtered.map((l) => l.id))}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Select all ({filtered.length})
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/20"
            >
              Unselect all
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-rose-500 px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-rose-600"
            >
              <Trash2 size={12} /> Delete ({chosen.length})
            </button>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="ml-1 flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              title="Close"
              aria-label="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleting}
        title="Delete lead?"
        message={<>Lead <b>{deleting?.id}</b> ({deleting?.business}) and its follow-up history will be removed.</>}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) await mutate((all) => all.filter((l) => l.id !== deleting.id), 'Lead deleted.'); setDeleting(null); }}
      />

      <ConfirmModal
        open={bulkOpen}
        title={`Delete ${chosen.length} lead${chosen.length === 1 ? '' : 's'}?`}
        message={<>The selected <b>{chosen.length}</b> lead{chosen.length === 1 ? '' : 's'} and their follow-up history will be removed. This cannot be undone.</>}
        confirmLabel="Delete"
        onCancel={() => setBulkOpen(false)}
        onConfirm={async () => {
          const ids = new Set(chosen);
          if (ids.size && (await mutate((all) => all.filter((l) => !ids.has(l.id)), `${ids.size} lead${ids.size === 1 ? '' : 's'} deleted.`))) setSelected([]);
          setBulkOpen(false);
        }}
      />
    </div>
  );
}
