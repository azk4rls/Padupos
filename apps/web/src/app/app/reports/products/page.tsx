'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ReportHeader,
  ReportStat,
  ReportTable,
  ReportTd,
  ReportTh,
} from '@/components/reports/report-shell';
import { formatMoneyString } from '@/lib/format';
import { buildQuery } from '@/lib/query';
import { Package, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

/** GET /products -> { products, pagination } using paginationSchema (page, limit, search) */
interface ProductsResponse {
  products: Array<{
    id: string;
    name: string;
    sku?: string;
    barcode?: string;
    sellingPrice: string;
    costPrice?: string;
    categoryId?: string;
    isActive?: boolean;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const LIMIT = 20;

export default function ProductsReportPage() {
  const { activeBusiness } = useAuth();
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchReport = useCallback(async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);
    const res = await api.get<ProductsResponse>(
      `/products${buildQuery({ page, limit: LIMIT, search: search || undefined })}`
    );
    if (res.error) {
      setError(res.error.message || 'Gagal memuat laporan produk.');
      setData(null);
    } else {
      setData(res.data ?? null);
    }
    setLoading(false);
  }, [activeBusiness, page, search]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Search is debounced so typing does not spam the backend.
  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 250);
    return () => clearTimeout(timer);
  }, [search]);

  if (loading && !data) return <SkeletonPage />;

  const currency = activeBusiness?.baseCurrency || 'IDR';
  const money = (v: string | undefined) => formatMoneyString(v, { currency });
  const rows = data?.products ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-8">
      <ReportHeader
        title="Laporan Produk"
        endpoint="GET /products"
        scope={
          <>
            {activeBusiness?.name}
            {pagination ? ` · ${pagination.total} produk` : ''}
          </>
        }
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, SKU, barcode"
            aria-label="Cari produk"
            className="h-9 w-full pl-8 sm:w-64"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Segarkan
        </Button>
      </ReportHeader>

      {error ? (
        <ErrorState title="Laporan gagal dimuat" message={error} onRetry={fetchReport} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={search ? 'Produk tidak ditemukan' : 'Belum ada produk'}
          description={
            search
              ? `Backend tidak mengembalikan produk untuk pencarian "${search}".`
              : 'Katalog produk masih kosong. Tambahkan produk untuk melihat laporan ini.'
          }
        />
      ) : (
        <>
          <ReportTable>
            <thead>
              <tr>
                <ReportTh className="w-12">#</ReportTh>
                <ReportTh>Nama produk</ReportTh>
                <ReportTh>SKU</ReportTh>
                <ReportTh>Barcode</ReportTh>
                <ReportTh align="right">Harga jual</ReportTh>
                <ReportTh align="right">Harga modal</ReportTh>
                <ReportTh align="center">Status</ReportTh>
              </tr>
            </thead>
            <tbody>
              {rows.map((product, idx) => (
                <tr key={product.id} className="transition-colors hover:bg-white">
                  <ReportTd numeric className="text-xs text-muted-foreground">
                    {(pagination?.page ?? 1) * LIMIT - LIMIT + idx + 1}
                  </ReportTd>
                  <ReportTd className="font-medium text-slate-900">{product.name}</ReportTd>
                  <ReportTd className="font-mono text-xs text-muted-foreground">{product.sku || '—'}</ReportTd>
                  <ReportTd className="font-mono text-xs text-muted-foreground">{product.barcode || '—'}</ReportTd>
                  <ReportTd align="right" numeric className="font-semibold">{money(product.sellingPrice)}</ReportTd>
                  <ReportTd align="right" numeric>{money(product.costPrice)}</ReportTd>
                  <ReportTd align="center" className="text-xs">{product.isActive === false ? 'Nonaktif' : 'Aktif'}</ReportTd>
                </tr>
              ))}
            </tbody>
          </ReportTable>

          {pagination && pagination.totalPages > 1 && (
            <nav className="flex items-center justify-between gap-4" aria-label="Paginasi produk">
              <p className="text-xs text-muted-foreground">
                Halaman {pagination.page} dari {pagination.totalPages} · {pagination.total} produk
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1 || loading}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                >
                  Berikutnya
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}