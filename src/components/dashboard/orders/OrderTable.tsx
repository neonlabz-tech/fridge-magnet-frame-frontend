'use client';

import { Eye, CreditCard, Banknote, Building2 } from 'lucide-react';
import type { Order } from '@/types/order';

interface OrderTableProps {
  orders: Order[];
  selectedIds: Set<string>;
  isBulkMode?: boolean;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectOne: (id: string) => void;
  onView: (order: Order) => void;
  /** Orders can no longer be deleted from the table (unsafe); kept optional so callers need no change. */
  onDelete?: (order: Order) => void;
}

function formatDate(dateInput?: string | Date) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusBadge(status?: string) {
  const s = String(status || '').toLowerCase();
  switch (s) {
    case 'delivered':
    case 'completed':
      return {
        label: 'Delivered',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'shipped':
      return {
        label: 'Shipped',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
      };
    case 'processing':
      return {
        label: 'Processing',
        bg: 'bg-sky-50 text-sky-700 border-sky-200',
        dot: 'bg-sky-500',
      };
    case 'pending':
      return {
        label: 'Pending',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'canceled':
    case 'cancelled':
      return {
        label: 'Cancelled',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: status || 'Pending',
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

function getPaymentBadge(paymentStatus?: string) {
  const p = String(paymentStatus || '').toLowerCase();
  if (p === 'paid') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700"
        style={{ fontSize: '12px', lineHeight: '16px' }}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Paid
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-700"
      style={{ fontSize: '12px', lineHeight: '16px' }}
    >
      <span className="size-1.5 rounded-full bg-amber-500" />
      Pending
    </span>
  );
}

function getMethodIcon(method?: string) {
  const m = String(method || '').toLowerCase();
  if (m.includes('card')) {
    return <CreditCard size={13} className="text-[#64748B] shrink-0" />;
  }
  if (m.includes('bank')) {
    return <Building2 size={13} className="text-[#64748B] shrink-0" />;
  }
  return <Banknote size={13} className="text-[#64748B] shrink-0" />;
}

export default function OrderTable({
  orders,
  selectedIds,
  isBulkMode = false,
  onToggleSelectAll,
  onToggleSelectOne,
  onView,
}: OrderTableProps) {
  const isAllSelected = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));

  return (
    <div className="w-full overflow-x-auto lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <table className="w-full table-auto border-collapse min-w-[840px] text-left">
        <thead>
          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
            {/* Show Checkbox column only when isBulkMode is active */}
            {isBulkMode && (
              <th className="w-12 px-4 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                  aria-label="Select all orders"
                />
              </th>
            )}
            <th
              className="px-4 py-2.5 font-bold uppercase tracking-wider text-[#64748B]"
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              Order ID
            </th>
            <th
              className="px-4 py-2.5 font-bold uppercase tracking-wider text-[#64748B]"
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              Customer Name
            </th>
            <th
              className="px-4 py-2.5 font-bold uppercase tracking-wider text-[#64748B]"
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              Date
            </th>
            <th
              className="px-4 py-2.5 font-bold uppercase tracking-wider text-[#64748B]"
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              Payment
            </th>
            <th
              className="px-4 py-2.5 font-bold uppercase tracking-wider text-[#64748B]"
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              Status
            </th>
            <th
              className="px-4 py-2.5 font-bold uppercase tracking-wider text-[#64748B]"
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              Method
            </th>
            <th
              className="sticky right-0 z-[1] bg-[#F8FAFC] px-4 py-2.5 text-center font-bold uppercase tracking-wider text-[#64748B] md:static"
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              Action
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[#F1F5F9]">
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={isBulkMode ? 8 : 7}
                className="px-4 py-16 text-center text-[#94A3B8]"
                style={{ fontSize: '12px', lineHeight: '16px' }}
              >
                No orders found.
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const isSelected = selectedIds.has(order.id);
              const statusMeta = getStatusBadge(order.status);
              const initials =
                order.customerInitials ||
                order.customerName
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) ||
                'CU';

              return (
                <tr
                  key={order.id}
                  className={`transition-colors hover:bg-[#F8FAFC]/80 ${
                    isSelected ? 'bg-blue-50/50' : ''
                  }`}
                >
                  {/* Checkbox column only in bulk mode */}
                  {isBulkMode && (
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectOne(order.id)}
                        className="size-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                        aria-label={`Select order ${order.orderId}`}
                      />
                    </td>
                  )}

                  {/* Order ID Column (Strictly 12px) */}
                  <td className="px-4 py-3" style={{ fontSize: '12px', lineHeight: '16px' }}>
                    <button
                      type="button"
                      onClick={() => onView(order)}
                      className="text-left font-mono font-bold text-[#2563EB] hover:underline block"
                      style={{ fontSize: '12px', lineHeight: '16px' }}
                    >
                      {order.orderId}
                    </button>
                    <p
                      className="text-[#94A3B8] mt-0.5"
                      style={{ fontSize: '12px', lineHeight: '16px' }}
                    >
                      {order.items?.length || order.qty || 1} item
                      {(order.items?.length || order.qty || 1) > 1 ? 's' : ''}
                    </p>
                  </td>

                  {/* Customer Name */}
                  <td className="px-4 py-3" style={{ fontSize: '12px', lineHeight: '16px' }}>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] font-bold text-[#2563EB]"
                        style={{ fontSize: '11px' }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="truncate font-semibold text-[#0F172A]"
                          style={{ fontSize: '12px', lineHeight: '16px' }}
                        >
                          {order.customerName}
                        </p>
                        <p
                          className="truncate text-[#94A3B8]"
                          style={{ fontSize: '12px', lineHeight: '16px' }}
                        >
                          {order.phone || order.customerId || order.email || ''}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Date */}
                  <td
                    className="px-4 py-3 text-[#334155] whitespace-nowrap"
                    style={{ fontSize: '12px', lineHeight: '16px' }}
                  >
                    {formatDate(order.createdAt)}
                  </td>

                  {/* Payment */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getPaymentBadge(order.paymentStatus)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold capitalize ${statusMeta.bg}`}
                      style={{ fontSize: '12px', lineHeight: '16px' }}
                    >
                      <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                      {statusMeta.label}
                    </span>
                  </td>

                  {/* Method */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center gap-1.5 font-medium text-[#334155]"
                      style={{ fontSize: '12px', lineHeight: '16px' }}
                    >
                      {getMethodIcon(order.paymentMethod)}
                      <span>{order.paymentMethod || 'Card'}</span>
                    </span>
                  </td>

                  {/* Action */}
                  <td className="sticky right-0 z-[1] bg-white px-4 py-3 text-center whitespace-nowrap shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)] md:static md:shadow-none">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onView(order)}
                        className="flex size-7 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] transition hover:border-[#2563EB] hover:bg-blue-50 hover:text-[#2563EB]"
                        title="View order details"
                        aria-label={`View order ${order.orderId}`}
                      >
                        <Eye size={14} />
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
  );
}
