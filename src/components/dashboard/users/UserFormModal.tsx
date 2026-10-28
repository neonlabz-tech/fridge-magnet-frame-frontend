'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  USER_ROLES,
  type AdminUser,
  type AdminUserInput,
  type UserRole,
  type UserStatus,
} from './userData';

interface UserFormModalProps {
  isOpen: boolean;
  initialData?: AdminUser | null;
  onClose: () => void;
  onSubmit: (data: AdminUserInput) => void;
}

const EMPTY_FORM: AdminUserInput = {
  name: '',
  email: '',
  phone: '',
  role: 'Staff',
  status: 'Active',
};

const inputClass =
  'h-[46px] w-full rounded-[9px] border border-[#cbd5e1] bg-white px-3.5 text-sm text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-[#174092] focus:ring-4 focus:ring-[#174092]/10';

const labelClass =
  'text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#111827]';

export default function UserFormModal({
  isOpen,
  initialData = null,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [form, setForm] = useState<AdminUserInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initialData);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      initialData
        ? {
            name: initialData.name,
            email: initialData.email,
            phone: initialData.phone,
            role: initialData.role,
            status: initialData.status,
          }
        : EMPTY_FORM,
    );
    setError(null);
  }, [isOpen, initialData]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const update = (patch: Partial<AdminUserInput>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Enter a valid email address.');
      return;
    }

    onSubmit({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center bg-slate-900/55 p-3.5 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between gap-5 border-b border-[#e5e7eb] px-5 pb-5 pt-6 sm:px-8">
          <div>
            <h2 className="mb-1 text-2xl font-extrabold tracking-tight text-[#111827] sm:text-[26px]">
              {isEdit ? 'Edit User' : 'Add New User'}
            </h2>
            <p className="text-sm text-[#475569]">
              {isEdit
                ? 'Update the user details, role and access status.'
                : 'Create a dashboard user and assign a role.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-[38px] flex-shrink-0 items-center justify-center rounded-xl text-[#111827] hover:bg-slate-100"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-6 sm:px-8">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              className={inputClass}
              placeholder="e.g. Arun Kumar"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update({ email: e.target.value })}
                className={inputClass}
                placeholder="user@magnify.lk"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update({ phone: e.target.value })}
                className={inputClass}
                placeholder="+94 77 000 0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Role</label>
              <select
                value={form.role}
                onChange={(e) => update({ role: e.target.value as UserRole })}
                className={inputClass}
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  update({ status: e.target.value as UserStatus })
                }
                className={inputClass}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3.5 py-3 text-sm font-semibold text-[#dc2626]">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#e5e7eb] bg-[#f8fafc] px-5 py-[18px] sm:flex-row sm:justify-end sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] min-w-[132px] rounded-[10px] border-2 border-[#0f3b82] bg-white text-sm font-extrabold text-[#0f3b82] hover:bg-[#eff6ff]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-[46px] min-w-[132px] rounded-[10px] border-2 border-[#174092] bg-[#174092] text-sm font-extrabold text-white hover:bg-[#0f3b82]"
          >
            {isEdit ? 'Save Changes' : 'Add User'}
          </button>
        </div>
      </div>
    </div>
  );
}
