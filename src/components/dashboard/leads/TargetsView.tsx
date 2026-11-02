'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToastStore } from '@/store/toastStore';
import type { DemoSession } from '@/lib/demoAuth';
import { Skeleton } from '@/components/dashboard/shared/Skeleton';
import {
  readCrmUsers,
  readLeads,
  readSession,
  readTargets,
  refreshLeads,
  refreshTargets,
  saveTarget,
  subscribeCrm,
  syncLeads,
  type CrmUser,
  type Lead,
  type Target,
} from '@/lib/crm';
import { refreshTeam } from '@/lib/teamApi';
import { fetchTiers, type CommissionTier } from '@/lib/commission';
import TeamPanel from './TeamPanel';
import CommissionPanel from './CommissionPanel';
import MyTargetsCard from './MyTargetsCard';
import HistoryPanel from './HistoryPanel';

export default function TargetsView() {
  const { addToast } = useToastStore();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [targets, setTargets] = useState<Record<string, Target>>({});
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [tiersLoaded, setTiersLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'team' | 'commission' | 'history'>('commission');

  const isAdmin = session?.role === 'admin';
  const me = session?.username ?? '';

  const reload = useCallback(() => {
    const s = readSession();
    setSession(s);
    setLeads(readLeads());
    setTargets(readTargets());
    setUsers(readCrmUsers());
    setReady(true);
    Promise.all([refreshLeads(), refreshTargets(), refreshTeam()]).then(([l, t]) => {
      setLeads(l);
      setTargets(t);
      setUsers(readCrmUsers());
    });
    fetchTiers().then((t) => {
      if (t) setTiers(t);
      setTiersLoaded(true);
    });
  }, []);

  useEffect(() => {
    reload();
    return subscribeCrm(reload);
  }, [reload]);

  const nameOf = (u: string) => (u === 'admin' ? 'Admin' : users.find((x) => x.username === u)?.name ?? u);

  const reassign = async (from: string, to: string) => {
    try {
      const before = await refreshLeads();
      let moved = 0;
      const next = before.map((l) => {
        if (l.owner !== from || l.status === 'Converted') return l;
        moved += 1;
        return { ...l, owner: to, history: [...l.history, { n: 0, at: new Date().toISOString(), by: 'admin', callStatus: '', result: '', product: '', nextFollowUp: '', system: true, notes: `Reassigned from ${nameOf(from)} to ${nameOf(to)}.` }] };
      });
      await syncLeads(before, next);
      setLeads(await refreshLeads());
      addToast(`${moved} lead(s) reassigned.`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save changes.', 'error');
    }
  };

  const setTarget = async (u: string, t: Target) => {
    try {
      await saveTarget(u, t);
      setTargets((prev) => ({ ...prev, [u]: t }));
      addToast('Targets saved.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save targets.', 'error');
    }
  };

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-6 lg:px-8">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="compact-ui relative mx-auto flex w-full max-w-7xl flex-col px-3 pb-6 pt-2 sm:px-6 sm:pt-3 lg:px-8 lg:pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#0F172A]">Targets & Commission</h1>
        <p className="text-xs text-[#64748B]">
          {isAdmin ? 'Set team targets, reassign leads and manage commission tiers.' : 'Track your commission tiers and what you have earned this month.'}
        </p>
      </div>

      <div className="mb-3 inline-flex w-fit rounded-xl border border-[#E2E8F0] bg-white p-1">
        {([
          ['commission', isAdmin ? 'Commission' : 'Targets & Commission'],
          ...(isAdmin ? [['team', 'Team & Targets']] : []),
          ['history', 'History'],
        ] as unknown as readonly (readonly ['team' | 'commission' | 'history', string])[]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`h-9 rounded-lg px-4 text-xs font-bold ${tab === k ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-slate-50'}`}>{l}</button>
        ))}
      </div>

      {!isAdmin && tab === 'commission' && (
        <div className="mb-4">
          <MyTargetsCard me={me} leads={leads} targets={targets} highlight />
        </div>
      )}

      {tab === 'history' ? (
        <HistoryPanel isAdmin={isAdmin} me={me} users={users} leads={leads} tiers={tiers} />
      ) : isAdmin && tab === 'team' ? (
        <TeamPanel users={users} leads={leads} targets={targets} onSetTarget={setTarget} onReassign={reassign} />
      ) : (
        <CommissionPanel
          isAdmin={isAdmin}
          me={me}
          users={users}
          leads={leads}
          tiers={tiers}
          loaded={tiersLoaded}
          onChanged={() => fetchTiers().then((t) => t && setTiers(t))}
          notify={addToast}
        />
      )}
    </div>
  );
}
