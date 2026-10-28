'use client';

import { AlertTriangle, AlertCircle, UserX } from 'lucide-react';
import { type CustomerRow, displayId, lkr } from './CustomerShared';

interface DeactivateCustomerModalProps {
  customer: CustomerRow | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeactivateCustomerModal({
  customer,
  busy = false,
  onCancel,
  onConfirm,
}: DeactivateCustomerModalProps) {
  if (!customer) return null;

  return (
    <div
      className="compact-ui fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3 px-5 pb-4 pt-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#0F172A]">Deactivate Customer Account?</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
              Are you sure you want to deactivate customer{' '}
              <span className="font-bold text-[#0F172A]">
                {customer.name} ({displayId(customer.id)})
              </span>
              ? This will pause automated reminders and set the customer profile to inactive.
              Existing order history will be preserved.
            </p>
          </div>
        </div>

        <div className="mx-5 mb-5 rounded-xl bg-[#EEF2FF] p-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-xs font-bold text-white"
            >
              {customer.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#0F172A]">
                {customer.name}{' '}
                <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 font-semibold text-[#2563EB]">
                  {displayId(customer.id)}
                </span>
              </p>
              <p className="truncate text-xs text-[#64748B]">
                {customer.phone} • {customer.address}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold text-[#0F172A]">{lkr(customer.totalAmount)}</p>
              <p className="text-xs text-[#64748B]">{customer.totalOrders} Completed Orders</p>
            </div>
          </div>

          {customer.activeOrders > 0 && (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-white p-2.5 text-xs text-[#334155]">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-600" />
              <p>
                <span className="font-bold text-rose-600">Active Orders:</span>{' '}
                {customer.activeOrders} order{customer.activeOrders > 1 ? 's' : ''}
                {customer.activeOrderRef && (
                  <>
                    {' '}
                    (<span className="font-semibold text-[#2563EB]">{customer.activeOrderRef}</span>)
                  </>
                )}{' '}
                {customer.activeOrders > 1 ? 'are' : 'is'} currently pending fulfillment.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#B91C1C] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#991B1B] disabled:opacity-60"
          >
            <UserX size={13} />
            {busy ? 'Deactivating...' : 'Confirm Deactivation'}
          </button>
        </div>
      </div>
    </div>
  );
}
