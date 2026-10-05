'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Calculator } from 'lucide-react';

export default function ProfitLossPage() {
  const { activeBusiness } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<any>('/finance/profit-loss');
    if (res.error) setError(res.error.message || 'Failed to load P&L');
    else setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: string) => (parseFloat(n) || 0).toLocaleString('id-ID');
  const currency = activeBusiness?.baseCurrency || '$';

  if (loading && !data) return <SkeletonPage />;
  if (error) return <ErrorState title="Failed to Load P&L" message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Profit & Loss</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real P&L derived from backend • {activeBusiness?.name}</p>
        </div>
      </div>
      {data ? (
        <div className="space-y-3 max-w-2xl">
          <div className="flex justify-between py-2 border-b border-slate-100"><span>Revenue (net)</span><span className="tabular-nums">{currency} {fmt(data.revenue)}</span></div>
          <div className="flex justify-between py-2 border-b border-slate-100"><span>COGS</span><span className="tabular-nums">{currency} {fmt(data.cogs)}</span></div>
          <div className="flex justify-between py-2 border-b border-slate-100 font-medium"><span>Gross Profit</span><span className="tabular-nums">{currency} {fmt(data.grossProfit)}</span></div>
          <div className="flex justify-between py-2 border-b border-slate-100"><span>Operating Expenses</span><span className="tabular-nums">{currency} {fmt(data.operatingExpenses)}</span></div>
          <div className="flex justify-between py-2 font-medium"><span>Operating Profit</span><span className="tabular-nums">{currency} {fmt(data.operatingProfit)}</span></div>
        </div>
      ) : (
        <EmptyState icon={<Calculator className="h-6 w-6" />} title="No Data" description="No financial data available" />
      )}
    </div>
  );
}
