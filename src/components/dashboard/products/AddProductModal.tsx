'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, WheelEvent } from 'react';
import { ImagePlus, Images, Trash2, UploadCloud, X, Package } from 'lucide-react';
import type { Product, ProductFormData } from '@/types/product';
import MaterialsEditor from './MaterialsEditor';
import { readInventory, refreshInventory } from '@/lib/inventoryStore';
import { type Material, readMaterials, refreshMaterials, saveMaterials, materialCost, producibleUnits } from '@/lib/materials';
import { useToastStore } from '@/store/toastStore';
import type { InventoryItem } from '@/types/inventory';
import { ModalShell, inputCls, textareaCls, labelCls, btnGhost, btnPrimary } from '@/components/dashboard/shared/UiKit';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: ProductFormData) => boolean | void | Promise<boolean | void>;
  onDelete?: (product: Product) => void;
  editingProduct?: Product | null;
  autoProductId?: string;
}

const EMPTY: ProductFormData = {
  name: '',
  productId: '',
  category: 'Wooden Frames',
  stock: 0,
  price: 0,
  manufactureCost: 0,
  imagecount: 0,
  description: '',
  personalization: false,
  primaryImage: null,
  galleryImages: [],
};

const MAX_GALLERY = 5;
type FieldErrors = Partial<Record<'name' | 'description' | 'price' | 'primaryImage', string>>;

