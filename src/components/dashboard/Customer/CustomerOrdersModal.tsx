'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiV1Url } from '@/lib/backendUrl';
import type { CustomerRow } from './CustomerShared';

type CustomerOrder = {
  _id?: string;
  orderId: string;
  email?: string;
  status?: string;
  totalValue?: number;
  createdAt?: string;
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PROCESSING: 'bg-sky-50 text-sky-700 border-sky-200',
  SHIPPED: 'bg-blue-50 text-blue-700 border-blue-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const formatDate = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const label = (status?: string) => {
  const s = String(status || '').toUpperCase();
  if (s === 'CANCELLED') return 'Cancelled';
  return s ? s.charAt(0) + s.slice(1).toLowerCase().replace('canceled', 'cancelled') : '-';
};

export default function CustomerOrdersModal({
  customer,
  onClose,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customer) return;
    let active = true;
    setLoading(true);
    setError('');
    setOrders([]);

    (async () => {
      try {
        const res = await fetch(apiV1Url('/orders'), { cache: 'no-store' });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const all = (await res.json()) as CustomerOrder[];
        const email = String(customer.email || '').trim().toLowerCase();
        const mine = (Array.isArray(all) ? all : []).filter(
          (o) => email && String(o.email || '').trim().toLowerCase() === email,
        );
        mine.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        if (active) setOrders(mine);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load orders.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [customer]);

  useEffect(() => {
    if (!customer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [customer, onClose]);

  if (!customer) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[#0F172A]">Orders</h3>
            <p className="truncate text-xs text-[#64748B]">
              {customer.name} · {customer.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#94A3B8]">Loading…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm font-semibold text-rose-600">{error}</p>
          ) : orders.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#94A3B8]">No orders found.</p>
          ) : (
            <ul className="divide-y divide-[#F1F5F9]">
              {orders.map((o) => {
                const key = String(o.status || '').toUpperCase();
                return (
                  <li key={o._id || o.orderId} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-bold text-[#1D4ED8]">
                        {String(o.orderId).startsWith('#') ? o.orderId : `#${o.orderId}`}
                      </p>
                      <p className="text-xs text-[#94A3B8]">{formatDate(o.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          STATUS_STYLES[key === 'CANCELLED' ? 'CANCELED' : key] ||
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {label(o.status)}
                      </span>
                      {typeof o.totalValue === 'number' && (
                        <span className="text-xs font-semibold text-[#334155]">
                          LKR {o.totalValue.toLocaleString('en-LK')}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
