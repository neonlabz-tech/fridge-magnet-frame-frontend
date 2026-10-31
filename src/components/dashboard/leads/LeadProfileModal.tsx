'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { ModalShell, btnGhost, btnPrimary, inputCls, labelCls, textareaCls } from '@/components/dashboard/shared/UiKit';
import {
  CALL_STATUSES,
  FOLLOW_UP_STATUSES,
  LEAD_STATUSES,
  SOURCES,
  displayPerson,
  phoneDigits,
  type CrmUser,
  type FollowUp,
  type Lead,
} from '@/lib/crm';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const fmtDT = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const toLocalInput = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export interface ProfileSave {
  lead: Lead;
  converting: boolean; // status was changed to Converted in this save
}

type Rec = { index: number | null; callStatus: string; status: string; notes: string; next: string };

export default function LeadProfileModal({
  open,
  lead,
  isNew,
  isAdmin,
  me,
  users,
  leads,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  lead: Lead | null;
  isNew: boolean;
  isAdmin: boolean;
  me: string;
  users: CrmUser[];
  /** Every lead, used to reject a phone number that is already uploaded. */
  leads: Lead[];
  onClose: () => void;
  onSave: (r: ProfileSave) => void;
  onDelete: (l: Lead) => void;
}) {
  const [d, setD] = useState<Lead | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [fe, setFe] = useState<{ business?: string; phone?: string }>({});
  const [rec, setRec] = useState<Rec | null>(null);

  useEffect(() => {
    if (!open || !lead) return;
    setD(JSON.parse(JSON.stringify(lead)) as Lead);
    setConfirmDel(null);
    setErr('');
    setFe({});
    setRec(null);
  }, [open, lead]);

  if (!d || !lead) return null;

  const wasConverted = lead.status === 'Converted';
  const becomingConverted = d.status === 'Converted' && !wasConverted;
  const who = me || 'admin';
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => {
    setErr('');
    if (k === 'business' || k === 'phone') setFe((p) => ({ ...p, [k]: undefined }));
    setD((p) => (p ? { ...p, [k]: v } : p));
  };

  const dupOf = (phone: string) => {
    const digits = phoneDigits(phone);
    if (digits.length < 10) return null;
    return leads.find((l) => l.id !== d.id && phoneDigits(l.phone) === digits) ?? null;
  };
  const dup = dupOf(d.phone);

  /** The lead's main status / call status always follow its latest follow-up record. */
  const withLatest = (base: Lead, history: FollowUp[]): Lead => {
    if (wasConverted) return { ...base, history };
    const last = [...history].reverse().find((h) => !h.system && h.status && (LEAD_STATUSES as readonly string[]).includes(h.status));
    if (!last) return { ...base, history, status: history.some((h) => !h.system) ? base.status : 'New' };
    return { ...base, history, status: last.status as Lead['status'], callStatus: last.callStatus || base.callStatus, result: last.status as string };
  };

  const saveRecord = () => {
    if (!rec) return;
    const now = new Date().toISOString();
    const nextIso = rec.next ? new Date(rec.next).toISOString() : '';
    if (rec.index === null) {
      const n = d.history.filter((h) => !h.system).length + 1;
      const entry: FollowUp = { n, at: now, by: who, callStatus: rec.callStatus, result: rec.status, status: rec.status, product: d.product, notes: rec.notes.trim(), nextFollowUp: nextIso };
      setD({ ...withLatest(d, [...d.history, entry]), nextFollowUp: nextIso });
    } else {
      const history = d.history.map((h, i) =>
        i === rec.index
          ? {
              ...h,
              callStatus: rec.callStatus,
              result: rec.status,
              status: rec.status,
              notes: rec.notes.trim(),
              nextFollowUp: nextIso,
              edits: [...(h.edits ?? []), { at: now, by: who, before: JSON.stringify({ callStatus: h.callStatus, status: h.status ?? h.result, notes: h.notes, nextFollowUp: h.nextFollowUp }) }],
            }
          : h
      );
      setD(withLatest(d, history));
    }
    setRec(null);
  };

  const deleteRecord = (index: number) => {
    const h = d.history[index];
    const rest = d.history.filter((_, i) => i !== index);
    const history: FollowUp[] = [
      ...rest,
      { n: 0, at: new Date().toISOString(), by: who, callStatus: '', result: '', product: '', nextFollowUp: '', system: true, notes: `Record #${h.n} (${h.callStatus}${h.status || h.result ? `, ${h.status || h.result}` : ''}) was deleted by ${displayPerson(who)}.` },
    ];
    setD(withLatest(d, history));
    setConfirmDel(null);
  };

  const submit = () => {
    const errors: { business?: string; phone?: string } = {};
    if (!d.business.trim()) errors.business = 'Business / customer name is required.';
    if (!d.phone.trim()) errors.phone = 'Phone number is required.';
    else if (!/^\d{10}$/.test(d.phone.trim())) errors.phone = 'Phone number must be exactly 10 digits (e.g. 0771234567).';
    else if (dup) errors.phone = `This phone number is already uploaded in lead ${dup.id}.`;
    setFe(errors);
    if (Object.keys(errors).length) {
      setErr('Please fix the highlighted fields.');
      return;
    }
    if (rec) return setErr('Save or cancel the follow-up record you are editing first.');
    onSave({ lead: { ...d, business: d.business.trim(), phone: d.phone.trim() }, converting: becomingConverted });
  };

  const phoneError = fe.phone || (dup ? `This phone number is already uploaded in lead ${dup.id}.` : '');

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={<UserRound size={18} />}
      title={isNew ? 'Add Lead' : 'Lead details & follow-ups'}
      subtitle={isNew ? 'Create a new lead.' : `${lead.id} - ${lead.business}`}
      maxWidth="max-w-3xl"
      footer={
        <>
          <button type="button" onClick={submit} className={btnPrimary}>{isNew ? 'Add Lead' : 'Save'}</button>
          {(isAdmin || lead.status !== 'Converted') && !isNew && (
            <button type="button" onClick={() => onDelete(lead)} className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-600 hover:bg-rose-50">
              Delete lead
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        </>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Lead ID</label>
            <input className={inputCls} value={d.id} disabled />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input className={inputCls} value={fmtDate(d.dateAdded)} disabled />
          </div>
          <div>
            <label className={labelCls}>Business / Customer name <span className="text-rose-600">*</span></label>
            <input className={inputCls} style={fe.business ? { borderColor: '#F43F5E' } : undefined} aria-invalid={Boolean(fe.business)} value={d.business} placeholder="e.g. ABC Restaurant" onChange={(e) => set('business', e.target.value)} />
            {fe.business && <p className="mt-1 text-xs font-medium text-rose-600">{fe.business}</p>}
          </div>
          <div>
            <label className={labelCls}>Phone <span className="text-rose-600">*</span></label>
            <input
              className={inputCls}
              style={phoneError ? { borderColor: '#F43F5E' } : undefined}
              aria-invalid={Boolean(phoneError)}
              value={d.phone}
              inputMode="numeric"
              maxLength={10}
              placeholder="0771234567"
              onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            {phoneError ? (
              <p className="mt-1 text-xs font-medium text-rose-600">{phoneError}</p>
            ) : (
              <p className={`mt-1 text-xs ${d.phone && d.phone.length !== 10 ? 'text-rose-600' : 'text-[#94A3B8]'}`}>{d.phone.length}/10 digits</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Source</label>
            <select className={inputCls} value={d.source} onChange={(e) => set('source', e.target.value)}>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Lead status</label>
            <input className={inputCls} value={d.status} disabled />
            {!isNew && <p className="mt-1 text-xs text-[#94A3B8]">Updates automatically from the latest follow-up.</p>}
          </div>
          <div>
            <label className={labelCls}>Next follow-up date</label>
            <input type="datetime-local" className={inputCls} value={toLocalInput(d.nextFollowUp)} onChange={(e) => set('nextFollowUp', e.target.value ? new Date(e.target.value).toISOString() : '')} />
          </div>
          <div>
            <label className={labelCls}>Added by</label>
            <input className={inputCls} value={displayPerson(isNew ? who : d.addedBy || d.owner || '')} disabled />
          </div>
          {!isNew && d.customerId && (
            <div>
              <label className={labelCls}>Client ID</label>
              <input className={inputCls} value={d.customerId} disabled />
            </div>
          )}
          {!isNew && isAdmin && (
            <div>
              <label className={labelCls}>Sales executive</label>
              <select className={inputCls} value={d.owner} onChange={(e) => set('owner', e.target.value)}>
                <option value="">Unassigned</option>
                {users.filter((u) => u.active || u.username === d.owner).map((u) => (
                  <option key={u.username} value={u.username}>{u.name} ({u.username})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {wasConverted && lead.order && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-[#334155]">
            <p className="mb-1 font-bold text-emerald-700">Sale: {lead.order.quantity} x {lead.order.product} = LKR {lead.order.total.toLocaleString('en-US')}</p>
            <p className="text-[#64748B]">Delivery: {lead.order.address}</p>
          </div>
        )}

        {!isNew && (
          <div className="border-t border-[#E2E8F0] pt-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#64748B]">
              Call & follow-up history ({d.history.filter((h) => !h.system).length} recorded)
            </p>

            <div className="space-y-2">
              {[...d.history].map((h, i) => ({ h, i })).reverse().map(({ h, i }) => {
                if (rec?.index === i) {
                  return <RecordForm key={i} rec={rec} setRec={setRec} onSave={saveRecord} title={`Edit record #${h.n}`} by={h.by} />;
                }
                const st = h.status || h.result;
                return (
                  <div key={i} className={`rounded-lg border p-3 text-xs ${h.system ? 'border-dashed border-[#CBD5E1] bg-slate-50 text-[#64748B]' : 'border-[#E2E8F0] bg-white'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold text-[#0F172A]">
                        {h.system ? 'System' : `${fmtDate(h.at)} • ${h.callStatus}${st ? ` • ${st}` : ''}`}
                      </span>
                      <span className="text-[#94A3B8]">{fmtDT(h.at)} · {displayPerson(h.by)}</span>
                    </div>
                    {h.notes && <p className="mt-1 text-[#475569]">{h.notes}</p>}
                    {h.nextFollowUp && !h.system && <p className="mt-1 text-amber-600">Next follow-up: {fmtDT(h.nextFollowUp)}</p>}
                    {!h.system && (
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setRec({ index: i, callStatus: h.callStatus, status: st || 'Connected', notes: h.notes, next: toLocalInput(h.nextFollowUp) })}
                          className="inline-flex items-center gap-1 font-semibold text-[#2563EB] hover:underline"
                        >
                          <Pencil size={11} /> Edit record #{h.n}
                        </button>
                        {confirmDel === i ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="font-semibold text-rose-600">Delete this record?</span>
                            <button type="button" onClick={() => deleteRecord(i)} className="font-bold text-rose-600 hover:underline">Yes, delete</button>
                            <button type="button" onClick={() => setConfirmDel(null)} className="font-semibold text-[#64748B] hover:underline">No</button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setConfirmDel(i)} className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline">
                            <Trash2 size={11} /> Delete record #{h.n}
                          </button>
                        )}
                        {h.edits && h.edits.length > 0 && <span className="text-[#94A3B8]">edited {h.edits.length}x (last by {displayPerson(h.edits[h.edits.length - 1].by)})</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              {d.history.length === 0 && <p className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-center text-xs text-[#94A3B8]">No calls recorded yet.</p>}
            </div>

            {rec?.index === null ? (
              <div className="mt-2"><RecordForm rec={rec} setRec={setRec} onSave={saveRecord} title="New call / follow-up" by={who} /></div>
            ) : (
              !wasConverted && (
                <button
                  type="button"
                  onClick={() => setRec({ index: null, callStatus: 'Answered', status: d.status === 'New' ? 'Connected' : d.status, notes: '', next: '' })}
                  className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[#2563EB] px-4 text-xs font-semibold text-[#2563EB] hover:bg-blue-50"
                >
                  <Plus size={14} /> Record new call / follow-up
                </button>
              )
            )}
          </div>
        )}

        {err && <p className="text-xs font-semibold text-rose-600">{err}</p>}
      </div>
    </ModalShell>
  );
}

function RecordForm({
  rec,
  setRec,
  onSave,
  title,
  by,
}: {
  rec: Rec;
  setRec: (r: Rec | null) => void;
  onSave: () => void;
  title: string;
  by: string;
}) {
  return (
    <div className="rounded-lg border border-[#BFDBFE] bg-[#F8FBFF] p-3">
      <p className="mb-2 text-xs font-bold text-[#1D4ED8]">{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Call status</label>
          <select className={inputCls} value={rec.callStatus} onChange={(e) => setRec({ ...rec, callStatus: e.target.value })}>
            {CALL_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Lead status</label>
          <select className={inputCls} value={rec.status} onChange={(e) => setRec({ ...rec, status: e.target.value })}>
            {FOLLOW_UP_STATUSES.filter((s) => s !== 'New' || rec.status === 'New').map((s) => (
              <option key={s} value={s}>{s === 'Converted' ? 'Converted (create order)' : s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Next follow-up</label>
          <input type="datetime-local" className={inputCls} value={rec.next} onChange={(e) => setRec({ ...rec, next: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Added by</label>
          <input className={inputCls} value={displayPerson(by)} disabled />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea rows={2} className={textareaCls} value={rec.notes} placeholder="What did the customer say?" onChange={(e) => setRec({ ...rec, notes: e.target.value })} />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => setRec(null)} className={btnGhost}>Cancel</button>
        <button type="button" onClick={onSave} className={btnPrimary}>{rec.index === null ? 'Add to history' : 'Update record'}</button>
      </div>
    </div>
  );
}
