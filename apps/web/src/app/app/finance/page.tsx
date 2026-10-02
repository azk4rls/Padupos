'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Landmark } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function FinancePage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Keuangan &amp; Akuntansi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Laba Rugi, Neraca, Arus Kas, Neraca Saldo (Trial Balance), dan Jurnal Umum — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<Landmark className="h-6 w-6" />}
        title="Modul Keuangan Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Laporan keuangan double-entry otomatis akan diintegrasikan penuh pada Phase 6."
      />
    </div>
  );
}
