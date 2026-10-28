import type { CSSProperties } from 'react';

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} style={style} />;
}

/** Table-shaped placeholder (header + rows). */
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading" className="w-full overflow-hidden">
      <div className="flex gap-4 bg-[#F8FAFC] px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-t border-[#F1F5F9] px-4 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="flex-1 space-y-1.5">
              <Skeleton className={`h-3 ${c === 0 ? 'w-4/5' : 'w-3/5'}`} />
              {c === 0 && <Skeleton className="h-2.5 w-2/5" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="mt-3 h-3 w-1/2" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-[#E2E8F0] bg-white p-4 ${className}`}>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="mt-1.5 h-2.5 w-1/4" />
      <div className="mt-4 flex h-40 items-end gap-2">
        {[55, 80, 40, 90, 65, 75, 50].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Generic full-page placeholder: heading, stat cards, table card. */
export function PageSkeleton({ stats = 3, rows = 8, cols = 6 }: { stats?: number; rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Loading page" className="mx-auto flex w-full max-w-7xl flex-col px-3 pb-6 pt-3 sm:px-6 lg:px-8 lg:pt-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mb-4 mt-2 h-3 w-72 max-w-full" />
      <div className="mb-4">
        <StatCardsSkeleton count={stats} />
      </div>
      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] p-3">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="hidden h-9 w-28 sm:block" />
          <Skeleton className="h-9 w-24" />
        </div>
        <TableSkeleton rows={rows} cols={cols} />
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading overview" className="mx-auto flex w-full max-w-7xl flex-col px-3 pb-6 pt-3 sm:px-6 lg:px-8 lg:pt-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mb-4 mt-2 h-3 w-80 max-w-full" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="mt-3 h-3 w-1/2" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        ))}
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center rounded-xl border border-[#E2E8F0] bg-white p-4">
            <Skeleton className="mb-4 h-3 w-1/2 self-start" />
            <Skeleton className="size-32 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
