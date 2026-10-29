import type { Order, OrderStatus } from "@/types/order";
import { apiV1Url } from "@/lib/backendUrl";

const normalizeCustomerId = (value: unknown) =>
  String(value ?? "").replace(/^#+/, "").trim();

type ApiOrder = {
  _id?: string;
  id?: string;
  orderId: string;
  customerName: string;
  customerId?: string | null;
  customer?: {
    customerId?: string | null;
    customerName?: string;
    name?: string;
  };
  qty: number;
  status: string;
  email?: string;
  phone?: string;
  totalValue?: number;
  shippingAddress?: string;
  adminNote?: string;
  createdAt?: string;
  deliveredAt?: string;
  imagesDeletedAt?: string;
  items?: {
    productId?: string;
    sku?: string | null;
    name?: string;
    price?: number;
    quantity?: number;
    image?: string;
    primaryImage?: string;
    uploadedImages?: string[];
    frameType?: string;
    colorOption?: string;
  }[];
};

type ApiOrdersResponse =
  | ApiOrder[]
  | {
      orders?: ApiOrder[];
      data?: ApiOrder[];
    };

const statusFromApi = (status?: string): OrderStatus => {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "cancelled") return "canceled";

  if (
    normalized === "shipped" ||
    normalized === "pending" ||
    normalized === "processing" ||
    normalized === "delivered" ||
    normalized === "canceled"
  ) {
    return normalized;
  }

  return "processing";
};

export const statusToApi = (status: OrderStatus) => status.toUpperCase();

export const mapApiOrder = (order: ApiOrder): Order => {
  const resolvedCustomerId = normalizeCustomerId(
    order.customer?.customerId ?? order.customerId,
  );
  const resolvedCustomerName =
    order.customer?.customerName ||
    order.customer?.name ||
    order.customerName ||
    "Customer";

  const rawAny = order as Record<string, unknown>;

  return {
    id: order._id || order.id || order.orderId,
    _id: order._id,
    orderId: order.orderId,
    customerName: resolvedCustomerName,
    customerInitials: resolvedCustomerName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    customerId: resolvedCustomerId,
    qty: order.qty,
    status: statusFromApi(order.status),
    paymentStatus: (rawAny.paymentStatus as any) || (order.status === "delivered" ? "paid" : "pending"),
    paymentMethod: (rawAny.paymentMethod as string) || "Card",
    paymentSlipUrl: (rawAny.paymentSlipUrl as string) || undefined,
    preferredLanguage: (rawAny.preferredLanguage as "Tamil" | "English") || "Tamil",
    allPhotosReceived: (rawAny.allPhotosReceived as boolean) ?? true,
    email: order.email,
    phone: order.phone,
    totalValue: order.totalValue,
    subtotal: (rawAny.subtotal as number) ?? (order.totalValue ? Math.max(0, order.totalValue - 350) : 0),
    deliveryFee: (rawAny.deliveryFee as number) ?? 350,
    discount: (rawAny.discount as number) ?? 0,
    district: (rawAny.district as string) || "Jaffna",
    city: (rawAny.city as string) || "",
    shippingAddress: order.shippingAddress,
    adminNote: order.adminNote,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    imagesDeletedAt: order.imagesDeletedAt,
    items: order.items?.map((item) => ({
      productId: item.productId,
      sku: item.sku ?? null,
      name: item.name || "Product",
      price: Number(item.price ?? 0),
      quantity: Number(item.quantity ?? 1),
      image: item.image,
      primaryImage: item.primaryImage ?? item.image,
      uploadedImages: item.uploadedImages,
      frameType: item.frameType,
      colorOption: item.colorOption,
    })),
  };
};

export const fetchOrders = async (): Promise<Order[]> => {
  try {
    const response = await fetch(apiV1Url("/orders"), { cache: "no-store" });

    if (response.ok) {
      const data = (await response.json()) as ApiOrdersResponse;
      const backendOrders = Array.isArray(data) ? data : data.orders || data.data || [];

      return backendOrders.map(mapApiOrder);
    }
  } catch {
    console.log("Backend not available");
  }

  return [];
};

