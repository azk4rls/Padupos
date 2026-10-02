'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ReportsPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Laporan Bisnis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Laporan penjualan, analisis produk, perputaran stok, dan rekap kasir — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title="Modul Laporan Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Filter rentang tanggal dan ekspor data akan diimplementasikan penuh pada Phase 7."
      />
    </div>
  );
}
