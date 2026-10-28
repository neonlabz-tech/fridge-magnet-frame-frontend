'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, TrendingUp } from 'lucide-react';
import type { Transaction } from '@/types/finance';
import { lkr } from '@/components/dashboard/shared/UiKit';

const RANGES = [
  { key: '7D', days: 7 },
  { key: '14D', days: 14 },
  { key: '30D', days: 30 },
  { key: 'Month', days: 0 },
] as const;

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function FlowChart({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('30D');

  const { points, income, expense, start, end } = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    const cfg = RANGES.find((r) => r.key === range)!;
    if (cfg.days === 0) startDate.setDate(1);
    else startDate.setDate(endDate.getDate() - (cfg.days - 1));

    const dayList: Date[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) dayList.push(new Date(d));

    const inc: Record<string, number> = {};
    const exp: Record<string, number> = {};
    transactions
      .filter((t) => t.status === 'completed')
      .forEach((t) => {
        const target = t.kind === 'income' ? inc : exp;
        target[t.date] = (target[t.date] || 0) + t.amount;
      });

    let ci = 0;
    let ce = 0;
    const pts = dayList.map((d) => {
      ci += inc[key(d)] || 0;
      ce += exp[key(d)] || 0;
      return { label: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }), inc: ci, exp: ce };
    });
    return { points: pts, income: ci, expense: ce, start: startDate, end: endDate };
  }, [transactions, range]);

  const W = 1000;
  const H = 220;
  const padX = 24;
  const padY = 20;
  const max = Math.max(1, ...points.map((p) => Math.max(p.inc, p.exp)));
  const x = (i: number) => padX + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - padX * 2));
  const y = (v: number) => H - padY - (v / max) * (H - padY * 2);

  const path = (pick: (p: (typeof points)[number]) => number) => {
    if (!points.length) return '';
    return points
      .map((p, i) => {
        if (i === 0) return `M ${x(0)} ${y(pick(p))}`;
        const px = x(i - 1);
        const cx = (px + x(i)) / 2;
        return `C ${cx} ${y(pick(points[i - 1]))}, ${cx} ${y(pick(p))}, ${x(i)} ${y(pick(p))}`;
      })
      .join(' ');
  };

  const ticks = points.length <= 5 ? points.map((_, i) => i) : [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (points.length - 1)));

  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <TrendingUp size={15} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-[#0F172A]">Financial Flow &amp; Expense Analytics</h2>
          <p className="text-xs text-[#64748B]">Income vs Expense comparison tracking &amp; settlement activity</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#0B1220] p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <CalendarDays size={14} /> {fmt(start)} - {fmt(end)}
          </p>
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  range === r.key ? 'bg-[#2563EB] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="size-2 rounded-full bg-emerald-400" /> Income:{' '}
            <span className="font-bold text-emerald-400">{lkr(income)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="size-2 rounded-full bg-rose-400" /> Expense:{' '}
            <span className="font-bold text-rose-400">{lkr(expense)}</span>
          </span>
          <span className="ml-auto text-slate-300">
            Net:{' '}
            <span className={`font-bold ${income - expense >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
              {income - expense >= 0 ? '+' : '-'}
              {lkr(Math.abs(income - expense))}
            </span>
          </span>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-52 w-full" preserveAspectRatio="none" role="img" aria-label="Income and expense trend">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={padX} x2={W - padX} y1={padY + f * (H - padY * 2)} y2={padY + f * (H - padY * 2)} stroke="rgba(255,255,255,0.06)" />
          ))}
          <path d={path((p) => p.inc)} fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={path((p) => p.exp)} fill="none" stroke="#FB7185" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex justify-between px-1 text-xs text-slate-500">
          {ticks.map((i) => (
            <span key={i}>{points[i]?.label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
