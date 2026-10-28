'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Download, Plus, Eye, SquarePen, ChevronDown, Trash2, Boxes, TriangleAlert, CircleX } from 'lucide-react';
import { type InventoryItem, type InventoryStatus, getInventoryStatus } from '@/types/inventory';
import { readInventory, refreshInventory, saveInventoryItem, deleteInventoryItem } from '@/lib/inventoryStore';
import { useToastStore } from '@/store/toastStore';
import { ConfirmModal, TableFooter, downloadCsv, lkr } from '@/components/dashboard/shared/UiKit';
import StatCard from '@/components/dashboard/shared/StatCard';
import InventoryModal, { type InventoryModalMode } from './InventoryModal';

const PAGE_SIZE = 10;

const STATUS_META: Record<InventoryStatus, { label: string; badge: string; num: string }> = {
  'in-stock': { label: 'In Stock', badge: 'border-emerald-100 bg-emerald-50 text-emerald-600', num: 'text-emerald-600' },
  'low-stock': { label: 'Low Stock', badge: 'border-amber-100 bg-amber-50 text-amber-600', num: 'text-amber-500' },
  'out-of-stock': { label: 'Out of Stock', badge: 'border-rose-100 bg-rose-50 text-rose-600', num: 'text-rose-500' },
};

export default function InventoryView() {
  const { addToast } = useToastStore();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setItems(readInventory());
    refreshInventory().then((list) => {
      if (!alive) return;
      setItems(list);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | InventoryStatus>('all');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<InventoryItem | null>(null);
  const [modal, setModal] = useState<{ mode: InventoryModalMode; item: InventoryItem | null } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (status !== 'all' && getInventoryStatus(i.stock) !== status) return false;
      return !q || [i.id, i.name].some((v) => v.toLowerCase().includes(q));
    });
  }, [items, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const lowCount = items.filter((i) => getInventoryStatus(i.stock) === 'low-stock').length;
  const outCount = items.filter((i) => getInventoryStatus(i.stock) === 'out-of-stock').length;
  const nextId = `ITEM-${String(
    items.reduce((max, i) => {
      const n = parseInt(i.id.replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1
  ).padStart(4, '0')}`;

  const stats = [
    { label: 'Total Items', value: items.length, icon: Boxes, tone: 'bg-blue-50 text-[#2563EB]' },
    { label: 'Low Stock Items', value: lowCount, icon: TriangleAlert, tone: 'bg-amber-50 text-amber-500' },
    { label: 'Out of Stock', value: outCount, icon: CircleX, tone: 'bg-rose-50 text-rose-500' },
  ];

  const handleSave = async (item: InventoryItem, isNew: boolean) => {
    try {
      const saved = await saveInventoryItem(item, isNew);
      setItems((prev) => (isNew ? [saved, ...prev.filter((x) => x.id !== saved.id)] : prev.map((x) => (x.id === saved.id ? saved : x))));
      setModal(null);
      addToast(isNew ? `${saved.id} added to inventory.` : `${saved.id} updated.`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save inventory item.', 'error');
    }
  };

  const handleDelete = async () => {
    const target = deleting;
    if (!target) return;
    try {
      await deleteInventoryItem(target.id);
      setItems((prev) => prev.filter((x) => x.id !== target.id));
      addToast(`${target.id} deleted.`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not delete inventory item.', 'error');
    }
    setDeleting(null);
  };

  const handleExport = () => {
    if (!filtered.length) return addToast('No items to export.', 'error');
    downloadCsv('inventory.csv', [
      ['Item ID', 'Item Name', 'Stock', 'Status', 'Unit Value (LKR)', 'Total Value (LKR)'],
      ...filtered.map((i) => [i.id, i.name, i.stock, STATUS_META[getInventoryStatus(i.stock)].label, i.unitValue, i.stock * i.unitValue]),
    ]);
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#071C40] sm:text-[28px]">Inventory</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Track stock levels, manage warehouse and inventory movements.
        </p>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon, tone }) => (
          <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-xs sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by product name, SKU, barcode..."
            className="h-9 w-full rounded-lg border border-transparent bg-[#F1F5F9] pl-9 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
          />
        </div>
        <div className="relative sm:w-36">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as 'all' | InventoryStatus);
              setPage(1);
            }}
            className="h-9 w-full appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 text-xs font-semibold text-[#334155] shadow-xs hover:bg-slate-50 sm:flex-none"
          >
            <Download size={14} className="text-[#64748B]" /> Export
          </button>
          <button
            type="button"
            onClick={() => setModal({ mode: 'add', item: null })}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1D4ED8] sm:flex-none"
          >
            <Plus size={14} strokeWidth={2.5} /> Add Item
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xs">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F8FAFC]">
                {['Item ID', 'Item Name'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    {h}
                  </th>
                ))}
                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#64748B]">Stock</th>
                <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#64748B]">Status</th>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-[#64748B]">Total Value</th>
                <th className="sticky right-0 z-[1] bg-[#F8FAFC] px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#64748B] md:static">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-xs text-[#94A3B8]">
                    {loading ? 'Loading inventory...' : 'No items found.'}
                  </td>
                </tr>
              ) : (
                rows.map((i) => {
                  const st = getInventoryStatus(i.stock);
                  const meta = STATUS_META[st];
                  return (
                    <tr key={i.id} className="hover:bg-[#F8FAFC]/80">
                      <td className="px-5 py-3.5 text-xs font-medium text-[#64748B]">{i.id}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-bold text-[#0F172A]">{i.name}</p>
                      </td>
                      <td className={`px-5 py-3.5 text-center text-xs font-bold ${meta.num}`}>{i.stock}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs font-bold text-[#0F172A]">
                        {i.stock === 0 ? <span className="text-[#94A3B8]">LKR 0</span> : lkr(i.stock * i.unitValue)}
                      </td>
                      <td className="sticky right-0 z-[1] bg-white px-5 py-3.5 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)] md:static md:shadow-none">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            aria-label={`View ${i.name}`}
                            title="View"
                            onClick={() => setModal({ mode: 'view', item: i })}
                            className="flex size-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-blue-50 hover:text-[#2563EB]"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${i.name}`}
                            title="Edit"
                            onClick={() => setModal({ mode: 'edit', item: i })}
                            className="flex size-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-blue-50 hover:text-[#2563EB]"
                          >
                            <SquarePen size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${i.name}`}
                            title="Delete"
                            onClick={() => setDeleting(i)}
                            className="flex size-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TableFooter page={safePage} pageSize={PAGE_SIZE} total={filtered.length} noun="items" onPage={setPage} />
      </div>

      <ConfirmModal
        open={!!deleting}
        title="Delete inventory item?"
        message={<><b>{deleting?.name}</b> ({deleting?.id}) and its stock log will be permanently removed. Products that use this item as a material will lose it from their cost and stock.</>}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
      <InventoryModal
        mode={modal?.mode ?? null}
        item={modal?.item ?? null}
        nextId={nextId}
        onClose={() => setModal(null)}
        onSave={handleSave}
      />
    </>
  );
}
