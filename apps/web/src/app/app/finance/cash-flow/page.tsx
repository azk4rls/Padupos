'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';

export default function CashFlowPage() {
  const { activeBusiness } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<any>('/finance/cash-flow');
    if (res.error) setError(res.error.message || 'Failed to load cash flow');
    else setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: string) => (parseFloat(n) || 0).toLocaleString('id-ID');
  const currency = activeBusiness?.baseCurrency || '$';

  if (loading && !data) return <SkeletonPage />;
  if (error) return <ErrorState title="Failed" message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cash Flow</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real cash in/out from backend • {activeBusiness?.name}</p>
        </div>
      </div>
      {data ? (
        <div className="space-y-3 max-w-2xl">
          <div className="font-medium text-sm mt-2">Inflows</div>
          <div className="flex justify-between py-2 border-b border-slate-100"><span>Sales Receipts</span><span className="tabular-nums">{currency} {fmt(data.inflows?.salesReceipts)}</span></div>
          <div className="flex justify-between py-2 border-b border-slate-100"><span>Total Inflow</span><span className="tabular-nums">{currency} {fmt(data.inflows?.totalInflow)}</span></div>
          <div className="font-medium text-sm mt-4">Outflows</div>
          <div className="flex justify-between py-2 border-b border-slate-100"><span>Operating Expenses</span><span className="tabular-nums">{currency} {fmt(data.outflows?.operatingExpenses)}</span></div>
          <div className="flex justify-between py-2 border-b border-slate-100"><span>Supplier Disbursements</span><span className="tabular-nums">{currency} {fmt(data.outflows?.supplierDisbursements)}</span></div>
          <div className="flex justify-between py-2 border-b border-slate-100"><span>Total Outflow</span><span className="tabular-nums">{currency} {fmt(data.outflows?.totalOutflow)}</span></div>
          <div className="flex justify-between py-2 font-medium mt-2"><span>Net Cash Flow</span><span className="tabular-nums">{currency} {fmt(data.netCashFlow)}</span></div>
        </div>
      ) : <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="No Data" description="No cash flow data" />}
    </div>
  );
}
