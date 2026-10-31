'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgePercent, CalendarClock, CheckCircle2, ListChecks, Users, type LucideIcon } from 'lucide-react';
import {
  DEFAULT_TARGET,
  metricsFor,
  readLeads,
  readSession,
  readTargets,
  refreshLeads,
  refreshTargets,
  type Lead,
  type Target,
} from '@/lib/crm';
import { commissionFor, fetchTiers, type CommissionTier } from '@/lib/commission';

/** "Leads & Followups" section shown first on the Overview for team members with Leads access. */
export default function LeadsOverview() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [me, setMe] = useState('');

  useEffect(() => {
    setMe(readSession()?.username ?? '');
    setLeads(readLeads());
    setTargets(readTargets());
    let alive = true;
    Promise.all([refreshLeads(), refreshTargets(), fetchTiers()]).then(([l, t, tr]) => {
      if (!alive) return;
      setLeads(l);
      setTargets(t);
      if (tr) setTiers(tr);
    });
    return () => {
      alive = false;
    };
  }, []);

  const m = metricsFor(leads, me);
  const tg = targets[me] ?? DEFAULT_TARGET;
  const com = commissionFor(tiers, m.salesMonth);
  const converted = leads.filter((l) => l.owner === me && l.status === 'Converted').length;

  const cards: { label: string; value: string; note: string; icon: LucideIcon; tone: string; card: string }[] = [
    { label: 'My Leads', value: String(m.leads), note: 'Assigned to you', icon: Users, tone: 'bg-blue-50 text-[#2563EB]', card: 'bg-blue-100/70 border-blue-200 hover:bg-blue-100' },
    { label: 'Follow Ups', value: String(m.pendingFollowUps), note: 'In progress', icon: ListChecks, tone: 'bg-amber-50 text-amber-500', card: 'bg-amber-100/70 border-amber-200 hover:bg-amber-100' },
    { label: 'Due Today', value: String(m.dueToday), note: 'Call these first', icon: CalendarClock, tone: 'bg-rose-50 text-rose-500', card: 'bg-rose-100/70 border-rose-200 hover:bg-rose-100' },
    { label: 'Converted', value: String(converted), note: 'All time', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600', card: 'bg-emerald-100/70 border-emerald-200 hover:bg-emerald-100' },
    { label: 'My Commission', value: `${com.rate}%`, note: `LKR ${com.amount.toLocaleString('en-US')} this month`, icon: BadgePercent, tone: 'bg-emerald-50 text-emerald-600', card: 'bg-emerald-100/70 border-emerald-200 hover:bg-emerald-100' },
  ];

  const bars = [
    ['Calls today', m.callsToday, tg.dailyCalls],
    ['New leads today', m.leadsToday, tg.dailyLeads],
    ['Monthly Magnet Target', m.magnetsMonth, tg.monthlyOrders],
    ['Sales this month (LKR)', m.salesMonth, tg.salesAmount],
  ] as const;

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-bold text-[#0F172A]">Leads &amp; Followups</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map(({ label, value, note, icon: Icon, tone, card }) => (
          <Link key={label} href="/dashboard/leads" className={`min-w-0 rounded-xl border p-4 transition-shadow hover:shadow-md ${card}`}>
            <span className={`mb-2 flex size-8 items-center justify-center rounded-lg bg-white ${tone.split(' ')[1]}`}><Icon size={16} /></span>
            <p className="text-xs font-semibold text-[#64748B]">{label}</p>
            <p className="text-lg font-bold text-[#0F172A]">{value}</p>
            <p className="text-[11px] text-[#94A3B8]">{note}</p>
          </Link>
        ))}
      </div>
      <Link href="/dashboard/leads" className="grid grid-cols-1 gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        {bars.map(([l, v, t]) => {
          const p = t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0;
          return (
            <div key={l}>
              <div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-[#64748B]">{l}</span><span className="font-bold text-[#0F172A]">{v.toLocaleString('en-US')} / {t > 0 ? t.toLocaleString('en-US') : 'target not set'}</span></div>
              <div className="h-2 rounded-full bg-[#F1F5F9]"><div className={`h-2 rounded-full ${p >= 100 ? 'bg-emerald-500' : 'bg-[#2563EB]'}`} style={{ width: `${p}%` }} /></div>
            </div>
          );
        })}
      </Link>
    </section>
  );
}
