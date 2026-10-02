'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Truck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PurchasesPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pembelian &amp; Pengadaan Barang</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Purchase orders, penerimaan barang ke gudang, dan pencatatan hutang dagang — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<Truck className="h-6 w-6" />}
        title="Modul Pembelian Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Manajemen pembelian dan penerimaan stok akan diimplementasikan penuh pada Phase 5."
      />
    </div>
  );
}