const fmt = (n: number) => `LKR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AddProductModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  editingProduct = null,
  autoProductId = '',
}: AddProductModalProps) {
  const [form, setForm] = useState<ProductFormData>(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToastStore();
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [existingGalleryUrls, setExistingGalleryUrls] = useState<string[]>([]);
  const [removedGalleryUrls, setRemovedGalleryUrls] = useState<string[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const changeMaterials = (next: Material[]) => {
    setMaterials(next);
    // With materials, the manufacture cost follows the inventory unit values automatically.
    if (next.length) setForm((p) => ({ ...p, manufactureCost: materialCost(next, inventory) }));
  };

  useEffect(() => {
    if (!isOpen) return;
    setInventory(readInventory());
    refreshInventory().then(setInventory);
    if (editingProduct) {
      setForm({
        name: editingProduct.name ?? '',
        productId: editingProduct.sku ?? editingProduct.id ?? '',
        category: editingProduct.series ?? 'Wooden Frames',
        stock: Number(editingProduct.stockCount ?? 0),
        price: Number(editingProduct.price ?? 0),
        manufactureCost: Number(editingProduct.manufactureCost ?? 0),
        imagecount: Number(editingProduct.imagecount ?? 0),
        description: editingProduct.description ?? '',
        personalization: false,
        primaryImage: null,
        galleryImages: [],
      });
      setExistingGalleryUrls(editingProduct.galleryImageUrls ?? []);
      const matKey = editingProduct.sku ?? editingProduct.id ?? '';
      setMaterials(readMaterials(matKey));
      refreshMaterials().then(() => setMaterials(readMaterials(matKey)));
    } else {
      setMaterials([]);
      setForm({ ...EMPTY, productId: autoProductId });
      setExistingGalleryUrls([]);
    }
    setRemovedGalleryUrls([]);
    setGalleryError(null);
    setFieldErrors({});
  }, [isOpen, editingProduct, autoProductId]);

  const primaryUrl = useMemo(
    () => (form.primaryImage ? URL.createObjectURL(form.primaryImage) : editingProduct?.primaryImageUrl || null),
    [form.primaryImage, editingProduct?.primaryImageUrl]
  );
  useEffect(
    () => () => {
      if (form.primaryImage && primaryUrl) URL.revokeObjectURL(primaryUrl);
    },
    [form.primaryImage, primaryUrl]
  );

  const newGalleryUrls = useMemo(() => form.galleryImages.map((f) => URL.createObjectURL(f)), [form.galleryImages]);
  useEffect(() => () => newGalleryUrls.forEach((u) => URL.revokeObjectURL(u)), [newGalleryUrls]);

  const visibleExisting = useMemo(
    () => existingGalleryUrls.filter((u) => !removedGalleryUrls.includes(u)),
    [existingGalleryUrls, removedGalleryUrls]
  );
  const galleryCount = visibleExisting.length + form.galleryImages.length;

  // With materials set, stock = how many units the inventory can produce right now.
  const hasMaterials = materials.some((m) => m.qty > 0);
  const autoStock = hasMaterials ? producibleUnits(materials, inventory) : null;
  const stockValue = autoStock ?? (Number(form.stock) || 0);
  // Manufacture cost follows the material cost whenever materials are set (also when editing).
  const autoCost = hasMaterials ? materialCost(materials, inventory) : null;
  const costValue = autoCost ?? (Number(form.manufactureCost) || 0);

  const profit = (Number(form.price) || 0) - costValue;
  const margin = form.price ? (profit / Number(form.price)) * 100 : 0;

  const setNum = (key: 'stock' | 'price' | 'manufactureCost' | 'imagecount') => (e: ChangeEvent<HTMLInputElement>) => {
    if (key === 'price') setFieldErrors((p) => ({ ...p, price: undefined }));
    setForm((p) => ({ ...p, [key]: Number(e.target.value) || 0 }));
  };
  const noWheel = (e: WheelEvent<HTMLInputElement>) => e.currentTarget.blur();
  const noArrows = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>, type: 'primary' | 'gallery') => {
    if (!e.target.files) return;
    if (type === 'primary') {
      const file = e.target.files[0] ?? null;
      setForm((p) => ({ ...p, primaryImage: file }));
      if (file) setFieldErrors((p) => ({ ...p, primaryImage: undefined }));
      e.target.value = '';
      return;
    }
    const combined = [...form.galleryImages, ...Array.from(e.target.files)];
    if (visibleExisting.length + combined.length > MAX_GALLERY) {
      setGalleryError(`Maximum ${MAX_GALLERY} gallery images allowed.`);
      e.target.value = '';
      return;
    }
    setGalleryError(null);
    setForm((p) => ({ ...p, galleryImages: combined, imagecount: Math.max(p.imagecount, 0) }));
    e.target.value = '';
  };

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = 'Product name is required.';
    if (!form.description.trim()) errors.description = 'Description is required.';
    if (!form.price || Number(form.price) <= 0) errors.price = 'Selling price is required.';
    if (!form.primaryImage && !editingProduct?.primaryImageUrl) errors.primaryImage = 'Primary image is required.';
    if (Object.keys(errors).length) return setFieldErrors(errors);

    setIsSubmitting(true);
    const productKey = form.productId;
    try {
      const result = await onSubmit?.({
        ...form,
        price: Number(form.price) || 0,
        stock: stockValue,
        manufactureCost: costValue,
        imagecount: Math.max(0, Math.floor(Number(form.imagecount) || 0)),
        personalization: false,
        personalizationEnabled: false,
        personalizationOptions: [],
        existingGalleryUrls: visibleExisting,
        removedGalleryUrls,
      });
      if (result !== false) {
        try {
          await saveMaterials(productKey, materials.filter((m) => m.qty > 0));
        } catch (e) {
          addToast(e instanceof Error ? e.message : 'Could not save product materials.', 'error');
        }
        setForm(EMPTY);
        setExistingGalleryUrls([]);
        setRemovedGalleryUrls([]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const err = (m?: string) => (m ? <p className="mt-1 text-xs font-semibold text-rose-600">{m}</p> : null);
  const errBorder = (m?: string) => (m ? 'border-rose-400' : '');

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      icon={<Package size={18} />}
      title={editingProduct ? 'Edit Product' : 'Add New Product'}
      subtitle={editingProduct ? 'Update product details.' : 'Enter details for the new product.'}
      maxWidth="max-w-2xl"
      footer={
        <>
          {editingProduct && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingProduct)}
              className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          <button type="button" onClick={onClose} className={btnGhost}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting} className={btnPrimary}>
            {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Publish Product'}
          </button>
        </>
      }
    >
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Product Name</label>
            <input
              className={`${inputCls} ${errBorder(fieldErrors.name)}`}
              value={form.name}
              placeholder="e.g. Vintage Walnut Frame"
              onChange={(e) => {
                setFieldErrors((p) => ({ ...p, name: undefined }));
                setForm((p) => ({ ...p, name: e.target.value }));
              }}
            />
            {err(fieldErrors.name)}
          </div>
          <div>
            <label className={labelCls}>Product ID</label>
            <input className={inputCls} value={form.productId || 'Generating…'} readOnly disabled />
          </div>
          <MaterialsEditor value={materials} onChange={changeMaterials} inventory={inventory} />
          <div>
            <label className={labelCls}>
              Manufacture Unit Cost (LKR){autoCost !== null && <span className="ml-1 font-normal text-emerald-600">· auto from materials</span>}
            </label>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              className={`${inputCls} ${autoCost !== null ? 'cursor-not-allowed bg-[#F1F5F9]' : ''}`}
              placeholder="0.00"
              readOnly={autoCost !== null}
              value={autoCost !== null ? autoCost : form.manufactureCost ? form.manufactureCost : ''}
              onChange={setNum('manufactureCost')}
              onWheel={noWheel}
              onKeyDown={noArrows}
            />
          </div>
          <div>
            <label className={labelCls}>Selling Unit Price (LKR)</label>
            <input
              type="number"
              min={0}
              inputMode="decimal"
              className={`${inputCls} ${errBorder(fieldErrors.price)}`}
              placeholder="0.00"
              value={form.price ? form.price : ''}
              onChange={setNum('price')}
              onWheel={noWheel}
              onKeyDown={noArrows}
            />
            {err(fieldErrors.price)}
          </div>
          <div>
            <label className={labelCls}>Unit Profit (auto)</label>
            <div
              className={`flex h-9 items-center justify-between rounded-lg border px-3 text-xs font-bold ${
                profit >= 0 ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-rose-100 bg-rose-50 text-rose-600'
              }`}
            >
              <span>
                {profit >= 0 ? '+' : '-'}
                {fmt(Math.abs(profit))}
              </span>
              <span>{margin.toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Stock (units){autoStock !== null && <span className="ml-1 font-normal text-emerald-600">· auto from inventory</span>}
            </label>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className={`${inputCls} ${autoStock !== null ? 'cursor-not-allowed bg-[#F1F5F9]' : ''}`}
              placeholder="0"
              readOnly={autoStock !== null}
              value={autoStock !== null ? autoStock : form.stock ? form.stock : ''}
              onChange={setNum('stock')}
              onWheel={noWheel}
              onKeyDown={noArrows}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Customer Image Count</label>
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className={inputCls}
              placeholder="e.g. 6"
              value={form.imagecount ? form.imagecount : ''}
              onChange={setNum('imagecount')}
              onWheel={noWheel}
              onKeyDown={noArrows}
            />
            <p className="mt-1 text-xs text-[#94A3B8]">Number of photos the customer can upload for this product (0 = none).</p>
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            rows={3}
            className={`${textareaCls} ${errBorder(fieldErrors.description)}`}
            placeholder="Provide detailed information..."
            value={form.description}
            onChange={(e) => {
              setFieldErrors((p) => ({ ...p, description: undefined }));
              setForm((p) => ({ ...p, description: e.target.value }));
            }}
          />
          {err(fieldErrors.description)}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Primary Image</label>
            {primaryUrl ? (
              <div className={`relative h-32 overflow-hidden rounded-xl border-2 ${fieldErrors.primaryImage ? 'border-rose-400' : 'border-[#E2E8F0]'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={primaryUrl} alt="Primary preview" className="size-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => setForm((p) => ({ ...p, primaryImage: null }))}
                  className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-white text-[#0F172A] shadow hover:bg-rose-50 hover:text-rose-600"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
                <label className="absolute inset-x-0 bottom-0 cursor-pointer bg-black/50 py-1 text-center text-xs font-semibold text-white">
                  Replace image
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, 'primary')} />
                </label>
              </div>
            ) : (
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, 'primary')} />
                <div
                  className={`flex h-32 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-[#F8FAFC] ${
                    fieldErrors.primaryImage ? 'border-rose-400' : 'border-[#CBD5E1]'
                  }`}
                >
                  <UploadCloud size={22} className="text-[#94A3B8]" />
                  <span className="text-xs font-semibold text-[#475569]">Click to upload</span>
                  <span className="text-xs text-[#94A3B8]">Main display image</span>
                </div>
              </label>
            )}
            {err(fieldErrors.primaryImage)}
          </div>

          <div>
            <label className={labelCls}>
              Gallery ({galleryCount}/{MAX_GALLERY})
            </label>
            <div className="flex min-h-32 flex-wrap content-start gap-2 rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-2.5">
              {visibleExisting.map((u) => (
                <Thumb key={u} src={u} onRemove={() => setRemovedGalleryUrls((p) => [...p, u])} />
              ))}
              {newGalleryUrls.map((u, i) => (
                <Thumb
                  key={u}
                  src={u}
                  onRemove={() => setForm((p) => ({ ...p, galleryImages: p.galleryImages.filter((_, j) => j !== i) }))}
                />
              ))}
              {galleryCount < MAX_GALLERY && (
                <label className="flex size-14 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-white text-[#94A3B8] hover:text-[#2563EB]">
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFile(e, 'gallery')} />
                  {galleryCount === 0 ? <ImagePlus size={18} /> : <Images size={18} />}
                </label>
              )}
            </div>
            {err(galleryError ?? undefined)}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative size-14 overflow-hidden rounded-lg border border-[#E2E8F0]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Gallery" className="size-full object-cover" />
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-white text-[#0F172A] shadow hover:text-rose-600"
      >
        <X size={10} strokeWidth={3} />
      </button>
    </div>
  );
}
