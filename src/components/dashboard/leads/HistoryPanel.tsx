'use client';

import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { inputCls, lkr } from '@/components/dashboard/shared/UiKit';
import { salesOf, type CrmUser, type Lead } from '@/lib/crm';
import { commissionFor, type CommissionTier } from '@/lib/commission';

type Period = 'today' | 'week' | 'month' | 'year';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;

interface Row {
  key: string;
  label: string;
  calls: number;
  leads: number;
  orders: number;
  magnets: number;
  sales: number;
  commission: number | null;
}

/** Calls, new leads, orders, magnets, sales and commission, bucketed by day (today / week / month) or by month (year). */
export default function HistoryPanel({
  isAdmin,
  me,
  users,
  leads,
  tiers,
}: {
  isAdmin: boolean;
  me: string;
  users: CrmUser[];
  leads: Lead[];
  tiers: CommissionTier[];
}) {
  const [period, setPeriod] = useState<Period>('month');
  const [who, setWho] = useState('all');
  const sel = isAdmin ? who : me;
  const pick = (u: string) => sel === 'all' || u === sel;

  const { rows, total } = useMemo(() => {
    const now = new Date();
    const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const byMonth = period === 'year';
    let days: Date[] = [];
    if (period === 'today') days = [sod];
    else if (period === 'week') {
      const mon = new Date(sod);
      mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
      days = Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
    } else if (period === 'month') {
      const n = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      days = Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth(), i + 1));
    } else {
      days = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), i, 1));
    }
    days = days.filter((d) => d.getTime() <= sod.getTime() || (byMonth && d.getMonth() <= now.getMonth()));
    const keyOf = (d: Date) => (byMonth ? monthKey(d) : dayKey(d));
    const map = new Map<string, Row>();
    days.forEach((d) =>
      map.set(keyOf(d), {
        key: keyOf(d),
        label: byMonth
          ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
          : `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} (${d.toLocaleDateString('en-GB', { weekday: 'short' })})`,
        calls: 0,
        leads: 0,
        orders: 0,
        magnets: 0,
        sales: 0,
        commission: byMonth ? 0 : null,
      })
    );
    const at = (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : map.get(keyOf(d)) ?? null;
    };

    leads.forEach((l) => {
      l.history.forEach((h) => {
        if (h.system || !pick(h.by)) return;
        const r = at(h.at);
        if (r) r.calls += 1;
      });
      if (pick(l.owner)) {
        const r = at(l.dateAdded);
        if (r) r.leads += 1;
      }
    });

    // Sales, plus each user's own monthly sales (commission tiers are per user, per month).
    const perUserMonth = new Map<string, number>();
    leads
      .filter((l) => l.status === 'Converted' && pick(l.owner))
      .forEach((l) =>
        salesOf(l).forEach((s) => {
          const d = new Date(s.convertedAt);
          if (Number.isNaN(d.getTime())) return;
          const k = `${l.owner}|${monthKey(d)}`;
          perUserMonth.set(k, (perUserMonth.get(k) ?? 0) + (s.total ?? 0));
          const r = at(s.convertedAt);
          if (!r) return;
          r.orders += 1;
          r.magnets += Number(s.quantity) || 0;
          r.sales += s.total ?? 0;
        })
      );
    const commissionOfMonth = (mk: string) =>
      [...perUserMonth.entries()].filter(([k]) => k.endsWith(`|${mk}`)).reduce((sum, [, v]) => sum + commissionFor(tiers, v).amount, 0);
    if (byMonth) map.forEach((r) => (r.commission = commissionOfMonth(r.key)));

    const list = [...map.values()].reverse();
    const sum = (f: (r: Row) => number) => list.reduce((n, r) => n + f(r), 0);
    const total: Row = {
      key: 'total',
      label: 'Total',
      calls: sum((r) => r.calls),
      leads: sum((r) => r.leads),
      orders: sum((r) => r.orders),
      magnets: sum((r) => r.magnets),
      sales: sum((r) => r.sales),
      commission: byMonth ? sum((r) => r.commission ?? 0) : period === 'month' ? commissionOfMonth(monthKey(now)) : null,
    };
    return { rows: list, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, tiers, period, sel]);

  const heads = [period === 'year' ? 'Month' : 'Date', 'Calls made', 'New leads', 'Orders', 'Magnets sold', 'Sales (LKR)', 'Commission'];

  return (
    <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]"><CalendarDays size={18} /></span>
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">History</h2>
            <p className="text-xs text-[#64748B]">{isAdmin ? 'Calls, leads, sales and commission for the team or one user.' : 'Your calls, leads, sales and commission.'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {isAdmin && (
            <select value={who} onChange={(e) => setWho(e.target.value)} className={`${inputCls} w-44`} aria-label="User">
              <option value="all">All users</option>
              {users.map((u) => <option key={u.username} value={u.username}>{u.name}</option>)}
            </select>
          )}
          <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`h-8 rounded-lg px-3 text-xs font-bold ${period === p.key ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-slate-50'}`}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {heads.map((h, i) => (
                <th key={h} className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B] ${i > 0 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-xs text-[#94A3B8]">No activity in this period.</td></tr>
            ) : (
              rows.map((r) => {
                const empty = !r.calls && !r.leads && !r.orders && !r.sales;
                return (
                  <tr key={r.key} className={empty ? 'opacity-50' : 'hover:bg-[#F8FAFC]/80'}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-[#0F172A]">{r.label}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#0F172A]">{r.calls}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#0F172A]">{r.leads}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#0F172A]">{r.orders}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#0F172A]">{r.magnets}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-[#0F172A]">{lkr(r.sales)}</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">{r.commission === null ? '-' : lkr(r.commission)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#E2E8F0] bg-[#F8FAFC]">
                <td className="px-4 py-3 text-xs font-bold text-[#0F172A]">{total.label}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">{total.calls}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">{total.leads}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">{total.orders}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">{total.magnets}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">{lkr(total.sales)}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600">{total.commission === null ? '-' : lkr(total.commission)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {period !== 'year' && <p className="border-t border-[#F1F5F9] px-4 py-2 text-[11px] text-[#94A3B8]">Commission is worked out per month, so it shows on the Month total and in Year view.</p>}
    </section>
  );
}
