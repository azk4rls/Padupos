'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui/utils';
import { ShoppingCart, LayoutDashboard, Package, Menu } from 'lucide-react';

interface MobileNavProps {
  onOpenMenu: () => void;
}

export function MobileNav({ onOpenMenu }: MobileNavProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Kasir', href: '/app/pos', icon: ShoppingCart },
    { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Produk', href: '/app/products', icon: Package },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-white px-2 shadow-lg">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center w-16 py-1 text-[10px] font-medium transition-colors',
              isActive ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
            )}
          >
            <Icon className={cn('h-5 w-5 mb-0.5', isActive ? 'text-slate-900' : 'text-slate-400')} />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center w-16 py-1 text-[10px] font-medium text-slate-500 hover:text-slate-900"
      >
        <Menu className="h-5 w-5 mb-0.5 text-slate-400" />
        <span>Menu</span>
      </button>
    </nav>
  );
}
