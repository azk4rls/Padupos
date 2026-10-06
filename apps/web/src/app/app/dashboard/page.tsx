'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toBN } from '@padupos/shared';
import { formatMoneyString, proportionOf } from '@/lib/format';
import {
  type DateRangeState,
  defaultDateRangeState,
  toQuery,
  validateCustomRange,
} from '@/lib/dateRange';
import { DateRangeFilter } from '@/components/reports/date-range-filter';
import { ExportButton } from '@/components/reports/export-button';
import {
  SalesTrendChart,
  type SeriesPoint,
} from '@/components/reports/sales-trend-chart';
import { RefreshCw, ShoppingCart, ArrowUpRight, AlertTriangle } from 'lucide-react';

/**
 * Shape returned by GET /dashboard/metrics -> { metrics }
 * and GET /dashboard/metrics/series -> { series: { series, totals } }
 * Field names and string-typed money values come straight from
 * DashboardMetricsService. Nothing here is computed client-side.
 */
interface DashboardMetrics {
  scope: { businessId: string; branchId: string | null; timeZone: string };
  range: { startDate: string; endDate: string; dayCount: number };
  sales: string;
  transactions: number;
  salesToday: string;
  salesThisWeek: string;
  salesThisMonth: string;
  totalCOGS: string;
  grossProfit: string;
  operatingExpenses: string;
  operatingProfit: string;
  cashOnHand: string;
  totalReceivables: string;
  totalPayables: string;
  lowStockCount: number;
  topProducts: Array<{ productId: string; productName: string; unitsSold: string; totalRevenue: string }>;
  paymentDistribution: Record<string, string>;
  /** Backend-computed sum, so the frontend never adds money up itself. */
  paymentDistributionTotal: string;
}

interface DashboardSeries {
  series: SeriesPoint[];
  totals: {
    sales: string;
    revenue: string;
    cogs: string;
    grossProfit: string;
    transactions: number;
  };
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Tunai',
  CARD: 'Kartu',
  QRIS: 'QRIS',
  BANK_TRANSFER: 'Transfer Bank',
  E_WALLET: 'E-Wallet',
  CREDIT: 'Kredit',
};

