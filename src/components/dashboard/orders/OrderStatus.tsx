'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  X,
  Download,
  Loader2,
  Trash2,
  Save,
  Printer,
  ChevronDown,
  Check,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useToastStore } from '@/store/toastStore';
import { apiV1Url } from '@/lib/backendUrl';
import { syncOrderStock } from '@/lib/orderStock';
import type { Order, OrderStatus as OrderStatusType, PaymentStatus } from '@/types/order';
import ShippingLabelModal from './ShippingLabelModal';
import { ConfirmModal } from '@/components/dashboard/shared/UiKit';

type OrderStatusProps = {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (order: Order) => void;
  onDeleteRequest?: (order: Order) => void;
};

const ORDER_STATUSES: { value: OrderStatusType; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'text-amber-700 bg-amber-50' },
  { value: 'processing', label: 'Processing', color: 'text-sky-700 bg-sky-50' },
  { value: 'shipped', label: 'Shipped', color: 'text-blue-700 bg-blue-50' },
  { value: 'delivered', label: 'Delivered', color: 'text-emerald-700 bg-emerald-50' },
  { value: 'canceled', label: 'Cancelled', color: 'text-rose-700 bg-rose-50' },
];

const PAYMENT_STATUSES: { value: PaymentStatus; label: string; color: string }[] = [
  { value: 'paid', label: 'Paid', color: 'text-emerald-700 bg-emerald-50' },
  { value: 'pending', label: 'Pending', color: 'text-amber-700 bg-amber-50' },
  { value: 'refunded', label: 'Refunded', color: 'text-rose-700 bg-rose-50' },
];

const formatPaymentMethod = (method?: string) => {
  switch ((method || '').toLowerCase()) {
    case 'cod':
      return 'Cash on Delivery';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'card':
      return 'Card';
    default:
      return method || '-';
  }
};

