'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Scale } from 'lucide-react';

export default function TrialBalancePage() {
  const { activeBusiness } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<any>('/accounting/trial-balance');
    if (res.error) setError(res.error.message || 'Failed to load trial balance');
    else setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: string) => (parseFloat(n) || 0).toLocaleString('id-ID');

  if (loading && !data) return <SkeletonPage />;
  if (error) return <ErrorState title="Failed" message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trial Balance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real trial balance from backend • {activeBusiness?.name}</p>
        </div>
      </div>
      {data?.accounts?.length ? (
        <>
          <div className="text-sm">{data.isBalanced ? 'Balanced' : 'Not Balanced'} • Diff: {fmt(data.difference)}</div>
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Account</th>
                  <th className="text-right p-3">Debit</th>
                  <th className="text-right p-3">Credit</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="p-3">{a.code}</td>
                    <td className="p-3">{a.name}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(a.debit)}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(a.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-medium">
                  <td className="p-3" colSpan={2}>Totals</td>
                  <td className="p-3 text-right tabular-nums">{fmt(data.totalDebits)}</td>
                  <td className="p-3 text-right tabular-nums">{fmt(data.totalCredits)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : <EmptyState icon={<Scale className="h-6 w-6" />} title="No Data" description="No trial balance data" />}
    </div>
  );
}
