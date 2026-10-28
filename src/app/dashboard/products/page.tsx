'use client';
import { useEffect, useMemo, useState } from "react";
import { Boxes, ChevronDown, Download, Plus, Search, TriangleAlert } from "lucide-react";
import DeleteProductModal from "@/components/dashboard/products/DeleteProductModal";
import AddProductModal from "@/components/dashboard/products/AddProductModal";
import ViewProductModal from "@/components/dashboard/products/ViewProductModal";
import ProductTable from "@/components/dashboard/products/ProductTable";
import { TableFooter, downloadCsv, btnPrimary } from "@/components/dashboard/shared/UiKit";
import { useProducts } from "@/hooks/useProducts";
import type { Product, ProductFormData } from "@/types/product";
import { apiV1Url } from "@/lib/backendUrl";
import { useToastStore } from "@/store/toastStore";
import StatCard from "@/components/dashboard/shared/StatCard";
import { PageSkeleton } from "@/components/dashboard/shared/Skeleton";

type StatusFilter = "all" | "in-stock" | "low-stock" | "out-of-stock" | "disabled";

const PAGE_SIZE = 8;
const ID_PREFIX = "MG-";

const getProductStatus = (stock: number) => {
  if (stock > 10) return "In Stock";
  if (stock > 0) return "Low Stock";
  return "Out of Stock";
};

const getErrorMessage = (responseText: string) => {
  try {
    const parsed = JSON.parse(responseText);
    return parsed.message || parsed.error || responseText;
  } catch {
    return responseText || "Something went wrong";
  }
};
const computeNextProductId = (products: Product[]): string => {
  let maxNumber = 0;
  let padLength = 2;

  products.forEach((product) => {
    const match = /^MG-(\d+)$/i.exec(product.sku ?? "");
    if (!match) return;

    const num = parseInt(match[1], 10);
    if (num > maxNumber) {
      maxNumber = num;
      padLength = match[1].length;
    }
  });

  const nextNumber = maxNumber + 1;
  return `${ID_PREFIX}${String(nextNumber).padStart(padLength, "0")}`;
};

