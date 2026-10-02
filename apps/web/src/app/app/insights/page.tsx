'use client';

import React from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function InsightsPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">AI Business Insights</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analisis berbasis data nyata untuk rekomendasi operasional dan mitigasi risiko — {activeBusiness?.name}
          </p>
        </div>
      </div>

      <EmptyState
        icon={<Sparkles className="h-6 w-6 text-amber-500" />}
        title="Modul AI Insights Siap Diintegrasikan"
        description="Pondasi aplikasi Phase 1 aktif. Insight bisnis grounded tanpa dummy data akan diimplementasikan penuh pada Phase 8."
      />
    </div>
  );
}