export default function OrderStatus({
  order,
  isOpen,
  onClose,
  onUpdated,
  onDeleteRequest,
}: OrderStatusProps) {
  const { addToast } = useToastStore();

  const [currentOrder, setCurrentOrder] = useState<Order | null>(order);
  const [saving, setSaving] = useState(false);
  const [downloadingItemIndex, setDownloadingItemIndex] = useState<number | null>(null);
  const [shippingLabelOpen, setShippingLabelOpen] = useState(false);
  const [deletePhotosOpen, setDeletePhotosOpen] = useState(false);
  const [deletingPhotos, setDeletingPhotos] = useState(false);

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [orderStatus, setOrderStatus] = useState<OrderStatusType>('processing');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');

  // Preview Image Modal state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setCurrentOrder(order);
      setCustomerName(order.customerName || '');
      setPhone(order.phone || '');
      setEmail(order.email || '');
      setShippingAddress(order.shippingAddress || '');
      setOrderStatus(order.status || 'processing');
      setPaymentStatus(order.paymentStatus || 'paid');
    }
  }, [order]);

  if (!isOpen || !currentOrder) return null;

  const items = currentOrder.items || [];
  const calculatedItemsTotal = items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );
  const subtotal = currentOrder.subtotal ?? (calculatedItemsTotal || currentOrder.totalValue || 0);
  const deliveryFee = currentOrder.deliveryFee ?? 350;
  const discount = currentOrder.discount ?? 0;
  const totalAmount = currentOrder.totalValue ?? Math.max(0, subtotal + deliveryFee - discount);

  // Download all photos for a specific item
  const handleDownloadAll = async (uploadedImages: string[], itemName: string, index: number) => {
    if (!uploadedImages || uploadedImages.length === 0) return;
    setDownloadingItemIndex(index);

    try {
      addToast(`Starting download of ${uploadedImages.length} images for ${itemName}...`, 'info');

      for (let i = 0; i < uploadedImages.length; i++) {
        const url = uploadedImages[i];
        try {
          const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
          const fileName = `${currentOrder.orderId}_${itemName.replace(/\s+/g, '_')}_Photo_${i + 1}.${ext}`;
          // Downloaded through the backend: the browser cannot fetch the Cloudflare URL directly (CORS).
          const res = await fetch(apiV1Url(`/orders/photos/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(fileName)}`));
          if (!res.ok) throw new Error('download failed');
          const blob = await res.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
          // small delay between downloads to prevent browser blocking
          await new Promise((r) => setTimeout(r, 300));
        } catch {
          window.open(url, '_blank');
        }
      }

      addToast(`Successfully downloaded photos for ${itemName}`, 'success');
    } catch {
      addToast('Could not download images. Please check permissions.', 'error');
    } finally {
      setDownloadingItemIndex(null);
    }
  };

  const RETENTION_DAYS = 7;
  const hasPhotos = items.some((i) => i.uploadedImages?.length);
  const photosExpireOn = currentOrder.deliveredAt
    ? new Date(new Date(currentOrder.deliveredAt).getTime() + RETENTION_DAYS * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  // Manual clean-up: removes the customer's photos from Cloudflare R2 (delivered orders only).
  const handleDeletePhotos = async () => {
    setDeletePhotosOpen(false);
    setDeletingPhotos(true);
    try {
      const res = await fetch(apiV1Url(`/orders/${currentOrder._id || currentOrder.id}/customer-images`), { method: 'DELETE' });
      if (!res.ok) {
        let message = 'Could not delete the customer photos.';
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (j?.message) message = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        } catch {
          if (res.status >= 500) message = `Server is not reachable (HTTP ${res.status}). Check that the backend is running.`;
        }
        addToast(message, 'error');
        return;
      }
      const updated: Order = {
        ...currentOrder,
        imagesDeletedAt: new Date().toISOString(),
        items: (currentOrder.items ?? []).map((i) => ({ ...i, uploadedImages: [] })),
      };
      setCurrentOrder(updated);
      onUpdated?.(updated);
      addToast('Customer photos deleted from storage.', 'success');
    } catch {
      addToast('Could not delete the customer photos.', 'error');
    } finally {
      setDeletingPhotos(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const updated: Order = {
      ...currentOrder,
      deliveredAt:
        orderStatus === 'delivered' && currentOrder.status !== 'delivered'
          ? new Date().toISOString()
          : currentOrder.deliveredAt,
      customerName,
      phone,
      email,
      shippingAddress,
      status: orderStatus,
      paymentStatus,
    };

    try {
      // Save to the database. Empty optional fields are left out so they are not validated/overwritten.
      const res = await fetch(apiV1Url(`/orders/${currentOrder._id || currentOrder.id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: orderStatus.toUpperCase(),
          paymentStatus,
          ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(shippingAddress.trim() ? { shippingAddress: shippingAddress.trim() } : {}),
        }),
      });
      if (!res.ok) {
        let message = 'Could not save order updates.';
        try {
          const j = (await res.json()) as { message?: string | string[] };
          if (j?.message) message = Array.isArray(j.message) ? j.message.join(', ') : j.message;
        } catch {
          // Not a JSON error - usually the backend is not running (proxy answers HTTP 500).
          if (res.status >= 500) message = `Server is not reachable (HTTP ${res.status}). Check that the backend is running.`;
        }
        addToast(message, 'error');
        return;
      }

      const stockMsg = await syncOrderStock(currentOrder, orderStatus).catch(() => null);

      setCurrentOrder(updated);
      onUpdated?.(updated);
      addToast(`Order ${currentOrder.orderId} changes saved successfully.${stockMsg ? ' ' + stockMsg : ''}`, 'success');
    } catch {
      addToast('Could not save order updates.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-[#F8FAFC] shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[12px] font-bold tracking-tight text-[#0F172A]" style={{ fontSize: '12px' }}>
                Order Details - <span className="font-mono text-[#2563EB]" style={{ fontSize: '12px' }}>{currentOrder.orderId}</span>
              </h2>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[12px] font-bold text-purple-700" style={{ fontSize: '12px' }}>
                <Sparkles size={13} className="text-purple-600" />
                All Photos Received
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B] transition hover:bg-slate-100 hover:text-[#0F172A]"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Top 2 Columns: Customer Info & Order Details */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* LEFT COLUMN: Customer Information */}
              <div className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
                <div>
                  <h3 className="mb-4 text-[12px] font-bold uppercase tracking-wider text-[#64748B]" style={{ fontSize: '12px' }}>
                    Customer Information
                  </h3>

                  <div className="space-y-3.5">
                    {/* Delivery Name */}
                    <div>
                      <label className="text-[12px] font-bold uppercase text-[#64748B]" style={{ fontSize: '12px' }}>
                        Delivery Name
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-[#E2E8F0] bg-slate-50/50 px-3 text-[12px] font-semibold text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                        style={{ fontSize: '12px' }}
                      />
                    </div>

                    {/* Phone Number & Email */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[12px] font-bold uppercase text-[#64748B]" style={{ fontSize: '12px' }}>
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="mt-1 h-9 w-full rounded-xl border border-[#E2E8F0] bg-slate-50/50 px-3 text-[12px] font-semibold text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                          style={{ fontSize: '12px' }}
                        />
                      </div>

                      <div>
                        <label className="text-[12px] font-bold uppercase text-[#64748B]" style={{ fontSize: '12px' }}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-1 h-9 w-full rounded-xl border border-[#E2E8F0] bg-slate-50/50 px-3 text-[12px] font-semibold text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                          style={{ fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <div>
                      <label className="text-[12px] font-bold uppercase text-[#64748B]" style={{ fontSize: '12px' }}>
                        Delivery Address
                      </label>
                      <textarea
                        rows={2}
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-slate-50/50 p-2.5 text-[12px] font-medium text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Download Shipping Label Button */}
                <div className="mt-5 border-t border-[#F1F5F9] pt-4">
                  <button
                    type="button"
                    onClick={() => setShippingLabelOpen(true)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[12px] font-bold text-[#1E293B] shadow-2xs transition hover:bg-slate-50 active:scale-[0.99]"
                    style={{ fontSize: '12px' }}
                  >
                    <Download size={15} className="text-[#2563EB]" />
                    <span style={{ fontSize: '12px' }}>Download Shipping Label</span>
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Order & Payment Details */}
              <div className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
                <div>
                  <h3 className="mb-4 text-[12px] font-bold uppercase tracking-wider text-[#64748B]" style={{ fontSize: '12px' }}>
                    Order & Payment Details
                  </h3>

                  {/* Items List */}
                  <div className="divide-y divide-[#F1F5F9] overflow-hidden rounded-xl border border-[#E2E8F0] bg-slate-50/30">
                    {items.length === 0 ? (
                      <p className="p-4 text-center text-[12px] text-[#94A3B8]" style={{ fontSize: '12px' }}>
                        No items attached to this order.
                      </p>
                    ) : (
                      items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                              <Image
                                src={item.primaryImage || item.image || '/product-1.png'}
                                alt={item.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-[12px] font-bold text-[#0F172A]" style={{ fontSize: '12px' }}>{item.name}</p>
                              <p className="text-[12px] text-[#64748B]" style={{ fontSize: '12px' }}>
                                SKU: {item.sku || 'MG-01'} · Qty: {item.quantity}
                              </p>
                            </div>
                          </div>

                          <span className="text-[12px] font-bold text-[#0F172A]" style={{ fontSize: '12px' }}>
                            LKR {(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="mt-4 space-y-1.5 border-t border-[#F1F5F9] pt-3 text-[12px]" style={{ fontSize: '12px' }}>
                    <div className="flex justify-between text-[#64748B]" style={{ fontSize: '12px' }}>
                      <span style={{ fontSize: '12px' }}>Subtotal</span>
                      <span className="font-semibold text-[#0F172A]" style={{ fontSize: '12px' }}>
                        LKR {subtotal.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between text-[#64748B]" style={{ fontSize: '12px' }}>
                      <span style={{ fontSize: '12px' }}>Delivery Charge</span>
                      <span className="font-semibold text-[#0F172A]" style={{ fontSize: '12px' }}>
                        LKR {deliveryFee.toLocaleString()}
                      </span>
                    </div>

                    {discount > 0 && (
                      <div className="flex justify-between text-rose-600" style={{ fontSize: '12px' }}>
                        <span style={{ fontSize: '12px' }}>Discount</span>
                        <span style={{ fontSize: '12px' }}>- LKR {discount.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between border-t border-[#E2E8F0] pt-2 text-[12px] font-bold text-[#0F172A]" style={{ fontSize: '12px' }}>
                      <span style={{ fontSize: '12px' }}>Total</span>
                      <span className="text-[#2563EB]" style={{ fontSize: '12px' }}>
                        LKR {totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method & Bank Transfer Receipt */}
                  <div className="mt-4 space-y-2 border-t border-[#F1F5F9] pt-3 text-[12px]" style={{ fontSize: '12px' }}>
                    <div className="flex justify-between text-[#64748B]" style={{ fontSize: '12px' }}>
                      <span style={{ fontSize: '12px' }}>Payment Method</span>
                      <span className="font-semibold text-[#0F172A]" style={{ fontSize: '12px' }}>
                        {formatPaymentMethod(currentOrder.paymentMethod)}
                      </span>
                    </div>

                    {currentOrder.paymentSlipUrl && (
                      <div>
                        <p className="mb-1.5 text-[#64748B]" style={{ fontSize: '12px' }}>Bank Transfer Receipt</p>
                        <button
                          type="button"
                          onClick={() => setPreviewImageUrl(currentOrder.paymentSlipUrl!)}
                          className="group relative block h-28 w-full overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xs transition hover:ring-2 hover:ring-[#2563EB]"
                          title="Click to view the full receipt"
                        >
                          <Image
                            src={currentOrder.paymentSlipUrl}
                            alt="Bank transfer receipt"
                            fill
                            sizes="320px"
                            className="object-contain"
                          />
                        </button>
                        <a
                          href={currentOrder.paymentSlipUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 font-bold text-[#2563EB] hover:underline"
                          style={{ fontSize: '12px' }}
                        >
                          <ExternalLink size={12} />
                          Open receipt in new tab
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Dropdowns */}
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#F1F5F9] pt-4">
                  {/* Order Status */}
                  <div>
                    <label className="text-[12px] font-bold uppercase text-[#64748B]" style={{ fontSize: '12px' }}>
                      Order Status
                    </label>
                    <div className="relative mt-1">
                      <select
                        value={orderStatus}
                        onChange={(e) => setOrderStatus(e.target.value as OrderStatusType)}
                        className="h-10 w-full appearance-none rounded-xl border border-[#CBD5E1] bg-white px-3 pr-8 text-[12px] font-bold text-[#0F172A] capitalize focus:border-[#2563EB] focus:outline-none"
                        style={{ fontSize: '12px' }}
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st.value} value={st.value} style={{ fontSize: '12px' }}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                      />
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div>
                    <label className="text-[12px] font-bold uppercase text-[#64748B]" style={{ fontSize: '12px' }}>
                      Payment Status
                    </label>
                    <div className="relative mt-1">
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                        className="h-10 w-full appearance-none rounded-xl border border-[#CBD5E1] bg-white px-3 pr-8 text-[12px] font-bold text-[#0F172A] capitalize focus:border-[#2563EB] focus:outline-none"
                        style={{ fontSize: '12px' }}
                      >
                        {PAYMENT_STATUSES.map((pst) => (
                          <option key={pst.value} value={pst.value} style={{ fontSize: '12px' }}>
                            {pst.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION: Customer Uploaded Photos List */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[12px] font-bold text-[#0F172A]" style={{ fontSize: '12px' }}>
                    Customer Uploaded Photos List
                  </h3>
                  <p className="text-[12px] text-[#64748B]" style={{ fontSize: '12px' }}>
                    Photos uploaded by the customer for customized magnets & frames.
                  </p>
                  {currentOrder.status === 'delivered' && hasPhotos && (
                    <p className="mt-0.5 text-[12px] font-semibold text-amber-600" style={{ fontSize: '12px' }}>
                      {photosExpireOn
                        ? `These photos are deleted automatically on ${photosExpireOn} (${RETENTION_DAYS} days after delivery).`
                        : `These photos are deleted automatically ${RETENTION_DAYS} days after delivery.`}
                    </p>
                  )}
                </div>
                {currentOrder.status === 'delivered' && hasPhotos && (
                  <button
                    type="button"
                    disabled={deletingPhotos}
                    onClick={() => setDeletePhotosOpen(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-[12px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    style={{ fontSize: '12px' }}
                  >
                    {deletingPhotos ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    <span style={{ fontSize: '12px' }}>{deletingPhotos ? 'Deleting...' : 'Delete photos now'}</span>
                  </button>
                )}
              </div>

              {items.length === 0 || !items.some((i) => i.uploadedImages?.length) ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] p-8 text-center">
                  <p className="text-[12px] text-[#94A3B8]" style={{ fontSize: '12px' }}>
                    {currentOrder.imagesDeletedAt
                      ? `Customer photos were deleted from storage on ${new Date(currentOrder.imagesDeletedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.`
                      : 'No custom photos were uploaded for this order.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {items.map((item, itemIdx) => {
                    const photos = item.uploadedImages || [];
                    if (photos.length === 0) return null;

                    const isDownloadingThis = downloadingItemIndex === itemIdx;

                    return (
                      <div
                        key={itemIdx}
                        className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/50 p-4"
                      >
                        {/* Product sub-header + Download All button */}
                        <div className="mb-3.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-[#2563EB]" />
                            <h4 className="text-[12px] font-bold uppercase tracking-wide text-[#0F172A]" style={{ fontSize: '12px' }}>
                              {item.name}
                            </h4>
                            <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[12px] font-bold text-[#475569]" style={{ fontSize: '12px' }}>
                              {photos.length} photos
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isDownloadingThis}
                            onClick={() => handleDownloadAll(photos, item.name, itemIdx)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 text-[12px] font-bold text-white shadow-2xs transition hover:bg-[#1D4ED8] disabled:opacity-60"
                            style={{ fontSize: '12px' }}
                          >
                            {isDownloadingThis ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Download size={13} />
                            )}
                            <span style={{ fontSize: '12px' }}>{isDownloadingThis ? 'Downloading...' : 'Download All'}</span>
                          </button>
                        </div>

                        {/* Photos Grid */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                          {photos.map((photoUrl, photoIdx) => (
                            <div
                              key={photoIdx}
                              onClick={() => setPreviewImageUrl(photoUrl)}
                              className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xs transition hover:shadow-md hover:ring-2 hover:ring-[#2563EB]"
                            >
                              <div className="relative aspect-square w-full">
                                <Image
                                  src={photoUrl}
                                  alt={`Customer photo ${photoIdx + 1}`}
                                  fill
                                  sizes="(max-width: 768px) 33vw, 16vw"
                                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                              </div>
                              <div className="bg-white p-1.5 text-center border-t border-[#F1F5F9]">
                                <span className="text-[12px] font-bold text-[#475569]" style={{ fontSize: '12px' }}>
                                  Photo {photoIdx + 1}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-[#E2E8F0] bg-white px-6 py-4">
            <button
              type="button"
              onClick={() => {
                onDeleteRequest?.(currentOrder);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2 text-[12px] font-bold text-rose-600 transition hover:bg-rose-50"
              style={{ fontSize: '12px' }}
            >
              <Trash2 size={15} />
              <span style={{ fontSize: '12px' }}>Delete Order</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-[12px] font-bold text-[#64748B] hover:bg-slate-100"
                style={{ fontSize: '12px' }}
              >
                Close
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-5 py-2 text-[12px] font-bold text-white shadow-xs transition hover:bg-[#1D4ED8] disabled:opacity-60"
                style={{ fontSize: '12px' }}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span style={{ fontSize: '12px' }}>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deletePhotosOpen}
        title="Delete customer photos?"
        message={<>The photos the customer uploaded for order <b>{currentOrder.orderId}</b> will be permanently removed from storage. This cannot be undone.</>}
        confirmLabel="Delete photos"
        onCancel={() => setDeletePhotosOpen(false)}
        onConfirm={handleDeletePhotos}
      />

      {/* Shipping Label Printable Preview Modal */}
      <ShippingLabelModal
        order={currentOrder}
        isOpen={shippingLabelOpen}
        onClose={() => setShippingLabelOpen(false)}
      />

      {/* Single Photo High-Res Preview Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-h-[85vh] max-w-[85vw] overflow-hidden rounded-2xl bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X size={18} />
            </button>

            <div className="relative h-[70vh] w-[70vw] max-w-[700px]">
              <Image
                src={previewImageUrl}
                alt="Enlarged customer photo"
                fill
                className="object-contain"
              />
            </div>

            <div className="flex items-center justify-between p-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-600">High-Resolution Customer Upload</span>
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline"
              >
                <ExternalLink size={13} />
                Open original
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
