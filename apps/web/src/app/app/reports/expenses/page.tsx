'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ReportHeader,
  ReportFilter,
  ReportStat,
  ReportTable,
  ReportTd,
  ReportTh,
} from '@/components/reports/report-shell';
import { formatMoneyString, formatDate, formatDateTime, sumDecimals } from '@/lib/format';
import { Receipt, RefreshCw, Search } from 'lucide-react';

/** GET /finance/expenses -> { expenses: Expense[] } */
interface ExpenseRow {
  id: string;
  categoryId: string;
  branchId?: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  description: string;
  incurredAt: string;
  createdAt: string;
}

const ALL_CATEGORIES = '__all__';

export default function ExpensesReportPage() {
  const { activeBusiness } = useAuth();
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [search, setSearch] = useState('');

  const fetchReport = useCallback(async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);
    const [expenseRes, categoryRes] = await Promise.all([
      api.get<{ expenses: ExpenseRow[] }>('/finance/expenses'),
      api.get<{ categories: Array<{ id: string; name: string }> }>('/finance/expense-categories'),
    ]);

    if (expenseRes.error) {
      setError(expenseRes.error.message || 'Gagal memuat laporan beban.');
      setRows([]);
    } else {
      setRows(expenseRes.data?.expenses ?? []);
    }
    setCategories(categoryRes.error ? [] : categoryRes.data?.categories ?? []);
    setLoading(false);
  }, [activeBusiness]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Client-side narrowing of already-fetched rows is display-only.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryId !== ALL_CATEGORIES && row.categoryId !== categoryId) return false;
      if (!term) return true;
      return (
        row.description.toLowerCase().includes(term) || row.categoryId.toLowerCase().includes(term)
      );
    });
  }, [rows, categoryId, search]);

  // Subtotal of the rows the user is currently looking at, summed exactly. The
  // authoritative ledger total stays with the backend.
  const totalVisible = useMemo(
    () => sumDecimals(visible.map((row) => row.amount)),
    [visible]
  );

  if (loading && rows.length === 0) return <SkeletonPage />;

  const currency = activeBusiness?.baseCurrency || 'IDR';
  const money = (v: string) => formatMoneyString(v, { currency });
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      <ReportHeader title="Laporan Beban" endpoint="GET /finance/expenses" scope={<>{activeBusiness?.name}</>}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari keterangan"
            aria-label="Cari beban"
            className="h-9 w-full pl-8 sm:w-56"
          />
        </div>
        {categories.length > 0 && (
          <ReportFilter
            label="Filter kategori beban"
            value={categoryId}
            onChange={setCategoryId}
            className="w-full sm:w-48"
            options={[
              { value: ALL_CATEGORIES, label: 'Semua kategori' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        )}
        <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Segarkan
        </Button>
      </ReportHeader>

      {error ? (
        <ErrorState title="Laporan gagal dimuat" message={error} onRetry={fetchReport} />
      ) : (
        <>
          <section className="grid gap-6 sm:grid-cols-3">
            <ReportStat label="Jumlah catatan" value={visible.length} />
            <ReportStat label={`Total ${visible.length} baris tampil`} value={money(totalVisible)} />
          </section>

          {visible.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="Belum ada beban"
              description="Backend tidak mengembalikan catatan beban untuk filter yang dipilih."
            />
          ) : (
            <ReportTable>
              <thead>
                <tr>
                  <ReportTh>Tanggal</ReportTh>
                  <ReportTh>Keterangan</ReportTh>
                  <ReportTh>Kategori</ReportTh>
                  <ReportTh align="center">Metode</ReportTh>
                  <ReportTh align="right">Jumlah</ReportTh>
                  <ReportTh>Dicatat</ReportTh>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-white">
                    <ReportTd className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.incurredAt)}
                    </ReportTd>
                    <ReportTd className="font-medium text-slate-900">{row.description}</ReportTd>
                    <ReportTd className="text-xs text-muted-foreground">{categoryName(row.categoryId)}</ReportTd>
                    <ReportTd align="center" className="text-xs">{row.paymentMethod}</ReportTd>
                    <ReportTd align="right" numeric className="font-semibold">{money(row.amount)}</ReportTd>
                    <ReportTd className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </ReportTd>
                  </tr>
                ))}
              </tbody>
            </ReportTable>
          )}
        </>
      )}
    </div>
  );
}