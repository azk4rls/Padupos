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
import { formatMoneyString, formatDate, sumDecimals } from '@/lib/format';
import { HandCoins, RefreshCw, Search } from 'lucide-react';

/** GET /finance/receivables -> { receivables: Receivable[] } */
interface ReceivableRow {
  id: string;
  customerId: string;
  saleId: string;
  originalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  dueDate: string;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Terbuka',
  PARTIAL: 'Sebagian',
  PAID: 'Lunas',
  OVERDUE: 'Jatuh tempo',
  CANCELLED: 'Dibatalkan',
};

const STATUS_TONE: Record<string, string> = {
  OPEN: 'text-slate-700',
  PARTIAL: 'text-slate-700',
  PAID: 'text-emerald-700',
  OVERDUE: 'text-rose-700',
  CANCELLED: 'text-muted-foreground',
};

const ALL_STATUS = '__all__';

export default function ReceivablesReportPage() {
  const { activeBusiness } = useAuth();
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(ALL_STATUS);
  const [search, setSearch] = useState('');

  const fetchReport = useCallback(async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);
    const res = await api.get<{ receivables: ReceivableRow[] }>('/finance/receivables');
    if (res.error) {
      setError(res.error.message || 'Gagal memuat laporan piutang.');
      setRows([]);
    } else {
      setRows(res.data?.receivables ?? []);
    }
    setLoading(false);
  }, [activeBusiness]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== ALL_STATUS && row.status !== status) return false;
      if (!term) return true;
      return row.customerId.toLowerCase().includes(term) || row.saleId.toLowerCase().includes(term);
    });
  }, [rows, status, search]);

  const outstanding = useMemo(
    () =>
      sumDecimals(
        visible
          .filter((r) => r.status !== 'PAID' && r.status !== 'CANCELLED')
          .map((r) => r.remainingAmount)
      ),
    [visible]
  );

  if (loading && rows.length === 0) return <SkeletonPage />;

  const currency = activeBusiness?.baseCurrency || 'IDR';
  const money = (v: string) => formatMoneyString(v, { currency });
  const statuses = Array.from(new Set(rows.map((r) => r.status)));

  return (
    <div className="space-y-8">
      <ReportHeader title="Laporan Piutang" endpoint="GET /finance/receivables" scope={<>{activeBusiness?.name}</>}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pelanggan / penjualan"
            aria-label="Cari piutang"
            className="h-9 w-full pl-8 sm:w-56"
          />
        </div>
        <ReportFilter
          label="Filter status piutang"
          value={status}
          onChange={setStatus}
          className="w-full sm:w-44"
          options={[
            { value: ALL_STATUS, label: 'Semua status' },
            ...statuses.map((s) => ({ value: s, label: STATUS_LABELS[s] || s })),
          ]}
        />
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
            <ReportStat label="Jumlah tagihan" value={visible.length} />
            <ReportStat label="Sisa belum lunas" value={money(outstanding)} />
            <ReportStat
              label="Lewat jatuh tempo"
              value={visible.filter((r) => r.status === 'OVERDUE').length}
              tone={visible.some((r) => r.status === 'OVERDUE') ? 'negative' : 'neutral'}
            />
          </section>

          {visible.length === 0 ? (
            <EmptyState
              icon={<HandCoins className="h-6 w-6" />}
              title="Belum ada piutang"
              description="Backend tidak mengembalikan tagihan pelanggan untuk filter yang dipilih."
            />
          ) : (
            <ReportTable>
              <thead>
                <tr>
                  <ReportTh>Pelanggan</ReportTh>
                  <ReportTh>Penjualan</ReportTh>
                  <ReportTh>Jatuh tempo</ReportTh>
                  <ReportTh align="right">Nilai awal</ReportTh>
                  <ReportTh align="right">Dibayar</ReportTh>
                  <ReportTh align="right">Sisa</ReportTh>
                  <ReportTh align="center">Status</ReportTh>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-white">
                    <ReportTd className="font-mono text-xs">{row.customerId}</ReportTd>
                    <ReportTd className="font-mono text-xs text-muted-foreground">{row.saleId}</ReportTd>
                    <ReportTd className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.dueDate)}
                    </ReportTd>
                    <ReportTd align="right" numeric>{money(row.originalAmount)}</ReportTd>
                    <ReportTd align="right" numeric>{money(row.paidAmount)}</ReportTd>
                    <ReportTd align="right" numeric className="font-semibold">{money(row.remainingAmount)}</ReportTd>
                    <ReportTd align="center" className={`text-xs ${STATUS_TONE[row.status] ?? 'text-slate-700'}`}>
                      {STATUS_LABELS[row.status] || row.status}
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