'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Boxes } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function InventoryPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Inventori &amp; Stok</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kartu stok, mutasi barang, stock opname, dan peringatan batas minimum — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<Boxes className="h-6 w-6" />}
        title="Modul Inventori Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Pelacakan stok riil dan mutasi inventori akan diimplementasikan penuh pada Phase 5."
      />
    </div>
  );
}
