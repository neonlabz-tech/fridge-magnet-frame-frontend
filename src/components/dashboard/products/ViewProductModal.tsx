'use client';

import { useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Clock,
  Package,
  Pencil,
  Tag,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Product } from '@/types/product';
import { apiV1Url } from '@/lib/backendUrl';
import { useInventory } from '@/lib/inventoryStore';
import { readMaterials, materialCost, useMaterialsSync } from '@/lib/materials';

interface ViewProductModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onEdit?: (product: Product) => void;
  onUpdate?: (
    product: Product,
    newStock: string,
  ) => Promise<boolean>;
}

type StockLogEntry = {
  previousStock: number;
  newStock: number;
  changedBy: string;
  changedAt: string;
};

// If the backend returns pagination metadata we trust it (server-side
// pagination). If it just returns a flat array (legacy API), we fall
// back to slicing that array on the client so the UI still only ever
// shows PAGE_SIZE rows at a time.
type StockLogResponse = {
  data: StockLogEntry[];
  total?: number;
  page?: number;
  totalPages?: number;
  pagination?: {
    total?: number;
    page?: number;
    totalPages?: number;
  };
};

const PAGE_SIZE = 5;

export default function ViewProductModal({
  isOpen,
  product,
  onClose,
  onEdit,
  onUpdate,
}: ViewProductModalProps) {
  const [showLog, setShowLog] = useState(false);
  const [isLoadingLog, setIsLoadingLog] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [activeGalleryImage, setActiveGalleryImage] =
    useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isServerPaginated, setIsServerPaginated] = useState(true);
  // Holds either the current page's rows (server-paginated) or the
  // full record set (client-side fallback for legacy API responses).
  const [logRecords, setLogRecords] = useState<StockLogEntry[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setShowLog(false);
    setLogRecords([]);
    setLogError(null);
    setActiveGalleryImage(null);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalRecords(0);
    setIsServerPaginated(true);
  }, [isOpen, product?.id]);

  const inventory = useInventory();
  useMaterialsSync();

  if (!isOpen || !product) return null;

  const currentStock = Number(product.stockCount ?? 0);
  const galleryImages = product.galleryImageUrls ?? [];

  const getStatus = (stock: number) => {
    if (stock > 10) return 'In Stock';
    if (stock > 4) return 'Low Stock';
    return 'Out of Stock';
  };

  const currentStatus = getStatus(currentStock);
  // Manufacture cost follows the product's materials (inventory unit values) when they exist.
  const materials = readMaterials(product.sku || product.id);
  const manufactureCost = materials.some((m) => m.qty > 0)
    ? materialCost(materials, inventory)
    : Number(product.manufactureCost ?? 0);
  const price = Number(product.price ?? 0);
  const unitProfit = price - manufactureCost;
  const margin = price > 0 ? (unitProfit / price) * 100 : 0;
  const lkr = (n: number) => `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const statusTone =
    currentStatus === 'In Stock'
      ? { pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', text: 'text-emerald-600' }
      : currentStatus === 'Low Stock'
        ? { pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', text: 'text-amber-600' }
        : { pill: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500', text: 'text-rose-600' };

  const mainImage = activeGalleryImage || product.primaryImageUrl;
  const thumbnails = Array.from(
    new Set([product.primaryImageUrl, ...galleryImages].filter((u): u is string => Boolean(u))),
  );

  const fetchStockLog = async (page: number) => {
    if (!product) return;

    setIsLoadingLog(true);
    setLogError(null);

    try {
      const res = await fetch(
        apiV1Url(
          `/products/${product.id}/stock-log?page=${page}&limit=${PAGE_SIZE}`,
        ),
      );

      if (!res.ok) {
        throw new Error('Failed to fetch stock log');
      }

      const json: StockLogResponse = await res.json();
      const records = json.data ?? [];

      const serverTotal = json.pagination?.total ?? json.total;
      const serverTotalPages =
        json.pagination?.totalPages ?? json.totalPages;

      if (typeof serverTotal === 'number') {
        // Backend supports pagination - trust its metadata and the
        // (already page-sized) records it returned.
        setIsServerPaginated(true);
        setLogRecords(records);
        setTotalRecords(serverTotal);
        setTotalPages(
          serverTotalPages ??
            Math.max(1, Math.ceil(serverTotal / PAGE_SIZE)),
        );
      } else {
        // Legacy API - it returned everything at once. Paginate on
        // the client so we still only render PAGE_SIZE rows.
        setIsServerPaginated(false);
        setLogRecords(records);
        setTotalRecords(records.length);
        setTotalPages(Math.max(1, Math.ceil(records.length / PAGE_SIZE)));
      }
    } catch (err) {
      setLogError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch stock log',
      );
    } finally {
      setIsLoadingLog(false);
    }
  };

  const handleViewLog = async () => {
    const next = !showLog;
    setShowLog(next);

    if (!next) return;

    setCurrentPage(1);
    await fetchStockLog(1);
  };

  const goToPage = async (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;

    setCurrentPage(page);

    if (isServerPaginated) {
      await fetchStockLog(page);
    }
    // For client-side pagination, the full list is already loaded in
    // logRecords - `displayedLog` below handles the slicing.
  };

  const displayedLog = isServerPaginated
    ? logRecords
    : logRecords.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm sm:p-5" onClick={onClose}>
      <div
        className="relative z-[1000] flex max-h-[94vh] w-full max-w-[900px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Product details"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-[#EFF6FF] px-2 py-1 text-[11px] font-bold tracking-wide text-[#2563EB]">
                <Tag size={11} /> {product.sku || product.id}
              </span>
              {product.series && (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{product.series}</span>
              )}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone.pill}`}>
                <span className={`size-1.5 rounded-full ${statusTone.dot}`} />
                {currentStatus}
              </span>
            </div>
            <h2 className="mt-2.5 break-words text-xl font-bold tracking-tight text-[#0F172A] sm:text-2xl">{product.name}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X size={19} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6 sm:px-7">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
            {/* Gallery */}
            <div>
              <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#F8FAFC]">
                {mainImage ? (
                  <img src={mainImage} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <Package size={44} strokeWidth={1.5} />
                    <span className="text-xs font-semibold">No image</span>
                  </div>
                )}
              </div>
              {thumbnails.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {thumbnails.map((url, idx) => (
                    <button
                      key={`${url}-${idx}`}
                      type="button"
                      onClick={() => setActiveGalleryImage(url)}
                      className={`size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-slate-50 transition ${
                        url === mainImage ? 'border-[#2563EB]' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      aria-label={`View image ${idx + 1}`}
                    >
                      <img src={url} alt={`${product.name} ${idx + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{product.description || 'No description provided.'}</p>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-[#0B2F8F] to-[#071C40] p-5 text-white">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">Selling price</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{lkr(price)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${unitProfit >= 0 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-rose-400/20 text-rose-200'}`}>
                    <TrendingUp size={13} className={unitProfit < 0 ? 'rotate-180' : ''} />
                    {margin.toFixed(1)}% margin
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ProductInfo icon={Wallet} label="Manufacture cost" value={lkr(manufactureCost)} />
                <ProductInfo
                  icon={TrendingUp}
                  label="Unit profit"
                  value={`${unitProfit >= 0 ? '+' : '-'}${lkr(Math.abs(unitProfit))}`}
                  tone={unitProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                />
                <ProductInfo icon={Boxes} label="In stock" value={`${currentStock} units`} tone={statusTone.text} />
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-xs">
                  <Clock size={16} />
                </span>
                <div className="min-w-0 text-xs leading-5 text-slate-500">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Last updated</p>
                  <p>
                    by <span className="font-bold text-[#0F172A]">{product.lastUpdatedBy || 'Admin'}</span> on{' '}
                    <span className="font-semibold text-slate-700">
                      {product.lastUpdatedDate ? new Date(product.lastUpdatedDate).toLocaleDateString() : 'Today'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {showLog && (
              <div>
                <h3 className="mb-3 text-base font-bold text-[#002B73] sm:text-lg">
                  Stock Modification History
                </h3>

                {isLoadingLog ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-sm text-slate-500">
                      Loading...
                    </p>
                  </div>
                ) : logError ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-5">
                    <p className="text-sm text-red-600">
                      {logError}
                    </p>
                  </div>
                ) : totalRecords === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-sm text-slate-500">
                      No stock changes recorded yet.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="divide-y divide-slate-100 sm:hidden">
                        {displayedLog.map((entry, idx) => {
                          const change =
                            entry.newStock -
                            entry.previousStock;

                          return (
                            <div
                              key={idx}
                              className="space-y-3 p-4"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-500">
                                  {new Date(
                                    entry.changedAt,
                                  ).toLocaleDateString()}
                                </span>

                                <span
                                  className={[
                                    'text-sm font-bold',
                                    change >= 0
                                      ? 'text-green-600'
                                      : 'text-red-600',
                                  ].join(' ')}
                                >
                                  {change >= 0
                                    ? `+${change}`
                                    : change}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <HistoryValue
                                  label="Previous"
                                  value={String(
                                    entry.previousStock,
                                  )}
                                />

                                <HistoryValue
                                  label="New Stock"
                                  value={String(
                                    entry.newStock,
                                  )}
                                />

                                <HistoryValue
                                  label="Changed By"
                                  value={entry.changedBy}
                                />

                                <HistoryValue
                                  label="Time"
                                  value={new Date(
                                    entry.changedAt,
                                  ).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="hidden overflow-x-auto sm:block">
                        <table className="w-full min-w-[600px] text-sm">
                          <thead className="bg-[#F5F6FB]">
                            <tr>
                              {[
                                'Date',
                                'Previous',
                                'Change',
                                'New Stock',
                                'Changed By',
                              ].map((heading) => (
                                <th
                                  key={heading}
                                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold text-[#002B73]"
                                >
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          <tbody>
                            {displayedLog.map((entry, idx) => {
                              const change =
                                entry.newStock -
                                entry.previousStock;

                              return (
                                <tr
                                  key={idx}
                                  className="border-t border-slate-100"
                                >
                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                                    {new Date(
                                      entry.changedAt,
                                    ).toLocaleString()}
                                  </td>

                                  <td className="px-4 py-3 font-medium text-slate-800">
                                    {entry.previousStock}
                                  </td>

                                  <td
                                    className={[
                                      'px-4 py-3 font-bold',
                                      change >= 0
                                        ? 'text-green-600'
                                        : 'text-red-600',
                                    ].join(' ')}
                                  >
                                    {change >= 0
                                      ? `+${change}`
                                      : change}
                                  </td>

                                  <td className="px-4 py-3 font-medium text-slate-800">
                                    {entry.newStock}
                                  </td>

                                  <td className="px-4 py-3 text-slate-500">
                                    {entry.changedBy}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {totalPages > 1 && (
                      <div className="mt-3 flex flex-col items-center justify-between gap-3 sm:flex-row">
                        <p className="text-xs font-medium text-slate-500">
                          Showing{' '}
                          <span className="font-bold text-slate-700">
                            {(currentPage - 1) * PAGE_SIZE + 1}
                            {'-'}
                            {Math.min(
                              currentPage * PAGE_SIZE,
                              totalRecords,
                            )}
                          </span>{' '}
                          of{' '}
                          <span className="font-bold text-slate-700">
                            {totalRecords}
                          </span>
                        </p>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              goToPage(currentPage - 1)
                            }
                            disabled={currentPage === 1}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Previous page"
                          >
                            <ChevronLeft size={16} />
                          </button>

                          {Array.from(
                            { length: totalPages },
                            (_, i) => i + 1,
                          ).map((pageNum) => (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => goToPage(pageNum)}
                              className={[
                                'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition',
                                pageNum === currentPage
                                  ? 'bg-[#002B73] text-white'
                                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50',
                              ].join(' ')}
                              aria-label={`Go to page ${pageNum}`}
                              aria-current={
                                pageNum === currentPage
                                  ? 'page'
                                  : undefined
                              }
                            >
                              {pageNum}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() =>
                              goToPage(currentPage + 1)
                            }
                            disabled={currentPage === totalPages}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Next page"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-[#FAFAFA] px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-6 text-xs font-bold text-white shadow-sm hover:bg-[#1D4ED8]"
            >
              <Pencil size={13} /> Edit Product
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProductInfoProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}

function ProductInfo({ icon: Icon, label, value, tone = 'text-[#0F172A]' }: ProductInfoProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} />
      </span>
      <p className="mt-2.5 text-[11px] font-semibold text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-bold ${tone}`}>{value}</p>
    </div>
  );
}

interface HistoryValueProps {
  label: string;
  value: string;
}

function HistoryValue({
  label,
  value,
}: HistoryValueProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-0.5 truncate text-xs font-semibold text-slate-700">
        {value}
      </p>
    </div>
  );
}
