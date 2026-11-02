'use client';

import { CalendarCheck, Magnet, PhoneCall, UserPlus, Wallet, type LucideIcon } from 'lucide-react';
import { DEFAULT_TARGET, metricsFor, type Lead, type Target } from '@/lib/crm';

/** A team member's own progress against the targets the admin set. */
export default function MyTargetsCard({ me, leads, targets, highlight = false }: { me: string; leads: Lead[]; targets: Record<string, Target>; highlight?: boolean }) {
  const m = metricsFor(leads, me);
  const tg = targets[me] ?? DEFAULT_TARGET;
  const rows: { label: string; period: string; value: number; target: number; icon: LucideIcon; tone: string; bar: string; card: string; money?: boolean }[] = [
    { label: 'Calls today', period: 'Today', value: m.callsToday, target: tg.dailyCalls, icon: PhoneCall, tone: 'bg-blue-100 text-blue-600', bar: 'bg-blue-500', card: 'border-blue-200 border-l-[#2563EB] from-blue-50 to-blue-100/60' },
    { label: 'New leads today', period: 'Today', value: m.leadsToday, target: tg.dailyLeads, icon: UserPlus, tone: 'bg-violet-100 text-violet-600', bar: 'bg-violet-500', card: 'border-violet-200 border-l-[#7C3AED] from-violet-50 to-violet-100/60' },
    { label: 'Monthly Magnet Target', period: 'This month', value: m.magnetsMonth, target: tg.monthlyOrders, icon: Magnet, tone: 'bg-amber-100 text-amber-600', bar: 'bg-amber-500', card: 'border-amber-200 border-l-[#F59E0B] from-amber-50 to-amber-100/60' },
    { label: 'Sales this month', period: 'LKR', value: m.salesMonth, target: tg.salesAmount, icon: Wallet, tone: 'bg-emerald-100 text-emerald-600', bar: 'bg-emerald-500', card: 'border-emerald-200 border-l-[#16A34A] from-emerald-50 to-emerald-100/60', money: true },
  ];
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white ${highlight ? "border-amber-300" : "border-[#E2E8F0]"}`}>
      <div className={`flex items-center gap-3 border-b px-4 py-3 border-[#E2E8F0]`}>
        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]"><CalendarCheck size={18} /></span>
        <div>
          <h2 className="text-sm font-bold text-[#0F172A]">My Targets</h2>
          <p className="text-xs text-[#64748B]">Your progress against the targets set by the admin. Daily targets reset every day.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(({ label, period, value, target, icon: Icon, tone, bar, card, money }) => {
          const set = target > 0;
          const pct = set ? Math.min(100, Math.round((value / target) * 100)) : 0;
          const fmt = (n: number) => n.toLocaleString('en-US');
          return (
            <div key={label} className={`rounded-xl border border-l-4 bg-gradient-to-br p-3.5 shadow-sm ${card}`}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className={`flex size-9 items-center justify-center rounded-lg ${tone}`}><Icon size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#0F172A]">{label}</p>
                  <p className="text-[11px] text-[#94A3B8]">{period}</p>
                </div>
                {set ? (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${pct >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-[#475569]'}`}>{pct}%</span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Not set</span>
                )}
              </div>
              <p className="text-lg font-bold text-[#0F172A]">
                {money ? `LKR ${fmt(value)}` : fmt(value)}
                <span className="ml-1 text-xs font-semibold text-[#94A3B8]">{set ? `/ ${money ? 'LKR ' : ''}${fmt(target)}` : ''}</span>
              </p>
              <p className={`mt-1 text-[11px] font-semibold ${!set ? 'text-[#94A3B8]' : value >= target ? 'text-emerald-600' : 'text-amber-600'}`}>
                {!set ? 'No target set yet' : value >= target ? 'Target reached' : `${money ? 'LKR ' : ''}${fmt(target - value)} remaining${period === 'Today' ? ' today' : period === 'This month' || money ? ' this month' : ''}`}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
