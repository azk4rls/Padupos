'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ShoppingCart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PosPage() {
  const { activeBusiness, activeBranch } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kasir Point of Sale (POS)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Outlet: {activeBranch?.name || 'Utama'} — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<ShoppingCart className="h-6 w-6" />}
        title="Modul Kasir POS Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Modul Kasir POS Desktop & Mobile akan diimplementasikan penuh pada Phase 4."
      />
    </div>
  );
}
