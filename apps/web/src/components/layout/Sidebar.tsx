'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Users,
  Landmark,
  BarChart3,
  Sparkles,
  TrendingUp,
  CreditCard,
  Settings,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Kasir POS', href: '/app/pos', icon: ShoppingCart },
  { label: 'Produk', href: '/app/products', icon: Package },
  { label: 'Inventori', href: '/app/inventory', icon: Boxes },
  { label: 'Pembelian', href: '/app/purchases', icon: Truck },
  { label: 'Pemasok', href: '/app/suppliers', icon: Users },
  { label: 'Keuangan', href: '/app/finance', icon: Landmark },
  { label: 'Laporan', href: '/app/reports', icon: BarChart3 },
  { label: 'AI Insights', href: '/app/insights', icon: Sparkles, tag: 'AI' },
  { label: 'ML Forecast', href: '/app/forecast', icon: TrendingUp, tag: 'ML' },
  { label: 'Langganan', href: '/app/subscription', icon: CreditCard },
  { label: 'Pengaturan', href: '/app/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-64 border-r border-border bg-white h-screen sticky top-0 select-none">
      {/* Brand Logo Header */}
      <div className="flex h-14 items-center px-6 border-b border-border">
        <Link href="/app/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white font-black text-sm">
            P
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-slate-900 leading-none">
              PADUPOS
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              Business OS
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors',
                isActive
                  ? 'bg-slate-900 text-white font-semibold shadow-subtle'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-slate-400')} />
                <span>{item.label}</span>
              </div>
              {item.tag && (
                <span
                  className={cn(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {item.tag}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-border bg-slate-50/50">
        <p className="text-[11px] font-medium text-slate-400">
          PADUPOS Core Engine v1.0
        </p>
        <p className="text-[10px] text-slate-400">
          Global Multi-Tenant SaaS
        </p>
      </div>
    </aside>
  );
}
