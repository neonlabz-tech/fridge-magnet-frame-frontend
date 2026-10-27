import type { Order } from '@/types/order';
import type { ReportDoc, Cell, Tone } from './reportPdf';
import { INITIAL_INVENTORY } from '@/data/inventory';
import { getInventoryStatus } from '@/types/inventory';
import { readDeliveries, refreshDeliveries } from '@/lib/deliveryStore';
import { readTransactions, refreshTransactions } from '@/components/dashboard/finance/financeStore';
import { readLeads, readCrmUsers, refreshLeads } from '@/lib/crm';
import { refreshTeam } from '@/lib/teamApi';
import { fetchOrders } from '@/lib/orders';
import { apiV1Url } from '@/lib/backendUrl';

export type ReportId = 'sales' | 'product' | 'inventory' | 'customers' | 'leads' | 'payment' | 'delivery' | 'pnl';
export interface Range {
  from: Date;
  to: Date;
}

interface RawCustomer {
  _id?: string;
  id?: string;
  customerId?: string;
  customerName?: string;
  name?: string;
  emailAddress?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  createdAt?: string;
  isActive?: boolean;
}
interface RawProduct {
  _id?: string;
  productId?: string;
  productName?: string;
  price?: number;
  manufactureCost?: number;
  stock?: number;
}

export interface ReportData {
  orders: Order[];
  customers: RawCustomer[];
  products: RawProduct[];
}

const arr = (j: unknown): unknown[] => {
  if (Array.isArray(j)) return j;
  type Box = { data?: unknown; products?: unknown; customers?: unknown; items?: unknown };
  const o = j as Box | null;
  // Handles { data: [...] }, { products: [...] }, { customers: [...] } and { data: { products: [...] } }.
  for (const k of [o?.data, o?.products, o?.customers, o?.items]) if (Array.isArray(k)) return k;
  const inner = o?.data as Box | null | undefined;
  if (inner && typeof inner === 'object') {
    for (const k of [inner.products, inner.customers, inner.items, inner.data]) if (Array.isArray(k)) return k;
  }
  return [];
};

export async function loadReportData(): Promise<ReportData> {
  const [, , , , orders, customers, products] = await Promise.all([
    refreshTransactions().catch(() => null),
    refreshDeliveries().catch(() => null),
    refreshLeads().catch(() => null),
    refreshTeam().catch(() => null),
    fetchOrders().catch(() => [] as Order[]),
    fetch('/api/v1/customers?page=1&limit=10000')
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => arr(j) as RawCustomer[])
      .catch(() => [] as RawCustomer[]),
    fetch(apiV1Url('/products?page=1&limit=1000'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => arr(j) as RawProduct[])
      .catch(() => [] as RawProduct[]),
  ]);
  return { orders, customers, products };
}

