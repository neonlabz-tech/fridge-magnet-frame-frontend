'use client';

import StatCard from '@/components/dashboard/shared/StatCard';
import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, ArrowUp, ArrowDown, Wallet } from 'lucide-react';
import type { Transaction, TxKind } from '@/types/finance';
import { currentUsername, deleteTransaction, readTransactions, refreshTransactions, saveTransaction, visibleTransactions } from './financeStore';
import { useToastStore } from '@/store/toastStore';
import { ConfirmModal, lkr } from '@/components/dashboard/shared/UiKit';
import FinanceModal, { type FinanceModalMode } from './FinanceModal';
import TransactionCard from './TransactionCard';
import FlowChart from './FlowChart';

export default function FinanceView() {
  const { addToast } = useToastStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      setTransactions(visibleTransactions(readTransactions()));
      refreshTransactions().then((list) => alive && setTransactions(visibleTransactions(list)));
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      window.removeEventListener('focus', load);
    };
  }, []);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [tab, setTab] = useState<TxKind>('income');
  const [modal, setModal] = useState<{ kind: TxKind; mode: FinanceModalMode; tx: Transaction | null } | null>(null);

  const incomes = useMemo(() => transactions.filter((t) => t.kind === 'income'), [transactions]);
  const expenses = useMemo(() => transactions.filter((t) => t.kind === 'expense'), [transactions]);

  const sum = (list: Transaction[]) => list.filter((t) => t.status === 'completed').reduce((a, t) => a + t.amount, 0);
  const totalIncome = sum(incomes);
  const totalExpense = sum(expenses);
  const net = totalIncome - totalExpense;

  const stats = [
    { label: 'Total Income (LKR)', value: lkr(totalIncome), icon: ArrowUp, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Total Expenses (LKR)', value: lkr(totalExpense), icon: ArrowDown, tone: 'bg-rose-50 text-rose-600' },
    { label: 'Net Profit (LKR)', value: lkr(net), icon: Wallet, tone: 'bg-blue-50 text-[#2563EB]' },
  ];

  const handleSave = async (tx: Transaction, isNew: boolean) => {
    try {
      const saved = await saveTransaction({ ...tx, createdBy: isNew ? currentUsername() : tx.createdBy }, isNew);
      setTransactions(visibleTransactions(readTransactions()));
      setModal(null);
      addToast(`${saved.kind === 'income' ? 'Income' : 'Expense'} ${isNew ? 'recorded' : 'updated'}.`, 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save the record.', 'error');
    }
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-[#071C40] sm:text-[28px]">Finance</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">Track income, expenses, payments and overall financial health.</p>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon, tone }) => (
          <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-xs sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions, bills, categories..."
            className="h-9 w-full rounded-lg border border-transparent bg-[#F1F5F9] pl-9 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
          />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => setModal({ kind: 'income', mode: 'add', tx: null })}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 sm:flex-none"
          >
            <Plus size={14} strokeWidth={2.5} /> Add Income
          </button>
          <button
            type="button"
            onClick={() => setModal({ kind: 'expense', mode: 'add', tx: null })}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-600 hover:bg-rose-100 sm:flex-none"
          >
            <Plus size={14} strokeWidth={2.5} /> Add Expense
          </button>
        </div>
      </div>

      <div className="mb-3 inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1">
        {([
          { key: 'income', label: 'Incomes', count: incomes.length, active: 'bg-emerald-600 text-white' },
          { key: 'expense', label: 'Expenses', count: expenses.length, active: 'bg-rose-600 text-white' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-5 text-xs font-bold transition ${
              tab === t.key ? t.active : 'text-[#64748B] hover:bg-slate-50'
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 py-0.5 text-xs ${tab === t.key ? 'bg-white/25' : 'bg-[#F1F5F9]'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="mb-3">
        <TransactionCard
          key={tab}
          kind={tab}
          items={tab === 'income' ? incomes : expenses}
          search={search}
          onView={(tx) => setModal({ kind: tab, mode: 'view', tx })}
          onEdit={(tx) => setModal({ kind: tab, mode: 'edit', tx })}
          onDelete={(tx) => setDeleteTarget(tx)}
        />
      </div>

      <FlowChart transactions={transactions} />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={`Delete this ${deleteTarget?.kind === 'expense' ? 'expense' : 'income'}?`}
        message={
          <>
            <span className="font-bold text-[#0F172A]">{deleteTarget?.ref || deleteTarget?.id}</span> ({deleteTarget ? lkr(deleteTarget.amount) : ''}) will be permanently removed from the database.
          </>
        }
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (!target) return;
          try {
            await deleteTransaction(target.id);
            setTransactions(visibleTransactions(readTransactions()));
            addToast(`${target.kind === 'income' ? 'Income' : 'Expense'} deleted.`, 'success');
          } catch (e) {
            addToast(e instanceof Error ? e.message : 'Could not delete the record.', 'error');
          }
        }}
      />

      <FinanceModal
        kind={modal?.kind ?? 'income'}
        mode={modal?.mode ?? null}
        tx={modal?.tx ?? null}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onEditRequest={(tx) => setModal({ kind: tx.kind, mode: 'edit', tx })}
      />
    </>
  );
}
