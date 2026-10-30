'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, UserPlus, UserX, Users, Wand2 } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { DEMO_SESSION_KEY, type DemoMember, type DemoSession } from '@/lib/demoAuth';
import RolesPanel from './RolesPanel';
import { DEFAULT_ROLE_NAME, readRoles, type Role } from '@/lib/roles';
import {
  createMember,
  createRole,
  deleteMember,
  deleteRole,
  readCachedMembers,
  refreshTeam,
  resetMemberPassword,
  setMemberStatus,
  updateMember,
  updateRole,
} from '@/lib/teamApi';
import {
  ConfirmModal,
  ModalShell,
  TableFooter,
  btnGhost,
  btnPrimary,
  inputCls,
  labelCls,
} from '@/components/dashboard/shared/UiKit';

const PAGE_SIZE = 8;

const initials = (n: string) => n.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
/* ID prefix comes from the role: "Business Operator" -> BO, "Sales Executive" -> SE, "Sales" -> SA */
const rolePrefix = (role: string) => {
  const words = role.trim().split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 3) : (words[0] ?? 'US').slice(0, 2);
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'US';
};
const slug = (n: string) => n.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '') ?? '';
const genPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return `${Array.from(arr, (n) => chars[n % chars.length]).join('')}@7`;
};

interface Form {
  role: string;
  name: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  confirm: string;
}
const EMPTY: Form = { role: DEFAULT_ROLE_NAME, name: '', email: '', phone: '', username: '', password: '', confirm: '' };

