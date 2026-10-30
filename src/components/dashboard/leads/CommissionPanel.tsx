'use client';

import { useMemo, useState } from 'react';
import { BadgePercent, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { ConfirmModal, ModalShell, btnGhost, btnPrimary, inputCls, labelCls, lkr } from '@/components/dashboard/shared/UiKit';
import { metricsFor, type CrmUser, type Lead } from '@/lib/crm';
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
  const mySales = metricsFor(leads, me).salesMonth;

  // Admin: pick any month / year to review the team's commission.
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    leads.forEach((l) => {
      const y = l.order?.convertedAt ? new Date(l.order.convertedAt).getFullYear() : NaN;
      if (Number.isFinite(y)) set.add(y);
    });
    return [...set].sort((a, b) => b - a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);
  const salesIn = (username: string) =>
    leads
      .filter((l) => {
        if (l.owner !== username || l.status !== 'Converted' || !l.order?.convertedAt) return false;
        const d = new Date(l.order.convertedAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, l) => sum + (l.order?.total ?? 0), 0);

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
      {!isAdmin && (
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <BadgePercent size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#64748B]">My commission rate</p>
              <p className="text-3xl font-bold text-[#0F172A]">{mine.rate}%</p>
            </div>
            <div className="ml-auto grid grid-cols-2 gap-x-8 gap-y-1 text-xs sm:grid-cols-3">
              <div><p className="font-semibold text-[#64748B]">Sales this month</p><p className="text-sm font-bold text-[#0F172A]">{lkr(mySales)}</p></div>
              <div><p className="font-semibold text-[#64748B]">Commission earned</p><p className="text-sm font-bold text-emerald-600">{lkr(mine.amount)}</p></div>
              <div><p className="font-semibold text-[#64748B]">Current range</p><p className="text-sm font-bold text-[#0F172A]">{mine.index >= 0 ? rangeLabel(tiers, mine.index) : '-'}</p></div>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#F8FAFC] px-3 py-2.5 text-xs text-[#475569]">
            <TrendingUp size={13} className="mr-1.5 inline text-[#2563EB]" />
            {mine.next
              ? <>Sell <b>{lkr(mine.toNext)}</b> more this month to reach the <b>{mine.next.rate}%</b> tier ({lkr(mine.next.minSales)} and above).</>
              : <>You are on the highest commission tier. Keep it up!</>}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">Commission Tiers</h2>
            <p className="text-xs text-[#64748B]">Based on each user&apos;s monthly verified paid sales.</p>
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
                    <tr key={t.id} className={active ? 'bg-emerald-50/60' : 'hover:bg-[#F8FAFC]/80'}>
                      <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">
                        {rangeLabel(tiers, i)}
                        {active && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">You are here</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-[#0F172A]">{t.rate}%</td>
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
