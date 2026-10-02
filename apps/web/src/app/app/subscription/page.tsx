'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SubscriptionPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Langganan &amp; Paket Layanan</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola paket Free, Pro, Business, dan kuota outlet — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<CreditCard className="h-6 w-6" />}
        title="Modul Langganan Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Manajemen paket langganan dan kuota fitur akan diimplementasikan penuh pada Phase 10."
      />
    </div>
  );
}
