'use client';

import {
  BarChart3,
  Banknote,
  LayoutDashboard,
  ListChecks,
  Package,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Warehouse,
} from 'lucide-react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DEMO_SESSION_KEY, type DemoSession } from '@/lib/demoAuth';
import { getAllowedPages } from '@/lib/roles';
import { useEffect, useState } from 'react';

const BASE_NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Orders', icon: ShoppingCart, href: '/dashboard/orders' },
  { label: 'Customers', icon: Users, href: '/dashboard/customers' },
  { label: 'Products', icon: Package, href: '/dashboard/products' },
  { label: 'Inventory', icon: Warehouse, href: '/dashboard/inventory' },
  { label: 'Delivery', icon: Truck, href: '/dashboard/deliveries' },
  { label: 'Leads & Followups', icon: ListChecks, href: '/dashboard/leads' },
  { label: 'Finance', icon: Banknote, href: '/dashboard/finance' },
] as const;

const ADMIN_NAV_ITEMS = [
  { label: 'Reports', icon: BarChart3, href: '/dashboard/reports' },
  { label: 'User Management', icon: UserCog, href: '/dashboard/users' },
] as const;

export default function Sidebar({
  open = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  open?: boolean;
  onClose?: () => void;
  /** Desktop only: icons-only mode */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<DemoSession | null>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem(DEMO_SESSION_KEY);
    if (!savedSession) return;
    try {
      setSession(JSON.parse(savedSession) as DemoSession);
    } catch (error) {
      console.error('Could not read the signed-in demo account.', error);
    }
  }, []);

  // Re-render when members/roles are refreshed from the backend (page access may change).
  useEffect(() => {
    const bump = () => setSession((s) => (s ? { ...s } : s));
    window.addEventListener('magnify-team-updated', bump);
    return () => window.removeEventListener('magnify-team-updated', bump);
  }, []);

  const allowed = getAllowedPages(session);
  const navItems = [...BASE_NAV_ITEMS, ...ADMIN_NAV_ITEMS].filter((item) => allowed.includes(item.href));
  const baseCount = navItems.filter((item) => BASE_NAV_ITEMS.some((b) => b.href === item.href)).length;

  const handleLogout = () => {
    localStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    document.cookie =
      'adminToken=; path=/; max-age=0; samesite=lax';
    document.cookie =
      'token=; path=/; max-age=0; samesite=lax';
    document.cookie = 'demoAuth=; path=/; max-age=0; samesite=lax';

    onClose?.();
    router.replace('/login');
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex flex-col transition-[transform,width] duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 w-[252px] ${collapsed ? 'lg:w-[76px]' : 'lg:w-[252px]'}`}
      style={{
        height: '100vh',
        background: 'linear-gradient(180deg, #0B2F8F 0%, #071C40 55%, #05142F 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div
        className={`flex flex-shrink-0 items-center justify-start ${collapsed ? 'lg:justify-center' : ''}`}
        style={{
          height: 64,
          padding: collapsed ? undefined : '0 20px',
        }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5" title="Magnify - Overview">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F8FAFC] p-1 ring-1 ring-slate-200/60">
            <Image
              src="/logo.png"
              alt="Magnify"
              width={34}
              height={34}
              priority
              className="h-full w-full object-contain"
            />
          </div>

          <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="truncate text-base font-bold tracking-tight text-white leading-tight">
              Magnify
            </p>

            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.25em] text-slate-400">
              Admin Panel
            </p>
          </div>
        </Link>
      </div>

      {/* Collapse toggle (desktop) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-[20px] z-50 hidden size-6 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0B3CB0] shadow-md transition hover:bg-[#0B3CB0] hover:text-white lg:flex"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 pt-[25px]">
        {[...navItems.slice(0, baseCount), ...(navItems.length > baseCount ? [null] : []), ...navItems.slice(baseCount)].map((item) => {
          if (!item) {
            return (
              <p
                key="admin-heading"
                className={`mx-3 px-5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 ${collapsed ? 'lg:hidden' : ''}`}
              >
                {session?.role === 'admin' ? 'Admin' : 'My account'}
              </p>
            );
          }

          const { label, icon: Icon, href } = item;
          const isActive =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === href || pathname.startsWith(href + '/');

          return (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              title={label}
              className={`group mx-3 flex items-center gap-3 rounded-lg px-5 py-3 transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                isActive
                  ? 'text-white'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
              style={{
                background: isActive
                  ? 'linear-gradient(90deg, #1448C8 0%, #0B3CB0 100%)'
                  : 'transparent',
                boxShadow: isActive ? 'inset 3px 0 0 #F03020' : 'none',
              }}
            >
              <Icon
                size={20}
                className={`flex-shrink-0 transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-white/80 group-hover:text-white'
                }`}
              />

              <span
                className={`text-[14px] transition-colors ${collapsed ? 'lg:hidden' : ''} ${
                  isActive
                    ? 'font-semibold text-white'
                    : 'font-medium text-white/80 group-hover:text-white'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-4 py-4">
        <button
          onClick={handleLogout}
          title="Logout"
          className={`group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-[#D83223] hover:bg-[#D83223]/10 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
        >
          <LogOut
            size={18}
            className="flex-shrink-0 text-white transition-colors group-hover:text-[#D83223]"
          />

          <span className={`text-[14px] font-semibold text-white transition-colors group-hover:text-[#D83223] ${collapsed ? 'lg:hidden' : ''}`}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
