'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Store,
  MapPin,
  Wifi,
  WifiOff,
  User,
  LogOut,
  ChevronDown,
  Menu,
} from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { user, activeBusiness, businesses, setActiveBusiness, activeBranch, branches, setActiveBranch, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [showBizMenu, setShowBizMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-white px-4 sm:px-6">
      {/* Left: Mobile Menu Toggle & Business/Branch Switcher */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="md:hidden rounded p-1.5 text-slate-600 hover:bg-slate-100 focus:outline-none"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Business Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowBizMenu(!showBizMenu)}
            className="flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition-colors border border-transparent hover:border-border"
          >
            <Store className="h-4 w-4 text-slate-500" />
            <span className="max-w-[140px] sm:max-w-[200px] truncate">
              {activeBusiness?.name || 'Pilih Bisnis'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showBizMenu && (
            <div className="absolute left-0 mt-1 w-56 rounded-md border border-border bg-white p-1 shadow-lg z-50">
              <div className="px-2 py-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Bisnis Aktif
              </div>
              {businesses.map((biz) => (
                <button
                  key={biz.id}
                  onClick={() => {
                    setActiveBusiness(biz);
                    setShowBizMenu(false);
                  }}
                  className={`flex w-full items-center justify-between px-2.5 py-2 text-xs font-medium rounded hover:bg-slate-100 ${
                    biz.id === activeBusiness?.id ? 'bg-slate-50 text-accent font-semibold' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{biz.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{biz.baseCurrency}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Branch / Outlet Indicator */}
        {activeBranch && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-50 px-2 py-1 rounded border border-border">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-700">{activeBranch.name}</span>
          </div>
        )}
      </div>

      {/* Right: Network Status, User Menu & Logout */}
      <div className="flex items-center gap-3">
        {/* Network & Offline Status */}
        <div className="flex items-center">
          {isOnline ? (
            <Badge variant="success" className="gap-1 text-[11px] py-0.5">
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">Online</span>
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1 text-[11px] py-0.5">
              <WifiOff className="h-3 w-3" />
              <span>Offline (PWA)</span>
            </Badge>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-full p-1 sm:px-2 sm:py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-xs">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="hidden md:inline max-w-[120px] truncate">{user?.email || 'Owner'}</span>
            <ChevronDown className="hidden sm:inline h-3.5 w-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-1 w-48 rounded-md border border-border bg-white p-1 shadow-lg z-50">
              <div className="px-3 py-2 border-b border-border/60">
                <p className="text-xs font-semibold text-slate-900 truncate">{user?.email || 'User'}</p>
                <p className="text-[10px] text-muted-foreground">{user?.id}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded mt-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar (Logout)
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
