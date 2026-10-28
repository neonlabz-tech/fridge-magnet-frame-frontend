'use client';

import React, { useEffect, useState } from 'react';
import { X, User, Mail, Phone, MapPin, Save } from 'lucide-react';
import { displayId } from './CustomerShared';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Shown in the breadcrumb of the "Add" dialog, e.g. "CUST-0009" */
  nextId?: string;
  initialData?: {
    id?: string;
    recordId?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    type?: 'Website' | 'Manual';
    emailVerified?: boolean;
  } | null;
}

const labelCls = 'block text-xs font-semibold text-[#334155]';

const AddCustomerModal = ({
  isOpen,
  onClose,
  onSuccess = () => {},
  nextId,
  initialData = null,
}: AddCustomerModalProps) => {
  const isEdit = Boolean(initialData?.id);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', emailVerified: false });
  // Website customers verify themselves via the activation mail; only Manual ones can be set by staff.
  const customerType = initialData?.type ?? 'Manual';
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setForm({
        name: initialData?.name ?? '',
        email: initialData?.email ?? '',
        phone: initialData?.phone ?? '',
        address: initialData?.address ?? '',
        emailVerified: initialData?.emailVerified ?? false,
      });
      setError(null);
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.address.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const customerUpdateId = initialData?.recordId || initialData?.id;
      const url = customerUpdateId
        ? `/api/v1/customers/${encodeURIComponent(customerUpdateId)}`
        : '/api/v1/customers';

      const res = await fetch(url, {
        method: customerUpdateId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type: customerType, emailVerified: customerType === 'Website' ? form.emailVerified : false }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Server error: ${res.status}`);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Add = plain underlined fields, Edit = filled fields with leading icons (per design)
  const fieldCls = isEdit
    ? 'w-full rounded-lg border border-transparent bg-[#EEF2FF] py-2.5 pl-9 pr-3 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15'
    : 'w-full border-0 border-b border-[#E2E8F0] bg-transparent px-0 py-2.5 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none';

  const icon = (node: React.ReactNode, top = 'top-1/2 -translate-y-1/2') =>
    isEdit ? (
      <span className={`pointer-events-none absolute left-3 ${top} text-[#64748B]`}>{node}</span>
    ) : null;

  return (
    <div
      className="compact-ui fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pb-3 pt-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Customer Management{' '}
              <span className="text-[#2563EB]">
                ·{' '}
                {isEdit
                  ? displayId(initialData?.id ?? '')
                  : `${displayId(nextId || 'CUST-NEW')} (Auto-Generated)`}
              </span>
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#0F172A]">
              {isEdit ? 'Edit Customer' : 'Add New Customer'}
            </h2>
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

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-5 pt-1">
          <div>
            <label className={labelCls}>
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1.5">
              {icon(<User size={14} />)}
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Tharindu Perera"
                className={fieldCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1.5">
              {icon(<Mail size={14} />)}
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="e.g. tharindu.perera@gmail.com"
                className={fieldCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1.5">
              {icon(<Phone size={14} />)}
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. 077 123 4567"
                className={fieldCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Shipping Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative mt-1.5">
              {icon(<MapPin size={14} />, 'top-3')}
              <textarea
                name="address"
                rows={isEdit ? 3 : 2}
                value={form.address}
                onChange={handleChange}
                placeholder="e.g. No. 15, Flower Rd, Colombo 07, Western Province"
                className={`${fieldCls} resize-none`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type</label>
              <div className="mt-1.5">
                <span
                  className={`inline-flex rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                    customerType === 'Website' ? 'bg-violet-50 text-violet-600' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {customerType}
                </span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Mail Verified</label>
              <div className="mt-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold ${
                    form.emailVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${form.emailVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {form.emailVerified ? 'Verified' : 'Not verified'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                {customerType === 'Website'
                  ? 'Verified by the customer via the activation mail.'
                  : 'Manual customers stay "Not verified".'}
              </p>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 rounded-lg bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {isEdit && <Save size={13} />}
            {submitting ? (isEdit ? 'Saving...' : 'Adding...') : isEdit ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomerModal;
