'use client';

import { useState, useEffect } from 'react';
import type { Product } from '@/types/product';
import { apiV1Url } from '@/lib/backendUrl';

type ApiImage = {
  secure_url?: string;
  public_id?: string;
};

type ApiProduct = {
  _id?: string;
  id?: string;
  productId?: string;
  productName?: string;
  category?: string;
  price?: number;
  manufactureCost?: number;
  unitCost?: number;
  costPrice?: number;
  isActive?: boolean;
  stock?: number;
  imagecount?: number;   // <-- ADD THIS
  status?: string;
  primaryImage?: ApiImage | null;
  galleryImages?: ApiImage[];
  description?: string;
  updatedAt?: string;
};

// Two demo products, shown only while the database has none (or the API is unreachable).
const DEMO_PRODUCTS: ApiProduct[] = [];

const toStockStatus = (status?: string, stock = 0): Product['stockStatus'] => {
  if (status === 'Out of Stock' || stock <= 0) return 'out-of-stock';
  if (status === 'Low Stock' || stock <= 10) return 'low-stock';
  return 'in-stock';
};

const mapProduct = (product: ApiProduct): Product => {
  const stockCount = Number(product.stock ?? 0);

  return {
    id: product._id || product.id || product.productId || '',
    sku: product.productId || '',
    name: product.productName || 'Untitled product',
    series: product.category?.trim() || '',
    price: Number(product.price ?? 0),
    manufactureCost: Number(product.manufactureCost ?? product.unitCost ?? product.costPrice ?? 0),
    // Disabled manually (isActive false) or automatically when there is no stock.
    isActive: product.isActive !== false && stockCount > 0,
    imagecount: Number(product.imagecount ?? 0), // <-- ADD THIS
    stockCount,
    stockStatus: toStockStatus(product.status, stockCount),
    gradient: 'from-slate-100 to-slate-300',
    primaryImageUrl: product.primaryImage?.secure_url,
    galleryImageUrls:
      product.galleryImages?.map((image) => image.secure_url || '').filter(Boolean) || [],
    galleryImagesRaw:
      product.galleryImages
        ?.filter((image) => image.secure_url && image.public_id)
        .map((image) => ({
          secure_url: image.secure_url as string,
          public_id: image.public_id as string,
        })) || [],
    description: product.description,
    lastUpdatedDate: product.updatedAt,
  };
};

const getProductsFromResponse = (data: unknown): ApiProduct[] => {
  if (Array.isArray(data)) return data;

  if (!data || typeof data !== 'object') return [];

  const payload = data as {
    products?: ApiProduct[];
    data?: ApiProduct[] | { products?: ApiProduct[] };
  };

  if (Array.isArray(payload.products)) return payload.products;
  if (Array.isArray(payload.data)) return payload.data;
  if (
    payload.data &&
    !Array.isArray(payload.data) &&
    Array.isArray(payload.data.products)
  ) {
    return payload.data.products;
  }

  return [];
};

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await fetch(apiV1Url('/products?page=1&limit=1000'), {
        cache: 'no-store',
      });

      if (!res.ok) {
        setProducts(DEMO_PRODUCTS.map(mapProduct));
        return;
      }

      const data = await res.json();
      const list = getProductsFromResponse(data);

      setProducts((list.length ? list : DEMO_PRODUCTS).map(mapProduct));
    } catch (error) {
      console.error('Failed to fetch products', error);
      setProducts(DEMO_PRODUCTS.map(mapProduct));
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return {
    products,
    isLoaded,
    refreshProducts: fetchProducts,
  };
};
