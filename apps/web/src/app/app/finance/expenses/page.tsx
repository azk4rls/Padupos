'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Receipt } from 'lucide-react';

export default function ExpensesPage() {
  const { activeBusiness } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<{ expenses: any[] }>('/finance/expenses');
    if (res.error) setError(res.error.message || 'Failed');
    else setItems(res.data?.expenses || []);
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
          <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Expense records • {activeBusiness?.name}</p>
        </div>
      </div>
      {items.length === 0 ? <EmptyState icon={<Receipt className="h-6 w-6" />} title="No Expenses" description="No expenses recorded" /> : (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Description</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Category</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="p-3">{new Date(e.incurredAt).toLocaleDateString('id-ID')}</td>
                  <td className="p-3">{e.description}</td>
                  <td className="p-3 text-right tabular-nums">{currency} {fmt(e.amount)}</td>
                  <td className="p-3">{e.paymentMethod}</td>
                  <td className="p-3">{e.categoryId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