export const fetchOrder = async (id: string): Promise<Order> => {
  try {
    const response = await fetch(apiV1Url(`/orders/${id}`), {
      cache: "no-store",
    });

    if (response.ok) {
      return mapApiOrder((await response.json()) as ApiOrder);
    }
  } catch {
    console.log("Backend not available, checking mock orders");
  }

  throw new Error(`Order not found: ${id}`);
};








// import type { Order, OrderStatus } from "@/types/order";
// import { ORDERS } from "@/data/orders";
// import { apiV1Url } from "@/lib/backendUrl";

// type ApiOrder = {
//   _id?: string;
//   id?: string;
//   orderId: string;
//   customerName: string;
//   customerId: string;
//   qty: number;
//   status: string;
//   email?: string;
//   phone?: string;
//   totalValue?: number;
//   shippingAddress?: string;
//   adminNote?: string;
//   createdAt?: string;
//   items?: {
//     productId?: string;
//     name?: string;
//     price?: number;
//     quantity?: number;
//     image?: string;
//     frameType?: string;
//     colorOption?: string;
//   }[];
// };

// type ApiOrdersResponse =
//   | ApiOrder[]
//   | {
//       orders?: ApiOrder[];
//       data?: ApiOrder[];
//     };

// const normalizeCustomerId = (value?: string) =>
//   String(value ?? "").replace(/^#+/, "");

// const statusFromApi = (status?: string): OrderStatus => {
//   const normalized = status?.trim().toLowerCase();

//   if (normalized === "cancelled") return "canceled";

//   if (
//     normalized === "shipped" ||
//     normalized === "pending" ||
//     normalized === "processing" ||
//     normalized === "delivered" ||
//     normalized === "canceled"
//   ) {
//     return normalized;
//   }

//   return "processing";
// };

// export const statusToApi = (status: OrderStatus) => status.toUpperCase();

// export const mapApiOrder = (order: ApiOrder): Order => ({
//   id: order._id || order.id || order.orderId,
//   _id: order._id,
//   orderId: order.orderId,
//   customerName: order.customerName,
//   customerInitials: (order.customerName || "")
//     .split(" ")
//     .filter(Boolean)
//     .map((part) => part[0])
//     .join("")
//     .toUpperCase()
//     .slice(0, 2) || "?",
//   customerId: normalizeCustomerId(order.customerId),
//   qty: order.qty,
//   status: statusFromApi(order.status),
//   email: order.email,
//   phone: order.phone,
//   totalValue: order.totalValue,
//   shippingAddress: order.shippingAddress,
//   adminNote: order.adminNote,
//   createdAt: order.createdAt,
//   items: order.items?.map((item) => ({
//     productId: item.productId,
//     name: item.name || "Product",
//     price: Number(item.price ?? 0),
//     quantity: Number(item.quantity ?? 1),
//     image: item.image,
//     frameType: item.frameType,
//     colorOption: item.colorOption,
//   })),
// });

// export const fetchOrders = async (): Promise<Order[]> => {
//   try {
//     const response = await fetch(apiV1Url("/orders"), { cache: "no-store" });

//     if (response.ok) {
//       const data = (await response.json()) as ApiOrdersResponse;
//       const backendOrders = Array.isArray(data) ? data : data.orders || data.data || [];

//       return backendOrders.map(mapApiOrder);
//     }
//   } catch {
//     console.log("Backend not available, using mock orders");
//   }

//   return ORDERS;
// };

// export const fetchOrder = async (id: string): Promise<Order> => {
//   try {
//     const response = await fetch(apiV1Url(`/orders/${id}`), {
//       cache: "no-store",
//     });

//     if (response.ok) {
//       return mapApiOrder((await response.json()) as ApiOrder);
//     }
//   } catch {
//     console.log("Backend not available, checking mock orders");
//   }

//   const mockOrder = ORDERS.find((o) => o.id === id);

//   if (mockOrder) return mockOrder;

//   throw new Error(`Order not found: ${id}`);
// };
