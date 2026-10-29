'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Search,
  Plus,
  Minus,
  Check,
  Trash2,
  UserPlus,
  Users,
  ShoppingBag,
  Package,
} from 'lucide-react';
import type { Order, OrderItem } from '@/types/order';
import { useToastStore } from '@/store/toastStore';
import { useProducts } from '@/hooks/useProducts';
import { mapApiOrder } from '@/lib/orders';

/** Pre-filled customer, used when a lead is converted into a client. */
export interface DirectOrderPrefill {
  name: string;
  phone: string;
  email: string;
  address: string;
  clientId?: string;
  /** Product names (as stored on the lead) to add to the order. */
  products?: string[];
}

interface DirectOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (newOrder: Order) => void;
  prefill?: DirectOrderPrefill | null;
}

type PaymentMethod = 'Cash' | 'Card Payment' | 'Bank Transfer';
const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card Payment', 'Bank Transfer'];

interface DirectCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface CatalogProduct {
  productId: string;
  sku: string;
  name: string;
  price: number;
  image?: string;
  subtitle?: string;
}

const API_BASE = '/api/v1';

const FALLBACK_PRODUCTS: CatalogProduct[] = [
  { productId: 'P-101', sku: 'MG-01', name: 'Square Magnet - Pack of 6', price: 2700, subtitle: 'Square magnet' },
  { productId: 'P-102', sku: 'MG-02', name: 'Rectangle Fridge Magnet - Pack of 4', price: 2000, subtitle: 'Rectangle magnet' },
  { productId: 'P-103', sku: 'MG-03', name: 'White Premium Wooden Frame (12×8)', price: 4200, subtitle: 'Wooden Frames' },
];

const lkr = (n: number) => `LKR ${n.toLocaleString()}`;

const labelCls = 'text-xs font-bold uppercase tracking-wide text-[#64748B]';
const inputCls =
  'mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15';

