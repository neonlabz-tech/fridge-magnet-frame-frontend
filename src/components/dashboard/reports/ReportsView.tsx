'use client';

import { useMemo, useRef, useState } from 'react';
import { BarChart3, Boxes, CalendarDays, Download, Eye, FileText, Loader2, PackageSearch, Receipt, TrendingUp, Truck, Users, ListChecks } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { downloadReportPdf } from './reportPdf';
import ReportPreview from './ReportPreview';
import { buildReport, loadReportData, type ReportData, type ReportId, type Range } from './reportBuilders';

interface Card {
  id: ReportId;
  title: string;
  desc: string;
  badge: string;
  badgeTone: string;
  icon: LucideIcon;
}

const CARDS: Card[] = [
  { id: 'sales', title: 'Sales Report', desc: 'Revenue trend, top products and order status overview.', badge: 'Revenue', badgeTone: 'bg-emerald-50 text-emerald-600', icon: TrendingUp },
  { id: 'product', title: 'Product Performance Report', desc: 'Units sold, revenue and unit margin per product.', badge: 'Analytics', badgeTone: 'bg-blue-50 text-blue-600', icon: PackageSearch },
  { id: 'inventory', title: 'Inventory Report', desc: 'Material and finished-goods stock with low-stock alerts.', badge: 'Stock', badgeTone: 'bg-amber-50 text-amber-600', icon: Boxes },
  { id: 'customers', title: 'Customers Report', desc: 'Customer growth, repeat buyers and top spenders.', badge: 'CRM', badgeTone: 'bg-rose-50 text-rose-600', icon: Users },
  { id: 'leads', title: 'Leads & Follow-ups Report', desc: 'Pipeline stages, conversion rate and follow-ups due.', badge: 'Pipeline', badgeTone: 'bg-violet-50 text-violet-600', icon: ListChecks },
  { id: 'payment', title: 'Payment / Transaction Report', desc: 'Collections, pending payments and method allocation.', badge: 'Finance', badgeTone: 'bg-sky-50 text-sky-600', icon: Receipt },
  { id: 'delivery', title: 'Delivery Report', desc: 'Delivery status, driver performance and returns.', badge: 'Logistics', badgeTone: 'bg-slate-100 text-slate-600', icon: Truck },
  { id: 'pnl', title: 'Profit & Loss Report', desc: 'Income, expenses and net profit summary.', badge: 'Audited', badgeTone: 'bg-emerald-50 text-emerald-600', icon: FileText },
];

type Preset = 'today' | '7d' | 'month' | 'custom';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ReportsView() {
  const { addToast } = useToastStore();
  const today = new Date();
  const [preset, setPreset] = useState<Preset>('month');
  const [from, setFrom] = useState(toInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(toInput(today));
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReportId | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const range: Range = useMemo(() => {
    const n = new Date();
    if (preset === 'today') return { from: startOfDay(n), to: endOfDay(n) };
    if (preset === '7d') {
      const s = new Date(n);
      s.setDate(s.getDate() - 6);
      return { from: startOfDay(s), to: endOfDay(n) };
    }
    if (preset === 'month') return { from: startOfDay(new Date(n.getFullYear(), n.getMonth(), 1)), to: endOfDay(n) };
    return { from: startOfDay(new Date(`${from}T00:00:00`)), to: endOfDay(new Date(`${to}T00:00:00`)) };
  }, [preset, from, to]);

  const invalid = range.from > range.to;

  const doc = useMemo(() => {
    if (!selected || !data || invalid) return null;
    try {
      return buildReport(selected, data, range);
    } catch {
      return null;
    }
  }, [selected, data, range, invalid]);

  const preview = async (id: ReportId) => {
    if (invalid) return addToast('From date must be before To date.', 'error');
    setBusy(id);
    setSelected(id);
    try {
      setData(await loadReportData());
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to load report.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const quickDownload = async (id: ReportId) => {
    if (invalid) return addToast('From date must be before To date.', 'error');
    setBusy(`dl:${id}`);
    try {
      const d = await loadReportData();
      setData(d);
      await downloadReportPdf(buildReport(id, d, range));
      addToast('Report downloaded.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to generate report.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      await downloadReportPdf(doc);
      addToast('Report downloaded.', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Failed to generate report.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const tabs: { key: Preset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: 'Last 7D' },
    { key: 'month', label: 'This Month' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div className="compact-ui relative mx-auto flex w-full max-w-7xl flex-col px-3 pb-6 pt-2 sm:px-6 sm:pt-3 lg:px-8 lg:pt-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A]">Reports</h1>
          <p className="text-xs text-[#64748B]">Select a report below to generate detailed financial, logistics and operational PDF exports.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-0.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPreset(t.key)}
                className={`h-8 rounded-md px-3 text-xs font-semibold ${preset === t.key ? 'bg-[#2563EB] text-white' : 'text-[#475569] hover:bg-slate-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs" />
              <span className="text-xs text-[#94A3B8]">to</span>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-2 text-xs" />
            </div>
          )}
          <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#475569]">
            <CalendarDays size={14} className="text-[#94A3B8]" />
            {range.from.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - {range.to.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map(({ id, title, desc, badge, badgeTone, icon: Icon }) => (
          <div key={id} className={`flex flex-col rounded-xl border bg-white p-4 shadow-xs transition hover:border-[#BFDBFE] hover:shadow-sm ${selected === id ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15' : 'border-[#E2E8F0]'}`}>
            <div className="flex items-start justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
                <Icon size={17} />
              </span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${badgeTone}`}>{badge}</span>
            </div>
            <h3 className="mt-3 text-xs font-bold text-[#0F172A]">{title}</h3>
            <p className="mt-1 flex-1 text-xs leading-5 text-[#64748B]">{desc}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => preview(id)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#2563EB] hover:bg-blue-50 disabled:opacity-60"
              >
                {busy === id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                {busy === id ? 'Loading...' : 'Preview'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => quickDownload(id)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] text-xs font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                {busy === `dl:${id}` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div ref={previewRef} className="mt-5 scroll-mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#64748B]">Preview</p>
            <button
              type="button"
              onClick={download}
              disabled={!doc || downloading}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
          {doc ? (
            <ReportPreview doc={doc} />
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-10 text-xs text-[#64748B]">
              <Loader2 size={14} className="animate-spin" /> Loading preview...
            </div>
          )}
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-[#94A3B8]">
        <BarChart3 size={13} /> Click Preview on a report, check it below, then press Download PDF.
      </p>
    </div>
  );
}
