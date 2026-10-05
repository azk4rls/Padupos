'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Clock } from 'lucide-react';

export default function PayablesPage() {
  const { activeBusiness } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<{ payables: any[] }>('/finance/payables');
    if (res.error) setError(res.error.message || 'Failed');
    else setItems(res.data?.payables || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: string) => (parseFloat(n) || 0).toLocaleString('id-ID');
  const currency = activeBusiness?.baseCurrency || '$';

  if (loading && items.length === 0) return <SkeletonPage />;
  if (error) return <ErrorState title="Failed" message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payables</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Outstanding payables • {activeBusiness?.name}</p>
        </div>
      </div>
      {items.length === 0 ? <EmptyState icon={<Clock className="h-6 w-6" />} title="No Payables" description="No outstanding payables" /> : (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left p-3">Supplier</th>
                <th className="text-left p-3">Purchase</th>
                <th className="text-right p-3">Original</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-right p-3">Remaining</th>
                <th className="text-left p-3">Due</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="p-3">{p.supplierId}</td>
                  <td className="p-3">{p.purchaseId}</td>
                  <td className="p-3 text-right tabular-nums">{currency} {fmt(p.originalAmount)}</td>
                  <td className="p-3 text-right tabular-nums">{currency} {fmt(p.paidAmount)}</td>
                  <td className="p-3 text-right tabular-nums">{currency} {fmt(p.remainingAmount)}</td>
                  <td className="p-3">{p.dueDate ? new Date(p.dueDate).toLocaleDateString('id-ID') : '-'}</td>
                  <td className="p-3">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
