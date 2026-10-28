'use client';

import { useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { ConfirmModal, ModalShell, btnGhost, btnPrimary, inputCls, labelCls } from '@/components/dashboard/shared/UiKit';
import { DEFAULT_ROLE_NAME, PAGE_OPTIONS, type Role } from '@/lib/roles';

interface Props {
  roles: Role[];
  memberCountByRole: Record<string, number>;
  /** Resolves true when the backend saved the role (editing = null creates a new role). */
  onSave: (editing: Role | null, name: string, pages: string[]) => Promise<boolean>;
  onDelete: (role: Role) => Promise<boolean>;
}

export default function RolesPanel({ roles, memberCountByRole, onSave, onDelete }: Props) {
  const { addToast } = useToastStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setPages([]);
    setError('');
    setOpen(true);
  };
  const openEdit = (r: Role) => {
    setEditing(r);
    setName(r.name);
    setPages(r.pages);
    setError('');
    setOpen(true);
  };

  const toggle = (href: string) => setPages((p) => (p.includes(href) ? p.filter((x) => x !== href) : [...p, href]));
  const allSelected = pages.length === PAGE_OPTIONS.length;

  const save = async () => {
    if (saving) return;
    const n = name.trim();
    if (!n) return setError('Role name is required.');
    if (roles.some((r) => r.name.toLowerCase() === n.toLowerCase() && r.id !== editing?.id)) return setError('A role with this name already exists.');
    if (!pages.length) return setError('Select at least one page.');
    setSaving(true);
    const ok = await onSave(editing, n, pages);
    setSaving(false);
    if (ok) setOpen(false);
  };

  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] p-3">
        <p className="text-xs text-[#64748B]">Create roles and choose which pages each role can open.</p>
        <button type="button" onClick={openAdd} className={btnPrimary}>
          <Plus size={14} /> Add Role
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        {roles.map((r) => {
          const count = memberCountByRole[r.name] ?? 0;
          return (
            <div key={r.id} className="rounded-xl border border-[#E2E8F0] p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <ShieldCheck size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#0F172A]">{r.name}</p>
                  <p className="text-xs text-[#94A3B8]">{count} {count === 1 ? 'user' : 'users'} · {PAGE_OPTIONS.filter((p) => r.pages.includes(p.href)).length} pages</p>
                </div>
                <button type="button" aria-label="Edit role" title="Edit" onClick={() => openEdit(r)} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]">
                  <Pencil size={15} />
                </button>
                {r.name !== DEFAULT_ROLE_NAME && (
                  <button
                    type="button"
                    aria-label="Delete role"
                    title={count ? 'Reassign its users first' : 'Delete'}
                    onClick={() => (count ? addToast('Move this role\'s users to another role first.', 'error') : setDeleting(r))}
                    className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {PAGE_OPTIONS.filter((p) => r.pages.includes(p.href)).map((p) => (
                  <span key={p.href} className="rounded-md bg-[#EFF6FF] px-2 py-1 text-xs font-semibold text-[#2563EB]">{p.label}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        icon={<ShieldCheck size={18} />}
        title={editing ? 'Edit Role' : 'Add Role'}
        subtitle="Tick the pages people with this role can open."
        maxWidth="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Cancel</button>
            <button type="button" onClick={save} disabled={saving} className={btnPrimary}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Role'}</button>
          </>
        }
      >
        <div className="space-y-3 pt-1">
          <div>
            <label className={labelCls}>Role name</label>
            <input className={inputCls} value={name} placeholder="e.g. Sales Executive" onChange={(e) => { setName(e.target.value); setError(''); }} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-[#64748B]">Allowed pages</label>
              <button type="button" onClick={() => setPages(allSelected ? [] : PAGE_OPTIONS.map((p) => p.href))} className="text-xs font-semibold text-[#2563EB] hover:underline">
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PAGE_OPTIONS.map((p) => {
                const on = pages.includes(p.href);
                return (
                  <label key={p.href} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-semibold ${on ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E2E8F0] text-[#475569] hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => { toggle(p.href); setError(''); }} className="size-4 accent-[#2563EB]" />
                    {p.label}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#94A3B8]">Overview is shown to everyone, but only with the data of the pages ticked here. User Management is always admin-only.</p>
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        </div>
      </ModalShell>

      <ConfirmModal
        open={!!deleting}
        title="Delete role?"
        message={<>Role <b>{deleting?.name}</b> will be removed.</>}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await onDelete(deleting);
          setDeleting(null);
        }}
      />
    </section>
  );
}
