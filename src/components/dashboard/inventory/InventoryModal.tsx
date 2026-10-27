'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, Plus, Calculator, FileText, Layers, History, Square } from 'lucide-react';
import { type InventoryItem, type StockReason, STOCK_REASONS, getInventoryStatus } from '@/types/inventory';
import {
  ModalShell,
  TableFooter,
  inputCls,
  labelCls,
  btnGhost,
  btnPrimary,
  lkr,
} from '@/components/dashboard/shared/UiKit';

export type InventoryModalMode = 'add' | 'edit' | 'view';

interface Props {
  mode: InventoryModalMode | null;
  item: InventoryItem | null;
  nextId: string;
  onClose: () => void;
  onSave: (item: InventoryItem, isNew: boolean) => void | Promise<void>;
}

const ROLE_STYLE: Record<string, string> = {
  'Admin/Director': 'bg-blue-50 text-blue-600 border-blue-100',
  'Warehouse Lead': 'bg-amber-50 text-amber-600 border-amber-100',
  'Purchasing Manager': 'bg-violet-50 text-violet-600 border-violet-100',
};

const idBadge = (id: string) => (
  <span className="ml-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-xs font-semibold text-[#64748B]">
    {id}
  </span>
);

export default function InventoryModal({ mode, item, nextId, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);
  const [showLog, setShowLog] = useState(false);
  const [reason, setReason] = useState<StockReason>('Correction');
  const logRef = useRef<HTMLDivElement>(null);

  const open = mode !== null;

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setStock(item ? String(item.stock) : '');
    setUnit(item ? String(item.unitValue) : '');
    setError(null);
    setLogPage(1);
    setShowLog(false);
    setReason('Correction');
  }, [open, item]);

  useEffect(() => {
    if (showLog) logRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [showLog]);

  const stockNum = Number(stock) || 0;
  const unitNum = Number(unit) || 0;
  const total = stockNum * unitNum;

  const save = () => {
    if (!name.trim()) return setError('Item name is required.');
    if (stock === '' || unit === '') return setError('Stock and unit value are required.');
    if (stockNum < 0 || unitNum < 0) return setError('Values cannot be negative.');

    const now = new Date().toISOString();
    if (mode === 'add') {
      onSave(
        {
          id: nextId,
          name: name.trim(),
          stock: stockNum,
          unitValue: unitNum,
          history: [{ at: now, role: 'Admin/Director', change: stockNum, totalValue: total, reason: 'Initial Stock' }],
        },
        true
      );
      return;
    }
    if (item) {
      const diff = stockNum - item.stock;
      onSave(
        {
          ...item,
          name: name.trim(),
          stock: stockNum,
          unitValue: unitNum,
          history:
            diff !== 0 ? [{ at: now, role: 'Admin/Director', change: diff, totalValue: total, reason }, ...item.history] : item.history,
        },
        false
      );
    }
  };

  /* ---------- VIEW ---------- */
  if (mode === 'view' && item) {
    const status = getInventoryStatus(item.stock);
    const LOG_SIZE = 3;
    const logRows = item.history.slice((logPage - 1) * LOG_SIZE, logPage * LOG_SIZE);
    return (
      <ModalShell
        open
        onClose={onClose}
        icon={<Eye size={18} />}
        title="Item Details"
        subtitle="Comprehensive specifications, dimensions, and current stock status."
        maxWidth="max-w-xl"
        footer={
          <button type="button" className={btnGhost} onClick={onClose}>
            Close
          </button>
        }
      >
        <p className="mb-3 mt-1 text-xs font-semibold text-[#2563EB]">{item.id}</p>

        <div className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] p-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#ECFEFF] text-[#0891B2]">
            <Square size={18} />
          </span>
          <p className="flex-1 text-sm font-bold text-[#0F172A]">{item.name}</p>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              status === 'in-stock'
                ? 'bg-emerald-50 text-emerald-600'
                : status === 'low-stock'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-rose-50 text-rose-600'
            }`}
          >
            ●{' '}
            {status === 'in-stock' ? 'In Stock' : status === 'low-stock' ? 'Low Stock' : 'Out of Stock'} •{' '}
            {item.stock} Units
          </span>
        </div>

        <h3 className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748B]">
          <Layers size={13} /> Stock &amp; Valuation Details
        </h3>
        <div className="rounded-xl border border-[#E2E8F0] p-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-[#94A3B8]">Current Quantity</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-600">{item.stock} units</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Unit Value</p>
              <p className="mt-0.5 text-sm font-bold text-[#0F172A]">{lkr(item.unitValue)}</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Total Stock Value</p>
              <p className="mt-0.5 text-sm font-bold text-[#0F172A]">{lkr(item.stock * item.unitValue)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#EFF6FF] px-3 py-2.5">
            <p className="flex items-center gap-2 text-xs text-[#64748B]">
              <Calculator size={14} className="text-[#2563EB]" /> Valuation calc:{' '}
              <span className="font-semibold text-[#2563EB]">
                {item.stock} units × {lkr(item.unitValue)}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[#2563EB] px-3 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
            >
              <FileText size={12} /> {showLog ? 'Hide Log' : 'Stock Log'}
            </button>
          </div>
        </div>

        {showLog && (
          <>
        <h3
          className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#64748B]"
        >
          <History size={13} /> Stock History Log
        </h3>
        <div ref={logRef} className="overflow-hidden rounded-xl border border-[#E2E8F0]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['Date & Time', 'User Role', 'Quantity', 'Reason', 'Total Stock Value'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-[#64748B]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {logRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-[#94A3B8]">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                ) : (
                  logRows.map((h, i) => {
                    const d = new Date(h.at);
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2.5">
                          <p className="text-xs font-bold text-[#0F172A]">
                            {d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-[#94A3B8]">
                            {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ROLE_STYLE[h.role]}`}>
                            {h.role}
                          </span>
                        </td>
                        <td className={`px-3 py-2.5 text-xs font-bold ${h.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {h.change >= 0 ? '+' : ''}
                          {h.change} units
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              h.reason === 'Damaged' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {h.reason ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-bold text-[#0F172A]">{lkr(h.totalValue)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <TableFooter page={logPage} pageSize={LOG_SIZE} total={item.history.length} noun="records" onPage={setLogPage} />
        </div>
          </>
        )}
      </ModalShell>
    );
  }

  /* ---------- ADD / EDIT ---------- */
  const isAdd = mode === 'add';
  return (
    <ModalShell
      open={open && mode !== 'view'}
      onClose={onClose}
      icon={isAdd ? <ArrowLeft size={18} /> : <ArrowLeft size={18} />}
      title={isAdd ? 'Add New Item' : 'Edit Item'}
      subtitle={
        isAdd
          ? 'Enter inventory item specifications, material category, and stock details.'
          : 'Update inventory item specifications, dimensions, and stock details.'
      }
      maxWidth="max-w-xl"
      footer={
        <>
          {error && <span className="mr-auto text-xs font-semibold text-rose-600">{error}</span>}
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={save}>
            {isAdd ? (
              <>
                <Plus size={13} /> Add Item to Inventory
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </>
      }
    >
      <p className="mb-3 mt-1 text-xs font-semibold text-[#2563EB]">{isAdd ? nextId : item?.id}</p>

      <label className={labelCls}>
        Item Name <span className="text-rose-500">*</span>
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Custom Cut Mylar Film"
        className={`${inputCls} bg-[#F8FAFC]`}
      />

      <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#475569]">
          <Layers size={13} /> Stock &amp; Inventory Value
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Stock (Units) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="100"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Unit Value (LKR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#94A3B8]">
                LKR
              </span>
              <input
                type="number"
                min={0}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="350"
                className={`${inputCls} pl-11`}
              />
            </div>
          </div>
        </div>

        {!isAdd && item && stockNum !== item.stock && (
          <div className="mt-3">
            <label className={labelCls}>
              Reason for change ({stockNum - item.stock > 0 ? '+' : ''}
              {stockNum - item.stock} units) <span className="text-rose-500">*</span>
            </label>
            <select value={reason} onChange={(e) => setReason(e.target.value as StockReason)} className={inputCls}>
              {STOCK_REASONS.filter((r) => r !== 'Initial Stock').map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#2563EB] text-white">
            <Calculator size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#0F172A]">Calculated Total Stock Value</p>
            <p className="text-xs text-[#64748B]">
              {stockNum} units × {lkr(unitNum)}
            </p>
          </div>
          <p className="text-sm font-bold text-[#2563EB]">{lkr(total)}</p>
        </div>
      </div>
    </ModalShell>
  );
}
