'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  AlertCircle,
  Package,
  Landmark,
  ArrowUpRight,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardMetrics {
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
}

export default function DashboardPage() {
  const { activeBusiness, activeBranch } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!activeBusiness) return;
    setIsLoading(true);
    setErrorMsg(null);

    const res = await api.get<{ metrics: DashboardMetrics }>('/dashboard/metrics');

    if (res.error) {
      setErrorMsg(res.error.message || 'Gagal mengambil data metrik bisnis.');
    } else if (res.data) {
      setMetrics(res.data.metrics);
    }
    setIsLoading(false);
  }, [activeBusiness]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (isLoading) {
    return <SkeletonPage />;
  }

  if (errorMsg) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h1 className="text-xl font-bold text-slate-900">Ringkasan Bisnis</h1>
        </div>
        <ErrorState
          title="Data Dashboard Gagal Dimuat"
          message={errorMsg}
          onRetry={fetchMetrics}
        />
      </div>
    );
  }

  const currencySymbol = activeBusiness?.baseCurrency === 'IDR' ? 'Rp' : activeBusiness?.baseCurrency || '$';
  const formatMoney = (val: string | undefined) => {
    const num = parseFloat(val || '0');
    if (isNaN(num)) return `${currencySymbol} 0`;
    return `${currencySymbol} ${num.toLocaleString('id-ID', {
      minimumFractionDigits: activeBusiness?.baseCurrency === 'IDR' ? 0 : 2,
      maximumFractionDigits: activeBusiness?.baseCurrency === 'IDR' ? 0 : 2,
    })}`;
  };

  const hasSales = metrics && parseFloat(metrics.salesThisMonth || '0') > 0;

  return (
    <div className="space-y-6">
      {/* Top Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
            Dashboard {activeBusiness?.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Outlet: <span className="font-semibold text-slate-700">{activeBranch?.name || 'Semua Outlet'}</span> — Mata Uang: <span className="font-semibold text-slate-700">{activeBusiness?.baseCurrency}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            className="text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Segarkan
          </Button>

          <Link href="/app/pos">
            <Button variant="primary" size="sm" className="text-xs">
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Buka Kasir POS
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Penjualan Hari Ini */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Penjualan Hari Ini
            </CardTitle>
            <Receipt className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {formatMoney(metrics?.salesToday)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Minggu ini: {formatMoney(metrics?.salesThisWeek)}
            </p>
          </CardContent>
        </Card>

        {/* Laba Kotor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Laba Kotor (Bulan Ini)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold text-emerald-700">
              {formatMoney(metrics?.grossProfit)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Total HPP (COGS): {formatMoney(metrics?.totalCOGS)}
            </p>
          </CardContent>
        </Card>

        {/* Kas di Tangan (Cash on Hand) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Kas di Tangan (1010)
            </CardTitle>
            <Landmark className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold text-blue-700">
              {formatMoney(metrics?.cashOnHand)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Saldo riil buku besar kasir
            </p>
          </CardContent>
        </Card>

        {/* Peringatan Stok Rendah */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Peringatan Stok Rendah
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl font-bold text-slate-900">
              {metrics?.lowStockCount || 0} <span className="text-xs font-normal text-muted-foreground">SKU</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {metrics?.lowStockCount ? 'Perlu pengadaan ulang segera' : 'Semua stok dalam batas aman'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area: Top Products & Honest Empty State */}
      {!hasSales ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="Belum Ada Transaksi Tercatat"
          description="Bisnis Anda belum memiliki riwayat transaksi penjualan. Buka kasir POS atau lakukan transaksi pertama untuk melihat performa bisnis Anda."
          actionLabel="Buka Kasir POS Sekarang"
          onAction={() => {
            window.location.href = '/app/pos';
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Produk Terlaris</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {metrics?.topProducts && metrics.topProducts.length > 0 ? (
                  metrics.topProducts.map((p, idx) => (
                    <div key={p.productId || idx} className="flex items-center justify-between p-3 text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400 w-4">{idx + 1}.</span>
                        <span className="font-medium text-slate-900">{p.productName}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatMoney(p.totalRevenue)}</div>
                        <div className="text-[10px] text-muted-foreground">{p.unitsSold} unit terjual</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Belum ada data produk terlaris
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payables & Receivables Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Piutang &amp; Hutang Operasional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-border">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Total Piutang Pelanggan</p>
                  <p className="text-[11px] text-muted-foreground">Tagihan belum lunas dari penjualan tempo</p>
                </div>
                <div className="text-sm font-bold text-blue-700">
                  {formatMoney(metrics?.totalReceivables)}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-border">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Total Hutang Pemasok</p>
                  <p className="text-[11px] text-muted-foreground">Kewajiban pembelian barang belum dibayar</p>
                </div>
                <div className="text-sm font-bold text-amber-700">
                  {formatMoney(metrics?.totalPayables)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
