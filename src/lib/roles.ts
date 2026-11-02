import { readDemoTeams, DEMO_SESSION_KEY, type DemoSession } from '@/lib/demoAuth';

export const ROLES_KEY = 'magnify-demo-roles';

export interface PageOption {
  href: string;
  label: string;
}

/** Pages an admin can allow for a role. Overview is always available to everyone (its content follows the allowed pages);
 *  Reports and User Management are always admin-only. */
export const PAGE_OPTIONS: PageOption[] = [
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/products', label: 'Products' },
  { href: '/dashboard/inventory', label: 'Inventory' },
  { href: '/dashboard/deliveries', label: 'Delivery' },
  { href: '/dashboard/leads', label: 'Leads & Followups' },
  { href: '/dashboard/targets', label: 'Targets & Commission' },
  { href: '/dashboard/finance', label: 'Finance' },
];

export type Action = 'view' | 'create' | 'edit' | 'delete';
export const ACTIONS: { key: Action; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

/** Overview widgets an admin can allow for a role. `page` = the page whose View permission it also needs. */
export interface WidgetOption {
  key: string;
  label: string;
  page?: string;
}
export const WIDGET_OPTIONS: WidgetOption[] = [
  { key: 'stat-orders', label: 'Card: Orders this week', page: '/dashboard/orders' },
  { key: 'stat-revenue', label: 'Card: Weekly revenue', page: '/dashboard/orders' },
  { key: 'stat-customers', label: 'Card: New customers', page: '/dashboard/customers' },
  { key: 'stat-stock', label: 'Card: Low / out of stock' },
  { key: 'stat-deliveries', label: 'Card: Deliveries done', page: '/dashboard/deliveries' },
  { key: 'stat-profit', label: 'Card: Net profit', page: '/dashboard/finance' },
  { key: 'revenue-trend', label: 'Revenue trend', page: '/dashboard/orders' },
  { key: 'orders-per-day', label: 'Orders per day', page: '/dashboard/orders' },
  { key: 'income-expenses', label: 'Income vs expenses', page: '/dashboard/finance' },
  { key: 'top-products', label: 'Top products', page: '/dashboard/products' },
  { key: 'order-status', label: 'Order status', page: '/dashboard/orders' },
  { key: 'payment-methods', label: 'Payment methods', page: '/dashboard/finance' },
  { key: 'product-stock', label: 'Product stock', page: '/dashboard/products' },
  { key: 'delivery-status', label: 'Delivery status', page: '/dashboard/deliveries' },
  { key: 'leads', label: 'Leads & Followups', page: '/dashboard/leads' },
];

export type PermissionMap = Record<string, Action[]>;

/** Old roles stored all summary cards as one 'stats' widget: it means every card. */
export function expandWidgets(list: string[]): string[] {
  if (!list.includes('stats')) return list;
  const cards = WIDGET_OPTIONS.filter((w) => w.key.startsWith('stat-')).map((w) => w.key);
  return [...new Set([...list.filter((k) => k !== 'stats'), ...cards])];
}

/** One line of the permission matrix. Finance is split per tab (Income / Expense). */
export interface PermissionRow {
  key: string; // page href, or `${href}#tab`
  page: string; // the page that must be opened
  label: string;
  /** Shown instead of "Delete" (customers are deactivated, never deleted). */
  deleteLabel?: string;
  note?: string;
  /** Newly added page: highlighted in the roles matrix. */
  isNew?: boolean;
}
export const PERMISSION_ROWS: PermissionRow[] = [
  { key: '/dashboard/orders', page: '/dashboard/orders', label: 'Orders' },
  { key: '/dashboard/customers', page: '/dashboard/customers', label: 'Customers', deleteLabel: 'Deactivate' },
  { key: '/dashboard/products', page: '/dashboard/products', label: 'Products' },
  { key: '/dashboard/inventory', page: '/dashboard/inventory', label: 'Inventory' },
  { key: '/dashboard/deliveries', page: '/dashboard/deliveries', label: 'Delivery' },
  { key: '/dashboard/leads', page: '/dashboard/leads', label: 'Leads & Followups' },
  { key: '/dashboard/targets', page: '/dashboard/targets', label: 'Targets & Commission' },
  { key: '/dashboard/finance#income', page: '/dashboard/finance', label: 'Finance › Income' },
  { key: '/dashboard/finance#expense', page: '/dashboard/finance', label: 'Finance › Expense' },
];

export interface Role {
  id: string;
  name: string;
  pages: string[]; // hrefs the role can open (= pages with View)
  /** Per-page actions. Missing/empty on old roles = full access to their pages. */
  permissions?: PermissionMap;
  /** Overview widgets. Missing = every widget the pages allow. */
  widgets?: string[];
}

export const ALL_ACTIONS: Action[] = ['view', 'create', 'edit', 'delete'];

/** Effective permissions of a role (old roles without a map keep full access to their pages). */
export function rolePermissions(role: Pick<Role, 'pages' | 'permissions'>): PermissionMap {
  const map: PermissionMap = {};
  const has = role.permissions && Object.keys(role.permissions).length > 0;
  for (const row of PERMISSION_ROWS) {
    if (has) {
      // Old roles stored Finance as one entry: it applies to both tabs.
      const acts = role.permissions?.[row.key] ?? (row.key.includes('#') ? role.permissions?.[row.page] : undefined);
      if (acts?.includes('view')) map[row.key] = ALL_ACTIONS.filter((a) => acts.includes(a));
    } else if (role.pages.includes(row.page)) {
      map[row.key] = [...ALL_ACTIONS];
    }
  }
  return map;
}

export const DEFAULT_ROLE_NAME = 'Business Operator';

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'ROLE-001',
    name: DEFAULT_ROLE_NAME,
    pages: PAGE_OPTIONS.map((p) => p.href),
    permissions: Object.fromEntries(PERMISSION_ROWS.map((r) => [r.key, [...ALL_ACTIONS]])),
  },
];

