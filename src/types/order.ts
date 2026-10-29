export type OrderStatus = 'shipped' | 'pending' | 'processing' | 'delivered' | 'canceled';
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface OrderItem {
  productId?: string;
  sku?: string | null;
  name: string;
  price: number;
  primaryImage?: string;
  uploadedImages?: string[];
  quantity: number;
  image?: string;
  frameType?: string;
  colorOption?: string;
}

export interface Order {
  id: string;
  _id?: string;
  orderId: string;
  customerName: string;
  customerInitials: string;
  customerId: string;
  qty: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  /** Bank transfer receipt uploaded by the customer (Cloudflare R2 receipts/ folder). */
  paymentSlipUrl?: string;
  preferredLanguage?: 'Tamil' | 'English' | string;
  allPhotosReceived?: boolean;
  email?: string;
  phone?: string;
  shippingAddress?: string;
  district?: string;
  city?: string;
  adminNote?: string;
  subtotal?: number;
  deliveryFee?: number;
  discount?: number;
  totalValue?: number;
  createdAt?: string;
  /** When the order was marked delivered (customer photos are removed 7 days later). */
  deliveredAt?: string;
  /** Set once the customer's uploaded photos were deleted from storage. */
  imagesDeletedAt?: string;
  items?: OrderItem[];
}
