import type { LucideIcon } from 'lucide-react';

interface DashboardStat {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
}

interface MockDashboardPageProps {
  title: string;
  description: string;
  stats: DashboardStat[];
  columns: string[];
  rows: string[][];
}

export default function MockDashboardPage({
  title,
  description,
  stats,
  columns,
  rows,
}: MockDashboardPageProps) {
  return (
    <div className="h-full w-full overflow-y-auto bg-[#F8FAFC] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#002B73] sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 text-xs text-[#64748B]">{description}</p>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, change, icon: Icon }) => (
          <article
            key={label}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">{label}</p>
              <span className="rounded-xl bg-[#EFF6FF] p-2.5 text-[#2563EB]">
                <Icon size={19} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-[#0F172A]">{value}</p>
            <p className="mt-1 text-xs font-medium text-[#16A34A]">{change}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-sm font-bold text-[#0F172A]">Recent activity</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Sample dashboard data for preview.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#F8FAFC] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-5 py-3 font-semibold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row[0]}-${index}`}
                  className="border-t border-[#E2E8F0] text-xs text-[#334155] transition hover:bg-slate-50/50"
                >
                  {row.map((cell, cellIndex) => (
                    <td key={`${cell}-${cellIndex}`} className="px-5 py-3.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
