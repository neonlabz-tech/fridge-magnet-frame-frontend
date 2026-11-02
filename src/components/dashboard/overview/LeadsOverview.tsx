'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MyTargetsCard from '@/components/dashboard/leads/MyTargetsCard';
import MyCommissionCards from '@/components/dashboard/leads/MyCommissionCards';
import { fetchTiers, type CommissionTier } from '@/lib/commission';
import { CalendarClock, CheckCircle2, ListChecks, Users, type LucideIcon } from 'lucide-react';
import {
  metricsFor,
  readLeads,
  readSession,
  readTargets,
  refreshLeads,
  refreshTargets,
  type Lead,
  type Target,
} from '@/lib/crm';

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
  const converted = leads.filter((l) => l.owner === me && l.status === 'Converted').length;

  const cards: { label: string; value: string; note: string; icon: LucideIcon; tone: string; card: string }[] = [
    { label: 'My Leads', value: String(m.leads), note: 'Assigned to you', icon: Users, tone: 'bg-blue-50 text-[#2563EB]', card: 'bg-blue-100/70 border-blue-200 hover:bg-blue-100' },
    { label: 'Follow Ups', value: String(m.pendingFollowUps), note: 'In progress', icon: ListChecks, tone: 'bg-amber-50 text-amber-500', card: 'bg-amber-100/70 border-amber-200 hover:bg-amber-100' },
    { label: 'Due Today', value: String(m.dueToday), note: 'Call these first', icon: CalendarClock, tone: 'bg-rose-50 text-rose-500', card: 'bg-rose-100/70 border-rose-200 hover:bg-rose-100' },
    { label: 'Converted', value: String(converted), note: 'All time', icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600', card: 'bg-emerald-100/70 border-emerald-200 hover:bg-emerald-100' },
  ];

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-sm font-bold text-[#0F172A]">Leads &amp; Followups</h2>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tone, card }) => (
          <Link key={label} href="/dashboard/leads" className={`min-w-0 rounded-xl border p-4 transition-shadow hover:shadow-md ${card}`}>
            <span className={`mb-2 flex size-8 items-center justify-center rounded-lg bg-white ${tone.split(' ')[1]}`}><Icon size={16} /></span>
            <p className="text-xs font-semibold text-[#64748B]">{label}</p>
            <p className="text-lg font-bold text-[#0F172A]">{value}</p>
            <p className="text-[11px] text-[#94A3B8]">{note}</p>
          </Link>
        ))}
      </div>
      <MyTargetsCard me={me} leads={leads} targets={targets} highlight />
      <div className="mt-3">
        <MyCommissionCards me={me} leads={leads} tiers={tiers} />
      </div>
    </section>
  );
}
