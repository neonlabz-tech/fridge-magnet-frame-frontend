'use client';

import type { ReactNode } from 'react';
import { X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

/* ---------- shared class names (all 12px) ---------- */
export const inputCls =
  'h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 disabled:bg-[#F8FAFC] disabled:text-[#334155] read-only:bg-[#F8FAFC]';
export const textareaCls =
  'w-full resize-none rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 disabled:bg-[#F8FAFC] disabled:text-[#334155] read-only:bg-[#F8FAFC]';
export const labelCls = 'mb-1 block text-xs font-semibold text-[#64748B]';
export const btnGhost =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 text-xs font-semibold text-[#475569] hover:bg-slate-50 disabled:opacity-50';
export const btnPrimary =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] disabled:opacity-60';

/* ---------- modal shell ---------- */
export function ModalShell({
  open,
  onClose,
  icon,
  title,
  subtitle,
  maxWidth = 'max-w-3xl',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="compact-ui fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/55 p-3 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[94vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pb-3 pt-4 sm:px-6">
          {icon && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#64748B] hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- confirm dialog ---------- */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="compact-ui fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3 px-5 pb-5 pt-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
          <button type="button" onClick={onCancel} className={btnGhost}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-9 items-center rounded-lg bg-[#B91C1C] px-4 text-xs font-bold text-white hover:bg-[#991B1B]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- pagination ---------- */
export const getPageNumbers = (current: number, total: number): (number | 'ellipsis')[] => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 'ellipsis', total];
  if (current >= total - 2) return [1, 'ellipsis', total - 2, total - 1, total];
  return [1, 'ellipsis', current, 'ellipsis', total];
};

function PageBtn({
  children,
  active,
  disabled,
  onClick,
  label,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{ fontSize: '12px' }}
      className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
        active
          ? 'bg-[#2563EB] text-white shadow-xs'
          : disabled
            ? 'cursor-not-allowed text-[#CBD5E1]'
            : 'text-[#475569] hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

export function TableFooter({
  page,
  pageSize,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col items-center gap-3 border-t border-[#E2E8F0] bg-white px-5 py-3 sm:flex-row sm:justify-between">
      <p className="text-xs font-medium text-[#64748B]">
        {total === 0 ? `No ${noun}` : `Showing ${from} to ${to} of ${total.toLocaleString('en-US')} ${noun}`}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <PageBtn label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft size={14} />
          </PageBtn>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e${i}`} className="flex h-8 w-6 items-center justify-center text-xs text-slate-400">
                ...
              </span>
            ) : (
              <PageBtn key={p} active={p === page} label={`Page ${p}`} onClick={() => onPage(p)}>
                {p}
              </PageBtn>
            )
          )}
          <PageBtn label="Next page" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <ChevronRight size={14} />
          </PageBtn>
        </div>
      )}
    </div>
  );
}

/* ---------- csv download ---------- */
export function downloadCsv(fileName: string, rows: (string | number)[][]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const lkr = (n: number) => `LKR ${Number(n || 0).toLocaleString('en-US')}`;
