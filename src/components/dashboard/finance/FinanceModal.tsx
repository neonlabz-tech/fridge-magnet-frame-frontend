'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Check, Pencil, Calendar, ChevronDown } from 'lucide-react';
import { type Transaction, type TxKind, type TxStatus, TX_METHODS } from '@/types/finance';
import { ModalShell, inputCls, textareaCls, labelCls, btnGhost } from '@/components/dashboard/shared/UiKit';

export type FinanceModalMode = 'add' | 'edit' | 'view';

interface Props {
  kind: TxKind;
  mode: FinanceModalMode | null;
  tx: Transaction | null;
  onClose: () => void;
  onSave: (tx: Transaction, isNew: boolean) => void | Promise<void>;
  onEditRequest: (tx: Transaction) => void;
}

const QUICK = [5000, 10000, 25000];

export default function FinanceModal({ kind, mode, tx, onClose, onSave, onEditRequest }: Props) {
  const isIncome = kind === 'income';
  const open = mode !== null;
  const readOnly = mode === 'view';

  const [amount, setAmount] = useState('');
  const [party, setParty] = useState('');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState('');
  const [method, setMethod] = useState<Transaction['method']>('Bank Transfer');
  const [status, setStatus] = useState<TxStatus>('completed');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(tx ? String(tx.amount) : '');
    setParty(tx?.party ?? '');
    setRef(tx?.ref ?? '');
    setDate(tx?.date ?? new Date().toISOString().slice(0, 10));
    setMethod(tx?.method ?? 'Bank Transfer');
    setStatus(tx?.status ?? 'completed');
    setNote(tx?.note ?? '');
    setError(null);
  }, [open, tx, kind]);

  const accent = isIncome
    ? { solid: 'bg-[#059669] hover:bg-[#047857]', tile: 'bg-emerald-50 text-emerald-600' }
    : { solid: 'bg-[#E11D48] hover:bg-[#BE123C]', tile: 'bg-rose-50 text-rose-600' };

  const submit = () => {
    const value = Number(amount);
    if (!value || value <= 0) return setError('Enter a valid amount.');
    if (!party.trim()) return setError(isIncome ? 'Customer / payer is required.' : 'Vendor / payee is required.');
    onSave(
      {
        id: tx?.id ?? `T-${Date.now()}`,
        kind,
        date,
        ref: ref.trim() || `${isIncome ? 'INV' : 'EXP'}-${Date.now().toString().slice(-8)}`,
        party: party.trim(),
        note: note.trim(),
        amount: value,
        method,
        status,
      },
      mode === 'add'
    );
  };

  const word = isIncome ? 'Income' : 'Expense';
  const title = mode === 'add' ? `Add New ${word}` : mode === 'edit' ? `Edit ${word}` : `View ${word} Details`;
  const subtitle = isIncome
    ? 'Record incoming payments, sales invoices, or client deposits.'
    : 'Record outgoing payments, operational bills, or vendor purchases.';

  const statusOptions: { value: TxStatus; label: string; dot: string; pill: string }[] = isIncome
    ? [
        { value: 'completed', label: 'Completed (Received)', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-600' },
        { value: 'pending', label: 'Pending / Receivable', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-600' },
      ]
    : [
        { value: 'completed', label: 'Completed (Paid)', dot: 'bg-emerald-500', pill: '' },
        { value: 'pending', label: 'Pending / Due', dot: 'bg-rose-500', pill: '' },
      ];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={isIncome ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
      title={title}
      subtitle={subtitle}
      maxWidth="max-w-xl"
      footer={
        readOnly ? (
          <>
            <button type="button" className={btnGhost} onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              onClick={() => tx && onEditRequest(tx)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-bold text-white shadow-xs ${accent.solid}`}
            >
              <Pencil size={13} /> Edit {word}
            </button>
          </>
        ) : (
          <>
            {error && <span className="mr-auto text-xs font-semibold text-rose-600">{error}</span>}
            <button type="button" className={btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-bold text-white shadow-xs ${accent.solid}`}
            >
              <Check size={13} /> {mode === 'add' ? `Record ${word}` : 'Save Changes'}
            </button>
          </>
        )
      }
    >
      {/* Amount */}
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wide text-[#64748B]">
          {isIncome ? 'Received Amount' : 'Expense Amount'} <span className="text-rose-500">*</span>
        </label>
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#94A3B8]">Quick Add</span>
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String((Number(amount) || 0) + q))}
                className="rounded-md bg-[#F1F5F9] px-2 py-1 text-xs font-semibold text-[#475569] hover:bg-slate-200"
              >
                +{q.toLocaleString('en-US')}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#2563EB] focus-within:bg-white">
        <span className="mx-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-[#64748B] shadow-xs">LKR</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          disabled={readOnly}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="h-11 flex-1 bg-transparent pr-3 text-xs font-bold text-[#0F172A] placeholder:text-[#CBD5E1] focus:outline-none disabled:text-[#0F172A]"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            {isIncome ? 'Customer / Payer' : 'Vendor / Payee'} {!isIncome && <span className="text-rose-500">*</span>}
          </label>
          <input
            className={inputCls}
            value={party}
            disabled={readOnly}
            onChange={(e) => setParty(e.target.value)}
            placeholder={isIncome ? 'e.g. Tharindu Perera' : 'e.g. Prime Office Realty Ltd'}
          />
        </div>
        <div>
          <label className={labelCls}>{isIncome ? 'Invoice / Ref No.' : 'Bill / Ref No.'}</label>
          <input
            className={inputCls}
            value={ref}
            disabled={readOnly}
            onChange={(e) => setRef(e.target.value)}
            placeholder={isIncome ? 'INV-000000-00' : 'EXP-000000-00'}
          />
        </div>
        <div>
          <label className={labelCls}>Payment Date</label>
          <div className="relative">
            <input
              type="date"
              className={`${inputCls} pr-8`}
              value={date}
              disabled={readOnly}
              onChange={(e) => setDate(e.target.value)}
            />
            <Calendar size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Payment Method</label>
          <div className="relative">
            <select
              className={`${inputCls} appearance-none pr-8`}
              value={method}
              disabled={readOnly}
              onChange={(e) => setMethod(e.target.value as Transaction['method'])}
            >
              {TX_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-4">
        <label className={labelCls}>{isIncome ? 'Status' : 'Payment Status'}</label>
        <div className={isIncome ? 'flex flex-wrap gap-2' : 'grid grid-cols-1 gap-2 sm:grid-cols-2'}>
          {statusOptions.map((o) => {
            const active = status === o.value;
            return (
              <button
                key={o.value}
                type="button"
                disabled={readOnly && !active}
                onClick={() => !readOnly && setStatus(o.value)}
                className={
                  isIncome
                    ? `inline-flex items-center gap-2 rounded-full px-1 py-0.5 text-xs font-semibold ${
                        readOnly && !active ? 'opacity-40' : ''
                      }`
                    : `flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${
                        active ? 'border-rose-200 bg-rose-50 text-[#0F172A]' : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]'
                      } ${readOnly && !active ? 'opacity-40' : ''}`
                }
              >
                <span
                  className={`flex size-4 items-center justify-center rounded-full border-2 ${
                    active ? (isIncome ? 'border-emerald-500' : 'border-rose-500') : 'border-[#CBD5E1]'
                  }`}
                >
                  {active && <span className={`size-2 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`} />}
                </span>
                {isIncome ? (
                  <span className={`rounded-full px-2.5 py-1 ${o.pill}`}>
                    <span className={`mr-1.5 inline-block size-1.5 rounded-full ${o.dot}`} />
                    {o.label}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${o.dot}`} />
                    {o.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <label className={labelCls}>
          Description / Note <span className="font-normal text-[#94A3B8]">(optional)</span>
        </label>
        <textarea
          rows={3}
          className={textareaCls}
          value={note}
          disabled={readOnly}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a short note about this transaction"
        />
      </div>
    </ModalShell>
  );
}
