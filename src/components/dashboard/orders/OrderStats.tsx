'use client';

import { ShoppingBag, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { Order } from '@/types/order';
import StatCard from '@/components/dashboard/shared/StatCard';

export default function OrderStats({ orders }: { orders: Order[] }) {
  const is = (o: Order) => String(o.status || '').toLowerCase();
  const total = orders.length;
  const pendingCount = orders.filter((o) => is(o) === 'pending').length;
  const processingCount = orders.filter((o) => is(o) === 'processing').length;
  const completedCount = orders.filter((o) => ['delivered', 'completed', 'shipped'].includes(is(o))).length;

  return (
    <div className="mb-4 grid w-full grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
      <StatCard label="Total Orders" value={total} icon={ShoppingBag} tone="blue" />
      <StatCard label="Pending" value={pendingCount} icon={Clock} tone="amber" />
      <StatCard label="Processing" value={processingCount} icon={RefreshCw} tone="sky" />
      <StatCard label="Completed" value={completedCount} icon={CheckCircle2} tone="green" />
    </div>
  );
}
