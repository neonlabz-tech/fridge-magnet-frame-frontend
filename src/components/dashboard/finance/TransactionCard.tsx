'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, ArrowUp, ArrowDown } from 'lucide-react';
import type { Transaction, TxKind, TxMethod } from '@/types/finance';
import { TableFooter } from '@/components/dashboard/shared/UiKit';

const PAGE_SIZE = 4;

const METHOD_TABS: { key: 'all' | TxMethod; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Bank Transfer', label: 'Bank' },
  { key: 'Cash', label: 'Cash' },
  { key: 'Card Payment', label: 'Card' },
];

const METHOD_STYLE: Record<TxMethod, string> = {
  'Bank Transfer': 'bg-blue-50 text-blue-600',
  Cash: 'bg-emerald-50 text-emerald-600',
  'Card Payment': 'bg-violet-50 text-violet-600',
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

export default function TransactionCard({
  kind,
  items,
  search,
  onView,
  onEdit,
}: {
  kind: TxKind;
  items: Transaction[];
  search: string;
  onView: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
}) {
  const isIncome = kind === 'income';
  const [tab, setTab] = useState<'all' | TxMethod>('all');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [tab, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((t) => (tab === 'all' ? true : t.method === tab))
      .filter((t) => !q || [t.party, t.ref, t.note, t.method].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [items, tab, search]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
          <span
            className={`flex size-6 items-center justify-center rounded-full ${
              isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}
          >
            {isIncome ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
          </span>
          {isIncome ? 'Incomes' : 'Expenses'}{' '}
          <span className="text-xs font-medium text-[#94A3B8]">{items.length} Total</span>
        </h2>
        <div className="flex gap-1">
          {METHOD_TABS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setTab(m.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                tab === m.key ? 'bg-blue-50 text-[#2563EB]' : 'text-[#94A3B8] hover:text-[#475569]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr>
              {['Date / Bill', 'Description'].map((h) => (
                <th key={h} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                  {h}
                </th>
              ))}
              <th className="px-2 py-2 text-right text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Amount</th>
              <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Payment</th>
              <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Status</th>
              <th className="px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-xs text-[#94A3B8]">
                  No {isIncome ? 'income' : 'expense'} records found.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} className="hover:bg-[#F8FAFC]/80">
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-[#0F172A]">{fmtDate(t.date)}</p>
                    <p className="text-xs text-[#94A3B8]">{t.ref}</p>
                  </td>
                  <td className="max-w-[170px] px-4 py-3">
                    <p className="truncate text-xs font-bold text-[#0F172A]">{t.party}</p>
                    <p className="truncate text-xs text-[#94A3B8]">{t.note || '—'}</p>
                  </td>
                  <td
                    className={`whitespace-nowrap px-2 py-3 text-right text-xs font-bold ${
                      isIncome ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isIncome ? '+' : '-'}LKR {t.amount.toLocaleString('en-US')}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${METHOD_STYLE[t.method]}`}>
                      {t.method}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${
                        t.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {t.status === 'completed' ? '● Completed' : '● Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        aria-label="View"
                        title="View"
                        onClick={() => onView(t)}
                        className="flex size-7 items-center justify-center rounded-md text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Edit"
                        title="Edit"
                        onClick={() => onEdit(t)}
                        className="flex size-7 items-center justify-center rounded-md text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TableFooter page={safePage} pageSize={PAGE_SIZE} total={filtered.length} noun="records" onPage={setPage} />
    </section>
  );
}
