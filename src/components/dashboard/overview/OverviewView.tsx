'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Banknote, Boxes, ShoppingBag, TriangleAlert, Truck, UserPlus, type LucideIcon } from 'lucide-react';
import type { Order } from '@/types/order';
import { loadReportData, type ReportData } from '@/components/dashboard/reports/reportBuilders';
import { readTransactions, visibleTransactions } from '@/components/dashboard/finance/financeStore';
import { readDeliveries } from '@/lib/deliveryStore';
import { readInventory, refreshInventory } from '@/lib/inventoryStore';
import LeadsOverview from './LeadsOverview';
import StatCard from '@/components/dashboard/shared/StatCard';
import { getInventoryStatus } from '@/types/inventory';
import { OverviewSkeleton } from '@/components/dashboard/shared/Skeleton';
import { getSessionAllowedPages } from '@/lib/roles';
import { readSession } from '@/lib/crm';
import { AreaChart, BarChart, Donut, HBars } from './Charts';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const lkr = (n: number) => `LKR ${Math.round(n).toLocaleString('en-US')}`;

function Panel({ title, sub, href, children, className = '' }: { title: string; sub?: string; href?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[#E2E8F0] bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-xs font-bold text-[#0F172A]">{title}</h3>
          {sub && <p className="text-xs text-[#94A3B8]">{sub}</p>}
        </div>
        {href && (
          <Link href={href} className="text-xs font-semibold text-[#2563EB] hover:underline">View all</Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function OverviewView() {
  const [data, setData] = useState<ReportData | null>(null);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    setAllowed(getSessionAllowedPages());
    setIsMember(readSession()?.role === 'member');
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([loadReportData(), refreshInventory()]).then(([d]) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  const m = useMemo(() => {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const keys = days.map(ymd);
    const labels = days.map((d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
    const idx = new Map(keys.map((k, i) => [k, i]));
    const weekStart = new Date(days[0]); weekStart.setHours(0, 0, 0, 0);

    const orders: Order[] = (data?.orders ?? []).filter((o) => o.createdAt && new Date(o.createdAt) >= weekStart);
    const live = orders.filter((o) => o.status !== 'canceled');
    const revenue = keys.map(() => 0);
    const count = keys.map(() => 0);
    live.forEach((o) => {
      const i = idx.get(ymd(new Date(o.createdAt as string)));
      if (i === undefined) return;
      revenue[i] += Number(o.totalValue ?? 0);
      count[i] += 1;
    });

    const income = keys.map(() => 0);
    const expense = keys.map(() => 0);
    visibleTransactions(readTransactions()).filter((t) => t.status === 'completed').forEach((t) => {
      const i = idx.get(t.date);
      if (i === undefined) return;
      (t.kind === 'income' ? income : expense)[i] += t.amount;
    });

    const statusColors: Record<string, string> = { pending: '#94A3B8', processing: '#2563EB', shipped: '#F59E0B', delivered: '#16A34A', canceled: '#DC2626' };
    const orderStatus = Object.keys(statusColors).map((s) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: orders.filter((o) => o.status === s).length,
      color: statusColors[s],
    })).filter((x) => x.value > 0);

    const methodMap = new Map<string, number>();
    live.forEach((o) => methodMap.set(o.paymentMethod || 'Other', (methodMap.get(o.paymentMethod || 'Other') ?? 0) + 1));
    const palette = ['#2563EB', '#16A34A', '#F59E0B', '#8B5CF6', '#EC4899'];
    const payments = [...methodMap.entries()].map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));

    const prod = new Map<string, number>();
    live.forEach((o) => (o.items ?? []).forEach((it) => prod.set(it.name, (prod.get(it.name) ?? 0) + (it.price || 0) * (it.quantity || 0))));
    const topProducts = [...prod.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value], i) => ({ label, value, display: lkr(value), color: palette[i % palette.length] }));

    const products = data?.products ?? [];
    const stock = [
      { label: 'In Stock', value: products.filter((p) => Number(p.stock ?? 0) > 10).length, color: '#16A34A' },
      { label: 'Low Stock', value: products.filter((p) => { const s = Number(p.stock ?? 0); return s > 0 && s <= 10; }).length, color: '#F59E0B' },
      { label: 'Out of Stock', value: products.filter((p) => Number(p.stock ?? 0) <= 0).length, color: '#DC2626' },
    ].filter((x) => x.value > 0);

    const weekKeys = new Set(keys);
    const allDeliveries = readDeliveries();
    const del = allDeliveries.filter((x) => weekKeys.has(x.date));
    const delSrc = del.length ? del : allDeliveries;
    const delivery = [
      { label: 'Delivered', value: delSrc.filter((x) => x.status === 'delivered').length, color: '#16A34A' },
      { label: 'In Transit', value: delSrc.filter((x) => x.status === 'in-transit').length, color: '#2563EB' },
      { label: 'Pending', value: delSrc.filter((x) => x.status === 'pending').length, color: '#F59E0B' },
      { label: 'Returned', value: delSrc.filter((x) => x.status === 'returned').length, color: '#DC2626' },
    ].filter((x) => x.value > 0);

    const newCustomers = (data?.customers ?? []).filter((c) => c.createdAt && new Date(c.createdAt) >= weekStart).length;
    const lowItems = readInventory().filter((i) => getInventoryStatus(i.stock) !== 'in-stock').length + stock.filter((s) => s.label !== 'In Stock').reduce((a, b) => a + b.value, 0);
    const totalRev = revenue.reduce((a, b) => a + b, 0);
    const net = income.reduce((a, b) => a + b, 0) - expense.reduce((a, b) => a + b, 0);

    return { labels, revenue, count, income, expense, orderStatus, payments, topProducts, stock, delivery, newCustomers, lowItems, totalRev, net, orderCount: live.length, delivered: delSrc.filter((x) => x.status === 'delivered').length };
  }, [data]);

  const stats: { label: string; value: string; icon: LucideIcon; tone: string; href: string; note: string }[] = [
    { label: 'Orders this week', value: String(m.orderCount), icon: ShoppingBag, tone: 'bg-blue-50 text-[#2563EB]', href: '/dashboard/orders', note: 'Excludes canceled' },
    { label: 'Weekly revenue', value: lkr(m.totalRev), icon: Banknote, tone: 'bg-emerald-50 text-emerald-600', href: '/dashboard/orders', note: 'Last 7 days' },
    { label: 'New customers', value: String(m.newCustomers), icon: UserPlus, tone: 'bg-violet-50 text-violet-600', href: '/dashboard/customers', note: 'Joined this week' },
    { label: 'Low / out of stock', value: String(m.lowItems), icon: TriangleAlert, tone: 'bg-amber-50 text-amber-500', href: '/dashboard/inventory', note: 'Items needing restock' },
    { label: 'Deliveries done', value: String(m.delivered), icon: Truck, tone: 'bg-sky-50 text-sky-600', href: '/dashboard/deliveries', note: 'Delivered' },
    { label: 'Net profit', value: lkr(m.net), icon: Boxes, tone: m.net >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500', href: '/dashboard/finance', note: 'Income - expenses' },
  ];

  if (!data || !allowed) return <OverviewSkeleton />;

  const can = (...hrefs: string[]) => hrefs.some((h) => allowed.includes(h));

  const visibleStats = stats.filter((s) => can(s.href) || (s.href === '/dashboard/inventory' && can('/dashboard/products')));

  return (
    <div className="compact-ui relative mx-auto flex w-full max-w-7xl flex-col px-3 pb-6 pt-2 sm:px-6 sm:pt-3 lg:px-8 lg:pt-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[#0F172A]">Overview</h1>
        <p className="text-xs text-[#64748B]">Weekly summary across orders, customers, stock, deliveries and finance.</p>
      </div>

      {isMember && can('/dashboard/leads') && <LeadsOverview />}

      {visibleStats.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {visibleStats.map(({ label, value, icon, tone, href, note }) => (
            <StatCard key={label} label={label} value={value} icon={icon} tone={tone} href={href} note={note} />
          ))}
        </div>
      )}

      <div className="grid grid-flow-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {can('/dashboard/orders') && (
          <Panel title="Revenue trend" sub="Daily order revenue, last 7 days" href="/dashboard/orders" className="xl:col-span-2">
            <AreaChart labels={m.labels} values={m.revenue} />
          </Panel>
        )}
        {can('/dashboard/orders') && (
          <Panel title="Orders per day" sub="Number of orders placed" href="/dashboard/orders" className="xl:col-span-2">
            <BarChart labels={m.labels} series={[{ name: 'Orders', color: '#2563EB', values: m.count }]} />
          </Panel>
        )}
        {can('/dashboard/finance') && (
          <Panel title="Income vs expenses" sub="Finance, last 7 days" href="/dashboard/finance" className="md:col-span-2 xl:col-span-3">
            <BarChart labels={m.labels} series={[{ name: 'Income', color: '#16A34A', values: m.income }, { name: 'Expenses', color: '#F87171', values: m.expense }]} />
          </Panel>
        )}
        {can('/dashboard/products', '/dashboard/orders') && (
          <Panel title="Top products" sub="By sales this week" href="/dashboard/products" className="md:col-span-2 xl:col-span-1">
            <HBars items={m.topProducts} />
          </Panel>
        )}
        {can('/dashboard/orders') && <Panel title="Order status" href="/dashboard/orders"><Donut data={m.orderStatus} centerLabel="Orders" /></Panel>}
        {can('/dashboard/finance') && <Panel title="Payment methods" href="/dashboard/finance"><Donut data={m.payments} centerLabel="Orders" /></Panel>}
        {can('/dashboard/products', '/dashboard/inventory') && <Panel title="Product stock" href="/dashboard/products"><Donut data={m.stock} centerLabel="Products" /></Panel>}
        {can('/dashboard/deliveries') && <Panel title="Delivery status" href="/dashboard/deliveries"><Donut data={m.delivery} centerLabel="Deliveries" /></Panel>}
      </div>

      {visibleStats.length === 0 && allowed.filter((h) => h !== '/dashboard').length === 0 && !(isMember && can('/dashboard/leads')) && (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center text-xs text-[#64748B]">
          No pages are assigned to your role yet. Please contact the administrator.
        </div>
      )}
    </div>
  );
}
