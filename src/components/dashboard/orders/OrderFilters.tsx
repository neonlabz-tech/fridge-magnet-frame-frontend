'use client';

import {
  ArrowUpDown,
  Check,
  CheckSquare,
} from 'lucide-react';
import type { OrderStatus } from '@/types/order';

export type OrderFilterStatus = 'all' | OrderStatus;
export type OrderSortBy =
  | 'default'
  | 'date-desc'
  | 'date-asc'
  | 'id-asc'
  | 'id-desc'
  | 'name-asc'
  | 'name-desc'
  | 'amount-desc'
  | 'amount-asc';

const TABS: { value: OrderFilterStatus; label: string }[] = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'delivered', label: 'Completed' },
  { value: 'canceled', label: 'Cancelled' },
];

const SORT_OPTIONS: { value: OrderSortBy; label: string }[] = [
  { value: 'default', label: 'Latest (Default)' },
  { value: 'date-asc', label: 'Oldest First' },
  { value: 'amount-desc', label: 'Amount: High to Low' },
  { value: 'amount-asc', label: 'Amount: Low to High' },
  { value: 'name-asc', label: 'Customer (A → Z)' },
  { value: 'id-desc', label: 'Order ID' },
];

interface OrderFiltersProps {
  filterStatus: OrderFilterStatus;
  sortBy: OrderSortBy;
  sortOpen?: boolean;
  isBulkMode?: boolean;
  onToggleSort?: () => void;
  onToggleBulkMode?: () => void;
  onFilterSelect: (filter: OrderFilterStatus) => void;
  onSortSelect: (sort: OrderSortBy) => void;
}

export default function OrderFilters({
  filterStatus,
  sortBy,
  sortOpen,
  isBulkMode = false,
  onToggleSort,
  onToggleBulkMode,
  onFilterSelect,
  onSortSelect,
}: OrderFiltersProps) {
  return (
    <div className="mb-2.5 flex flex-col justify-between gap-2.5 border-b border-[#E2E8F0] pb-2.5 sm:flex-row sm:items-center">
      {/* Status Tabs with Horizontal Scroll for Mobile */}
      <div className="flex max-w-full items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none sm:gap-2">
        {TABS.map((tab) => {
          const isActive = filterStatus === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onFilterSelect(tab.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-bold transition-all ${
                isActive
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]'
              }`}
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right Controls: Bulk Select button & Sort By */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {/* Bulk Select Button (Strictly 12px) */}
        <button
          type="button"
          onClick={onToggleBulkMode}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-semibold transition shadow-2xs ${
            isBulkMode
              ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
              : 'border-[#E2E8F0] bg-white text-[#475569] hover:bg-slate-50'
          }`}
          style={{ fontSize: '12px', lineHeight: '16px' }}
        >
          <CheckSquare size={13} className={isBulkMode ? 'text-[#2563EB]' : 'text-[#94A3B8]'} />
          <span style={{ fontSize: '12px', lineHeight: '16px' }}>
            {isBulkMode ? 'Exit Selection' : 'Bulk Select'}
          </span>
        </button>

        {/* Sort Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleSort}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 font-semibold text-[#475569] shadow-2xs hover:bg-slate-50"
            style={{ fontSize: '12px', lineHeight: '16px' }}
          >
            <ArrowUpDown size={13} className="text-[#94A3B8]" />
            <span style={{ fontSize: '12px', lineHeight: '16px' }}>Sort By</span>
          </button>

          {sortOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={onToggleSort}
                role="presentation"
              />
              <div className="absolute right-0 top-full z-40 mt-1.5 w-44 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-lg">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSortSelect(opt.value)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left font-medium transition hover:bg-slate-50 ${
                      sortBy === opt.value
                        ? 'bg-blue-50/70 text-[#2563EB] font-bold'
                        : 'text-[#334155]'
                    }`}
                    style={{ fontSize: '12px', lineHeight: '16px' }}
                  >
                    <span style={{ fontSize: '12px' }}>{opt.label}</span>
                    {sortBy === opt.value && <Check size={13} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
