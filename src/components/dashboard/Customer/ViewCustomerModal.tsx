'use client';

import type { ReactNode } from 'react';
import { X, Mail, Phone, MapPin, UserRound, Pencil } from 'lucide-react';
import { type CustomerRow, displayId, lkr } from './CustomerShared';

interface ViewCustomerModalProps {
  customer: CustomerRow | null;
  onClose: () => void;
  onEdit: (customer: CustomerRow) => void;
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
        <div className="mt-0.5 break-words text-xs font-semibold text-[#0F172A]">{children}</div>
      </div>
    </div>
  );
}

export default function ViewCustomerModal({ customer, onClose, onEdit }: ViewCustomerModalProps) {
  if (!customer) return null;

  const since = customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className="compact-ui fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pb-2 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Customer Management{' '}
              <span className="text-[#2563EB]">· {displayId(customer.id)}</span>
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#0F172A]">Customer Details</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto bg-[#F8FAFC] p-4">
          {/* Profile */}
          <div className="flex items-center gap-3 rounded-xl bg-[#EEF2FF] p-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-xs font-bold text-white">
              {customer.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#0F172A]">{customer.name}</p>
              {since && <p className="text-xs text-[#64748B]">Customer since {since}</p>}
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                customer.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${customer.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
              />
              {customer.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          {/* Type + mail verification */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Type</p>
              <p className="mt-0.5 text-xs font-bold text-[#0F172A]">{customer.type}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Mail Verified</p>
              <p className={`mt-0.5 text-xs font-bold ${customer.emailVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                {customer.emailVerified ? 'Verified' : 'Not verified'}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Orders</p>
              <p className="mt-0.5 text-xs font-bold text-[#0F172A]">
                {customer.totalOrders} {customer.totalOrders === 1 ? 'Order' : 'Orders'}
              </p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                Total Amount
              </p>
              <p className="mt-0.5 text-xs font-bold text-[#2563EB]">{lkr(customer.totalAmount)}</p>
            </div>
          </div>

          <InfoRow icon={<UserRound size={14} />} label="Full Legal Name">
            {customer.name}
          </InfoRow>
          <InfoRow icon={<Mail size={14} />} label="Email Address">
            <a href={`mailto:${customer.email}`} className="text-[#2563EB] hover:underline">
              {customer.email}
            </a>
          </InfoRow>
          <InfoRow icon={<Phone size={14} />} label="Phone / WhatsApp">
            {customer.phone}
          </InfoRow>
          <InfoRow icon={<MapPin size={14} />} label="Shipping Address">
            {customer.address}
          </InfoRow>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(customer)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8]"
          >
            <Pencil size={13} /> Edit Customer
          </button>
        </div>
      </div>
    </div>
  );
}
