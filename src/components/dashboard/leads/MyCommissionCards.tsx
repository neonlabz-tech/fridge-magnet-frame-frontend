'use client';

import { BadgePercent, BarChart3, Coins, HandCoins, Target } from 'lucide-react';
import { lkr } from '@/components/dashboard/shared/UiKit';
import { metricsFor, type Lead } from '@/lib/crm';
import { commissionFor, rangeLabel, type CommissionTier } from '@/lib/commission';

/** A team member's commission summary: rate, sales, earned, range and the next-tier message. */
export default function MyCommissionCards({ me, leads, tiers }: { me: string; leads: Lead[]; tiers: CommissionTier[] }) {
  const mySales = metricsFor(leads, me).salesMonth;
  const mine = commissionFor(tiers, mySales);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ['My Commission Rate', `${mine.rate}%`, BadgePercent, 'from-blue-50 to-blue-100/70 border-blue-200 border-l-[#2563EB]', 'bg-blue-100 text-[#2563EB] border-blue-200', 'text-[#1D4ED8]', 'rgba(59,130,246,0.22)'],
          ['Sales This Month', lkr(mySales), Coins, 'from-rose-50 to-rose-100/70 border-rose-200 border-l-[#E11D48]', 'bg-rose-100 text-[#E11D48] border-rose-200', 'text-[#E11D48]', 'rgba(244,63,94,0.20)'],
          ['Commission Earned', lkr(mine.amount), HandCoins, 'from-emerald-50 to-emerald-100/70 border-emerald-200 border-l-[#16A34A]', 'bg-emerald-100 text-[#16A34A] border-emerald-200', 'text-[#15803D]', 'rgba(16,185,129,0.20)'],
          ['Current Range', mine.index >= 0 ? rangeLabel(tiers, mine.index) : '-', BarChart3, 'from-violet-50 to-violet-100/70 border-violet-200 border-l-[#7C3AED]', 'bg-violet-100 text-[#7C3AED] border-violet-200', 'text-[#6D28D9]', 'rgba(139,92,246,0.22)'],
        ] as const).map(([label, value, Icon, card, iconTone, valueTone, glow]) => (
          <div key={label} className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border border-l-4 bg-gradient-to-br p-4 shadow-sm ${card}`}>
            <span className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 55% at 100% 115%, ${glow}, transparent 70%)` }} />
            <span className={`relative flex size-12 shrink-0 items-center justify-center rounded-xl border ${iconTone}`}><Icon size={22} /></span>
            <span className="relative h-9 w-px bg-black/10" />
            <div className="relative min-w-0">
              <p className="text-xs font-semibold text-[#334155]">{label}</p>
              <p className={`truncate text-xl font-extrabold ${valueTone}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-100 to-rose-50 px-4 py-3 text-sm text-[#4C0519] shadow-sm">
        <Target size={22} className="shrink-0 text-[#E11D48]" />
        <span className="h-6 w-px bg-rose-200" />
        {mine.next
          ? <span>Sell <b className="text-[#DC2626]">{lkr(mine.toNext)}</b> more this month to reach the <b className="text-[#DC2626]">{mine.next.rate}%</b> tier ({lkr(mine.next.minSales)} and above).</span>
          : <span>You are on the highest commission tier. Keep it up!</span>}
      </div>
    </div>
  );
}
