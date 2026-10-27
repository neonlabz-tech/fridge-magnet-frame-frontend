export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export interface GalleryImageItem {
  secure_url: string;
  public_id: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  series: string;
  price: number;
  imagecount:number;
  stockCount: number;
  stockStatus: StockStatus;
  gradient: string;
  primaryImageUrl?: string;
  galleryImageUrls?: string[];
  galleryImagesRaw?: GalleryImageItem[];
  previewVariant?: 'updated-1' | 'updated-2' | 'gradient';
  description?: string;
  size?: string;
  finish?: string;
  warehouseLocation?: string;
  warehouseCenter?: string;
  lastUpdatedBy?: string;
  lastUpdatedDate?: string;
  isPopular?: boolean;
  manufactureCost?: number;
  isActive?: boolean;
  image?: string;
  imageUrl?: string;
}

export interface ProductFormData {
  name: string;
  productId: string;
  category: string;
  stock: number;
  price: number;
  manufactureCost?: number;
  imagecount:number;
  description: string;
  personalization: boolean;
  personalizationEnabled?: boolean;
  personalizationOptions?: PersonalizationFormOption[];
  primaryImage: File | null;
  galleryImages: File[];
  existingGalleryUrls?: string[];
  removedGalleryUrls?: string[];
}

export interface PersonalizationFormOption {
  label: string;
  price: number;
  note?: string;
  imageFile?: File | null;
}