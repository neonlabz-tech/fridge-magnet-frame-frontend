'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ArrowRightLeft,
  PencilLine,
  Eye,
  Check,
  Phone,
  Calendar,
  Clock,
  Copy,
  Package,
  Zap,
  Truck,
  Plus,
  X,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import type { Delivery, DeliveryMethod, DeliveryStatus, DispatchOrder } from '@/types/delivery';
import { TIME_SLOTS } from '@/data/deliveries';
import { fetchDispatchOrders } from '@/lib/deliveryStore';
import { ModalShell, inputCls, textareaCls, labelCls, btnGhost, btnPrimary, lkr } from '@/components/dashboard/shared/UiKit';

export type DeliveryModalMode = 'create' | 'edit' | 'view';

interface DeliveryModalProps {
  mode: DeliveryModalMode | null;
  delivery: Delivery | null;
  nextSequence: number;
  onClose: () => void;
  onSave: (delivery: Delivery, isNew: boolean) => void | Promise<void>;
  onEditRequest: (delivery: Delivery) => void;
}

const STATUS_OPTIONS: { value: DeliveryStatus; label: string; dot: string }[] = [
  { value: 'pending', label: 'Pending', dot: 'bg-amber-500' },
  { value: 'in-transit', label: 'In Transit', dot: 'bg-sky-500' },
  { value: 'delivered', label: 'Delivered', dot: 'bg-emerald-500' },
  { value: 'returned', label: 'Returned', dot: 'bg-slate-500' },
];

const BADGE_STYLE: Record<DispatchOrder['badge'], string> = {
  'Ready to Dispatch': 'bg-emerald-50 text-emerald-600',
  'Pending Pack': 'bg-amber-50 text-amber-600',
  Standard: 'bg-slate-100 text-slate-500',
};

const emptyForm = (seq: number): Delivery => ({
  id: `#MGD-${seq}`,
  orderId: '',
  orderTotal: 0,
  method: 'Standard',
  tracking: `TRK-${seq}`,
  driver: '',
  place: '',
  recipient: '',
  phone: '',
  address: '',
  date: new Date().toISOString().slice(0, 10),
  timeSlot: TIME_SLOTS[2],
  status: 'pending',
  vehicleType: '',
  licenseNo: '',
  plateNo: '',
  emergencyContact: '',
  zones: [],
});

function SectionTitle({ n, children }: { n: number; children: string }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 border-b border-[#EEF2F7] pb-2 text-xs font-bold uppercase tracking-wide text-[#0F172A]">
      <span className="size-1.5 rounded-full bg-[#2563EB]" />
      {n}. {children}
    </h3>
  );
}

