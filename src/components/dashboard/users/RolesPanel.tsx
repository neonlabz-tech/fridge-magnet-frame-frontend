'use client';

import { Fragment, useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { ConfirmModal, ModalShell, btnGhost, btnPrimary, inputCls, labelCls } from '@/components/dashboard/shared/UiKit';
import { ACTIONS, ALL_ACTIONS, PAGE_OPTIONS, expandWidgets, PERMISSION_ROWS, WIDGET_OPTIONS, rolePermissions, type Action, type PermissionMap, type Role } from '@/lib/roles';

interface Props {
  roles: Role[];
  memberCountByRole: Record<string, number>;
  /** Resolves true when the backend saved the role (editing = null creates a new role). */
  onSave: (editing: Role | null, name: string, permissions: PermissionMap, widgets: string[]) => Promise<boolean>;
  onDelete: (role: Role) => Promise<boolean>;
}

export default function RolesPanel({ roles, memberCountByRole, onSave, onDelete }: Props) {
  const { addToast } = useToastStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [perms, setPerms] = useState<PermissionMap>({});
  const [widgets, setWidgets] = useState<string[]>(WIDGET_OPTIONS.map((w) => w.key));
  const [hideCols, setHideCols] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setPerms({});
    setWidgets(WIDGET_OPTIONS.map((w) => w.key));
    setHideCols([]);
    setError('');
    setOpen(true);
  };
  const openEdit = (r: Role) => {
    setEditing(r);
    setName(r.name);
    setPerms(rolePermissions(r));
    setWidgets(expandWidgets(r.widgets ?? WIDGET_OPTIONS.map((w) => w.key)).filter((k) => !k.startsWith('hide-')));
    setHideCols((r.widgets ?? []).filter((k) => k.startsWith('hide-')));
    setError('');
    setOpen(true);
  };

  const pagesOn = PERMISSION_ROWS.filter((p) => perms[p.key]?.includes('view'));
  const allSelected = PERMISSION_ROWS.every((p) => perms[p.key]?.length === ALL_ACTIONS.length);
  const pageViewable = (href: string) => Object.keys(perms).some((k) => k.split('#')[0] === href && perms[k]?.includes('view'));

  // Create / Edit / Delete need View: ticking one turns View on, clearing View clears the rest.
  const toggleAction = (href: string, action: Action) => {
    setError('');
    setPerms((prev) => {
      const cur = prev[href] ?? [];
      const has = cur.includes(action);
      let next: Action[];
      if (action === 'view') next = has ? [] : [...cur, 'view'];
      else next = has ? cur.filter((a) => a !== action) : [...cur, 'view', action];
      const clean = ALL_ACTIONS.filter((a) => next.includes(a));
      const copy = { ...prev };
      if (clean.length) copy[href] = clean;
      else delete copy[href];
      return copy;
    });
  };
  const toggleRow = (href: string) => {
    setError('');
    setPerms((prev) => {
      const copy = { ...prev };
      if (copy[href]?.length === ALL_ACTIONS.length) delete copy[href];
      else copy[href] = [...ALL_ACTIONS];
      return copy;
    });
  };
  const toggleAll = () => {
    setError('');
    setPerms(allSelected ? {} : Object.fromEntries(PERMISSION_ROWS.map((p) => [p.key, [...ALL_ACTIONS]])));
  };
  const toggleWidget = (key: string) => setWidgets((w) => (w.includes(key) ? w.filter((x) => x !== key) : [...w, key]));
  const allWidgets = widgets.length === WIDGET_OPTIONS.length;

  const save = async () => {
    if (saving) return;
    const n = name.trim();
    if (!n) return setError('Role name is required.');
    if (roles.some((r) => r.name.toLowerCase() === n.toLowerCase() && r.id !== editing?.id)) return setError('A role with this name already exists.');
    if (!pagesOn.length) return setError('Give View access to at least one page.');
    setSaving(true);
    const ok = await onSave(editing, n, perms, [...widgets, ...hideCols]);
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
                  <p className="text-xs text-[#94A3B8]">{count} {count === 1 ? 'user' : 'users'} · {new Set(PERMISSION_ROWS.filter((p) => rolePermissions(r)[p.key]).map((p) => p.page)).size} pages</p>
                </div>
                <button type="button" aria-label="Edit role" title="Edit" onClick={() => openEdit(r)} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]">
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Delete role"
                  title={count ? 'Reassign its users first' : 'Delete'}
                  onClick={() => (count ? addToast('Move this role\'s users to another role first.', 'error') : setDeleting(r))}
                  className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {PERMISSION_ROWS.filter((p) => rolePermissions(r)[p.key]).map((p) => {
                  const acts = rolePermissions(r)[p.key] ?? [];
                  return (
                    <span key={p.key} className="rounded-md bg-[#EFF6FF] px-2 py-1 text-xs font-semibold text-[#2563EB]">
                      {p.label}
                      <span className="ml-1 font-normal text-[#64748B]">
                        {acts.length === ALL_ACTIONS.length ? 'Full' : acts.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join('/')}
                      </span>
                    </span>
                  );
                })}
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
        subtitle="Choose what people with this role can see and do on each page."
        maxWidth="max-w-2xl"
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
              <label className="text-xs font-semibold text-[#64748B]">Page permissions</label>
              <button type="button" onClick={toggleAll} className="text-xs font-semibold text-[#2563EB] hover:underline">
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
              <table className="w-full min-w-[420px] text-xs">
                <thead className="bg-slate-50 text-[#64748B]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Page</th>
                    {ACTIONS.map((a) => (
                      <th key={a.key} className="px-2 py-2 text-center font-semibold">{a.label}</th>
                    ))}
                    <th className="px-2 py-2 text-center font-semibold">All</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_ROWS.map((p) => {
                    const cur = perms[p.key] ?? [];
                    return (
                      <Fragment key={p.key}>
                        <tr className={`border-t border-[#E2E8F0]`}>
                          <td className="px-3 py-2 font-semibold text-[#334155]">
                            {p.label}
                            {p.deleteLabel && <span className="block text-[10px] font-semibold text-red-600">Delete = {p.deleteLabel} (never deleted)</span>}
                          </td>
                          {ACTIONS.map((a) => (
                            <td key={a.key} className="px-2 py-2 text-center">
                              <input type="checkbox" aria-label={`${p.label} ${a.key === 'delete' && p.deleteLabel ? p.deleteLabel : a.label}`} title={a.key === 'delete' && p.deleteLabel ? p.deleteLabel : undefined} checked={cur.includes(a.key)} onChange={() => toggleAction(p.key, a.key)} className="size-4 accent-[#2563EB]" />
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" aria-label={`${p.label} all`} checked={cur.length === ALL_ACTIONS.length} onChange={() => toggleRow(p.key)} className="size-4 accent-[#2563EB]" />
                          </td>
                        </tr>
                        {p.key === '/dashboard/finance#expense' && (
                          <tr className="border-t border-[#E2E8F0] bg-rose-50/60">
                            <td colSpan={6} className="px-3 py-2 text-xs font-semibold leading-5 text-red-600">
                              Finance: entries added by a user are visible to the admin, but entries added by the admin are NOT visible to users. Each user only sees the entries they added.
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#94A3B8]">Create, Edit and Delete need View. Reports and User Management are always admin-only.</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold text-[#64748B]">Overview widgets</label>
              <button type="button" onClick={() => setWidgets(allWidgets ? [] : WIDGET_OPTIONS.map((w) => w.key))} className="text-xs font-semibold text-[#2563EB] hover:underline">
                {allWidgets ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WIDGET_OPTIONS.map((w) => {
                const on = widgets.includes(w.key);
                const locked = !!w.page && !pageViewable(w.page);
                return (
                  <label key={w.key} title={locked ? `Needs View on ${PAGE_OPTIONS.find((p) => p.href === w.page)?.label}` : undefined} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-semibold ${locked ? 'cursor-not-allowed border-[#E2E8F0] text-[#CBD5E1]' : on ? 'cursor-pointer border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'cursor-pointer border-[#E2E8F0] text-[#475569] hover:bg-slate-50'}`}>
                    <input type="checkbox" disabled={locked} checked={on && !locked} onChange={() => toggleWidget(w.key)} className="size-4 accent-[#2563EB]" />
                    {w.label}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#94A3B8]">A widget also needs View on its page. Overview itself is shown to everyone.</p>
          </div>
          {pageViewable('/dashboard/products') && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#64748B]">Products table columns</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([['hide-product-cost', 'Manufacture Unit Cost'], ['hide-product-profit', 'Unit Profit']] as const).map(([k, l]) => (
                  <label key={k} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-semibold ${!hideCols.includes(k) ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E2E8F0] text-[#475569] hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={!hideCols.includes(k)} onChange={() => setHideCols((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))} className="size-4 accent-[#2563EB]" />
                    Show {l}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-[#94A3B8]">Untick to hide that column (and its value in the product view) from this role.</p>
            </div>
          )}
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
