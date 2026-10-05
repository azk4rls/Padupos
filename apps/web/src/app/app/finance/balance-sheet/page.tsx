'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Scale } from 'lucide-react';

export default function BalanceSheetPage() {
  const { activeBusiness } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<any>('/finance/balance-sheet');
    if (res.error) setError(res.error.message || 'Failed to load balance sheet');
    else setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n: string) => (parseFloat(n) || 0).toLocaleString('id-ID');
  const currency = activeBusiness?.baseCurrency || '$';

  if (loading && !data) return <SkeletonPage />;
  if (error) return <ErrorState title="Failed to Load Balance Sheet" message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Balance Sheet</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real balance sheet from backend • {activeBusiness?.name}</p>
        </div>
      </div>
      {data && (
        <div className="space-y-6 max-w-3xl">
          <div>
            <h2 className="font-medium mb-2">Assets</h2>
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left p-3">Account</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assets?.map((a: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="p-3">{a.code} - {a.name}</td>
                      <td className="p-3 text-right tabular-nums">{currency} {fmt(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-medium">
                    <td className="p-3">Total Assets</td>
                    <td className="p-3 text-right tabular-nums">{currency} {fmt(data.totals?.assets || '0')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 className="font-medium mb-2">Liabilities</h2>
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left p-3">Account</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.liabilities?.map((l: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="p-3">{l.code} - {l.name}</td>
                      <td className="p-3 text-right tabular-nums">{currency} {fmt(l.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-medium">
                    <td className="p-3">Total Liabilities</td>
                    <td className="p-3 text-right tabular-nums">{currency} {fmt(data.totals?.liabilities || '0')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 className="font-medium mb-2">Equity</h2>
            <div className="overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left p-3">Account</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.equity?.map((e: any, i: number) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="p-3">{e.code} - {e.name}</td>
                      <td className="p-3 text-right tabular-nums">{currency} {fmt(e.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-medium">
                    <td className="p-3">Total Equity</td>
                    <td className="p-3 text-right tabular-nums">{currency} {fmt(data.totals?.equity || '0')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            {data.balanceCheck?.balanced ? 'Balanced (Assets = Liabilities + Equity)' : 'Not balanced'} • Diff: {fmt(data.balanceCheck?.difference || '0')}
          </div>
        </div>
      )}
      {data && !data.assets?.length && !data.liabilities?.length && !data.equity?.length && (
        <EmptyState icon={<Scale className="h-6 w-6" />} title="No Data" description="No balance sheet data for this period" />
      )}
    </div>
  );
}
