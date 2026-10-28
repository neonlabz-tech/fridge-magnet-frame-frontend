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
  { href: '/dashboard/finance', label: 'Finance' },
];

export interface Role {
  id: string;
  name: string;
  pages: string[]; // hrefs
}

export const DEFAULT_ROLE_NAME = 'Business Operator';

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'ROLE-001',
    name: DEFAULT_ROLE_NAME,
    pages: PAGE_OPTIONS.map((p) => p.href),
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
    return ['/dashboard', ...role.pages.filter((h) => PAGE_OPTIONS.some((p) => p.href === h))];
  } catch {
    return ['/dashboard', ...DEFAULT_ROLES[0].pages];
  }
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
