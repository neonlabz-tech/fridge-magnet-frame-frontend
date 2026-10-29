'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Download,
  Plus,
  Eye,
  Pencil,
  X,
  ChevronDown,
  Package,
  Zap,
  Undo2,
} from 'lucide-react';
import type { Delivery, DeliveryStatus } from '@/types/delivery';
import { readDeliveries, refreshDeliveries, saveDelivery, deleteDelivery } from '@/lib/deliveryStore';
import { useToastStore } from '@/store/toastStore';
import { ConfirmModal, TableFooter, downloadCsv } from '@/components/dashboard/shared/UiKit';
import DeliveryModal, { type DeliveryModalMode } from './DeliveryModal';

const PAGE_SIZE = 8;

const TABS: { value: 'all' | DeliveryStatus; label: string }[] = [
  { value: 'all', label: 'All Deliveries' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
];

const STATUS_STYLE: Record<DeliveryStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-[#EFF6FF] text-[#2563EB]' },
  'in-transit': { label: 'In Transit', cls: 'bg-[#E0F2FE] text-[#0369A1]' },
  delivered: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-600' },
  returned: { label: 'Returned', cls: 'bg-slate-200 text-slate-700' },
};

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full appearance-none rounded-lg border border-transparent bg-[#F1F5F9] pl-3 pr-8 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
      >
        {children}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
    </div>
  );
}

