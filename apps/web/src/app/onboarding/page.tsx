'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Store, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-2xl mb-1 shadow-sm">
            P
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Setup Bisnis PADUPOS</h1>
          <p className="text-xs text-muted-foreground">
            Langkah awal inisialisasi negara, mata uang, dan outlet pertama Anda
          </p>
        </div>

        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title="Onboarding Siap Diimplementasikan"
          description="Pondasi aplikasi Phase 1 aktif. Form inisialisasi bisnis lengkap dengan multi-negara dan konfigurasi fiskal akan diimplementasikan pada Phase 2."
          actionLabel="Lanjut ke Dashboard Demo"
          onAction={() => router.push('/app/dashboard')}
        />
      </div>
    </div>
  );
}
