'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SuppliersPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Daftar Pemasok (Suppliers)</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola data vendor, kontak, dan riwayat pesanan pasokan — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="Modul Pemasok Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Manajemen data pemasok dan riwayat pasokan akan diimplementasikan penuh pada Phase 5."
      />
    </div>
  );
}
