'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import type { Receivable, Payable, Expense } from '@padupos/types';

export default function FinancePage() {
  const { activeBusiness } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pl, setPl] = useState<any>(null);
  const [cf, setCf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, payRes, expRes, plRes, cfRes] = await Promise.all([
        api.get<{ receivables: Receivable[] }>('/finance/receivables'),
        api.get<{ payables: Payable[] }>('/finance/payables'),
        api.get<{ expenses: Expense[] }>('/finance/expenses'),
        api.get<any>('/finance/profit-loss'),
        api.get<any>('/finance/cash-flow'),
      ]);
      if (recRes.error || payRes.error || expRes.error) {
        setError(recRes.error?.message || payRes.error?.message || expRes.error?.message || 'Failed to load finance data');
      } else {
        setReceivables(recRes.data?.receivables || []);
        setPayables(payRes.data?.payables || []);
        setExpenses(expRes.data?.expenses || []);
        if (plRes.data) setPl(plRes.data);
        if (cfRes.data) setCf(cfRes.data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n: string) => (parseFloat(n) || 0).toLocaleString('id-ID');
  const currency = activeBusiness?.baseCurrency || '$';

  if (loading && !pl) return <SkeletonPage />;
  if (error) return <ErrorState title="Failed to Load Finance" message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Finance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real financial data from backend • {activeBusiness?.name}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pl && (
          <>
            <div className="rounded-lg border border-slate-200 p-4 space-y-1">
              <p className="text-xs text-slate-600">Revenue (net)</p>
              <p className="text-lg font-semibold tabular-nums">{currency} {fmt(pl.revenue)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 space-y-1">
              <p className="text-xs text-slate-600">Gross Profit</p>
              <p className="text-lg font-semibold tabular-nums">{currency} {fmt(pl.grossProfit)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 space-y-1">
              <p className="text-xs text-slate-600">Operating Expenses</p>
              <p className="text-lg font-semibold tabular-nums">{currency} {fmt(pl.operatingExpenses)}</p>
            </div>
          </>
        )}
        {cf && (
          <div className="rounded-lg border border-slate-200 p-4 space-y-1">
            <p className="text-xs text-slate-600">Net Cash Flow</p>
            <p className="text-lg font-semibold tabular-nums">{currency} {fmt(cf.netCashFlow)}</p>
          </div>
        )}
        <div className="rounded-lg border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-600">Receivables</p>
          <p className="text-lg font-semibold tabular-nums">{currency} {fmt(receivables.reduce((s, r) => s + parseFloat(r.remainingAmount || '0'), 0).toString())}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-600">Payables</p>
          <p className="text-lg font-semibold tabular-nums">{currency} {fmt(payables.reduce((s, p) => s + parseFloat(p.remainingAmount || '0'), 0).toString())}</p>
        </div>
      </div>
    </div>
  );
}
