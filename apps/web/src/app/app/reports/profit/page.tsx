'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { ReportHeader } from '@/components/reports/report-shell';
import { formatMoneyString, isNonNegative } from '@/lib/format';
import { RefreshCw, TrendingUp } from 'lucide-react';

/**
 * GET /finance/profit-loss
 * Every figure below is computed by the backend. The frontend only formats
 * and lays out the values; it never derives margin or profit locally.
 */
interface ProfitLossResponse {
  revenue: string;
  cogs: string;
  grossProfit: string;
  operatingExpenses?: string;
  operatingProfit?: string;
}

export default function ProfitReportPage() {
  const { activeBusiness } = useAuth();
  const [data, setData] = useState<ProfitLossResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);
    const res = await api.get<ProfitLossResponse>('/finance/profit-loss');
    if (res.error) {
      setError(res.error.message || 'Gagal memuat laporan laba rugi.');
      setData(null);
    } else {
      setData(res.data ?? null);
    }
    setLoading(false);
  }, [activeBusiness]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading && !data) return <SkeletonPage />;

  const currency = activeBusiness?.baseCurrency || 'IDR';
  const money = (v: string | undefined) => formatMoneyString(v, { currency });

  const lines = data
    ? [
        { label: 'Pendapatan', value: data.revenue },
        { label: 'Harga pokok penjualan', value: data.cogs },
        { label: 'Laba kotor', value: data.grossProfit, bold: true },
        ...(data.operatingExpenses !== undefined
          ? [{ label: 'Beban operasional', value: data.operatingExpenses }]
          : []),
        ...(data.operatingProfit !== undefined
          ? [
              {
                label: 'Laba operasional',
                value: data.operatingProfit,
                bold: true,
                tone: isNonNegative(data.operatingProfit) ? 'positive' : 'negative',
              },
            ]
          : []),
      ]
    : ([] as Array<{ label: string; value: string | undefined; bold?: boolean; tone?: 'positive' | 'negative' }>);

  return (
    <div className="space-y-8">
      <ReportHeader
        title="Laporan Laba Rugi"
        endpoint="GET /finance/profit-loss"
        scope={<>{activeBusiness?.name} · seluruh perhitungan dilakukan backend</>}
      >
        <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Segarkan
        </Button>
      </ReportHeader>

      {error ? (
        <ErrorState title="Laporan gagal dimuat" message={error} onRetry={fetchReport} />
      ) : !data ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          Backend belum mengembalikan data laba rugi untuk bisnis ini.
        </div>
      ) : (
        <section className="max-w-2xl">
          <dl className="divide-y divide-border border-y border-border">
            {lines.map((line) => (
              <div
                key={line.label}
                className={`flex items-baseline justify-between gap-6 py-4 ${
                  line.bold ? 'bg-slate-50/60 px-3' : ''
                }`}
              >
                <dt className={`text-sm ${line.bold ? 'font-semibold text-slate-900' : 'text-muted-foreground'}`}>
                  {line.label}
                </dt>
                <dd
                  className={`tabular-nums ${
                    line.bold ? 'text-base font-bold' : 'text-sm font-medium'
                  } ${
                    line.tone === 'positive'
                      ? 'text-emerald-700'
                      : line.tone === 'negative'
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  {money(line.value)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Laporan ini menampilkan nilai apa adanya dari backend. Tidak ada perhitungan margin,
            biaya, atau valuasi yang dihitung ulang di sisi klien.
          </p>
        </section>
      )}
    </div>
  );
}