export function readRoles(): Role[] {
  try {
    const raw = localStorage.getItem(ROLES_KEY);
    if (!raw) return DEFAULT_ROLES;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed as Role[];
  } catch (error) {
    console.error('Could not read saved roles.', error);
  }
  return DEFAULT_ROLES;
}

export function saveRoles(roles: Role[]): void {
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
}

/** Pages the signed-in person may open. Admin: everything. */
export function getAllowedPages(session: DemoSession | null): string[] {
  const all = ['/dashboard', ...PAGE_OPTIONS.map((p) => p.href), '/dashboard/reports', '/dashboard/users'];
  if (!session) return [];
  if (session.role === 'admin') return all;
  try {
    const member = readDemoTeams()
      .flatMap((t) => t.members)
      .find((m) => m.username.toLowerCase() === session.username.toLowerCase());
    if (!member && session.allowedPages?.length) return session.allowedPages;
    const roles = readRoles();
    const role = roles.find((r) => r.name === member?.role) ?? roles.find((r) => r.name === DEFAULT_ROLE_NAME) ?? DEFAULT_ROLES[0];
    const pages = role.pages.filter((h) => PAGE_OPTIONS.some((p) => p.href === h));
    // Overview only shows when at least one of its widgets is ticked for the role (and its page is allowed).
    const hasWidget = expandWidgets(role.widgets ?? WIDGET_OPTIONS.map((w) => w.key)).some((k) => {
      const w = WIDGET_OPTIONS.find((o) => o.key === k);
      return !!w && (!w.page || pages.includes(w.page));
    });
    return [...(hasWidget ? ['/dashboard'] : []), ...pages];
  } catch {
    return ['/dashboard', ...DEFAULT_ROLES[0].pages];
  }
}

function findRole(session: DemoSession | null): Role | null {
  if (!session || session.role !== 'member') return null;
  try {
    const member = readDemoTeams()
      .flatMap((t) => t.members)
      .find((m) => m.username.toLowerCase() === session.username.toLowerCase());
    const roles = readRoles();
    return roles.find((r) => r.name === member?.role) ?? roles.find((r) => r.name === DEFAULT_ROLE_NAME) ?? DEFAULT_ROLES[0];
  } catch {
    return DEFAULT_ROLES[0];
  }
}

function sessionNow(): DemoSession | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
}

/** Can the signed-in person do `action` on the page that owns `pathname`? Admin: always. */
export function canDo(href: string, action: Action): boolean {
  const session = sessionNow();
  if (!session) return false;
  if (session.role === 'admin') return true;
  const role = findRole(session);
  if (!role) return false;
  const perms = rolePermissions(role);
  if (perms[href]?.includes(action)) return true;
  // A page without a tab asks "any tab of it".
  return !href.includes('#') && Object.keys(perms).some((k) => k.startsWith(`${href}#`) && perms[k].includes(action));
}

/** Products page: may the signed-in person see manufacture cost / unit profit? (admin: always). */
export function canSeeProductField(field: 'cost' | 'profit'): boolean {
  const session = sessionNow();
  if (!session) return false;
  if (session.role === 'admin') return true;
  const role = findRole(session);
  return !(role?.widgets ?? []).includes(`hide-product-${field}`);
}

/** Overview widget keys the signed-in person may see (null = all; admin). */
export function getAllowedWidgets(): string[] | null {
  const session = sessionNow();
  if (!session || session.role === 'admin') return null;
  const role = findRole(session);
  if (!role) return [];
  const pages = getAllowedPages(session);
  const base = expandWidgets(role.widgets ?? WIDGET_OPTIONS.map((w) => w.key));
  return base.filter((k) => {
    const w = WIDGET_OPTIONS.find((o) => o.key === k);
    return !!w && (!w.page || pages.includes(w.page));
  });
}

export function getSessionAllowedPages(): string[] {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return getAllowedPages(raw ? (JSON.parse(raw) as DemoSession) : null);
  } catch {
    return [];
  }
}

export function isPathAllowed(pages: string[], pathname: string): boolean {
  if (pathname.startsWith('/dashboard/account')) return true;
  if (pathname === '/dashboard') return pages.includes('/dashboard');
  return pages.some((p) => p !== '/dashboard' && (pathname === p || pathname.startsWith(`${p}/`)));
}
