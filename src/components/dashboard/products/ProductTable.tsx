import { Eye, Pencil } from 'lucide-react';
import type { Product } from '@/types/product';
import { useInventory } from '@/lib/inventoryStore';
import { readMaterials, materialCost, useMaterialsSync } from '@/lib/materials';

interface ProductTableProps {
  products: Product[];
  togglingId?: string | null;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onToggle: (product: Product) => void;
}

const money = (n: number) =>
  `LKR ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProductTable({ products, togglingId, onView, onEdit, onToggle }: ProductTableProps) {
  const rows = Array.isArray(products) ? products : [];
  const inventory = useInventory();
  useMaterialsSync();

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[1080px] border-collapse text-left">
        <thead>
          <tr className="bg-[#F8FAFC]">
            {['Product ID', 'Product Image', 'Product Name', 'Manufacture Unit Cost', 'Selling Unit Price', 'Unit Profit', 'Image Count', 'Stock'].map(
              (h) => (
                <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  {h}
                </th>
              )
            )}
            <th className="sticky right-0 z-[1] bg-[#F8FAFC] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-[#64748B] md:static">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F1F5F9]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-16 text-center text-xs text-[#94A3B8]">
                No products found. Try changing your filters or add a new product.
              </td>
            </tr>
          ) : (
            rows.map((p, index) => {
              const mats = readMaterials(p.sku || p.id);
              const cost = mats.some((m) => m.qty > 0) ? materialCost(mats, inventory) : Number(p.manufactureCost ?? 0);
              const profit = p.price - cost;
              const depleted = p.stockCount <= 0;
              const images =
                Number(p.imagecount) || (p.galleryImageUrls?.length ?? 0) + (p.primaryImageUrl ? 1 : 0);
              const active = p.isActive !== false && !depleted ? true : Boolean(p.isActive);

              return (
                <tr key={`${p.id}-${index}`} className="transition-colors hover:bg-[#F8FAFC]/80">
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-[#EFF6FF] px-2 py-1 text-xs font-bold text-[#2563EB]">
                      {p.sku || p.id}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="size-11 overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                      {p.primaryImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.primaryImageUrl} alt={p.name} className="size-full object-cover" />
                      ) : (
                        <div className="size-full bg-gradient-to-br from-slate-100 to-slate-300" />
                      )}
                    </div>
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <p className="line-clamp-2 text-xs font-bold text-[#0F172A]" title={p.name}>
                      {p.name}
                    </p>
                    {depleted ? (
                      <p className="text-xs font-medium text-rose-500">Currently depleted</p>
                    ) : (
                      <p className="line-clamp-1 text-xs text-[#94A3B8]">{p.description || p.series}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#64748B]">{money(cost)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs font-bold text-[#0F172A]">{money(p.price)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <p className="text-xs font-bold text-emerald-600">
                      {profit >= 0 ? '+' : '-'}LKR {Math.abs(profit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#64748B]">
                      {images} {images === 1 ? 'Image' : 'Images'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-bold ${
                        depleted
                          ? 'bg-rose-50 text-rose-500'
                          : p.stockCount <= 10
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-[#F1F5F9] text-[#0F172A]'
                      }`}
                    >
                      {p.stockCount} units
                    </span>
                    {!depleted && p.stockCount <= 10 && (
                      <p className="mt-1 text-xs font-semibold text-amber-600">Low stock</p>
                    )}
                  </td>
                  <td className="sticky right-0 z-[1] bg-white px-4 py-3 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)] md:static md:shadow-none">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`View ${p.name}`}
                        title="View"
                        onClick={() => onView(p)}
                        className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${p.name}`}
                        title="Edit"
                        onClick={() => onEdit(p)}
                        className="flex size-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-blue-50 hover:text-[#2563EB]"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={active ? `Disable ${p.name}` : `Enable ${p.name}`}
                        title={active ? 'Active – click to disable' : 'Disabled – click to enable'}
                        disabled={togglingId === p.id}
                        onClick={() => onToggle(p)}
                        className={`relative ml-1 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                          active ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                            active ? 'left-[18px]' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