export default function DeliveryModal({
  mode,
  delivery,
  nextSequence,
  onClose,
  onSave,
  onEditRequest,
}: DeliveryModalProps) {
  const [form, setForm] = useState<Delivery>(emptyForm(nextSequence));
  const [orderQuery, setOrderQuery] = useState('');
  const [orderOpen, setOrderOpen] = useState(false);
  const [zoneDraft, setZoneDraft] = useState('');
  const [addingZone, setAddingZone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dispatchOrders, setDispatchOrders] = useState<DispatchOrder[]>([]);

  const open = mode !== null;
  const readOnly = mode === 'view';
  const isCreate = mode === 'create';

  useEffect(() => {
    if (!open) return;
    setForm(delivery ? { ...delivery, zones: [...delivery.zones] } : emptyForm(nextSequence));
    setOrderQuery('');
    setOrderOpen(false);
    setError(null);
    setAddingZone(false);
    setZoneDraft('');
  }, [open, delivery, nextSequence]);

  useEffect(() => {
    if (mode !== 'create') return;
    let cancelled = false;
    fetchDispatchOrders().then((list) => {
      if (!cancelled) setDispatchOrders(list);
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const matches = useMemo(() => {
    const q = orderQuery.trim().toLowerCase().replace(/^#/, '');
    if (!q) return [];
    return dispatchOrders.filter(
      (o) =>
        o.orderId.toLowerCase().replace(/^#/, '').includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.phone.includes(q)
    );
  }, [orderQuery, dispatchOrders]);

  const set = <K extends keyof Delivery>(key: K, value: Delivery[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pickOrder = (o: DispatchOrder) => {
    setForm((f) => ({
      ...f,
      orderId: o.orderId,
      orderTotal: o.total,
      recipient: o.customer,
      phone: o.phone,
      address: o.address,
      place: o.place,
    }));
    setOrderQuery(o.orderId);
    setOrderOpen(false);
  };

  const submit = () => {
    if (!form.orderId) return setError('Please select an order.');
    if (!form.recipient.trim() || !form.phone.trim() || !form.address.trim())
      return setError('Recipient name, phone and address are required.');
    onSave(
      {
        ...form,
        place: form.place || form.address.split(',').slice(-2).join(',').trim(),
        status: isCreate ? 'in-transit' : form.status,
      },
      isCreate
    );
  };

  const title = isCreate ? 'Create Delivery' : mode === 'edit' ? 'Edit Delivery Details' : 'View Delivery Details';
  const subtitle = isCreate
    ? 'Quick dispatch creation with intelligent order auto-complete.'
    : mode === 'edit'
      ? 'Update dispatch assignment, recipient info, delivery schedule, and driver data.'
      : 'Comprehensive read-only inspection for order dispatch and route assignment.';
  const icon = isCreate ? <ArrowRightLeft size={18} /> : mode === 'edit' ? <PencilLine size={18} /> : <Eye size={18} />;

  const fieldCls = inputCls;
  const dis = readOnly;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      icon={icon}
      title={title}
      subtitle={subtitle}
      maxWidth="max-w-3xl"
      footer={
        readOnly ? (
          <>
            <button type="button" className={btnGhost} onClick={onClose}>
              Close
            </button>
            <button type="button" className={btnPrimary} onClick={() => delivery && onEditRequest(delivery)}>
              Edit Delivery <ArrowRight size={13} />
            </button>
          </>
        ) : (
          <>
            {error && <span className="mr-auto text-xs font-semibold text-rose-600">{error}</span>}
            <button type="button" className={btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={btnPrimary} onClick={submit}>
              {isCreate ? (
                <>
                  Create &amp; Dispatch Delivery <ArrowRight size={13} />
                </>
              ) : (
                'Save'
              )}
            </button>
          </>
        )
      }
    >
      {/* ORDER */}
      <div className="mb-4">
        <label className={labelCls}>Order{isCreate ? 's' : ''}</label>

        {isCreate ? (
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2563EB]" />
            <input
              value={orderQuery}
              onChange={(e) => {
                setOrderQuery(e.target.value);
                setOrderOpen(true);
              }}
              onFocus={() => setOrderOpen(true)}
              placeholder="Search by order ID or customer, e.g. #ORD-250121-01"
              className="h-10 w-full rounded-lg border border-[#2563EB] bg-white pl-9 pr-3 text-xs font-semibold text-[#0F172A] placeholder:font-normal placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
            />
            {orderOpen && orderQuery.trim() && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xl">
                {matches.length === 0 && (
                  <p className="p-4 text-center text-xs text-[#94A3B8]">No matching orders.</p>
                )}
                {matches.map((o) => {
                  const selected = form.orderId === o.orderId;
                  return (
                    <div
                      key={o.orderId}
                      className={`flex items-center justify-between gap-3 border-l-2 px-4 py-2.5 hover:bg-slate-50 ${
                        selected ? 'border-[#2563EB] bg-[#EFF6FF]/60' : 'border-transparent'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#0F172A]">
                          {o.orderId}
                          <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${BADGE_STYLE[o.badge]}`}>
                            {o.badge}
                          </span>
                          <span className="font-medium text-[#64748B]">{lkr(o.total)}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#64748B]">
                          {o.customer} · {o.phone} · {o.place}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => pickOrder(o)}
                        className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${
                          selected ? 'rounded-md bg-[#2563EB] px-3 py-1.5 text-white' : 'text-[#2563EB] hover:underline'
                        }`}
                      >
                        {selected ? (
                          <>
                            <Check size={12} /> Selected
                          </>
                        ) : (
                          'Select Order'
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF]/60 px-4 py-2.5">
            <p className="flex items-center gap-2 text-xs font-bold text-[#2563EB]">
              {form.orderId}
              <span className="rounded bg-white px-2 py-0.5 font-semibold text-[#0F172A]">{lkr(form.orderTotal)}</span>
            </p>
            <p className="mt-0.5 text-xs text-[#64748B]">
              {form.recipient} · {form.phone} · {form.place}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        {/* 1. CUSTOMER & DESTINATION */}
        <div>
          <SectionTitle n={1}>Customer &amp; Delivery</SectionTitle>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-[#64748B]">Recipient Name</label>
                {form.orderId && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-600">
                    <Check size={11} /> Verified Contact
                  </span>
                )}
              </div>
              <input
                className={fieldCls}
                value={form.recipient}
                disabled={dis}
                onChange={(e) => set('recipient', e.target.value)}
                placeholder="Recipient full name"
              />
            </div>
            <div>
              <label className={labelCls}>Contact Phone</label>
              <div className="relative">
                {!isCreate && (
                  <Phone size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                )}
                <input
                  className={`${fieldCls} ${!isCreate ? 'pl-8' : ''}`}
                  value={form.phone}
                  disabled={dis}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+94 77 000 0000"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Delivery Address &amp; Zone</label>
              <textarea
                rows={2}
                className={textareaCls}
                value={form.address}
                disabled={dis}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Street address, town, district"
              />
            </div>
            <div>
              <label className={labelCls}>Delivery Method</label>
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#F1F5F9] p-1">
                {(['Standard', 'Courier'] as DeliveryMethod[]).map((m) => {
                  const active = form.method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={dis && !active}
                      onClick={() => !dis && set('method', m)}
                      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition ${
                        active
                          ? 'border border-[#BFDBFE] bg-white text-[#2563EB] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A] disabled:opacity-40'
                      }`}
                    >
                      {m === 'Standard' ? <Package size={13} /> : <Zap size={13} />}
                      {m === 'Standard' ? 'Standard Delivery' : 'Express Courier'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 2. DISPATCH & DRIVER */}
        <div>
          <SectionTitle n={2}>Dispatch &amp; Driver</SectionTitle>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Assign Rider / Driver</label>
              <input
                className={fieldCls}
                value={form.driver}
                disabled={dis}
                onChange={(e) => set('driver', e.target.value)}
                placeholder="Type driver name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Delivery Date</label>
                <div className="relative">
                  {!isCreate && (
                    <Calendar size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  )}
                  <input
                    type="date"
                    className={`${fieldCls} ${!isCreate ? 'pl-8' : ''}`}
                    value={form.date}
                    disabled={dis}
                    onChange={(e) => set('date', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Time Slot</label>
                <div className="relative">
                  {!isCreate && (
                    <Clock size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  )}
                  <select
                    className={`${fieldCls} appearance-none pr-7 ${!isCreate ? 'pl-8' : ''}`}
                    value={form.timeSlot}
                    disabled={dis}
                    onChange={(e) => set('timeSlot', e.target.value)}
                  >
                    {TIME_SLOTS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                </div>
              </div>
            </div>

            <div className={isCreate ? '' : 'grid grid-cols-2 gap-3'}>
              <div>
                <label className={labelCls}>{isCreate ? 'Tracking ID' : 'Dispatch Tracking ID'}</label>
                <div className="relative">
                  <input
                    className={`${fieldCls} pr-8`}
                    value={form.tracking}
                    readOnly={readOnly}
                    onChange={(e) => set('tracking', e.target.value)}
                    placeholder="Enter tracking ID"
                  />
                  {!isCreate && !readOnly && (
                    <button
                      type="button"
                      aria-label="Copy tracking ID"
                      onClick={() => {
                        void navigator.clipboard?.writeText(form.tracking);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1200);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#2563EB]"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
              {!isCreate && (
                <div>
                  <label className={labelCls}>Status</label>
                  <div className="relative">
                    <span
                      className={`pointer-events-none absolute left-3 top-1/2 size-2 -translate-y-1/2 rounded-full ${
                        STATUS_OPTIONS.find((s) => s.value === form.status)?.dot
                      }`}
                    />
                    <select
                      className={`${fieldCls} appearance-none pl-7 pr-7`}
                      value={form.status}
                      disabled={dis}
                      onChange={(e) => set('status', e.target.value as DeliveryStatus)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DELIVERY DETAILS */}
      <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-[#0F172A]">
          <Truck size={14} className="text-[#D97706]" /> Delivery Details{' '}
          <span className="font-medium text-[#94A3B8]">(if applicable)</span>
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              ['Vehicle Type', 'vehicleType', 'e.g. Motorbike'],
              ['Driving License No.', 'licenseNo', 'B-0000000-A'],
              ['Plate Number', 'plateNo', 'WP-CAB-0000'],
              ['Emergency Contact', 'emergencyContact', '077 000 0000'],
            ] as const
          ).map(([label, key, ph]) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <input
                className={fieldCls}
                value={form[key]}
                disabled={dis}
                placeholder={ph}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-3">
          <label className={labelCls}>Coverage Area / Zone</label>
          <div className="flex flex-wrap items-center gap-2">
            {form.zones.map((z, i) => (
              <span
                key={`${z}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A]"
              >
                {z} <span className="text-[#94A3B8]">Zone {i + 1}</span>
                {!dis && (
                  <button
                    type="button"
                    aria-label={`Remove ${z}`}
                    onClick={() => set('zones', form.zones.filter((_, idx) => idx !== i))}
                    className="text-[#94A3B8] hover:text-rose-600"
                  >
                    <X size={11} />
                  </button>
                )}
              </span>
            ))}

            {!dis &&
              (addingZone ? (
                <input
                  autoFocus
                  value={zoneDraft}
                  onChange={(e) => setZoneDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && zoneDraft.trim()) {
                      set('zones', [...form.zones, zoneDraft.trim()]);
                      setZoneDraft('');
                      setAddingZone(false);
                    }
                    if (e.key === 'Escape') setAddingZone(false);
                  }}
                  onBlur={() => {
                    if (zoneDraft.trim()) set('zones', [...form.zones, zoneDraft.trim()]);
                    setZoneDraft('');
                    setAddingZone(false);
                  }}
                  placeholder="Type zone, press Enter"
                  className="h-8 w-44 rounded-lg border border-[#2563EB] bg-white px-2.5 text-xs font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingZone(true)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-100"
                >
                  <Plus size={12} /> Add Zone
                </button>
              ))}
            {dis && form.zones.length === 0 && <span className="text-xs text-[#94A3B8]">No zones assigned.</span>}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