export default function DirectOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
  prefill,
}: DirectOrderModalProps) {
  const { addToast } = useToastStore();
  const { products } = useProducts();

  // Customer
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customers, setCustomers] = useState<DirectCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saveToDirectory, setSaveToDirectory] = useState(true);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  // Products
  const [productQuery, setProductQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load existing customers for the search dropdown
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/customers?page=1&limit=10000`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return;
        const json = await res.json();
        const list: DirectCustomer[] = (json.data || []).map(
          (c: Record<string, string | undefined>) => ({
            id: String(c.customerId || c.id || c._id || '').replace(/^#+/, ''),
            name: c.customerName || c.name || 'Website Customer',
            phone: c.phoneNumber || c.phone || '',
            email: c.emailAddress || c.email || '',
            address: c.customerAddress || c.address || '',
          })
        );
        if (!cancelled) setCustomers(list);
      } catch {
        /* offline / no backend – search just shows "create new" */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Close the customer dropdown on outside click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setCustomerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Lead conversion: pre-fill the customer (and products) every time the modal opens for a lead.
  const prefillProductsDone = useRef(false);
  useEffect(() => {
    if (!isOpen || !prefill) return;
    setCustomerQuery(prefill.name);
    setSelectedCustomerId(null);
    setPhone(prefill.phone);
    setEmail(prefill.email);
    setSelectedItems([]);
    setProductQuery('');
    setPaymentNote('');
    setSaveToDirectory(true);
    prefillProductsDone.current = false;
  }, [isOpen, prefill]);

  const catalog: CatalogProduct[] = useMemo(() => {
    if (!products.length) return FALLBACK_PRODUCTS;
    return products.map((p) => ({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      price: p.price,
      image: p.primaryImageUrl,
      subtitle: p.series || undefined,
    }));
  }, [products]);

  // Add the lead's products once the catalog has loaded (matched by name, quantity 1).
  useEffect(() => {
    if (!isOpen || !prefill?.products?.length || prefillProductsDone.current) return;
    if (!products.length) return; // wait for the real catalog
    const wanted = prefill.products.map((n) => n.trim().toLowerCase()).filter(Boolean);
    const found = catalog.filter((p) => wanted.includes(p.name.trim().toLowerCase()));
    prefillProductsDone.current = true;
    if (!found.length) return;
    setSelectedItems(
      found.map((p) => ({
        productId: p.productId,
        sku: p.sku,
        name: p.name,
        price: p.price,
        quantity: 1,
        image: p.image,
      })),
    );
  }, [isOpen, prefill, products.length, catalog]);

  const matchedCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
          c.id.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [customers, customerQuery]);

  const matchedProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 6);
  }, [catalog, productQuery]);

  if (!isOpen) return null;

  const subtotal = selectedItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const itemCount = selectedItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalAmount = subtotal;

  const qtyOf = (productId: string) =>
    selectedItems.find((it) => it.productId === productId)?.quantity ?? 0;

  const setQty = (prod: CatalogProduct, qty: number) => {
    setSelectedItems((prev) => {
      if (qty <= 0) return prev.filter((it) => it.productId !== prod.productId);
      const exists = prev.some((it) => it.productId === prod.productId);
      if (exists) {
        return prev.map((it) => (it.productId === prod.productId ? { ...it, quantity: qty } : it));
      }
      return [
        ...prev,
        {
          productId: prod.productId,
          sku: prod.sku,
          name: prod.name,
          price: prod.price,
          quantity: qty,
          image: prod.image,
        },
      ];
    });
  };

  const selectCustomer = (c: DirectCustomer) => {
    setSelectedCustomerId(c.id);
    setCustomerQuery(c.name);
    setPhone(c.phone);
    setEmail(c.email);
    setCustomerOpen(false);
  };

  const startNewCustomer = () => {
    setSelectedCustomerId(null);
    setCustomerOpen(false);
  };

  const handleClose = () => {
    onClose();
  };

  const handleCreateOrder = async () => {
    if (submitting) return;
    if (!customerQuery.trim()) {
      addToast('Please enter the customer name.', 'error');
      return;
    }
    if (!phone.trim()) {
      addToast('Please enter the customer phone number.', 'error');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      addToast('Please enter a valid customer email address.', 'error');
      return;
    }
    if (selectedItems.length === 0) {
      addToast('Please add at least one product.', 'error');
      return;
    }

    const name = customerQuery.trim();
    const orderNo = `MG-${Date.now().toString().slice(-6)}`;
    setSubmitting(true);

    try {
      // Save a brand-new customer to the directory first (staff-created = Manual). Ignore "already exists".
      if (saveToDirectory && !selectedCustomerId) {
        await fetch(`${API_BASE}/customers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: name,
            phoneNumber: phone.trim(),
            emailAddress: email.trim(),
          }),
        }).catch(() => undefined);
      }

      // Save the order in the database so it is still there after a refresh.
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `#${orderNo}`,
          customerName: name,
          customerId: prefill?.clientId || selectedCustomerId || `C-${Math.floor(10000 + Math.random() * 90000)}`,
          email: email.trim(),
          phone: phone.trim(),
          qty: itemCount,
          totalValue: totalAmount,
          deliveryFee: 0,
          shippingAddress: prefill?.address?.trim() || '',
          adminNote: paymentNote.trim(),
          paymentMethod,
          paymentStatus: 'paid',
          orderSource: 'direct',
          items: selectedItems.map((it) => ({
            productId: it.productId,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
          })),
        }),
      });

      if (!res.ok) {
        let message = 'Could not create the order.';
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

      const saved = (await res.json()) as Parameters<typeof mapApiOrder>[0];
      const newOrder: Order = {
        ...mapApiOrder(saved),
        paymentStatus: 'paid',
        items: selectedItems,
        subtotal,
      };

      onOrderCreated(newOrder);
      addToast(`Direct Order ${newOrder.orderId} created successfully.`, 'success');
      handleClose();
    } catch {
      addToast('Could not reach the server. The order was not saved.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const showCustomerDropdown = customerOpen && customerQuery.trim().length > 0;

  return (
    <div className="direct-order-modal fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-xs sm:p-4" onClick={() => { if (!submitting) handleClose(); }}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xs font-bold text-[#0F172A]">Direct Order</h2>
            <span className="rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs font-semibold text-[#2563EB]">
              #MG-ORDER-{new Date().getFullYear()}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              {/* Customer details */}
              <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  <Users size={13} /> Customer Details
                  {prefill?.clientId && (
                    <span className="ml-auto rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold normal-case tracking-normal text-emerald-700">
                      Client ID: {prefill.clientId}
                    </span>
                  )}
                </h3>

                <label className={labelCls}>
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <div ref={customerBoxRef} className="relative">
                  <div className="relative mt-1">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                    />
                    <input
                      type="text"
                      value={customerQuery}
                      placeholder="Search or enter customer name"
                      onChange={(e) => {
                        setCustomerQuery(e.target.value);
                        setSelectedCustomerId(null);
                        setCustomerOpen(true);
                      }}
                      onFocus={() => setCustomerOpen(true)}
                      className="h-9 w-full rounded-lg border border-[#2563EB] bg-white pl-9 pr-8 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                    />
                    {customerQuery && (
                      <button
                        type="button"
                        aria-label="Clear"
                        onClick={() => {
                          setCustomerQuery('');
                          setSelectedCustomerId(null);
                          setPhone('');
                          setEmail('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {showCustomerDropdown && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl">
                      {matchedCustomers.length > 0 && (
                        <>
                          <p className="px-3 pt-2 text-xs font-medium text-[#94A3B8]">
                            {matchedCustomers.length} existing customer
                            {matchedCustomers.length > 1 ? 's' : ''} found
                          </p>
                          <ul className="divide-y divide-[#F1F5F9]">
                            {matchedCustomers.map((c) => (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-[#0F172A]">
                                    {c.name}{' '}
                                    <span className="font-normal text-[#94A3B8]">#{c.id}</span>
                                  </p>
                                  <p className="truncate text-xs text-[#64748B]">
                                    {c.phone || 'No phone'}
                                    {c.address ? ` · ${c.address}` : ''}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => selectCustomer(c)}
                                  className="shrink-0 rounded-md border border-[#CBD5E1] px-3 py-1 text-xs font-semibold text-[#0F172A] hover:border-[#2563EB] hover:text-[#2563EB]"
                                >
                                  Select
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      <div className="flex items-center justify-between gap-2 border-t border-[#E2E8F0] bg-[#EFF6FF] px-3 py-2">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[#2563EB]">
                          <UserPlus size={13} className="shrink-0" />
                          <span className="truncate">Create as new customer</span>
                        </span>
                        <button
                          type="button"
                          onClick={startNewCustomer}
                          className="shrink-0 rounded-md border border-[#BFDBFE] bg-white px-3 py-1 text-xs font-semibold text-[#2563EB] hover:bg-blue-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={phone}
                      placeholder="+94 77 123 4567"
                      onChange={(e) => setPhone(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      value={email}
                      placeholder="customer@example.com"
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-[#0F172A]">
                  <span
                    className={`flex size-4 items-center justify-center rounded border ${
                      saveToDirectory
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : 'border-[#CBD5E1] bg-white'
                    }`}
                  >
                    {saveToDirectory && <Check size={11} strokeWidth={3} />}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={saveToDirectory}
                    onChange={(e) => setSaveToDirectory(e.target.checked)}
                  />
                  Save customer to directory
                </label>
              </section>

              {/* Payment method */}
              <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Payment Method
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const active = paymentMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`h-9 whitespace-nowrap rounded-lg border px-1 text-xs font-semibold transition ${
                          active
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-2 ring-[#2563EB]/15'
                            : 'border-[#CBD5E1] bg-white text-[#475569] hover:border-[#94A3B8]'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>

                <label className={`${labelCls} mt-3 block`}>
                  Payment Reference / Note{' '}
                  <span className="font-medium normal-case text-[#94A3B8]">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. I deposited (Receipt #4693) for this order"
                  className="mt-1 w-full resize-none rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                />
              </section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              {/* Add products */}
              <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  <ShoppingBag size={13} /> Add Products
                </h3>

                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
                  />
                  <input
                    type="text"
                    value={productQuery}
                    placeholder="Search products by name or SKU"
                    onChange={(e) => setProductQuery(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#2563EB] bg-white pl-9 pr-8 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                  {productQuery && (
                    <button
                      type="button"
                      aria-label="Clear"
                      onClick={() => setProductQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {productQuery.trim() && (
                <ul className="mt-2 max-h-52 divide-y divide-[#F1F5F9] overflow-y-auto rounded-lg border border-[#E2E8F0]">
                  {matchedProducts.length === 0 && (
                    <li className="p-4 text-center text-xs text-[#94A3B8]">No products found.</li>
                  )}
                  {matchedProducts.map((p) => {
                    const qty = qtyOf(p.productId);
                    return (
                      <li key={p.productId} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#0F172A]">
                            {p.name}{' '}
                            {p.sku && (
                              <span className="font-normal text-[#94A3B8]">{p.sku}</span>
                            )}
                          </p>
                          <p className="text-xs font-medium text-[#64748B]">{lkr(p.price)}</p>
                        </div>

                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => setQty(p, 1)}
                            className="flex shrink-0 items-center gap-1 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-blue-100"
                          >
                            <Plus size={12} /> Add
                          </button>
                        ) : (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <div className="flex items-center rounded-md border border-[#CBD5E1]">
                              <button
                                type="button"
                                onClick={() => setQty(p, qty - 1)}
                                className="px-1.5 py-1 text-[#64748B] hover:bg-slate-100"
                                aria-label="Decrease"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="min-w-5 text-center text-xs font-bold text-[#0F172A]">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => setQty(p, qty + 1)}
                                className="px-1.5 py-1 text-[#64748B] hover:bg-slate-100"
                                aria-label="Increase"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                            <span className="hidden items-center gap-0.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600 sm:flex">
                              <Check size={11} strokeWidth={3} /> Added
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                )}
              </section>

              {/* Selected items */}
              <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    <Package size={13} /> Selected Items ({selectedItems.length})
                  </h3>
                  <span className="text-xs font-medium text-[#64748B]">
                    Total:{' '}
                    <span className="font-bold text-[#2563EB]">{lkr(totalAmount)}</span>
                  </span>
                </div>

                {selectedItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#CBD5E1] p-5 text-center text-xs text-[#94A3B8]">
                    No items added yet. Search and add products above.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selectedItems.map((item) => (
                      <li
                        key={item.productId}
                        className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] p-2.5"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#FEF3C7] text-[#D97706]">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image} alt={item.name} className="size-full object-cover" />
                          ) : (
                            <Package size={16} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[#0F172A]">
                            {item.name}
                          </p>
                          <p className="text-xs text-[#64748B]">
                            Qty {item.quantity} × {lkr(item.price)}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#0F172A]">
                          {lkr(item.price * item.quantity)}
                        </span>
                        <button
                          type="button"
                          aria-label="Remove item"
                          onClick={() =>
                            setSelectedItems((prev) =>
                              prev.filter((it) => it.productId !== item.productId)
                            )
                          }
                          className="text-[#94A3B8] hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Order summary */}
              <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Order Summary
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Items ({itemCount})</span>
                    <span className="font-semibold text-[#0F172A]">{lkr(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-2">
                    <span className="font-bold text-[#0F172A]">TOTAL</span>
                    <span className="text-xs font-bold text-[#2563EB]">{lkr(totalAmount)}</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white px-6 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="h-9 rounded-lg px-4 text-xs font-semibold text-[#475569] hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={submitting}
            className="h-9 rounded-lg bg-[#2563EB] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
