'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
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
import { formatMoneyString, formatDateTime } from '@/lib/format';
import { buildQuery } from '@/lib/query';
import {
  type DateRangeState,
  defaultDateRangeState,
  toQuery,
  validateCustomRange,
} from '@/lib/dateRange';
import { DateRangeFilter } from '@/components/reports/date-range-filter';
import { ExportButton } from '@/components/reports/export-button';
import { FileText, RefreshCw } from 'lucide-react';

/** GET /reports/sales -> { summary, sales } */
interface SalesReportResponse {
  summary: {
    totalRevenue: string;
    totalCogs: string;
    grossProfit: string;
    grossMarginPercentage: string;
    totalDiscount: string;
    totalTax: string;
    transactionCount: number;
  };
  sales: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    subtotal: string;
    discountAmount: string;
    taxAmount: string;
    totalAmount: string;
    cogsAmount: string;
    grossProfitAmount: string;
    currency: string;
    createdAt: string;
  }>;
}

const ALL_BRANCHES = '__all__';

export default function SalesReportPage() {
  const { activeBusiness, activeBranch } = useAuth();
  const [data, setData] = useState<SalesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The endpoint accepts a branch scope and an explicit period; nothing else.
  const [branchId, setBranchId] = useState<string>(ALL_BRANCHES);
  const [range, setRange] = useState<DateRangeState>(defaultDateRangeState);

  const window = toQuery(range);
  const rangeIsValid =
    range.preset !== 'custom' || validateCustomRange(range.startDate, range.endDate) === null;

  const fetchReport = useCallback(async () => {
    if (!activeBusiness || !rangeIsValid) return;
    setLoading(true);
    setError(null);
    const res = await api.get<SalesReportResponse>(
      `/reports/sales${buildQuery({
        branchId: branchId === ALL_BRANCHES ? undefined : branchId,
        startDate: window.startDate,
        endDate: window.endDate,
      })}`
    );
    if (res.error) {
      setError(res.error.message || 'Gagal memuat laporan penjualan.');
      setData(null);
    } else {
      setData(res.data ?? null);
    }
    setLoading(false);
  }, [activeBusiness, branchId, rangeIsValid, window.startDate, window.endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading && !data) return <SkeletonPage />;

  const currency = activeBusiness?.baseCurrency || 'IDR';
  const money = (v: string | undefined) => formatMoneyString(v, { currency });

  const toolbar = (
    <>
      {activeBranch && (
        <ReportFilter
          label="Filter outlet"
          value={branchId}
          onChange={setBranchId}
          className="w-full sm:w-44"
          options={[
            { value: ALL_BRANCHES, label: 'Semua Outlet' },
            { value: activeBranch.id, label: activeBranch.name },
          ]}
        />
      )}
      <DateRangeFilter value={range} onChange={setRange} />
      <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Segarkan
      </Button>
      <ExportButton reportType="SALES" range={window} className="shrink-0" />
    </>
  );

  if (error) {
    return (
      <div className="space-y-6">
        <ReportHeader title="Laporan Penjualan" endpoint="GET /reports/sales" />
        <ErrorState title="Laporan gagal dimuat" message={error} onRetry={fetchReport} />
      </div>
    );
  }

  const rows = data?.sales ?? [];

  return (
    <div className="space-y-8">
      <ReportHeader
        title="Laporan Penjualan"
        endpoint="GET /reports/sales"
        scope={
          <>
            {activeBusiness?.name} ·{' '}
            {branchId === ALL_BRANCHES ? 'Semua Outlet' : activeBranch?.name ?? branchId}
          </>
        }
      >
        {toolbar}
      </ReportHeader>

      {data && (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <ReportStat label="Total pendapatan" value={money(data.summary.totalRevenue)} />
          <ReportStat label="Harga pokok penjualan" value={money(data.summary.totalCogs)} />
          <ReportStat
            label="Laba kotor"
            value={money(data.summary.grossProfit)}
            tone={Number(data.summary.grossProfit) >= 0 ? 'positive' : 'negative'}
          />
          <ReportStat label="Margin kotor" value={`${data.summary.grossMarginPercentage}%`} />
        </section>
      )}

      {data && (
        <dl className="grid gap-6 border-y border-border py-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Transaksi</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
              {data.summary.transactionCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total diskon</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
              {money(data.summary.totalDiscount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Total pajak</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
              {money(data.summary.totalTax)}
            </dd>
          </div>
        </dl>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Tidak ada transaksi"
          description="Backend tidak mengembalikan transaksi penjualan untuk filter outlet yang dipilih."
        />
      ) : (
        <ReportTable>
          <thead>
            <tr>
              <ReportTh>Invoice</ReportTh>
              <ReportTh>Tanggal</ReportTh>
              <ReportTh align="right">Subtotal</ReportTh>
              <ReportTh align="right">Diskon</ReportTh>
              <ReportTh align="right">Pajak</ReportTh>
              <ReportTh align="right">Total</ReportTh>
              <ReportTh align="right">HPP</ReportTh>
              <ReportTh align="right">Laba kotor</ReportTh>
              <ReportTh align="center">Status</ReportTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((sale) => (
              <tr key={sale.id} className="transition-colors hover:bg-white">
                <ReportTd className="font-mono text-xs">{sale.invoiceNumber}</ReportTd>
                <ReportTd className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(sale.createdAt)}
                </ReportTd>
                <ReportTd align="right" numeric>{money(sale.subtotal)}</ReportTd>
                <ReportTd align="right" numeric>{money(sale.discountAmount)}</ReportTd>
                <ReportTd align="right" numeric>{money(sale.taxAmount)}</ReportTd>
                <ReportTd align="right" numeric className="font-semibold">{money(sale.totalAmount)}</ReportTd>
                <ReportTd align="right" numeric>{money(sale.cogsAmount)}</ReportTd>
                <ReportTd align="right" numeric>{money(sale.grossProfitAmount)}</ReportTd>
                <ReportTd align="center" className="text-xs">{sale.status}</ReportTd>
              </tr>
            ))}
          </tbody>
        </ReportTable>
      )}
    </div>
  );
}