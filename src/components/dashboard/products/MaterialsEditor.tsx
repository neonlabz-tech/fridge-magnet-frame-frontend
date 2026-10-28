'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { InventoryItem } from '@/types/inventory';
import { inputCls, labelCls } from '@/components/dashboard/shared/UiKit';
import { type Material, materialCost, producibleUnits } from '@/lib/materials';

const lkr = (n: number) => `LKR ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function MaterialsEditor({
  value,
  onChange,
  inventory,
}: {
  value: Material[];
  onChange: (next: Material[]) => void;
  inventory: InventoryItem[];
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const used = new Set(value.map((m) => m.inventoryId));
    const key = q.trim().toLowerCase();
    return inventory
      .filter((i) => !used.has(i.id) && (!key || `${i.id} ${i.name}`.toLowerCase().includes(key)))
      .slice(0, 8);
  }, [inventory, value, q]);

  const total = materialCost(value, inventory);
  const canMake = producibleUnits(value, inventory);

  return (
    <div className="sm:col-span-2">
      <label className={labelCls}>Materials used for 1 product (from inventory)</label>

      <div className="relative mt-1">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          className={`${inputCls} pl-9`}
          placeholder={inventory.length ? 'Search inventory item to add...' : 'No inventory items yet - add them in Inventory first'}
          value={q}
          disabled={!inventory.length}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {open && inventory.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white shadow-lg">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[#94A3B8]">No matching items.</p>
            ) : (
              results.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange([...value, { inventoryId: i.id, qty: 1 }]); setQ(''); setOpen(false); }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-[#F8FAFC]"
                >
                  <span className="min-w-0 truncate font-semibold text-[#0F172A]">{i.name} <span className="font-normal text-[#94A3B8]">· {i.id}</span></span>
                  <span className="flex shrink-0 items-center gap-2 text-[#64748B]">Stock {i.stock} · {lkr(i.unitValue)}<Plus size={13} className="text-[#2563EB]" /></span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-lg border border-[#E2E8F0]">
          {value.map((m) => {
            const item = inventory.find((i) => i.id === m.inventoryId);
            return (
              <div key={m.inventoryId} className="flex items-center gap-2 border-b border-[#F1F5F9] px-3 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#0F172A]">{item?.name ?? `${m.inventoryId} (removed)`}</p>
                  <p className="text-xs text-[#94A3B8]">{m.inventoryId}{item ? ` · stock ${item.stock} · ${lkr(item.unitValue)} each` : ''}</p>
                </div>
                <input
                  type="number"
                  min={1}
                  className={`${inputCls} !w-16 text-center`}
                  value={m.qty || ''}
                  onChange={(e) => onChange(value.map((x) => (x.inventoryId === m.inventoryId ? { ...x, qty: Math.max(0, Number(e.target.value) || 0) } : x)))}
                  aria-label="Quantity per product"
                />
                <span className="w-24 text-right text-xs font-bold text-[#0F172A]">{lkr((item?.unitValue ?? 0) * m.qty)}</span>
                <button type="button" aria-label="Remove material" onClick={() => onChange(value.filter((x) => x.inventoryId !== m.inventoryId))} className="flex size-7 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFC] px-3 py-2 text-xs">
            <span className="font-semibold text-[#64748B]">Material cost per product: <b className="text-[#0F172A]">{lkr(total)}</b> (used as manufacture cost)</span>
            <span className={`font-bold ${canMake > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Can make now: {canMake} units</span>
          </div>
        </div>
      )}
    </div>
  );
}