/* ---------- helpers ---------- */
const lkr = (n: number) => `LKR ${Math.round(n).toLocaleString('en-US')}`;
const lkr2 = (n: number) => `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fd = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const day = (s?: string) => (s ? new Date(s) : null);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inRange = (d: Date | null, r: Range) => !!d && !Number.isNaN(d.getTime()) && d >= r.from && d <= r.to;
const localDay = (s: string) => new Date(`${s}T12:00:00`);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '0.0%');

const periodLabel = (r: Range) => `${fd(r.from)} - ${fd(r.to)}`;
const stamp = () => new Date().toISOString().slice(0, 10);

const orderTotal = (o: Order) => Number(o.totalValue ?? 0);
const live = (o: Order) => o.status !== 'canceled';

function dailySeries(orders: Order[], r: Range, value: (o: Order) => number) {
  const days = Math.min(31, Math.max(1, Math.round((r.to.getTime() - r.from.getTime()) / 86400000) + 1));
  const buckets = new Map<string, number>();
  const labels: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(r.to);
    d.setDate(d.getDate() - (days - 1 - i));
    const k = ymd(d);
    buckets.set(k, 0);
    labels.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
  }
  orders.forEach((o) => {
    const d = day(o.createdAt);
    if (!d) return;
    const k = ymd(d);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + value(o));
  });
  return { labels, values: [...buckets.values()] };
}

/* ---------- builders ---------- */

function sales(d: ReportData, r: Range): ReportDoc {
  const orders = d.orders.filter((o) => inRange(day(o.createdAt), r));
  const ok = orders.filter(live);
  const revenue = ok.reduce((s, o) => s + orderTotal(o), 0);
  const units = ok.reduce((s, o) => s + (o.qty || 0), 0);

  const byProduct = new Map<string, { units: number; amount: number }>();
  ok.forEach((o) =>
    (o.items ?? []).forEach((it) => {
      const cur = byProduct.get(it.name) ?? { units: 0, amount: 0 };
      cur.units += it.quantity || 0;
      cur.amount += (it.price || 0) * (it.quantity || 0);
      byProduct.set(it.name, cur);
    })
  );
  const prodRows = [...byProduct.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 10);

  const statuses = ['pending', 'processing', 'shipped', 'delivered', 'canceled'] as const;
  const colors: Record<string, string> = { pending: '#94a3b8', processing: '#2563eb', shipped: '#f59e0b', delivered: '#16a34a', canceled: '#dc2626' };
  const series = dailySeries(ok, r, orderTotal);

  return {
    title: 'Sales & Revenue Report',
    period: periodLabel(r),
    fileName: `sales-report_${stamp()}.pdf`,
    blocks: [
      {
        type: 'stats',
        items: [
          { label: 'Total Revenue', value: lkr(revenue) },
          { label: 'Total Orders', value: String(ok.length) },
          { label: 'Units Sold', value: String(units) },
          { label: 'Avg Order Value', value: lkr(ok.length ? revenue / ok.length : 0) },
        ],
      },
      { type: 'section', title: 'Sales trend' },
      { type: 'line', labels: series.labels, values: series.values },
      { type: 'section', title: 'Sales by product (top 10)' },
      {
        type: 'table',
        columns: [
          { header: 'Product name', w: 5 },
          { header: 'Units sold', w: 1.6, align: 'right' },
          { header: 'Unit price', w: 2, align: 'right' },
          { header: 'Total sales', w: 2.4, align: 'right' },
        ],
        rows: prodRows.map(([name, v]) => [name, v.units, lkr(v.units ? v.amount / v.units : 0), { text: lkr(v.amount), bold: true }]),
        totalRow: prodRows.length ? ['Total', prodRows.reduce((s, [, v]) => s + v.units, 0), '', lkr(prodRows.reduce((s, [, v]) => s + v.amount, 0))] : undefined,
      },
      { type: 'section', title: 'Order status overview' },
      {
        type: 'bars',
        items: statuses.map((s) => ({
          label: cap(s),
          value: orders.filter((o) => o.status === s).length,
          display: String(orders.filter((o) => o.status === s).length),
          color: colors[s],
        })),
      },
    ],
  };
}

function product(d: ReportData, r: Range): ReportDoc {
  const ok = d.orders.filter((o) => live(o) && inRange(day(o.createdAt), r));
  const sold = new Map<string, { units: number; amount: number }>();
  ok.forEach((o) =>
    (o.items ?? []).forEach((it) => {
      const k = it.name;
      const cur = sold.get(k) ?? { units: 0, amount: 0 };
      cur.units += it.quantity || 0;
      cur.amount += (it.price || 0) * (it.quantity || 0);
      sold.set(k, cur);
    })
  );
  const list = d.products.map((p) => {
    const name = p.productName || 'Untitled';
    const price = Number(p.price ?? 0);
    const cost = Number(p.manufactureCost ?? 0);
    const s = sold.get(name) ?? { units: 0, amount: 0 };
    return { name, sku: p.productId || '-', price, cost, profit: price - cost, units: s.units, amount: s.amount, stock: Number(p.stock ?? 0) };
  });
  const ranked = [...list].sort((a, b) => b.amount - a.amount);
  const totalUnits = list.reduce((s, p) => s + p.units, 0);
  const totalRev = list.reduce((s, p) => s + p.amount, 0);
  const totalProfit = list.reduce((s, p) => s + p.profit * p.units, 0);

  return {
    title: 'Product Performance Report',
    period: periodLabel(r),
    fileName: `product-performance-report_${stamp()}.pdf`,
    blocks: [
      {
        type: 'stats',
        items: [
          { label: 'Active Products', value: String(list.length) },
          { label: 'Units Sold', value: String(totalUnits) },
          { label: 'Revenue', value: lkr(totalRev) },
          { label: 'Gross Profit', value: lkr(totalProfit), tone: totalProfit >= 0 ? 'good' : 'bad' },
        ],
      },
      { type: 'section', title: 'Product performance ledger' },
      {
        type: 'table',
        columns: [
          { header: 'Product', w: 4.5 },
          { header: 'SKU', w: 1.8 },
          { header: 'Units', w: 1.2, align: 'right' },
          { header: 'Revenue', w: 2.2, align: 'right' },
          { header: 'Stock', w: 1.2, align: 'right' },
        ],
        rows: ranked.map((p) => [p.name, p.sku, p.units, lkr(p.amount), { text: p.stock, tone: (p.stock <= 0 ? 'bad' : p.stock <= 10 ? 'warn' : 'good') as Tone }]),
        empty: 'No products found.',
      },
      { type: 'section', title: 'Unit economics & margin analysis' },
      {
        type: 'table',
        columns: [
          { header: 'Product', w: 4 },
          { header: 'Mfg cost', w: 2, align: 'right' },
          { header: 'Selling price', w: 2, align: 'right' },
          { header: 'Unit profit', w: 2, align: 'right' },
          { header: 'Margin', w: 1.4, align: 'right' },
        ],
        rows: ranked.map((p) => [
          p.name,
          lkr(p.cost),
          lkr(p.price),
          { text: lkr(p.profit), bold: true },
          { text: pct(p.profit, p.price), tone: (p.profit >= 0 ? 'good' : 'bad') as Tone },
        ]),
        empty: 'No products found.',
      },
    ],
  };
}

function inventory(d: ReportData): ReportDoc {
  const items = INITIAL_INVENTORY;
  const low = items.filter((i) => getInventoryStatus(i.stock) === 'low-stock').length;
  const out = items.filter((i) => getInventoryStatus(i.stock) === 'out-of-stock').length;
  const value = items.reduce((s, i) => s + i.stock * i.unitValue, 0);
  const tone = (s: ReturnType<typeof getInventoryStatus>): Tone => (s === 'in-stock' ? 'good' : s === 'low-stock' ? 'warn' : 'bad');
  const label = { 'in-stock': 'In Stock', 'low-stock': 'Low Stock', 'out-of-stock': 'Out of Stock' };

  return {
    title: 'Inventory Report',
    period: `As of ${fd(new Date())}`,
    fileName: `inventory-report_${stamp()}.pdf`,
    blocks: [
      {
        type: 'stats',
        items: [
          { label: 'Total Items', value: String(items.length) },
          { label: 'Low Stock', value: String(low), tone: low ? 'warn' : undefined },
          { label: 'Out of Stock', value: String(out), tone: out ? 'bad' : undefined },
          { label: 'Stock Value', value: lkr(value) },
        ],
      },
      { type: 'section', title: 'Material stock ledger' },
      {
        type: 'table',
        columns: [
          { header: 'Item', w: 4.2 },
          { header: 'Status', w: 2, align: 'center' },
          { header: 'Stock', w: 1.2, align: 'right' },
          { header: 'Unit value', w: 2, align: 'right' },
          { header: 'Total value', w: 2.2, align: 'right' },
        ],
        rows: items.map((i) => {
          const s = getInventoryStatus(i.stock);
          return [{ text: i.name, sub: i.id }, { text: label[s], tone: tone(s) }, i.stock, lkr(i.unitValue), { text: lkr(i.stock * i.unitValue), bold: true }] as Cell[];
        }),
        totalRow: ['Total', '', items.reduce((s, i) => s + i.stock, 0), '', lkr(value)],
      },
      { type: 'section', title: 'Finished product stock' },
      {
        type: 'table',
        columns: [
          { header: 'Product', w: 5 },
          { header: 'SKU', w: 2 },
          { header: 'Stock', w: 1.5, align: 'right' },
          { header: 'Status', w: 2, align: 'center' },
        ],
        rows: d.products.map((p) => {
          const st = Number(p.stock ?? 0);
          return [p.productName || 'Untitled', p.productId || '-', st, { text: st <= 0 ? 'Out of Stock' : st <= 10 ? 'Low Stock' : 'In Stock', tone: (st <= 0 ? 'bad' : st <= 10 ? 'warn' : 'good') as Tone }] as Cell[];
        }),
        empty: 'No products found.',
      },
    ],
  };
}

function customers(d: ReportData, r: Range): ReportDoc {
  const ords = d.orders.filter((o) => live(o) && inRange(day(o.createdAt), r));
  const stat = new Map<string, { orders: number; spent: number; last: Date | null }>();
  ords.forEach((o) => {
    const k = o.customerId || o.customerName;
    const cur = stat.get(k) ?? { orders: 0, spent: 0, last: null };
    cur.orders += 1;
    cur.spent += orderTotal(o);
    const dd = day(o.createdAt);
    if (dd && (!cur.last || dd > cur.last)) cur.last = dd;
    stat.set(k, cur);
  });
  const rows = d.customers.map((c) => {
    const name = c.customerName || c.name || 'Customer';
    const key = c.customerId || c.id || c._id || name;
    const s = stat.get(key) ?? stat.get(name) ?? { orders: 0, spent: 0, last: null };
    return { name, email: c.emailAddress || c.email || c.phoneNumber || c.phone || '-', active: c.isActive !== false, ...s };
  });
  const top = rows.sort((a, b) => b.spent - a.spent).slice(0, 25);
  const fresh = d.customers.filter((c) => inRange(day(c.createdAt), r)).length;

  return {
    title: 'Customers Report',
    period: periodLabel(r),
    fileName: `customers-report_${stamp()}.pdf`,
    blocks: [
      {
        type: 'stats',
        items: [
          { label: 'Total Customers', value: d.customers.length.toLocaleString('en-US') },
          { label: 'Active Customers', value: d.customers.filter((c) => c.isActive !== false).length.toLocaleString('en-US') },
          { label: 'New in Period', value: String(fresh) },
          { label: 'Repeat Buyers', value: String(rows.filter((c) => c.orders > 1).length) },
        ],
      },
      { type: 'section', title: 'Customer performance (top 25 by spend)' },
      {
        type: 'table',
        columns: [
          { header: 'Customer', w: 4.4 },
          { header: 'Orders', w: 1.2, align: 'right' },
          { header: 'Total spent', w: 2.2, align: 'right' },
          { header: 'Last order', w: 2 },
          { header: 'Status', w: 1.6, align: 'center' },
        ],
        rows: top.map((c) => [{ text: c.name, sub: c.email }, c.orders, { text: lkr(c.spent), bold: true }, c.last ? fd(c.last) : '-', { text: c.active ? 'Active' : 'Inactive', tone: (c.active ? 'good' : 'muted') as Tone }] as Cell[]),
        empty: 'No customers found.',
      },
    ],
  };
}

function leads(r: Range): ReportDoc {
  const all = readLeads();
  const list = all.filter((l) => inRange(day(l.dateAdded), r));
  const converted = list.filter((l) => l.status === 'Converted');
  const eod = new Date();
  eod.setHours(23, 59, 59, 999);
  const due = list.filter((l) => l.status !== 'Converted' && l.nextFollowUp && new Date(l.nextFollowUp) <= eod);
  const users = readCrmUsers();
  const nameOf = (u: string) => (u ? users.find((x) => x.username === u)?.name ?? u : 'Unassigned');
  const stageTone: Record<string, Tone> = { New: 'info', Connected: 'info', 'Follow Up': 'warn', Converted: 'good', Lost: 'muted' };

  return {
    title: 'Leads & Follow-ups Report',
    period: periodLabel(r),
    fileName: `leads-followups-report_${stamp()}.pdf`,
    blocks: [
      {
        type: 'stats',
        items: [
          { label: 'Total Leads', value: String(list.length) },
          { label: 'Converted', value: String(converted.length), tone: 'good' },
          { label: 'Follow-ups Due', value: String(due.length), tone: due.length ? 'warn' : undefined },
          { label: 'Conversion Rate', value: pct(converted.length, list.length) },
        ],
      },
      { type: 'section', title: 'Pipeline by status' },
      {
        type: 'bars',
        items: (['New', 'Connected', 'Follow Up', 'Converted', 'Lost'] as const).map((s) => ({
          label: s,
          value: list.filter((l) => l.status === s).length,
          display: String(list.filter((l) => l.status === s).length),
          color: s === 'Converted' ? '#16a34a' : '#2563eb',
        })),
      },
      { type: 'section', title: 'Sales team performance' },
      {
        type: 'table',
        columns: [
          { header: 'User', w: 3 },
          { header: 'Leads', w: 1.2, align: 'right' },
          { header: 'Calls', w: 1.2, align: 'right' },
          { header: 'Pending', w: 1.4, align: 'right' },
          { header: 'Converted', w: 1.6, align: 'right' },
          { header: 'Sales', w: 2.2, align: 'right' },
        ],
        rows: users.map((u) => {
          const mine = list.filter((l) => l.owner === u.username);
          const calls = all.flatMap((l) => l.history).filter((h) => !h.system && h.by === u.username && inRange(day(h.at), r)).length;
          const conv = mine.filter((l) => l.status === 'Converted');
          return [u.name, mine.length, calls, mine.filter((l) => l.status === 'Follow Up' || l.status === 'Connected').length, conv.length, { text: lkr(conv.reduce((s, l) => s + (l.order?.total ?? 0), 0)), bold: true }] as Cell[];
        }),
        empty: 'No sales users yet.',
      },
      { type: 'section', title: 'Lead & follow-up register' },
      {
        type: 'table',
        columns: [
          { header: 'Lead', w: 3.4 },
          { header: 'Source', w: 1.6 },
          { header: 'Status', w: 1.6, align: 'center' },
          { header: 'Result', w: 2 },
          { header: 'Next follow-up', w: 2 },
          { header: 'Owner', w: 1.8 },
        ],
        rows: list.map((l) => [
          { text: l.business, sub: `${l.id} - ${l.phone}` },
          l.source,
          { text: l.status, tone: stageTone[l.status] },
          l.result || '-',
          l.nextFollowUp ? fd(new Date(l.nextFollowUp)) : '-',
          nameOf(l.owner),
        ] as Cell[]),
        empty: 'No leads in this period.',
      },
    ],
  };
}

function payment(d: ReportData, r: Range): ReportDoc {
  const ords = d.orders.filter((o) => inRange(day(o.createdAt), r));
  const paid = ords.filter((o) => o.paymentStatus === 'paid');
  const pending = ords.filter((o) => (o.paymentStatus ?? 'pending') === 'pending' && live(o));
  const failed = ords.filter((o) => o.paymentStatus === 'failed' || o.paymentStatus === 'refunded');
  const sum = (a: Order[]) => a.reduce((s, o) => s + orderTotal(o), 0);
  const byMethod = new Map<string, number>();
  paid.forEach((o) => byMethod.set(o.paymentMethod || 'Other', (byMethod.get(o.paymentMethod || 'Other') ?? 0) + orderTotal(o)));
  const tone: Record<string, Tone> = { paid: 'good', pending: 'warn', failed: 'bad', refunded: 'muted' };

  return {
    title: 'Payment / Transaction Report',
    period: periodLabel(r),
    fileName: `payment-transaction-report_${stamp()}.pdf`,
    blocks: [
      {
        type: 'stats',
        items: [
          { label: 'Transactions', value: String(ords.length) },
          { label: 'Collected', value: lkr(sum(paid)), tone: 'good' },
          { label: 'Pending', value: lkr(sum(pending)), tone: 'warn' },
          { label: 'Failed / Refunded', value: lkr(sum(failed)), tone: failed.length ? 'bad' : undefined },
        ],
      },
      { type: 'section', title: 'Payment method allocation' },
      {
        type: 'bars',
        items: [...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([m, v]) => ({ label: m, value: v, display: lkr(v) })),
      },
      { type: 'section', title: 'Transaction details' },
      {
        type: 'table',
        columns: [
          { header: 'Transaction', w: 2.2 },
          { header: 'Customer', w: 3 },
          { header: 'Method', w: 1.8 },
          { header: 'Date', w: 1.8 },
          { header: 'Status', w: 1.6, align: 'center' },
          { header: 'Amount', w: 2, align: 'right' },
        ],
        rows: ords.slice(0, 200).map((o) => {
          const p = o.paymentStatus ?? 'pending';
          const dd = day(o.createdAt);
          return [o.orderId, o.customerName, o.paymentMethod || '-', dd ? fd(dd) : '-', { text: cap(p), tone: tone[p] }, { text: lkr(orderTotal(o)), bold: true }] as Cell[];
        }),
        empty: 'No transactions in this period.',
      },
    ],
  };
}

function delivery(r: Range): ReportDoc {
  const list = readDeliveries().filter((x) => inRange(localDay(x.date), r));
  const cnt = (s: string) => list.filter((x) => x.status === s).length;
  const drivers = [...new Set(list.map((x) => x.driver).filter(Boolean))];
  const tone: Record<string, Tone> = { delivered: 'good', 'in-transit': 'info', pending: 'warn', returned: 'bad' };

  return {
    title: 'Delivery Report',
    period: periodLabel(r),
    fileName: `delivery-report_${stamp()}.pdf`,
    blocks: [
      {
        type: 'stats',
        items: [
          { label: 'Total Deliveries', value: String(list.length) },
          { label: 'Delivered', value: String(cnt('delivered')), tone: 'good' },
          { label: 'In Transit', value: String(cnt('in-transit')), tone: 'info' },
          { label: 'Returned', value: String(cnt('returned')), tone: cnt('returned') ? 'bad' : undefined },
        ],
      },
      { type: 'section', title: 'Courier / driver performance' },
      {
        type: 'table',
        columns: [
          { header: 'Driver', w: 3 },
          { header: 'Assigned', w: 1.5, align: 'right' },
          { header: 'Delivered', w: 1.5, align: 'right' },
          { header: 'Returned', w: 1.5, align: 'right' },
          { header: 'Success rate', w: 2, align: 'right' },
        ],
        rows: drivers.map((dr) => {
          const mine = list.filter((x) => x.driver === dr);
          const del = mine.filter((x) => x.status === 'delivered').length;
          return [dr, mine.length, del, mine.filter((x) => x.status === 'returned').length, { text: pct(del, mine.length), bold: true }] as Cell[];
        }),
        empty: 'No driver activity.',
      },
      { type: 'section', title: 'Delivery log' },
      {
        type: 'table',
        columns: [
          { header: 'Delivery', w: 2.2 },
          { header: 'Order', w: 2.2 },
          { header: 'Destination', w: 3 },
          { header: 'Date', w: 1.8 },
          { header: 'Status', w: 1.7, align: 'center' },
        ],
        rows: list.map((x) => [x.id, x.orderId, x.place, fd(localDay(x.date)), { text: cap(x.status.replace('-', ' ')), tone: tone[x.status] }] as Cell[]),
        empty: 'No deliveries in this period.',
      },
    ],
  };
}

function pnl(r: Range): ReportDoc {
  const tx = readTransactions().filter((t) => t.status === 'completed' && inRange(localDay(t.date), r));
  const inc = tx.filter((t) => t.kind === 'income');
  const exp = tx.filter((t) => t.kind === 'expense');
  const sum = (a: typeof tx) => a.reduce((s, t) => s + t.amount, 0);
  const net = sum(inc) - sum(exp);
  const group = (a: typeof tx, key: 'method' | 'party') => {
    const m = new Map<string, number>();
    a.forEach((t) => m.set(t[key], (m.get(t[key]) ?? 0) + t.amount));
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  };

  return {
    title: 'Profit & Loss Report',
    period: periodLabel(r),
    fileName: `profit-loss-report_${stamp()}.pdf`,
    blocks: [
      {
        type: 'stats',
        items: [
          { label: 'Total Income', value: lkr(sum(inc)), tone: 'good' },
          { label: 'Total Expenses', value: lkr(sum(exp)), tone: 'bad' },
          { label: 'Net Profit', value: lkr(net), tone: net >= 0 ? 'good' : 'bad' },
          { label: 'Profit Margin', value: pct(net, sum(inc)) },
        ],
      },
      { type: 'section', title: 'Financial overview' },
      {
        type: 'bars',
        items: [
          { label: 'Income', value: sum(inc), display: lkr(sum(inc)), color: '#16a34a' },
          { label: 'Expenses', value: sum(exp), display: lkr(sum(exp)), color: '#dc2626' },
        ],
      },
      {
        type: 'summary',
        title: 'Income summary',
        rows: [...group(inc, 'method').map(([k, v]) => ({ label: k, value: lkr(v) })), { label: 'Total income', value: lkr(sum(inc)), tone: 'good' as Tone, bold: true }],
      },
      {
        type: 'summary',
        title: 'Expenses summary',
        rows: [...group(exp, 'party').map(([k, v]) => ({ label: k, value: lkr(v) })), { label: 'Total expenses', value: lkr(sum(exp)), tone: 'bad' as Tone, bold: true }],
      },
      {
        type: 'summary',
        title: 'Bottom line',
        rows: [{ label: net >= 0 ? 'Net profit' : 'Net loss', value: lkr2(net), tone: (net >= 0 ? 'good' : 'bad') as Tone, bold: true }],
      },
    ],
  };
}

export function buildReport(id: ReportId, data: ReportData, range: Range): ReportDoc {
  switch (id) {
    case 'sales':
      return sales(data, range);
    case 'product':
      return product(data, range);
    case 'inventory':
      return inventory(data);
    case 'customers':
      return customers(data, range);
    case 'leads':
      return leads(range);
    case 'payment':
      return payment(data, range);
    case 'delivery':
      return delivery(range);
    case 'pnl':
      return pnl(range);
  }
}
