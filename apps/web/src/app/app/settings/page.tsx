'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { activeBusiness, activeBranch } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pengaturan Bisnis &amp; Sistem</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Konfigurasi profil usaha, pajak, struk belanja, integrasi pembayaran, dan izin staf — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<Settings className="h-6 w-6" />}
        title="Modul Pengaturan Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Konfigurasi komprehensif profil bisnis dan perangkat akan diimplementasikan penuh pada Phase 2 &amp; Phase 10."
      />
    </div>
  );
}
