'use client';

import { useMemo, useState } from 'react';
import { Award, BadgePercent, Pencil, Plus, Trash2 } from 'lucide-react';
import MyCommissionCards from './MyCommissionCards';
import { ConfirmModal, ModalShell, btnGhost, btnPrimary, inputCls, labelCls, lkr } from '@/components/dashboard/shared/UiKit';
import { metricsFor, salesOf, type CrmUser, type Lead } from '@/lib/crm';
import { commissionFor, deleteTier, rangeLabel, saveTier, type CommissionTier } from '@/lib/commission';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CommissionPanel({
  isAdmin,
  me,
  users,
  leads,
  tiers,
  loaded,
  onChanged,
  notify,
}: {
  isAdmin: boolean;
  me: string;
  users: CrmUser[];
  leads: Lead[];
  tiers: CommissionTier[];
  loaded: boolean;
  onChanged: () => void;
  notify: (msg: string, type: 'success' | 'error') => void;
}) {
  const [editing, setEditing] = useState<{ id?: string; minSales: string; rate: string } | null>(null);
  const [deleting, setDeleting] = useState<CommissionTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mine = commissionFor(tiers, metricsFor(leads, me).salesMonth);

  // Admin: pick any month / year to review the team's commission.
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    leads.forEach((l) => {
      salesOf(l).forEach((x) => {
        const y = x.convertedAt ? new Date(x.convertedAt).getFullYear() : NaN;
        if (Number.isFinite(y)) set.add(y);
      });
    });
    return [...set].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);
  const salesIn = (username: string) =>
    leads
      .filter((l) => l.owner === username && l.status === 'Converted')
      .flatMap((l) => salesOf(l))
      .filter((x) => {
        if (!x.convertedAt) return false;
        const d = new Date(x.convertedAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, x) => sum + (x.total ?? 0), 0);

  const openNew = () => {
    setError(null);
    setEditing({ minSales: '', rate: '' });
  };
  const openEdit = (t: CommissionTier) => {
    setError(null);
    setEditing({ id: t.id, minSales: String(t.minSales), rate: String(t.rate) });
  };

  const submit = async () => {
    if (!editing) return;
    const minSales = Number(editing.minSales);
    const rate = Number(editing.rate);
    if (editing.minSales.trim() === '' || !Number.isFinite(minSales) || minSales < 0) return setError('Enter the sales amount this tier starts from.');
    if (editing.rate.trim() === '' || !Number.isFinite(rate) || rate < 0 || rate > 100) return setError('Commission rate must be between 0 and 100.');
    if (tiers.some((t) => t.minSales === minSales && t.id !== editing.id)) return setError('A tier starting at this amount already exists.');
    setBusy(true);
    try {
      await saveTier({ id: editing.id, minSales, rate });
      notify(editing.id ? 'Commission tier updated.' : 'Commission tier added.', 'success');
      setEditing(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the tier.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await deleteTier(deleting.id);
      notify('Commission tier deleted.', 'success');
      setDeleting(null);
      onChanged();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not delete the tier.', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!isAdmin && <MyCommissionCards me={me} leads={leads} tiers={tiers} />}

      <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
        <div className={`flex items-center justify-between px-4 py-3 ${isAdmin ? 'border-b border-[#E2E8F0]' : 'relative bg-[#0B3A7A] bg-[radial-gradient(ellipse_60%_120%_at_100%_100%,rgba(37,99,235,0.85),transparent_70%)] pb-8 pt-4'}`}>
          <div className="flex items-center gap-3">
            {!isAdmin && <span className="flex size-11 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-md"><Award size={22} /></span>}
            <div>
              <h2 className={`text-sm font-bold ${isAdmin ? 'text-[#0F172A]' : 'text-lg text-white'}`}>Commission Tiers</h2>
              <p className={`text-xs ${isAdmin ? 'text-[#64748B]' : 'text-blue-100/90'}`}>Based on each user&apos;s monthly verified paid sales.</p>
            </div>
          </div>
          {isAdmin && (
            <button type="button" onClick={openNew} className={`${btnPrimary} gap-1.5`}>
              <Plus size={14} /> Add Tier
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F8FAFC]">
                {['Monthly verified paid sales', 'Rate', 'Commission payable', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {!loaded ? (
                <tr><td colSpan={4} className="py-10 text-center text-xs text-[#94A3B8]">Loading tiers...</td></tr>
              ) : tiers.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-xs text-[#94A3B8]">No commission tiers yet.{isAdmin ? ' Click "Add Tier" to create one.' : ''}</td></tr>
              ) : (
                tiers.map((t, i) => {
                  const active = !isAdmin && mine.index === i;
                  return (
                    <tr key={t.id} className={active ? 'bg-blue-100/80 shadow-[inset_4px_0_0_#3B82F6]' : 'hover:bg-[#F8FAFC]/80'}>
                      <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">
                        {rangeLabel(tiers, i)}
                        {active && <span className="ml-2 rounded-md bg-[#2563EB] px-2 py-0.5 text-[10px] font-bold text-white">You are here</span>}
                      </td>
                      <td className={`px-4 py-3 font-bold ${isAdmin ? "text-xs text-[#0F172A]" : "text-base text-[#1D4ED8]"}`}>{t.rate}%</td>
                      <td className="px-4 py-3 text-xs text-[#475569]">{t.rate > 0 ? `${t.rate}% of verified paid sales` : 'No commission'}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button type="button" aria-label="Edit tier" onClick={() => openEdit(t)} className="rounded-lg border border-[#E2E8F0] p-1.5 text-[#64748B] hover:bg-slate-50"><Pencil size={13} /></button>
                            <button type="button" aria-label="Delete tier" onClick={() => setDeleting(t)} className="rounded-lg border border-[#E2E8F0] p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A]">Team Commission ({MONTHS[month]} {year})</h2>
              <p className="text-xs text-[#64748B]">Where each user stands against the tiers above.</p>
            </div>
            <div className="flex gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${inputCls} w-36`} aria-label="Month">
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${inputCls} w-24`} aria-label="Year">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  {['User', 'Sales (month)', 'Range reached', 'Rate', 'Commission', 'To next tier'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-[#94A3B8]">No sales users yet.</td></tr>
                ) : (
                  users.map((u) => {
                    const sales = salesIn(u.username);
                    const c = commissionFor(tiers, sales);
                    return (
                      <tr key={u.username} className="hover:bg-[#F8FAFC]/80">
                        <td className="px-4 py-3"><p className="text-xs font-bold text-[#0F172A]">{u.name}</p><p className="text-xs text-[#94A3B8]">{u.username}</p></td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">{lkr(sales)}</td>
                        <td className="px-4 py-3 text-xs text-[#475569]">{c.index >= 0 ? rangeLabel(tiers, c.index) : '-'}</td>
                        <td className="px-4 py-3 text-xs font-bold text-[#0F172A]">{c.rate}%</td>
                        <td className="px-4 py-3 text-xs font-bold text-emerald-600">{lkr(c.amount)}</td>
                        <td className="px-4 py-3 text-xs text-[#64748B]">{c.next ? `${lkr(c.toNext)} for ${c.next.rate}%` : 'Top tier'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ModalShell
        open={!!editing}
        onClose={() => setEditing(null)}
        icon={<BadgePercent size={18} />}
        title={editing?.id ? 'Edit Commission Tier' : 'Add Commission Tier'}
        subtitle="Users whose monthly verified paid sales reach this amount earn this rate, until the next tier starts."
        maxWidth="max-w-md"
        footer={
          <>
            {error && <span className="mr-auto text-xs font-semibold text-rose-600">{error}</span>}
            <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void submit()}>{busy ? 'Saving...' : 'Save Tier'}</button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Sales from (LKR)</label>
              <input className={inputCls} inputMode="numeric" value={editing.minSales} placeholder="e.g. 270000" onChange={(e) => setEditing({ ...editing, minSales: e.target.value.replace(/[^\d]/g, '') })} />
            </div>
            <div>
              <label className={labelCls}>Commission rate (%)</label>
              <input className={inputCls} inputMode="decimal" value={editing.rate} placeholder="e.g. 2" onChange={(e) => setEditing({ ...editing, rate: e.target.value.replace(/[^\d.]/g, '') })} />
            </div>
          </div>
        )}
      </ModalShell>

      <ConfirmModal
        open={!!deleting}
        title="Delete commission tier"
        message={deleting ? <>Delete the <b>{deleting.rate}%</b> tier starting at <b>{lkr(deleting.minSales)}</b>? Users in this range will fall back to the tier below.</> : null}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
