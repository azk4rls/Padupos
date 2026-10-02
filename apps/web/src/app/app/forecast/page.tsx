'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { TrendingUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function ForecastPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Machine Learning Sales Forecasting</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prediksi tren penjualan masa depan dengan Ridge Regression &amp; interval ketidakpastian — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<TrendingUp className="h-6 w-6 text-blue-600" />}
        title="Modul ML Forecasting Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Model peramalan penjualan dengan gerbang data 30 hari akan diimplementasikan penuh pada Phase 8."
      />
    </div>
  );
}
