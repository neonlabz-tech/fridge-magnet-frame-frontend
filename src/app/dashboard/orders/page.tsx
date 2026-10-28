'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  Download,
  X,
  RefreshCw,
} from 'lucide-react';
import DeleteOrderModal from '@/components/dashboard/orders/DeleteOrderModal';
import OrderStatus from '@/components/dashboard/orders/OrderStatus';
import OrderFilters, {
  type OrderFilterStatus,
  type OrderSortBy,
} from '@/components/dashboard/orders/OrderFilters';
import OrderHeader from '@/components/dashboard/orders/OrderHeader';
import OrderPagination from '@/components/dashboard/orders/OrderPagination';
import { downloadOrdersPdf } from '@/lib/ordersPdf';
import OrderStats from '@/components/dashboard/orders/OrderStats';
import OrderTable from '@/components/dashboard/orders/OrderTable';
import DirectOrderModal from '@/components/dashboard/orders/DirectOrderModal';
import { fetchOrders } from '@/lib/orders';
import { TableSkeleton } from '@/components/dashboard/shared/Skeleton';
import { apiV1Url } from '@/lib/backendUrl';
import { syncOrderStock } from '@/lib/orderStock';
import type { Order, OrderStatus as OrderStatusType } from '@/types/order';
import { useToastStore } from '@/store/toastStore';

