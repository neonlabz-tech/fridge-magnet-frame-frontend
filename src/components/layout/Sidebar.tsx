'use client';

import {
  Package,
  ShoppingCart,
  Users,
  UserCog,
  LogOut,
} from 'lucide-react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Products', icon: Package, href: '/dashboard/products' },
  { label: 'Orders', icon: ShoppingCart, href: '/dashboard/orders' },
  { label: 'Customers', icon: Users, href: '/dashboard/customers' },
  { label: 'Account', icon: UserCog, href: '/dashboard/account' },
] as const;

export default function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    document.cookie =
      'adminToken=; path=/; max-age=0; samesite=lax';
    document.cookie =
      'token=; path=/; max-age=0; samesite=lax';

    onClose?.();
    router.replace('/login');
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex flex-col bg-[#071C40] transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
      style={{
        width: 252,
        height: '100vh',
        borderRight: '1px solid #F1F5F9',
      }}
    >
      {/* Logo */}
      <div
        className="flex flex-shrink-0 items-left justify-left"
        style={{
          height: 89,
          // borderBottom: '1px solid #F1F5F9',
          padding: '0 24px',
        }}
      >
        <Link href="/dashboard/products" className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#F8FAFC] p-1.5 ring-1 ring-slate-200/60">
            <Image
              src="/logo.png"
              alt="Magnify"
              width={44}
              height={44}
              priority
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="truncate text-lg font-bold tracking-tight text-white">
              Magnify
            </p>

            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Admin Panel
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 pt-[25px]">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const isActive =
            pathname === href ||
            pathname.startsWith(href + '/');

          return (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              className={`group mx-3 flex items-center gap-3 rounded-lg px-5 py-3 transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-white hover:bg-[#2563EB] hover:text-white'
              }`}
              style={{
                background: isActive
                  ? '#2563EB'
                  : 'transparent',
              }}
            >
              <Icon
                size={20}
                className={`flex-shrink-0 transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-white group-hover:text-[#2563EB]'
                }`}
              />

              <span
                className={`text-[14px] transition-colors ${
                  isActive
                    ? 'font-semibold text-white'
                    : 'font-medium text-white group-hover:text-[#2563EB]'
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
          className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-[#D83223] hover:bg-[#D83223]/10"
        >
          <LogOut
            size={18}
            className="flex-shrink-0 text-white transition-colors group-hover:text-[#D83223]"
          />

          <span className="text-[14px] font-semibold text-white transition-colors group-hover:text-[#D83223]">
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