export default function ProductsPage() {
  const { products, isLoaded, refreshProducts } = useProducts();
  const { addToast } = useToastStore();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [viewTarget, setViewTarget] = useState<Product | null>(null);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productMessage, setProductMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!productMessage) return;

    const timer = window.setTimeout(() => {
      setProductMessage(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [productMessage]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const safeProducts = Array.isArray(products) ? products : [];

  const autoProductId = useMemo(
    () => computeNextProductId(safeProducts),
    [safeProducts],
  );

  const lowCount = safeProducts.filter(
    (p) => p.stockCount > 0 && p.stockCount <= 10,
  ).length;

  const filtered = safeProducts.filter((p) => {
    const q = search.trim().toLowerCase();
    if (q && ![p.name, p.sku, p.id, p.series].some((v) => String(v ?? "").toLowerCase().includes(q)))
      return false;
    if (statusFilter === "in-stock") return p.stockCount > 10;
    if (statusFilter === "low-stock") return p.stockCount > 0 && p.stockCount <= 10;
    if (statusFilter === "out-of-stock") return p.stockCount <= 0;
    if (statusFilter === "disabled") return p.isActive === false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleToggle = async (product: Product) => {
    if (!product.isActive && product.stockCount <= 0) {
      addToast(`${product.name} has no stock. Add stock before enabling it.`, "error");
      return;
    }
    const next = !product.isActive;
    setTogglingId(product.id);
    try {
      const res = await fetch(apiV1Url(`/products/${product.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error(getErrorMessage(await res.text()));
      addToast(`${product.name} ${next ? "enabled" : "disabled"}`, "success");
      await refreshProducts();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to update product", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleExport = () => {
    if (!filtered.length) return addToast("No products to export.", "error");
    downloadCsv("products.csv", [
      ["Product ID", "Name", "Manufacture Cost", "Selling Price", "Unit Profit", "Stock"],
      ...filtered.map((p) => [p.sku || p.id, p.name, p.manufactureCost ?? 0, p.price, p.price - (p.manufactureCost ?? 0), p.stockCount]),
    ]);
  };

  const handleAddProduct = async (formData: ProductFormData) => {
    try {
      const data = new FormData();

      data.append("productName", formData.name);
      data.append("productId", formData.productId);
      data.append("stock", String(formData.stock));
      data.append("description", formData.description);
      data.append("status", getProductStatus(formData.stock));

      data.append("price", String(formData.price));
      data.append("manufactureCost", String(formData.manufactureCost ?? 0));
      data.append("imagecount", String(formData.imagecount));

      if (formData.primaryImage) {
        data.append("primaryImage", formData.primaryImage);
      }

      formData.galleryImages.forEach((file) => {
        data.append("galleryImages", file);
      });

      const res = await fetch(apiV1Url("/products"), {
        method: "POST",
        body: data,
      });

      const result = await res.text();

      if (!res.ok) {
        throw new Error(getErrorMessage(result));
      }

      addToast("Product added successfully", "success");
      setProductMessage("Product added successfully");

      await refreshProducts();
      setAddOpen(false);

      setPage(1);
      setStatusFilter("all");
      setSearch("");

      return true;
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Something went wrong",
        "error",
      );
      return false;
    }
  };

  const handleEditProduct = async (formData: ProductFormData) => {
    if (!editTarget) return false;

    try {
      const data = new FormData();

      data.append("productName", formData.name);
      data.append("productId", formData.productId);
      data.append("stock", String(formData.stock));
      data.append("price", String(formData.price));
      data.append("manufactureCost", String(formData.manufactureCost ?? 0));
      data.append("imagecount", String(formData.imagecount));
      data.append("description", formData.description);
      data.append("status", getProductStatus(formData.stock));

      if (formData.primaryImage) {
        data.append("primaryImage", formData.primaryImage);
      }

      const res = await fetch(apiV1Url(`/products/${editTarget.id}`), {
        method: "PUT",
        body: data,
      });

      const result = await res.text();

      if (!res.ok) {
        throw new Error(getErrorMessage(result));
      }
      const removedUrls = formData.removedGalleryUrls ?? [];
      if (removedUrls.length > 0 && editTarget.galleryImagesRaw) {
        const toDelete = editTarget.galleryImagesRaw.filter((img) =>
          removedUrls.includes(img.secure_url),
        );

        await Promise.all(
          toDelete.map(async (img) => {
            const encodedPublicId = encodeURIComponent(img.public_id);
            const deleteRes = await fetch(
              apiV1Url(
                `/products/${editTarget.id}/image/${encodedPublicId}`,
              ),
              { method: "DELETE" },
            );
            if (!deleteRes.ok) {
              const text = await deleteRes.text();
              throw new Error(getErrorMessage(text));
            }
          }),
        );
      }

      if (formData.galleryImages.length > 0) {
        const galleryData = new FormData();
        formData.galleryImages.forEach((file) => {
          galleryData.append("galleryImages", file);
        });

        const galleryRes = await fetch(
          apiV1Url(`/products/${editTarget.id}/gallery`),
          {
            method: "POST",
            body: galleryData,
          },
        );

        if (!galleryRes.ok) {
          const text = await galleryRes.text();
          throw new Error(getErrorMessage(text));
        }
      }
      addToast("Product updated successfully", "success");
      setProductMessage("Product updated successfully");
      await refreshProducts();
      setEditTarget(null);
      return true;
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Failed to update product",
        "error",
      );
      return false;
    }
  };

  const handleUpdateProduct = async (product: Product, newStock: string) => {
    try {
      const updatedStock = Number(newStock);

      let status = "Out of Stock";

      if (updatedStock > 10) {
        status = "In Stock";
      } else if (updatedStock > 4) {
        status = "Low Stock";
      }

      const res = await fetch(apiV1Url(`/products/${product.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stock: updatedStock,
          status,
        }),
      });

      const result = await res.text();

      if (!res.ok) {
        throw new Error(getErrorMessage(result));
      }

      addToast("Stock updated successfully", "success");
      setProductMessage("Stock updated successfully");

      await refreshProducts();

      setViewTarget(null);

      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update stock";
      addToast(message, "error");
      setProductMessage(message);

      return false;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleteError(null);
    setIsDeleting(true);

    try {
      const res = await fetch(apiV1Url(`/products/${deleteTarget.id}`), {
        method: "DELETE",
      });

      const result = await res.text();

      if (!res.ok) {
        throw new Error(getErrorMessage(result));
      }

      addToast("Product deleted successfully", "success");
      setProductMessage("Product deleted successfully");
      await refreshProducts();
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete product",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isLoaded) {
    return <PageSkeleton stats={2} rows={8} cols={8} />;
  }

  const stats = [
    { label: "Total Products", value: safeProducts.length, icon: Boxes, tone: "bg-blue-50 text-[#2563EB]" },
    { label: "Low Stock Items", value: lowCount, icon: TriangleAlert, tone: "bg-amber-50 text-amber-500" },
  ];

  return (
    <>
      <div className="compact-ui relative mx-auto flex min-h-full w-full max-w-7xl flex-col px-3 pb-4 pt-2 sm:px-6 sm:pt-3 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:px-8 lg:pb-4 lg:pt-4">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-[#0F172A]">Products Management</h1>
          <p className="text-xs text-[#64748B]">Manage your catalogue, pricing and stock levels.</p>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 sm:max-w-md">
          {stats.map(({ label, value, icon, tone }) => (
            <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />
          ))}
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
          <div className="flex flex-col gap-2 border-b border-[#E2E8F0] p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by product name or ID..."
                className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none"
              />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
                className="h-9 w-full appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-xs font-medium text-[#475569] sm:w-40"
              >
                <option value="all">All Status</option>
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
                <option value="disabled">Disabled</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            </div>
            <button type="button" onClick={handleExport} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#475569] hover:bg-slate-50">
              <Download size={14} /> Export
            </button>
            <button type="button" onClick={() => setAddOpen(true)} className={btnPrimary}>
              <Plus size={14} /> Add Product
            </button>
          </div>

          {productMessage && (
            <div className="mx-3 mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-[#1E40AF]">
              {productMessage}
            </div>
          )}

          <ProductTable
            products={paged}
            togglingId={togglingId}
            onView={setViewTarget}
            onEdit={setEditTarget}
            onToggle={handleToggle}
          />

          <TableFooter page={safePage} pageSize={PAGE_SIZE} total={filtered.length} noun="products" onPage={setPage} />
        </section>
      </div>

      <AddProductModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddProduct}
        autoProductId={autoProductId}
      />

      <AddProductModal
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditProduct}
        onDelete={(p) => { setEditTarget(null); setDeleteError(null); setDeleteTarget(p); }}
        editingProduct={editTarget}
      />

      <ViewProductModal
        isOpen={Boolean(viewTarget)}
        product={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={(p) => { setViewTarget(null); setEditTarget(p); }}
        onUpdate={handleUpdateProduct}
      />

      <DeleteProductModal
        isOpen={Boolean(deleteTarget)}
        product={deleteTarget}
        onCancel={() => {
          setDeleteError(null);
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        error={deleteError}
        isDeleting={isDeleting}
      />
    </>
  );
}
