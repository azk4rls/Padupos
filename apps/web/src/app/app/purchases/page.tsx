'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ShoppingBag, RefreshCw } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import type { Purchase } from '@padupos/types';

export default function PurchasesPage() {
  const { activeBusiness, activeBranch } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<{ purchases: Purchase[] }>('/purchases');
    if (res.error) setError(res.error.message || 'Failed to load purchases');
    else setPurchases(res.data?.purchases || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (n: string) => {
    const v = parseFloat(n);
    if (isNaN(v)) return '0';
    return v.toLocaleString('id-ID');
  };
  const currency = activeBusiness?.baseCurrency || '$';

  if (loading && purchases.length === 0) return <SkeletonPage />;

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h1 className="text-xl font-bold text-slate-900">Purchases</h1>
        </div>
        <ErrorState title="Failed to Load Purchases" message={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Purchases</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Purchase history and receiving • {activeBusiness?.name}{activeBranch ? ` • ${activeBranch.name}` : ''}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5 mr-1', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>
      {purchases.length === 0 ? (
        <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title="No Purchases" description="No purchase records found" />
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left p-3 font-medium text-slate-900">Invoice</th>
                <th className="text-left p-3 font-medium text-slate-900">Date</th>
                <th className="text-right p-3 font-medium text-slate-900">Subtotal</th>
                <th className="text-right p-3 font-medium text-slate-900">Tax</th>
                <th className="text-right p-3 font-medium text-slate-900">Total</th>
                <th className="text-left p-3 font-medium text-slate-900">Type</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="p-3 font-medium text-slate-900">{p.invoiceNumber}</td>
                  <td className="p-3 text-slate-600">{new Date(p.purchasedAt).toLocaleDateString('id-ID')}</td>
                  <td className="p-3 text-right tabular-nums">{currency} {formatCurrency(p.subtotal)}</td>
                  <td className="p-3 text-right tabular-nums">{currency} {formatCurrency(p.taxAmount)}</td>
                  <td className="p-3 text-right tabular-nums font-medium">{currency} {formatCurrency(p.totalAmount)}</td>
                  <td className="p-3 text-slate-600">{p.isCredit ? 'Credit' : 'Cash'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
