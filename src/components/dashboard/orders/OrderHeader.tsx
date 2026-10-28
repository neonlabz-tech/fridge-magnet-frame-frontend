'use client';

import { Search, Download, Plus } from 'lucide-react';

interface OrderHeaderProps {
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  onAddOrder?: () => void;
  onExport?: () => void;
}

export default function OrderHeader({
  searchTerm = '',
  onSearchChange,
  onAddOrder,
  onExport,
}: OrderHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#071C40] sm:text-[28px]">
          Orders Management
        </h1>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Track customer orders, manage statuses and print shipping labels.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1 sm:w-64 sm:flex-initial">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            type="text"
            placeholder="Search orders, customer..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#E2E8F0] bg-white pl-9 pr-3 text-[12px] text-[#0F172A] placeholder:text-[12px] placeholder-[#94A3B8] transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
            style={{ fontSize: '12px' }}
          />
        </div>

        {/* Export Button */}
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-[12px] font-semibold text-[#334155] shadow-xs transition hover:bg-slate-50"
          style={{ fontSize: '12px' }}
        >
          <Download size={15} className="text-[#64748B]" />
          <span style={{ fontSize: '12px' }}>Export PDF</span>
        </button>

        {/* Add Order Button */}
        <button
          type="button"
          onClick={onAddOrder}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] active:scale-[0.98]"
          style={{ fontSize: '12px' }}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span style={{ fontSize: '12px' }}>Add Order</span>
        </button>
      </div>
    </div>
  );
}