export default function OperatorsView() {
  const { addToast } = useToastStore();
  const [members, setMembers] = useState<DemoMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tab, setTab] = useState<'operators' | 'roles'>('operators');
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DemoMember | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [showPw, setShowPw] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);

  const [creds, setCreds] = useState<{ name: string; username: string; password: string } | null>(null);
  const [resetting, setResetting] = useState<DemoMember | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [deleting, setDeleting] = useState<DemoMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEMO_SESSION_KEY);
      const s = raw ? (JSON.parse(raw) as DemoSession) : null;
      if (s?.role === 'admin') setAdminEmail(s.email ?? '');
    } catch {}
  }, []);

  /** Pulls members and roles from the backend (also refreshes the local cache). */
  const reload = async () => {
    const t = await refreshTeam();
    setMembers(t.members);
    setRoles(t.roles);
    return t;
  };

  useEffect(() => {
    let alive = true;
    // Cached copy first so the page is not empty while the backend answers.
    setMembers(readCachedMembers());
    setRoles(readRoles());
    refreshTeam()
      .then((t) => {
        if (!alive) return;
        setMembers(t.members);
        setRoles(t.roles);
        if (!t.online) addToast('Server is not reachable. Showing the last saved users.', 'error');
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [addToast]);

  const fail = (e: unknown, fallback: string) => addToast(e instanceof Error ? e.message : fallback, 'error');

  const saveRole = async (editingRole: Role | null, name: string, pages: string[]) => {
    try {
      if (editingRole) await updateRole(editingRole.id, { name, pages });
      else await createRole(name, pages);
      await reload();
      addToast(editingRole ? 'Role updated.' : 'Role created.', 'success');
      return true;
    } catch (e) {
      fail(e, 'Could not save role.');
      return false;
    }
  };

  const removeRole = async (role: Role) => {
    try {
      await deleteRole(role.id);
      await reload();
      addToast('Role deleted.', 'success');
      return true;
    } catch (e) {
      fail(e, 'Could not delete role.');
      return false;
    }
  };
  const memberCountByRole = useMemo(
    () => members.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.role]: (acc[m.role] ?? 0) + 1 }), {}),
    [members]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter(
      (m) =>
        (status === 'all' || m.status === status) &&
        (!q || [m.name, m.email, m.phone, m.username, m.id].some((v) => v.toLowerCase().includes(q)))
    );
  }, [members, search, status]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const active = members.filter((m) => m.status === 'Active').length;

  const nextId = (role: string) => {
    const prefix = rolePrefix(role);
    const max = members.reduce((mx, m) => {
      const hit = m.id.match(/^([A-Z0-9]+?)(\d{3,})$/);
      return hit && hit[1] === prefix ? Math.max(mx, Number(hit[2])) : mx;
    }, 0);
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  };

  const openAdd = () => {
    setEditing(null);
    // The dropdown must start on a role that really exists, otherwise it shows the first
    // option while the form still holds the default role (wrong ID prefix).
    const startRole = roles.some((r) => r.name === DEFAULT_ROLE_NAME) ? DEFAULT_ROLE_NAME : roles[0]?.name ?? DEFAULT_ROLE_NAME;
    setForm({ ...EMPTY, role: startRole });
    setErrors({});
    setShowPw(false);
    setUsernameTouched(false);
    setFormOpen(true);
  };
  const openEdit = (m: DemoMember) => {
    setEditing(m);
    setForm({ role: m.role, name: m.name, email: m.email, phone: m.phone, username: m.username, password: '', confirm: '' });
    setErrors({});
    setShowPw(false);
    setUsernameTouched(true);
    setFormOpen(true);
  };

  const set = (k: keyof Form, v: string) => {
    setErrors((p) => ({ ...p, [k]: undefined }));
    setForm((p) => {
      const next = { ...p, [k]: v };
      if (k === 'name' && !usernameTouched && !editing) next.username = slug(v);
      return next;
    });
    if (k === 'username') setUsernameTouched(true);
  };

  const submit = async () => {
    if (busy) return;
    const e: Partial<Record<keyof Form, string>> = {};
    // Login username is the Member ID (new users). Existing users keep the username they already have.
    const newId = nextId(form.role);
    const u = editing ? editing.username : newId;
    if (!form.name.trim()) e.name = 'Full name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (!form.phone.trim()) e.phone = 'Phone number is required.';
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = 'Phone number must be exactly 10 digits (e.g. 0771234567).';
    if (!editing || form.password) {
      if (form.password.length < 6) e.password = 'At least 6 characters.';
      if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    }
    if (members.some((m) => m.email.toLowerCase() === form.email.trim().toLowerCase() && m.id !== editing?.id))
      e.email = 'This email is already used.';
    if (Object.keys(e).length) return setErrors(e);

    setBusy(true);
    try {
      if (editing) {
        await updateMember(editing.id, { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
        if (form.password) await resetMemberPassword(editing.id, form.password);
        await reload();
        addToast('User updated.', 'success');
        setFormOpen(false);
        if (form.password) setCreds({ name: form.name.trim(), username: u, password: form.password });
        return;
      }
      // The backend generates the Member ID (and uses it as the username).
      const created = await createMember({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        password: form.password,
      });
      await reload();
      setFormOpen(false);
      setPage(1);
      setCreds({ name: created.name, username: created.username, password: form.password });
      addToast(`${created.id} created.`, 'success');
    } catch (err2) {
      fail(err2, 'Could not save user.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (m: DemoMember) => {
    const next = m.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await setMemberStatus(m.id, next);
      await reload();
      addToast(`${m.name} is now ${next.toLowerCase()}.`, 'info');
    } catch (e) {
      fail(e, 'Could not change status.');
    }
  };

  const doReset = async () => {
    if (!resetting) return;
    if (resetPw.length < 6) return addToast('Password must be at least 6 characters.', 'error');
    try {
      await resetMemberPassword(resetting.id, resetPw);
      setCreds({ name: resetting.name, username: resetting.username, password: resetPw });
      setResetting(null);
      setResetPw('');
    } catch (e) {
      fail(e, 'Could not reset password.');
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast('Copied to clipboard.', 'success');
    } catch {
      addToast('Could not copy. Select and copy manually.', 'error');
    }
  };

  const err = (m?: string) => (m ? <p className="mt-1 text-xs font-semibold text-rose-600">{m}</p> : null);
  const bd = (m?: string) => (m ? 'border-rose-400' : '');

  const stats = [
    { label: 'Users', value: members.length, icon: Users, tone: 'bg-blue-50 text-[#2563EB]' },
    { label: 'Active', value: active, icon: UserCheck, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Inactive', value: members.length - active, icon: UserX, tone: 'bg-rose-50 text-rose-500' },
  ];

  return (
    <div className="compact-ui relative mx-auto flex w-full max-w-7xl flex-col px-3 pb-6 pt-2 sm:px-6 sm:pt-3 lg:px-8 lg:pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#0F172A]">User Management</h1>
        <p className="text-xs text-[#64748B]">One administrator and your users. Users sign in with their Member ID and the password you set, and see only the pages their role allows.</p>
      </div>

      {/* Admin (only one) */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:flex-row sm:items-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-[#071C40] text-white">
          <ShieldCheck size={20} />
        </span>
        <div className="flex-1">
          <p className="text-xs font-bold text-[#0F172A]">Administrator</p>
          <p className="text-xs text-[#64748B]">Email: <span className="font-semibold text-[#0F172A]">{adminEmail || 'admin'}</span> · Only one admin account</p>
        </div>
        <span className="w-fit rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">Full access - all pages</span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 sm:max-w-xl">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}><Icon size={15} /></span>
            <p className="mt-2 text-xs font-medium text-[#64748B]">{label}</p>
            <p className="text-sm font-bold text-[#0F172A]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 inline-flex w-fit rounded-xl border border-[#E2E8F0] bg-white p-1">
        {([['operators', 'Users'], ['roles', 'Roles & Permissions']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`h-9 rounded-lg px-4 text-xs font-bold ${tab === k ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'roles' && <RolesPanel roles={roles} memberCountByRole={memberCountByRole} onSave={saveRole} onDelete={removeRole} />}

      <section className={`overflow-hidden rounded-xl border border-[#E2E8F0] bg-white ${tab === 'roles' ? 'hidden' : ''}`}>
        <div className="flex flex-col gap-2 border-b border-[#E2E8F0] p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, username or ID..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} className={`${inputCls} sm:w-36`}>
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button type="button" onClick={openAdd} className={btnPrimary}>
            <Plus size={14} /> Add User
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F8FAFC]">
                {['Member ID', 'Name', 'Contact', 'Username', 'Role', 'Joined', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">{h}</th>
                ))}
                <th className="sticky right-0 z-[1] bg-[#F8FAFC] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#64748B] md:static">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {!loaded ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-slate-200/80" /></td></tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-xs text-[#94A3B8]">
                    {members.length === 0 ? 'No users yet. Click "Add User" to create one.' : 'No users match your filters.'}
                  </td>
                </tr>
              ) : (
                rows.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F8FAFC]/80">
                    <td className="px-4 py-3"><span className="rounded-md bg-[#EFF6FF] px-2 py-1 text-xs font-bold text-[#2563EB]">{m.id}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#DBEAFE] text-xs font-bold text-[#1D4ED8]">{initials(m.name)}</span>
                        <span className="text-xs font-bold text-[#0F172A]">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><p className="text-xs text-[#0F172A]">{m.email}</p><p className="text-xs text-[#94A3B8]">{m.phone}</p></td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">{m.username}</td>
                    <td className="px-4 py-3"><span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-600">{m.role}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#64748B]">{m.joinDate}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${m.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{m.status}</span>
                    </td>
                    <td className="sticky right-0 z-[1] bg-white px-4 py-3 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)] md:static md:shadow-none">
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" title="Edit" aria-label="Edit" onClick={() => openEdit(m)} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]"><Pencil size={15} /></button>
                        <button type="button" title="Reset password" aria-label="Reset password" onClick={() => { setResetting(m); setResetPw(genPassword()); }} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-amber-50 hover:text-amber-600"><KeyRound size={15} /></button>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={m.status === 'Active'}
                          title={m.status === 'Active' ? 'Active - click to deactivate' : 'Inactive - click to activate'}
                          onClick={() => toggle(m)}
                          className={`relative mx-1 h-5 w-9 shrink-0 rounded-full transition-colors ${m.status === 'Active' ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}
                        >
                          <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${m.status === 'Active' ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                        <button type="button" title="Delete" aria-label="Delete" onClick={() => setDeleting(m)} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooter page={safePage} pageSize={PAGE_SIZE} total={filtered.length} noun="users" onPage={setPage} />
      </section>

      {/* Add / Edit */}
      <ModalShell
        open={formOpen}
        dirty={editing ? (form.name !== editing.name || form.email !== editing.email || form.phone !== editing.phone || !!form.password || !!form.confirm || form.role !== editing.role) : !!(form.name.trim() || form.email.trim() || form.phone.trim() || form.password || form.confirm)}
        onClose={() => setFormOpen(false)}
        icon={<UserPlus size={18} />}
        title={editing ? 'Edit User' : 'Add User'}
        subtitle={editing ? `${editing.id} - to change the password, use Reset password in the list.` : 'Create a user. Their Member ID is the login username; you set the password.'}
        maxWidth="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} className={btnGhost}>Cancel</button>
            <button type="button" onClick={submit} disabled={busy} className={btnPrimary}>{busy ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}</button>
          </>
        }
      >
        <div className="space-y-3 pt-1">
          <div>
            <label className={labelCls}>Full name</label>
            <input className={`${inputCls} ${bd(errors.name)}`} value={form.name} placeholder="Member name" onChange={(e) => set('name', e.target.value)} />
            {err(errors.name)}
          </div>
          <div>
            <label className={labelCls}>Email address</label>
            <input type="email" className={`${inputCls} ${bd(errors.email)}`} value={form.email} placeholder="member@example.com" onChange={(e) => set('email', e.target.value)} />
            {err(errors.email)}
          </div>
          <div>
            <label className={labelCls}>Phone number</label>
            <input className={`${inputCls} ${bd(errors.phone)}`} value={form.phone} inputMode="numeric" maxLength={10} placeholder="0771234567" onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
            {err(errors.phone)}
            <p className={`mt-1 text-xs ${form.phone && form.phone.length !== 10 ? 'text-rose-600' : 'text-[#94A3B8]'}`}>{form.phone.length}/10 digits</p>
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={`${inputCls} ${editing ? 'appearance-none' : ''}`} value={form.role} disabled={!!editing} onChange={(e) => set('role', e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
              {editing && !roles.some((r) => r.name === form.role) && <option value={form.role}>{form.role}</option>}
            </select>
            {editing && <p className="mt-1 text-xs text-[#94A3B8]">Role can't be changed after the user is created (it decides the Member ID).</p>}
          </div>
          <div>
            <label className={labelCls}>Username (for login)</label>
            <input className={inputCls} value={editing ? editing.username : nextId(form.role)} readOnly />
            {!editing && <p className="mt-1 text-xs text-[#94A3B8]">Auto-filled from the Member ID. Changes when you change the role.</p>}
          </div>
          {!editing && (
            <>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-[#64748B]">Password to share</label>
                <button type="button" onClick={() => { const p = genPassword(); setForm((f) => ({ ...f, password: p, confirm: p })); setShowPw(true); }} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">
                  <Wand2 size={12} /> Generate
                </button>
              </div>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} className={`${inputCls} pr-9 ${bd(errors.password)}`} value={form.password} placeholder="At least 6 characters" autoComplete="new-password" onChange={(e) => set('password', e.target.value)} />
                <button type="button" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {err(errors.password)}
            </div>
            <div>
              <label className={labelCls}>Confirm password</label>
              <input type={showPw ? 'text' : 'password'} className={`${inputCls} ${bd(errors.confirm)}`} value={form.confirm} placeholder="Repeat password" autoComplete="new-password" onChange={(e) => set('confirm', e.target.value)} />
              {err(errors.confirm)}
            </div>
            </>
          )}
          {!editing && (
            <p className="rounded-lg bg-[#EFF6FF] px-3 py-2.5 text-xs leading-5 text-[#1D4ED8]">
              Member ID is generated automatically from the role (next one is <b>{nextId(form.role)}</b>). This ID is also the user&apos;s login username, so you only need to set the password.
            </p>
          )}
        </div>
      </ModalShell>

      {/* Credentials to share */}
      <ModalShell
        open={!!creds}
        onClose={() => setCreds(null)}
        icon={<KeyRound size={18} />}
        title="Share login details"
        subtitle={creds ? `Give these to ${creds.name}. They can sign in on the login page.` : ''}
        maxWidth="max-w-sm"
        footer={<button type="button" onClick={() => setCreds(null)} className={btnPrimary}>Done</button>}
      >
        {creds && (
          <div className="space-y-2 pt-1">
            {([['Username', creds.username], ['Password', creds.password]] as const).map(([l, v]) => (
              <div key={l} className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-[#64748B]">{l}</p>
                  <p className="select-all text-xs font-bold text-[#0F172A]">{v}</p>
                </div>
                <button type="button" aria-label={`Copy ${l}`} onClick={() => copy(v)} className="flex size-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-white"><Copy size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => copy(`Username: ${creds.username}\nPassword: ${creds.password}`)} className={`${btnGhost} w-full`}>
              <Copy size={13} /> Copy both
            </button>
            <p className="text-xs leading-5 text-[#94A3B8]">They can open only the pages allowed for their role.</p>
          </div>
        )}
      </ModalShell>

      {/* Reset password */}
      <ModalShell
        open={!!resetting}
        onClose={() => setResetting(null)}
        icon={<KeyRound size={18} />}
        title="Reset password"
        subtitle={resetting ? `${resetting.name} (${resetting.username})` : ''}
        maxWidth="max-w-sm"
        footer={
          <>
            <button type="button" onClick={() => setResetting(null)} className={btnGhost}>Cancel</button>
            <button type="button" onClick={doReset} className={btnPrimary}>Save password</button>
          </>
        }
      >
        <div className="pt-1">
          <label className={labelCls}>New password</label>
          <div className="flex gap-2">
            <input className={inputCls} value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
            <button type="button" onClick={() => setResetPw(genPassword())} className={btnGhost}><Wand2 size={13} /></button>
          </div>
        </div>
      </ModalShell>

      <ConfirmModal
        open={!!deleting}
        title="Delete user?"
        message={<>This permanently removes <b>{deleting?.name}</b> and their login. This cannot be undone.</>}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteMember(deleting.id);
            await reload();
            addToast('User deleted.', 'success');
          } catch (e) {
            fail(e, 'Could not delete user.');
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
