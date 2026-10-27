'use client';

import { useState } from 'react';
import { ArrowRightLeft, Target as TargetIcon } from 'lucide-react';
import { ModalShell, btnGhost, btnPrimary, inputCls, labelCls } from '@/components/dashboard/shared/UiKit';
import { DEFAULT_TARGET, metricsFor, type CrmUser, type Lead, type Target } from '@/lib/crm';

const pct = (v: number, t: number) => (t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0);

function Bar({ value, target, text }: { value: number; target: number; text: string }) {
  const p = pct(value, target);
  return (
    <div className="min-w-[110px]">
      <p className="text-xs font-semibold text-[#0F172A]">{text}</p>
      <div className="mt-1 h-1.5 rounded-full bg-[#F1F5F9]">
        <div className={`h-1.5 rounded-full ${p >= 100 ? 'bg-emerald-500' : p >= 50 ? 'bg-[#2563EB]' : 'bg-amber-400'}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export default function TeamPanel({
  users,
  leads,
  targets,
  onSetTarget,
  onReassign,
}: {
  users: CrmUser[];
  leads: Lead[];
  targets: Record<string, Target>;
  onSetTarget: (username: string, t: Target) => void;
  onReassign: (from: string, to: string) => void;
}) {
  const [editing, setEditing] = useState<CrmUser | null>(null);
  const [t, setT] = useState<Target>(DEFAULT_TARGET);
  const [moving, setMoving] = useState<CrmUser | null>(null);
  const [to, setTo] = useState('');

  return (
    <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <thead>
            <tr className="bg-[#F8FAFC]">
              {['User', 'Leads', 'Calls today', 'New leads today', 'Answered', 'Pending follow-ups', 'Converted (month)', 'Sales (month)', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {users.length === 0 ? (
              <tr><td colSpan={9} className="py-14 text-center text-xs text-[#94A3B8]">No sales users yet. Create users in User Management first.</td></tr>
            ) : (
              users.map((u) => {
                const m = metricsFor(leads, u.username);
                const tg = targets[u.username] ?? DEFAULT_TARGET;
                return (
                  <tr key={u.username} className="hover:bg-[#F8FAFC]/80">
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-[#0F172A]">{u.name}</p>
                      <p className="text-xs text-[#94A3B8]">{u.username}{u.active ? '' : ' · inactive'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-[#0F172A]">{m.leads}</td>
                    <td className="px-4 py-3"><Bar value={m.callsToday} target={tg.dailyCalls} text={`${m.callsToday} / ${tg.dailyCalls}`} /></td>
                    <td className="px-4 py-3"><Bar value={m.leadsToday} target={tg.dailyLeads} text={`${m.leadsToday} / ${tg.dailyLeads}`} /></td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">{m.answeredToday}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-amber-600">{m.pendingFollowUps}{m.dueToday ? ` (${m.dueToday} due)` : ''}</td>
                    <td className="px-4 py-3"><Bar value={m.convertedMonth} target={tg.monthlyOrders} text={`${m.convertedMonth} / ${tg.monthlyOrders}`} /></td>
                    <td className="px-4 py-3"><Bar value={m.salesMonth} target={tg.salesAmount} text={`${m.salesMonth.toLocaleString('en-US')} / ${tg.salesAmount.toLocaleString('en-US')}`} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button type="button" title="Set targets" aria-label="Set targets" onClick={() => { setEditing(u); setT(tg); }} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]"><TargetIcon size={15} /></button>
                        <button type="button" title="Reassign pending leads" aria-label="Reassign pending leads" onClick={() => { setMoving(u); setTo(''); }} className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-amber-50 hover:text-amber-600"><ArrowRightLeft size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ModalShell
        open={!!editing}
        onClose={() => setEditing(null)}
        icon={<TargetIcon size={18} />}
        title="Set targets"
        subtitle={editing ? `${editing.name} - only the admin can change these.` : ''}
        maxWidth="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
            <button type="button" onClick={() => { if (editing) onSetTarget(editing.username, t); setEditing(null); }} className={btnPrimary}>Save Targets</button>
          </>
        }
      >
        <div className="space-y-4 pt-1">
          {([
            ['Daily target', [['dailyCalls', 'Calls per day'], ['dailyLeads', 'New leads per day']]],
            ['Monthly target', [['monthlyOrders', 'Orders (converted leads)'], ['salesAmount', 'Sales amount (LKR)']]],
          ] as const).map(([title, fields]) => (
            <div key={title}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748B]">{title}</p>
              <div className="grid grid-cols-2 gap-3">
                {fields.map(([k, l]) => (
                  <div key={k}>
                    <label className={labelCls}>{l}</label>
                    <input type="number" min={0} placeholder="0" className={inputCls} value={t[k] || ''} onChange={(e) => setT({ ...t, [k]: Number(e.target.value) || 0 })} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ModalShell>

      <ModalShell
        open={!!moving}
        onClose={() => setMoving(null)}
        icon={<ArrowRightLeft size={18} />}
        title="Reassign pending leads"
        subtitle={moving ? `Move ${moving.name}'s unfinished leads to another user. History is kept.` : ''}
        maxWidth="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setMoving(null)} className={btnGhost}>Cancel</button>
            <button type="button" disabled={!to} onClick={() => { if (moving && to) onReassign(moving.username, to); setMoving(null); }} className={btnPrimary}>Reassign</button>
          </>
        }
      >
        <div className="pt-1">
          <label className={labelCls}>Move to</label>
          <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Select user</option>
            {users.filter((u) => u.active && u.username !== moving?.username).map((u) => (
              <option key={u.username} value={u.username}>{u.name} ({u.username})</option>
            ))}
          </select>
          {moving && (
            <p className="mt-2 text-xs text-[#64748B]">
              {leads.filter((l) => l.owner === moving.username && l.status !== 'Converted').length} pending lead(s) will move.
            </p>
          )}
        </div>
      </ModalShell>
    </section>
  );
}
