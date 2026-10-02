'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Drawer } from '@/components/ui/drawer';
import { NAV_ITEMS } from './Sidebar';
import { cn } from '@/components/ui/utils';
import { useAuth } from '@/context/AuthContext';
import { LogOut } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const { user, activeBusiness, logout } = useAuth();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      position="left"
      title={
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-900 text-white font-black text-xs">
            P
          </div>
          <span className="font-bold text-sm text-slate-900">PADUPOS</span>
        </div>
      }
    >
      <div className="flex flex-col h-full justify-between pb-6">
        <div className="space-y-4">
          {/* Active Business Banner */}
          <div className="bg-slate-50 p-3 rounded border border-border">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bisnis Aktif</p>
            <p className="text-xs font-semibold text-slate-800 truncate">{activeBusiness?.name || 'Belum ada bisnis'}</p>
            <p className="text-[10px] text-muted-foreground">{user?.email}</p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/app/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-slate-400')} />
                    <span>{item.label}</span>
                  </div>
                  {item.tag && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-100 text-slate-500">
                      {item.tag}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout */}
        <div className="pt-4 border-t border-border mt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
          >
            <LogOut className="h-4 w-4" />
            Keluar (Logout)
          </button>
        </div>
      </div>
    </Drawer>
  );
}