function MetricLine({ label, value, currency, emphasis }: {
  label: string;
  value: string;
  currency: string;
  emphasis?: 'positive' | 'negative' | 'neutral';
}) {
  const tone =
    emphasis === 'positive' ? 'text-emerald-700' : emphasis === 'negative' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div className="flex items-baseline justify-between gap-6 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tone}`}>
        {formatMoneyString(value, { currency })}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { activeBusiness, activeBranch } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trend, setTrend] = useState<DashboardSeries | null>(null);
  const [range, setRange] = useState<DateRangeState>(defaultDateRangeState);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // A half-filled custom range would be rejected by the backend, so the request is
  // simply deferred until both ends are valid. The backend still validates.
  const window = toQuery(range);
  const rangeIsValid =
    range.preset !== 'custom' || validateCustomRange(range.startDate, range.endDate) === null;

  const fetchMetrics = useCallback(async () => {
    if (!activeBusiness || !rangeIsValid) return;
    setIsLoading(true);
    setErrorMsg(null);

    const query = `?startDate=${window.startDate}&endDate=${window.endDate}`;
    const [metricsRes, seriesRes] = await Promise.all([
      api.get<{ metrics: DashboardMetrics }>(`/dashboard/metrics${query}`),
      api.get<{ series: DashboardSeries }>(`/dashboard/metrics/series${query}`),
    ]);

    if (metricsRes.error) {
      setErrorMsg(metricsRes.error.message || 'Gagal mengambil data metrik bisnis.');
      setMetrics(null);
      setTrend(null);
    } else if (metricsRes.data) {
      setMetrics(metricsRes.data.metrics);
      setTrend(seriesRes.data?.series ?? null);
    }
    setIsLoading(false);
  }, [activeBusiness, rangeIsValid, window.startDate, window.endDate]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (isLoading) return <SkeletonPage />;

  if (errorMsg) {
    return (
      <div className="space-y-4">
        <div className="pb-3 border-b border-border">
          <h1 className="text-xl font-bold text-slate-900">Ringkasan Bisnis</h1>
        </div>
        <ErrorState title="Data Dashboard Gagal Dimuat" message={errorMsg} onRetry={fetchMetrics} />
      </div>
    );
  }

  const currency = activeBusiness?.baseCurrency || 'IDR';
  const m = metrics;

  if (!m) {
    return (
      <EmptyState
        title="Metrik bisnis belum tersedia"
        description="Backend belum mengembalikan metrik untuk bisnis ini. Coba muat ulang."
      />
    );
  }

  const hasSales = m.topProducts.length > 0;
  const topRevenue = m.topProducts.length > 0 ? m.topProducts[0].totalRevenue : null;
  const paymentEntries = Object.entries(m.paymentDistribution);
  const attentionCount = m.lowStockCount;

  return (
    <div className="space-y-10">
      {/* Masthead */}
      <header className="flex flex-col gap-4 pb-6 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {activeBusiness?.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {activeBranch?.name || 'Semua Outlet'} · {currency} · Ringkasan real dari backend
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Segarkan
          </Button>
          <Link href="/app/pos">
            <Button variant="primary" size="sm">
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Buka Kasir
            </Button>
          </Link>
        </div>
      </header>

      {/* PERIOD — every figure below is scoped to this window, server-side. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DateRangeFilter value={range} onChange={setRange} />
        <ExportButton
          reportType="DASHBOARD_SERIES"
          range={window}
          label="Ekspor tren"
          className="shrink-0"
        />
      </div>

      {/* TREND — real daily points from GET /dashboard/metrics/series */}
      {trend && trend.series.length > 0 && (
        <section aria-labelledby="trend-heading" className="space-y-4">
          <h2
            id="trend-heading"
            className="border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Tren {trend.series.length} hari
          </h2>
          <SalesTrendChart points={trend.series} currency={currency} metric="revenue" />
        </section>
      )}

      {/* TODAY — one dominant metric, not a card grid */}
      <section aria-labelledby="today-heading" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 id="today-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Penjualan Hari Ini
          </h2>
          <p className="mt-3 text-5xl font-bold tracking-tight tabular-nums text-slate-900 sm:text-6xl">
            {formatMoneyString(m.salesToday, { currency })}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 max-w-md">
            <div>
              <dt className="text-xs text-muted-foreground">Minggu ini</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900">
                {formatMoneyString(m.salesThisWeek, { currency })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Bulan ini</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900">
                {formatMoneyString(m.salesThisMonth, { currency })}
              </dd>
            </div>
          </dl>
        </div>

        <section aria-labelledby="result-heading" className="lg:border-l lg:border-border lg:pl-8">
          <h2 id="result-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Hasil Periode Berjalan
          </h2>
          <div className="mt-1">
            <MetricLine label="Laba kotor" value={m.grossProfit} currency={currency} />
            <MetricLine label="Harga pokok penjualan" value={m.totalCOGS} currency={currency} />
            <MetricLine label="Beban operasional" value={m.operatingExpenses} currency={currency} />
            <MetricLine
              label="Laba operasional"
              value={m.operatingProfit}
              currency={currency}
              // Sign check only, via exact decimal comparison.
              emphasis={!toBN(m.operatingProfit).isNegative() ? 'positive' : 'negative'}
            />
          </div>
        </section>
      </section>

      {/* ATTENTION — only what backend actually reports */}
      <section aria-labelledby="attention-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
          <h2 id="attention-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Perlu Perhatian
          </h2>
          {attentionCount > 0 && (
            <span className="text-xs font-medium text-amber-700 tabular-nums">{attentionCount} SKU</span>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Stok menipis</p>
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{m.lowStockCount}</p>
            <p className="text-xs text-muted-foreground">
              {attentionCount > 0 ? 'Perlu pengadaan ulang' : 'Semua stok dalam batas aman'}
            </p>
            {attentionCount > 0 && (
              <Link
                href="/app/inventory"
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
              >
                <AlertTriangle className="h-3 w-3" />
                Tinjau inventori
              </Link>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Piutang belum lunas</p>
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {formatMoneyString(m.totalReceivables, { currency })}
            </p>
            <Link
              href="/app/finance/receivables"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
            >
              Lihat piutang
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Hutang ke pemasok</p>
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {formatMoneyString(m.totalPayables, { currency })}
            </p>
            <Link
              href="/app/finance/payables"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
            >
              Lihat hutang
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* PERFORMANCE — proportional bars derived from backend aggregates only */}
      <section aria-labelledby="performance-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
          <h2 id="performance-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Performa Produk
          </h2>
          <Link
            href="/app/reports/products"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
          >
            Laporan produk
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {!hasSales || m.topProducts.length === 0 ? (
          <EmptyState
            title="Belum ada performa produk"
            description="Dashboard menampilkan produk terlaris setelah transaksi penjualan tercatat."
          />
        ) : (
          <ul className="divide-y divide-border">
            {m.topProducts.map((p, idx) => {
              const ratio = proportionOf(p.totalRevenue, topRevenue);
              return (
                <li key={p.productId || idx} className="py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium text-slate-900">
                      <span className="mr-2 text-xs tabular-nums text-muted-foreground">{idx + 1}</span>
                      {p.productName}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatMoneyString(p.totalRevenue, { currency })}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 bg-slate-100">
                      {ratio !== null && (
                        <div
                          className="h-full origin-left bg-slate-800 motion-safe:animate-[grow_600ms_ease-out]"
                          style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                        />
                      )}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {p.unitsSold} unit
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* PAYMENT MIX + CASH POSITION */}
      <section aria-labelledby="cash-heading" className="space-y-4">
        <h2 id="cash-heading" className="border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Posisi Kas
        </h2>
        <p className="text-3xl font-bold tracking-tight tabular-nums text-slate-900">
          {formatMoneyString(m.cashOnHand, { currency })}
        </p>
        <p className="text-xs text-muted-foreground">
          Saldo akun kas dari jurnal entry yang telah di-poste.
        </p>
      </section>

      <section aria-labelledby="payments-heading" className="space-y-4">
        <h2 id="payments-heading" className="border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Komposisi Pembayaran
        </h2>
        {paymentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada pembayaran tercatat untuk periode berjalan.
          </p>
        ) : (
          <ul className="space-y-3">
            {paymentEntries.map(([method, amount]) => {
              // The total comes from the backend, so the frontend never sums money itself.
              const ratio = proportionOf(amount, m.paymentDistributionTotal);
              return (
                <li key={method}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-slate-700">{PAYMENT_LABELS[method] || method}</span>
                    <span className="font-medium tabular-nums text-slate-900">
                      {formatMoneyString(amount, { currency })}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-slate-100">
                    {ratio !== null && (
                      <div className="h-full origin-left bg-slate-700 motion-safe:animate-[grow_600ms_ease-out]" style={{ width: `${ratio * 100}%` }} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}