export default function DeliveriesView() {
  const { addToast } = useToastStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    let alive = true;
    setDeliveries(readDeliveries());
    refreshDeliveries().then((list) => alive && setDeliveries(list));
    return () => {
      alive = false;
    };
  }, []);
  const [tab, setTab] = useState<'all' | DeliveryStatus>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ mode: DeliveryModalMode; delivery: Delivery | null } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Delivery | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Only drivers that have actually been assigned to a delivery.
  const driverOptions = useMemo(
    () => Array.from(new Set(deliveries.map((d) => (d.driver || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [deliveries],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deliveries.filter((d) => {
      if (tab !== 'all' && d.status !== tab) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (typeFilter !== 'all' && d.method !== typeFilter) return false;
      if (driverFilter !== 'all' && d.driver !== driverFilter) return false;
      if (!q) return true;
      return [d.id, d.orderId, d.recipient, d.tracking, d.place, d.driver].some((v) =>
        v.toLowerCase().includes(q)
      );
    });
  }, [deliveries, tab, search, statusFilter, typeFilter, driverFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const resetPage = () => setPage(1);

  const handleSave = async (d: Delivery, isNew: boolean) => {
    try {
      const saved = await saveDelivery(d, isNew);
      setDeliveries((prev) => (isNew ? [saved, ...prev.filter((x) => x.id !== saved.id)] : prev.map((x) => (x.id === saved.id ? saved : x))));
      setModal(null);
      addToast(isNew ? `Delivery ${saved.id} dispatched.` : `Delivery ${saved.id} updated.`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save delivery.', 'error');
    }
  };

  const handleSaveMany = async (list: Delivery[]) => {
    const created: Delivery[] = [];
    try {
      for (const d of list) created.push(await saveDelivery(d, true));
      setModal(null);
      addToast(`${created.length} deliveries dispatched.`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save all deliveries.', 'error');
    } finally {
      if (created.length) setDeliveries((prev) => [...created, ...prev.filter((x) => !created.some((c) => c.id === x.id))]);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) return addToast('No deliveries to export.', 'error');
    downloadCsv('deliveries.csv', [
      ['Delivery ID', 'Order ID', 'Type', 'Tracking ID', 'Delivery Person', 'Place', 'Status'],
      ...filtered.map((d) => [d.id, d.orderId, d.method, d.tracking, d.driver || '-', d.place, STATUS_STYLE[d.status].label]),
    ]);
  };

  /* ---------- bulk actions (on the ticked rows) ---------- */
  const chosen = deliveries.filter((d) => selected.has(d.id));
  const clearSelection = () => setSelected(new Set());

  const bulkStatus = async (status: DeliveryStatus) => {
    if (!chosen.length || bulkBusy) return;
    setBulkBusy(true);
    let done = 0;
    try {
      for (const d of chosen) {
        if (d.status === status) continue;
        const saved = await saveDelivery({ ...d, status }, false);
        setDeliveries((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
        done += 1;
      }
      addToast(`${done} deliver${done === 1 ? 'y' : 'ies'} marked ${STATUS_STYLE[status].label}.`, 'success');
      clearSelection();
    } catch (e) {
      addToast(`${e instanceof Error ? e.message : 'Could not update deliveries.'} (${done} updated before it stopped.)`, 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkRemove = async () => {
    setBulkDelete(false);
    if (!chosen.length || bulkBusy) return;
    setBulkBusy(true);
    let done = 0;
    try {
      for (const d of chosen) {
        await deleteDelivery(d.id);
        setDeliveries((prev) => prev.filter((x) => x.id !== d.id));
        done += 1;
      }
      addToast(`${done} deliver${done === 1 ? 'y' : 'ies'} cancelled.`, 'success');
      clearSelection();
    } catch (e) {
      addToast(`${e instanceof Error ? e.message : 'Could not remove deliveries.'} (${done} removed before it stopped.)`, 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const exportChosen = () => {
    downloadCsv('deliveries-selected.csv', [
      ['Delivery ID', 'Order ID', 'Type', 'Tracking ID', 'Delivery Person', 'Place', 'Status'],
      ...chosen.map((d) => [d.id, d.orderId, d.method, d.tracking, d.driver || '-', d.place, STATUS_STYLE[d.status].label]),
    ]);
  };

  const nextSequence =
    deliveries.reduce((max, d) => {
      const n = parseInt(d.id.replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 260913) + 1;

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#071C40] sm:text-[28px]">Deliveries</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Manage deliveries, track shipments and monitor delivery status.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xs">
        {/* Tabs + filters */}
        <div className="space-y-3 p-4">
          <div className="flex gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTab(t.value);
                  resetPage();
                }}
                className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition ${
                  tab === t.value
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="relative lg:w-72">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                placeholder="Search by Order ID, Customer, Tracking..."
                className="h-9 w-full rounded-lg border border-transparent bg-[#F1F5F9] pl-9 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
              />
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex">
              <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); resetPage(); }}>
                <option value="all">All Status</option>
                {Object.entries(STATUS_STYLE).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
              <Select value={typeFilter} onChange={(v) => { setTypeFilter(v); resetPage(); }}>
                <option value="all">All Delivery Types</option>
                <option value="Standard">Standard</option>
                <option value="Courier">Courier</option>
              </Select>
              <Select value={driverFilter} onChange={(v) => { setDriverFilter(v); resetPage(); }}>
                <option value="all">All Drivers</option>
                {driverOptions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2 lg:ml-auto">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 text-xs font-semibold text-[#334155] shadow-xs hover:bg-slate-50 lg:flex-none"
              >
                <Download size={14} className="text-[#64748B]" /> Export
              </button>
              <button
                type="button"
                onClick={() => setModal({ mode: 'create', delivery: null })}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1D4ED8] lg:flex-none"
              >
                <Plus size={14} strokeWidth={2.5} /> Create Delivery
              </button>
            </div>
          </div>
        </div>

        {/* Bulk actions */}
        {chosen.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5">
            <span className="text-xs font-bold text-[#1D4ED8]">{chosen.length} selected</span>
            {filtered.length > chosen.length && (
              <button type="button" onClick={() => setSelected(new Set(filtered.map((d) => d.id)))} className="text-xs font-semibold text-[#2563EB] hover:underline">
                Select all {filtered.length}
              </button>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <select
                disabled={bulkBusy}
                value=""
                onChange={(e) => e.target.value && bulkStatus(e.target.value as DeliveryStatus)}
                className="h-8 rounded-lg border border-[#BFDBFE] bg-white px-2 text-xs font-semibold text-[#334155] disabled:opacity-50"
              >
                <option value="">{bulkBusy ? 'Updating...' : 'Mark as...'}</option>
                {Object.entries(STATUS_STYLE).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button type="button" onClick={exportChosen} disabled={bulkBusy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-white px-3 text-xs font-semibold text-[#334155] hover:bg-slate-50 disabled:opacity-50">
                <Download size={13} /> Export selected
              </button>
              <button type="button" onClick={() => setBulkDelete(true)} disabled={bulkBusy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                <X size={13} /> Cancel selected
              </button>
              <button type="button" onClick={clearSelection} disabled={bulkBusy} className="h-8 rounded-lg px-2 text-xs font-semibold text-[#64748B] hover:underline">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto border-t border-[#E2E8F0]">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F8FAFC]">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        rows.forEach((r) => (e.target.checked ? next.add(r.id) : next.delete(r.id)));
                        return next;
                      })
                    }
                    className="size-4 rounded border-slate-300 accent-[#2563EB]"
                  />
                </th>
                {['Delivery ID', 'Order ID', 'Delivery Type', 'Tracking ID', 'Delivery Person', 'Place', 'Status'].map((h) => (
                  <th key={h} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    {h}
                  </th>
                ))}
                <th className="sticky right-0 z-[1] bg-[#F8FAFC] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B] md:static">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-xs text-[#94A3B8]">
                    No deliveries found.
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const st = STATUS_STYLE[d.status];
                  const canEdit = d.status !== 'delivered';
                  const canCancel = d.status === 'pending' || d.status === 'in-transit';
                  return (
                    <tr key={d.id} className="transition-colors hover:bg-[#F8FAFC]/80">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${d.id}`}
                          checked={selected.has(d.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(d.id)) next.delete(d.id);
                              else next.add(d.id);
                              return next;
                            })
                          }
                          className="size-4 rounded border-slate-300 accent-[#2563EB]"
                        />
                      </td>
                      <td className="px-3 py-3 text-xs font-bold text-[#2563EB]">{d.id}</td>
                      <td className="px-3 py-3 text-xs font-bold text-[#2563EB]">{d.orderId}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#475569]">
                          {d.method === 'Standard' ? <Package size={12} /> : <Zap size={12} />}
                          {d.method}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-bold text-[#0F172A]">{d.tracking}</td>
                      <td className="px-3 py-3 text-xs text-[#475569]">{d.driver || '-'}</td>
                      <td className="px-3 py-3 text-xs text-[#475569]">{d.place}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
                          {d.status === 'returned' && <Undo2 size={11} />}
                          {st.label}
                        </span>
                      </td>
                      <td className="sticky right-0 z-[1] bg-white px-4 py-3 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)] md:static md:shadow-none">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`View ${d.id}`}
                            title="View"
                            onClick={() => setModal({ mode: 'view', delivery: d })}
                            className="flex size-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
                          >
                            <Eye size={14} />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              aria-label={`Edit ${d.id}`}
                              title="Edit"
                              onClick={() => setModal({ mode: 'edit', delivery: d })}
                              className="flex size-8 items-center justify-center rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] hover:bg-blue-100"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              aria-label={`Cancel ${d.id}`}
                              title="Cancel delivery"
                              onClick={() => setCancelTarget(d)}
                              className="flex size-8 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TableFooter page={safePage} pageSize={PAGE_SIZE} total={filtered.length} noun="deliveries" onPage={setPage} />
      </div>

      <DeliveryModal
        mode={modal?.mode ?? null}
        delivery={modal?.delivery ?? null}
        nextSequence={nextSequence}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onSaveMany={handleSaveMany}
        onEditRequest={(d) => setModal({ mode: 'edit', delivery: d })}
      />

      <ConfirmModal
        open={bulkDelete}
        title={`Cancel ${chosen.length} deliveries?`}
        message={<>The {chosen.length} selected deliveries will be removed from the dispatch list.</>}
        confirmLabel="Cancel Deliveries"
        onCancel={() => setBulkDelete(false)}
        onConfirm={bulkRemove}
      />

      <ConfirmModal
        open={Boolean(cancelTarget)}
        title="Cancel this delivery?"
        message={
          <>
            Delivery <span className="font-bold text-[#0F172A]">{cancelTarget?.id}</span> for order{' '}
            {cancelTarget?.orderId} will be removed from the dispatch list.
          </>
        }
        confirmLabel="Cancel Delivery"
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          const target = cancelTarget;
          setCancelTarget(null);
          if (!target) return;
          try {
            await deleteDelivery(target.id);
            setDeliveries((prev) => prev.filter((x) => x.id !== target.id));
            addToast(`Delivery ${target.id} cancelled.`, 'success');
          } catch (e) {
            addToast(e instanceof Error ? e.message : 'Could not remove delivery.', 'error');
          }
        }}
      />
    </>
  );
}
