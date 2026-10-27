'use client';

import type { Cell, ReportBlock, ReportDoc, Tone } from './reportPdf';

const TONE: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-700',
  bad: 'bg-rose-50 text-rose-600',
  warn: 'bg-amber-50 text-amber-700',
  info: 'bg-blue-50 text-blue-600',
  muted: 'bg-slate-100 text-slate-600',
};
const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-600',
  bad: 'text-rose-600',
  warn: 'text-amber-600',
  info: 'text-blue-600',
  muted: 'text-slate-600',
};

const alignCls = (a?: 'left' | 'right' | 'center') =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

function CellView({ cell }: { cell: Cell }) {
  if (typeof cell === 'object' && cell !== null) {
    const inner = (
      <>
        <span className={cell.bold ? 'font-bold' : ''}>{cell.text}</span>
        {cell.sub && <span className="block text-[11px] font-normal text-[#94A3B8]">{cell.sub}</span>}
      </>
    );
    if (cell.tone) {
      return (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${TONE[cell.tone]}`}>{inner}</span>
      );
    }
    return inner;
  }
  return <>{cell}</>;
}

function LineChart({ labels, values }: { labels: string[]; values: number[] }) {
  const W = 600;
  const H = 140;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? W / (values.length - 1) : W;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * (H - 10) - 5).toFixed(1)}`);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full overflow-visible" preserveAspectRatio="none">
        <polyline points={pts.join(' ')} fill="none" stroke="#2563EB" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[#94A3B8]">
        {labels.map((l, i) => (
          <span key={`${l}${i}`}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case 'stats':
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {block.items.map((s, i) => (
            <div key={i} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[11px] font-semibold text-[#64748B]">{s.label}</p>
              <p className={`mt-0.5 text-sm font-bold ${s.tone ? TONE_TEXT[s.tone] : 'text-[#0F172A]'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      );
    case 'section':
      return <h4 className="border-b border-[#E2E8F0] pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-[#0F172A]">{block.title}</h4>;
    case 'table': {
      const total = block.columns.reduce((a, c) => a + c.w, 0) || 1;
      return (
        <div className="overflow-x-auto rounded-lg border border-[#E2E8F0]">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              {block.columns.map((c, i) => (
                <col key={i} style={{ width: `${(c.w / total) * 100}%` }} />
              ))}
            </colgroup>
            <thead className="bg-[#F1F5F9] text-[#475569]">
              <tr>
                {block.columns.map((c, i) => (
                  <th key={i} className={`px-2 py-1.5 font-semibold ${alignCls(c.align)}`}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-[#0F172A]">
              {block.rows.length === 0 && (
                <tr>
                  <td colSpan={block.columns.length} className="px-2 py-4 text-center text-[#94A3B8]">
                    {block.empty ?? 'No data.'}
                  </td>
                </tr>
              )}
              {block.rows.map((row, r) => (
                <tr key={r} className="border-t border-[#EEF2F7]">
                  {row.map((cell, c) => (
                    <td key={c} className={`break-words px-2 py-1.5 ${alignCls(block.columns[c]?.align)}`}>
                      <CellView cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
              {block.totalRow && (
                <tr className="border-t border-[#CBD5E1] bg-[#F8FAFC] font-bold">
                  {block.totalRow.map((cell, c) => (
                    <td key={c} className={`px-2 py-1.5 ${alignCls(block.columns[c]?.align)}`}>
                      <CellView cell={cell} />
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }
    case 'bars': {
      const max = Math.max(1, ...block.items.map((b) => b.value));
      return (
        <div className="space-y-2">
          {block.items.length === 0 && <p className="text-xs text-[#94A3B8]">No data.</p>}
          {block.items.map((b, i) => (
            <div key={i}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="font-medium text-[#334155]">{b.label}</span>
                <span className="font-semibold text-[#0F172A]">{b.display}</span>
              </div>
              <div className="h-2 rounded-full bg-[#EEF2F7]">
                <div className="h-2 rounded-full" style={{ width: `${(b.value / max) * 100}%`, background: b.color || '#2563EB' }} />
              </div>
            </div>
          ))}
        </div>
      );
    }
    case 'line':
      return (
        <div>
          {block.title && <p className="mb-1 text-xs font-semibold text-[#334155]">{block.title}</p>}
          <LineChart labels={block.labels} values={block.values} />
        </div>
      );
    case 'summary':
      return (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <p className="mb-1.5 text-xs font-bold text-[#0F172A]">{block.title}</p>
          {block.rows.map((r, i) => (
            <div key={i} className="flex justify-between py-0.5 text-xs">
              <span className="text-[#64748B]">{r.label}</span>
              <span className={`${r.bold ? 'font-bold' : 'font-semibold'} ${r.tone ? TONE_TEXT[r.tone] : 'text-[#0F172A]'}`}>{r.value}</span>
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export default function ReportPreview({ doc }: { doc: ReportDoc }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
      <div className="mb-4 border-b-2 border-[#1E293B] pb-2">
        <h3 className="text-base font-bold text-[#0F172A]">{doc.title}</h3>
        <p className="text-xs text-[#64748B]">{doc.period}</p>
      </div>
      <div className="space-y-4">
        {doc.blocks.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </div>
    </div>
  );
}
