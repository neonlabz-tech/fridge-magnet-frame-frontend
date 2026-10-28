export type CustomerRow = {
  id: string;
  recordId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  initials: string;
  isActive: boolean;
  source?: string;
  type: 'Website' | 'Manual';
  emailVerified: boolean;
  createdAt?: string;
  totalOrders: number;
  totalAmount: number;
  activeOrders: number;
  activeOrderRef?: string;
};

const AVATAR_STYLES = [
  'bg-[#DBEAFE] text-[#1D4ED8]',
  'bg-[#E0E7FF] text-[#4338CA]',
  'bg-[#FEE2E2] text-[#B91C1C]',
  'bg-[#DCFCE7] text-[#15803D]',
  'bg-[#FEF3C7] text-[#B45309]',
  'bg-[#E2E8F0] text-[#475569]',
];

export const avatarStyle = (key: string) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
};

export const lkr = (n: number) => `LKR ${Number(n || 0).toLocaleString('en-US')}`;

export const displayId = (id: string) => `#${String(id ?? '').replace(/^#+/, '')}`;

export const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

const toNumber = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* Website = registered by the customer on the website; Manual = added by staff in the dashboard. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveType = (c: any): 'Website' | 'Manual' => {
  const raw = String(c.type ?? c.registrationType ?? c.registeredFrom ?? c.channel ?? '').toLowerCase();
  if (raw) return raw.includes('web') || raw.includes('online') ? 'Website' : 'Manual';
  return c.source === 'user' ? 'Website' : 'Manual';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveVerified = (c: any): boolean =>
  Boolean(c.emailVerified ?? c.isEmailVerified ?? c.isVerified ?? c.verified ?? c.emailVerifiedAt ?? c.mailVerified);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const normalizeCustomer = (customer: any): CustomerRow => {
  const name =
    customer.customerName ||
    customer.name ||
    `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() ||
    'Unknown';

  const ordersField = customer.orders;
  const totalOrders = toNumber(
    customer.totalOrders ??
      customer.ordersCount ??
      customer.orderCount ??
      (Array.isArray(ordersField) ? ordersField.length : ordersField)
  );

  return {
    id: String(
      customer.customerId || customer.id || customer._id || customer.recordId || ''
    ).replace(/^#+/, ''),
    recordId: String(customer._id || customer.recordId || customer.id || ''),
    name,
    email: customer.emailAddress || customer.email || 'Not provided',
    phone: customer.phoneNumber || customer.phone || 'Not provided',
    address: customer.customerAddress || customer.address || 'Not provided',
    initials: getInitials(name),
    isActive: customer.isActive ?? customer.status !== 'inactive',
    source: customer.source,
    type: resolveType(customer),
    emailVerified: resolveVerified(customer),
    createdAt: customer.createdAt,
    totalOrders,
    totalAmount: toNumber(customer.totalAmount ?? customer.totalSpent ?? customer.totalValue),
    activeOrders: toNumber(customer.activeOrders ?? customer.pendingOrders),
    activeOrderRef: customer.activeOrderId || customer.pendingOrderId || undefined,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const extractCustomers = (data: any): any[] => {
  if (Array.isArray(data?.data?.customers)) return data.data.customers;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.customers)) return data.customers;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
};