export default function OrdersPage() {
  const { addToast } = useToastStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [viewTarget, setViewTarget] = useState<Order | null>(null);
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [filterStatus, setFilterStatus] = useState<OrderFilterStatus>('all');
  const [sortBy, setSortBy] = useState<OrderSortBy>('default');
  const [sortOpen, setSortOpen] = useState(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const fetched = await fetchOrders();
      setOrders(fetched);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  // Filter by Status and Search Term
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (filterStatus !== 'all') {
        const s = String(order.status || '').toLowerCase();
        if (filterStatus === 'delivered' && s !== 'delivered' && s !== 'completed') {
          return false;
        } else if (filterStatus !== 'delivered' && s !== filterStatus) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesId = order.orderId.toLowerCase().includes(query);
        const matchesName = (order.customerName || '').toLowerCase().includes(query);
        const matchesPhone = (order.phone || '').toLowerCase().includes(query);
        const matchesEmail = (order.email || '').toLowerCase().includes(query);
        if (!matchesId && !matchesName && !matchesPhone && !matchesEmail) {
          return false;
        }
      }

      return true;
    });
  }, [orders, filterStatus, searchTerm]);

  // Sort orders
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (sortBy === 'id-asc') return a.orderId.localeCompare(b.orderId);
      if (sortBy === 'id-desc') return b.orderId.localeCompare(a.orderId);
      if (sortBy === 'name-asc') return (a.customerName || '').localeCompare(b.customerName || '');
      if (sortBy === 'name-desc') return (b.customerName || '').localeCompare(a.customerName || '');
      if (sortBy === 'amount-asc') return (a.totalValue || 0) - (b.totalValue || 0);
      if (sortBy === 'amount-desc') return (b.totalValue || 0) - (a.totalValue || 0);
      if (sortBy === 'date-asc') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      return 0; // default order
    });
  }, [filteredOrders, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = sortedOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  const startItem = sortedOrders.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, sortedOrders.length);

  const handleFilterSelect = (nextFilter: OrderFilterStatus) => {
    setFilterStatus(nextFilter);
    setPage(1);
  };

  const handleSortSelect = (nextSort: OrderSortBy) => {
    setSortBy(nextSort);
    setPage(1);
    setSortOpen(false);
  };

  // Bulk Selection Handlers
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pagedOrders.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk Status Update
  const apiError = async (res: Response, fallback: string) => {
    try {
      const j = (await res.json()) as { message?: string | string[] };
      if (j?.message) return Array.isArray(j.message) ? j.message.join(', ') : j.message;
    } catch {
      // Not a JSON error - usually the backend is not running (proxy answers HTTP 500).
      if (res.status >= 500) return `Server is not reachable (HTTP ${res.status}). Check that the backend is running.`;
    }
    return fallback;
  };

  const handleBulkUpdateStatus = async (newStatus: OrderStatusType) => {
    if (selectedIds.size === 0) return;

    const done = new Set<string>();
    let lastError = '';
    for (const o of orders.filter((x) => selectedIds.has(x.id))) {
      try {
        const res = await fetch(apiV1Url(`/orders/${o._id || o.id}/status`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: newStatus.toUpperCase(),
            ...(newStatus === 'delivered' ? { paymentStatus: 'paid' } : {}),
          }),
        });
        if (!res.ok) throw new Error(await apiError(res, `Could not update ${o.orderId}.`));
        await syncOrderStock(o, newStatus).catch(() => null);
        done.add(o.id);
      } catch (e) {
        lastError = e instanceof Error ? e.message : `Could not update ${o.orderId}.`;
      }
    }

    setOrders((prev) =>
      prev.map((order) =>
        done.has(order.id)
          ? { ...order, status: newStatus, paymentStatus: newStatus === 'delivered' ? 'paid' : order.paymentStatus }
          : order
      )
    );

    if (done.size) addToast(`Updated ${done.size} order${done.size > 1 ? 's' : ''} to ${newStatus}.`, 'success');
    if (lastError) addToast(lastError, 'error');
    setSelectedIds(new Set());
  };

  // Export (All or Selected)
  const handleExport = (exportOnlySelected = false) => {
    const listToExport = exportOnlySelected
      ? orders.filter((o) => selectedIds.has(o.id))
      : sortedOrders;

    if (listToExport.length === 0) {
      addToast('No orders available to export.', 'error');
      return;
    }

    downloadOrdersPdf(listToExport)
      .then(() => addToast(`Exported ${listToExport.length} orders as PDF.`, 'success'))
      .catch(() => addToast('Could not create the PDF.', 'error'));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await fetch(apiV1Url(`/orders/${deleteTarget.id}`), {
        method: 'DELETE',
      }).catch(() => null);

      setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
      addToast(`Order ${deleteTarget.orderId} deleted.`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete order');
    }
  };

  return (
    <div className="compact-ui relative w-full min-h-full px-3 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3 lg:px-8 lg:pb-4 lg:pt-4 max-w-7xl mx-auto lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
      {/* Modals */}
      <DeleteOrderModal
        isOpen={Boolean(deleteTarget)}
        order={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <OrderStatus
        isOpen={Boolean(viewTarget)}
        order={viewTarget}
        onClose={() => setViewTarget(null)}
        onDeleteRequest={(target) => {
          setViewTarget(null);
          setDeleteTarget(target);
        }}
        onUpdated={(updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        }}
      />

      <DirectOrderModal
        isOpen={addOrderOpen}
        onClose={() => setAddOrderOpen(false)}
        onOrderCreated={(newOrder) => {
          setOrders((prev) => [newOrder, ...prev]);
        }}
      />

      {/* Screen 1: Orders Header */}
      <OrderHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onAddOrder={() => setAddOrderOpen(true)}
        onExport={() => handleExport(false)}
      />

      {/* Stats Cards (Total, Pending, Processing, Completed) */}
      <OrderStats orders={orders} />

      {/* Main Table Card */}
      <div className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white shadow-xs lg:min-h-0 lg:flex-1">
        {/* Filters & Tabs */}
        <div className="px-4 pt-3 pb-0">
          <OrderFilters
            filterStatus={filterStatus}
            sortBy={sortBy}
            sortOpen={sortOpen}
            isBulkMode={isBulkMode}
            onToggleSort={() => setSortOpen((cur) => !cur)}
            onToggleBulkMode={() => {
              setIsBulkMode((prev) => {
                if (prev) setSelectedIds(new Set());
                return !prev;
              });
            }}
            onFilterSelect={handleFilterSelect}
            onSortSelect={handleSortSelect}
          />
        </div>

        {/* Orders Table */}
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <div className="flex items-center justify-center p-16 text-[12px] font-semibold text-rose-600">
            {error}
          </div>
        ) : (
          <OrderTable
            orders={pagedOrders}
            selectedIds={selectedIds}
            isBulkMode={isBulkMode}
            onToggleSelectAll={handleToggleSelectAll}
            onToggleSelectOne={handleToggleSelectOne}
            onView={setViewTarget}
            onDelete={setDeleteTarget}
          />
        )}

        {/* Pagination Section - Always Visible */}
        <OrderPagination
          currentPage={safePage}
          totalPages={totalPages}
          startItem={startItem}
          endItem={endItem}
          totalItems={sortedOrders.length}
          onPageChange={setPage}
        />
      </div>

      {/* Bulk Actions Floating Bar (Shows when items are checked) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-1.5rem)] -translate-x-1/2 transform sm:bottom-6 sm:w-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700 bg-[#071C40] px-4 py-3 text-white shadow-2xl backdrop-blur-md sm:gap-3 sm:px-6">
            {/* Selected Count */}
            <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
              <CheckSquare size={15} className="text-[#38BDF8]" />
              <span className="text-[12px] font-bold text-white whitespace-nowrap">
                {selectedIds.size} selected
              </span>
            </div>

            {/* Quick Status Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkUpdateStatus('processing')}
                className="inline-flex items-center gap-1 rounded-xl bg-sky-500/20 px-2.5 py-1.5 text-[12px] font-semibold text-sky-300 transition hover:bg-sky-500/30 whitespace-nowrap"
              >
                <RefreshCw size={12} />
                <span>Mark Processing</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkUpdateStatus('delivered')}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-300 transition hover:bg-emerald-500/30 whitespace-nowrap"
              >
                <CheckCircle2 size={12} />
                <span>Mark Delivered</span>
              </button>
            </div>

            {/* Export Selected */}
            <button
              type="button"
              onClick={() => handleExport(true)}
              className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/20 whitespace-nowrap"
              title="Export selected as PDF"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Clear Selection */}
            <button
              type="button"
              onClick={handleClearSelection}
              className="ml-1 flex size-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              title="Deselect all"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
