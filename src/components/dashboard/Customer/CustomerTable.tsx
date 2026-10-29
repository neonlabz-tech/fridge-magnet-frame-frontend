'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/dashboard/shared/Skeleton';
import {
  Search,
  Download,
  Plus,
  Eye,
  Pencil,
  Phone,
  Mail,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import AddCustomerModal from './AddCustomerModal';
import ViewCustomerModal from './ViewCustomerModal';
import DeactivateCustomerModal from './DeactivateCustomerModal';
import CustomerOrdersModal from './CustomerOrdersModal';
import { apiV1Url } from '@/lib/backendUrl';
import {
  type CustomerRow,
  avatarStyle,
  displayId,
  extractCustomers,
  normalizeCustomer,
} from './CustomerShared';

type CustomerTableProps = {
  onCustomersChanged?: () => void;
};

type StatusFilter = 'all' | 'Enable' | 'Disable';

const getPageNumbers = (current: number, total: number): (number | 'ellipsis')[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 'ellipsis', total];
  if (current >= total - 2) return [1, 'ellipsis', total - 2, total - 1, total];
  return [1, 'ellipsis', current, 'ellipsis', total];
};

function PageBtn({
  children,
  active = false,
  disabled = false,
  onClick,
  label,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{ fontSize: '12px' }}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
        active
          ? 'bg-[#2563EB] text-white shadow-xs'
          : disabled
            ? 'cursor-not-allowed text-[#CBD5E1]'
            : 'text-[#475569] hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

const CustomerTable = ({ onCustomersChanged }: CustomerTableProps) => {
  const { customers, loading, error, page, total, totalPages, limit, goToPage, refresh } =
    useCustomers();

  const [addOpen, setAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<CustomerRow | null>(null);
  const [ordersTarget, setOrdersTarget] = useState<CustomerRow | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [allCustomersLoading, setAllCustomersLoading] = useState(false);

  const currentPageCustomers = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => customers.map((customer: any) => normalizeCustomer(customer)),
    [customers]
  );

  const fetchAllCustomers = async () => {
    setAllCustomersLoading(true);
    try {
      const res = await fetch(apiV1Url('/customers?page=1&limit=10000'));
      if (!res.ok) throw new Error('Unable to load all customers');
      const data = await res.json();
      const list = extractCustomers(data).map(normalizeCustomer);
      setAllCustomers(list.length ? list : currentPageCustomers);
    } catch {
      setAllCustomers(currentPageCustomers);
    } finally {
      setAllCustomersLoading(false);
    }
  };

  // The full list is only needed while searching/filtering (or exporting) – skip the extra request otherwise.
  const needsAll = searchText.trim() !== '' || statusFilter !== 'all';
  useEffect(() => {
    if (needsAll) void fetchAllCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAll, total, customers.length]);

  const isFiltering = searchText.trim() !== '' || statusFilter !== 'all';

  const filterCustomers = (list: CustomerRow[]) => {
    const keyword = searchText.trim().toLowerCase();
    return list.filter((c) => {
      const matchesSearch =
        keyword === '' ||
        [c.id, c.name, c.email, c.phone, c.address].some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(keyword)
        );
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'Enable' && c.isActive) ||
        (statusFilter === 'Disable' && !c.isActive);
      return matchesSearch && matchesStatus;
    });
  };

  const filteredAllCustomers = useMemo(() => {
    const source = allCustomers.length > 0 ? allCustomers : currentPageCustomers;
    return filterCustomers(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCustomers, currentPageCustomers, searchText, statusFilter]);

  const tableCustomers = isFiltering ? filteredAllCustomers : currentPageCustomers;

  const handleDownload = async () => {
    if (allCustomers.length === 0) await fetchAllCustomers();
    const rows = filteredAllCustomers;
    if (rows.length === 0) return;

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Customer ID', 'Customer Name', 'Email Address', 'Phone Number', 'Customer Address', 'Status'],
      ...rows.map((c) => [c.id, c.name, c.email, c.phone, c.address, c.isActive ? 'Enable' : 'Disable']),
    ]
      .map((row) => row.map(esc).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'customers.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const changeStatus = async (customer: CustomerRow) => {
    setUpdatingStatusId(customer.id);
    setStatusError(null);
    try {
      const res = await fetch(apiV1Url(`/customers/${customer.recordId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !customer.isActive, source: customer.source }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Server error: ${res.status}`);
      }
      await refresh();
      await fetchAllCustomers();
      onCustomersChanged?.();
      setDeactivateTarget(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to update customer status');
      setDeactivateTarget(null);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Turning an active customer off asks for confirmation first
  const handleToggle = (customer: CustomerRow) => {
    if (customer.isActive) setDeactivateTarget(customer);
    else void changeStatus(customer);
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const nextCustomerId = `CUST-${String(total + 1).padStart(4, '0')}`;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Toolbar */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-xs sm:flex-row sm:items-center">
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search by name, phone, email..."
                style={{ fontSize: '12px' }}
                className="h-9 w-full rounded-lg border border-transparent bg-[#F1F5F9] pl-9 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
              />
            </div>

            <div className="relative sm:w-36">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                style={{ fontSize: '12px' }}
                className="h-9 w-full appearance-none rounded-lg border border-transparent bg-[#F1F5F9] pl-3 pr-8 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
              >
                <option value="all">All Status</option>
                <option value="Enable">Active</option>
                <option value="Disable">Inactive</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={handleDownload}
              disabled={filteredAllCustomers.length === 0 || allCustomersLoading}
              style={{ fontSize: '12px' }}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 text-xs font-semibold text-[#334155] shadow-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <Download size={14} className="text-[#64748B]" /> Export
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              style={{ fontSize: '12px' }}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#1D4ED8] sm:flex-none"
            >
              <Plus size={14} strokeWidth={2.5} /> Add Customer
            </button>
          </div>
        </div>

        {statusError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-600"
          >
            {statusError}
          </div>
        )}

        {/* Table card */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xs">
          <div className="min-h-0 w-full flex-1 overflow-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  {['Customer Info', 'Contact Details', 'Shipping Address', 'Mail Verified', 'Type'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Total Orders
                  </th>
                  <th className="sticky right-0 z-[1] bg-[#F8FAFC] px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#64748B] md:static">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#F1F5F9]">
                {loading || allCustomersLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`}>
                      {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                        <td key={c} className="px-5 py-4">
                          <div className="space-y-1.5">
                            <Skeleton className={`h-3 ${c === 0 ? 'w-4/5' : 'w-3/5'}`} />
                            {c === 0 && <Skeleton className="h-2.5 w-2/5" />}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-xs font-semibold text-rose-600">
                      Error: {error}
                    </td>
                  </tr>
                ) : tableCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-xs text-[#64748B]">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  tableCustomers.map((c) => (
                    <tr key={c.recordId || c.id} className="transition-colors hover:bg-[#F8FAFC]/80">
                      {/* Customer info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarStyle(
                              c.id || c.name
                            )} ${c.isActive ? '' : 'opacity-60'}`}
                          >
                            {c.initials}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#0F172A]">{c.name}</p>
                            <span className="mt-0.5 inline-block rounded bg-[#EFF6FF] px-1.5 py-0.5 text-xs font-semibold text-[#2563EB]">
                              {displayId(c.id)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-3.5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A]">
                          <Phone size={12} className="shrink-0 text-[#64748B]" /> {c.phone}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[#64748B]">
                          <Mail size={12} className="shrink-0" />
                          <span className="break-all">{c.email}</span>
                        </p>
                      </td>

                      {/* Address */}
                      <td className="max-w-[240px] px-5 py-3.5">
                        <p className="flex items-start gap-1.5 text-xs text-[#334155]">
                          <MapPin size={12} className="mt-0.5 shrink-0 text-[#64748B]" />
                          <span className="line-clamp-2 break-words">{c.address}</span>
                        </p>
                      </td>

                      {/* Mail verified */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
                            c.emailVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${c.emailVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {c.emailVerified ? 'Verified' : 'Not verified'}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${
                            c.type === 'Website' ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.type}
                        </span>
                      </td>

                      {/* Total orders */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => c.totalOrders > 0 && setOrdersTarget(c)}
                          disabled={!c.totalOrders}
                          title={c.totalOrders ? 'View order IDs' : 'No orders'}
                          className="inline-flex min-w-7 items-center justify-center rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-bold text-[#334155] transition enabled:cursor-pointer enabled:hover:bg-blue-100 enabled:hover:text-[#1D4ED8] disabled:cursor-default"
                        >
                          {c.totalOrders}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="sticky right-0 z-[1] bg-white px-5 py-3.5 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)] md:static md:shadow-none">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingCustomer(c)}
                            aria-label={`View ${c.name}`}
                            title="View customer"
                            className="flex size-8 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569] hover:bg-blue-50 hover:text-[#2563EB]"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCustomer(c)}
                            disabled={!c.isActive}
                            aria-label={`Edit ${c.name}`}
                            title={c.isActive ? 'Edit customer' : 'Activate the customer to edit'}
                            className="flex size-8 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#475569] hover:bg-blue-50 hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={c.isActive}
                            aria-label={c.isActive ? `Deactivate ${c.name}` : `Activate ${c.name}`}
                            title={c.isActive ? 'Active – click to deactivate' : 'Inactive – click to activate'}
                            onClick={() => handleToggle(c)}
                            disabled={updatingStatusId === c.id}
                            className={`relative ml-1 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                              c.isActive ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                                c.isActive ? 'left-[18px]' : 'left-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center gap-3 border-t border-[#E2E8F0] bg-white px-5 py-3 sm:flex-row sm:justify-between">
            <p className="text-xs font-medium text-[#64748B]">
              {isFiltering
                ? `Showing ${tableCustomers.length} filtered customer(s)`
                : total > 0
                  ? `Showing ${from} to ${to} of ${total.toLocaleString('en-US')} customers`
                  : 'No customers'}
            </p>

            {!isFiltering && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <PageBtn label="Previous page" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  <ChevronLeft size={14} />
                </PageBtn>
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === 'ellipsis' ? (
                    <span
                      key={`e-${i}`}
                      className="flex h-8 w-6 items-center justify-center text-xs font-semibold text-slate-400"
                    >
                      ...
                    </span>
                  ) : (
                    <PageBtn key={p} active={p === page} label={`Page ${p}`} onClick={() => goToPage(p)}>
                      {p}
                    </PageBtn>
                  )
                )}
                <PageBtn label="Next page" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                  <ChevronRight size={14} />
                </PageBtn>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit */}
      <AddCustomerModal
        isOpen={addOpen || Boolean(editingCustomer)}
        onClose={() => {
          setAddOpen(false);
          setEditingCustomer(null);
        }}
        onSuccess={async () => {
          await refresh();
          await fetchAllCustomers();
          onCustomersChanged?.();
        }}
        nextId={nextCustomerId}
        initialData={editingCustomer}
      />

      {/* View */}
      <ViewCustomerModal
        customer={viewingCustomer}
        onClose={() => setViewingCustomer(null)}
        onEdit={(c) => {
          setViewingCustomer(null);
          if (c.isActive) setEditingCustomer(c);
        }}
      />

      {/* Customer order IDs */}
      <CustomerOrdersModal customer={ordersTarget} onClose={() => setOrdersTarget(null)} />

      {/* Deactivate */}
      <DeactivateCustomerModal
        customer={deactivateTarget}
        busy={Boolean(deactivateTarget && updatingStatusId === deactivateTarget.id)}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && void changeStatus(deactivateTarget)}
      />
    </>
  );
};

export default CustomerTable;
