'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ProductsPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Katalog Produk</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola daftar barang, harga jual, HPP, dan kategori — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="Katalog Produk Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Manajemen Produk & Kategori akan diimplementasikan penuh pada Phase 3."
      />
    </div>
  );
}
