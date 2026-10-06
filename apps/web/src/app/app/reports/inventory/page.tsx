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
import { formatDecimalString, formatDateTime } from '@/lib/format';
import { buildQuery } from '@/lib/query';
import { Boxes, RefreshCw, PackageX } from 'lucide-react';

/**
 * GET /inventory            -> { inventory: [...] }
 * GET /inventory/movements  -> { movements: [...] }  (most recent 100)
 * Both accept ?branchId=.
 *
 * The low-stock flag below mirrors the backend rule used by
 * DashboardMetricsService: availableQuantity <= minimumStock.
 * The comparison itself is performed on the backend values, not re-derived
 * from any valuation logic.
 */
interface InventoryRow {
  id: string;
  productId: string;
  branchId?: string;
  quantity: string;
  availableQuantity: string;
  minimumStock: string;
  updatedAt?: string;
}

interface MovementRow {
  id: string;
  productId: string;
  branchId?: string;
  type: string;
  quantity: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
  createdBy?: string;
}

const ALL_BRANCHES = '__all__';

export default function InventoryReportPage() {
  const { activeBusiness, activeBranch } = useAuth();
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'levels' | 'movements'>('levels');
  const [branchId, setBranchId] = useState<string>(ALL_BRANCHES);

  const fetchReport = useCallback(async () => {
    if (!activeBusiness) return;
    setLoading(true);
    setError(null);
    const qs = buildQuery({ branchId: branchId === ALL_BRANCHES ? undefined : branchId });
    const [stockRes, movementRes] = await Promise.all([
      api.get<{ inventory: InventoryRow[] }>(`/inventory${qs}`),
      api.get<{ movements: MovementRow[] }>(`/inventory/movements${qs}`),
    ]);

    if (stockRes.error) {
      setError(stockRes.error.message || 'Gagal memuat data inventori.');
      setItems([]);
      setMovements([]);
    } else {
      setItems(stockRes.data?.inventory ?? []);
      setMovements(movementRes.error ? [] : movementRes.data?.movements ?? []);
    }
    setLoading(false);
  }, [activeBusiness, branchId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading && items.length === 0 && movements.length === 0) return <SkeletonPage />;

  const lowStock = items.filter(
    (i) => Number(i.availableQuantity) <= Number(i.minimumStock)
  );
  const unitsOnHand = items.reduce((sum, i) => sum + Number(i.quantity), 0);

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
      <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Segarkan
      </Button>
    </>
  );

  return (
    <div className="space-y-8">
      <ReportHeader
        title="Laporan Inventori"
        endpoint="GET /inventory · GET /inventory/movements"
        scope={
          <>
            {activeBusiness?.name} ·{' '}
            {branchId === ALL_BRANCHES ? 'Semua Outlet' : activeBranch?.name ?? branchId}
          </>
        }
      >
        {toolbar}
      </ReportHeader>

      {error ? (
        <ErrorState title="Laporan gagal dimuat" message={error} onRetry={fetchReport} />
      ) : (
        <>
          <section className="grid gap-6 sm:grid-cols-3">
            <ReportStat label="Item terlacak" value={items.length} />
            <ReportStat label="Unit tersedia" value={formatDecimalString(unitsOnHand.toFixed(4))} />
            <ReportStat
              label="Stok menipis"
              value={lowStock.length}
              tone={lowStock.length > 0 ? 'negative' : 'neutral'}
            />
          </section>

          <div className="flex gap-6 border-b border-border" role="tablist" aria-label="Tampilan inventori">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'levels'}
              onClick={() => setTab('levels')}
              className={`-mb-px border-b-2 pb-2 text-sm font-medium transition-colors ${
                tab === 'levels' ? 'border-slate-900 text-slate-900' : 'border-transparent text-muted-foreground hover:text-slate-700'
              }`}
            >
              Level stok
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'movements'}
              onClick={() => setTab('movements')}
              className={`-mb-px border-b-2 pb-2 text-sm font-medium transition-colors ${
                tab === 'movements' ? 'border-slate-900 text-slate-900' : 'border-transparent text-muted-foreground hover:text-slate-700'
              }`}
            >
              Pergerakan stok
            </button>
          </div>

          {tab === 'levels' ? (
            items.length === 0 ? (
              <EmptyState
                icon={<Boxes className="h-6 w-6" />}
                title="Belum ada data stok"
                description="Backend tidak mengembalikan level stok untuk outlet yang dipilih."
              />
            ) : (
              <ReportTable>
                <thead>
                  <tr>
                    <ReportTh>Produk</ReportTh>
                    <ReportTh align="right">Jumlah</ReportTh>
                    <ReportTh align="right">Tersedia</ReportTh>
                    <ReportTh align="right">Stok minimum</ReportTh>
                    <ReportTh align="center">Status</ReportTh>
                    <ReportTh>Diperbarui</ReportTh>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const isLow = Number(row.availableQuantity) <= Number(row.minimumStock);
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-white">
                        <ReportTd className="font-mono text-xs">{row.productId}</ReportTd>
                        <ReportTd align="right" numeric>{formatDecimalString(row.quantity)}</ReportTd>
                        <ReportTd align="right" numeric className="font-semibold">
                          {formatDecimalString(row.availableQuantity)}
                        </ReportTd>
                        <ReportTd align="right" numeric>{formatDecimalString(row.minimumStock)}</ReportTd>
                        <ReportTd
                          align="center"
                          className={`text-xs ${isLow ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}
                        >
                          {isLow ? 'Menipis' : 'Aman'}
                        </ReportTd>
                        <ReportTd className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(row.updatedAt)}
                        </ReportTd>
                      </tr>
                    );
                  })}
                </tbody>
              </ReportTable>
            )
          ) : movements.length === 0 ? (
            <EmptyState
              icon={<PackageX className="h-6 w-6" />}
              title="Belum ada pergerakan stok"
              description="Backend tidak mengembalikan mutasi stok untuk outlet yang dipilih."
            />
          ) : (
            <ReportTable>
              <thead>
                <tr>
                  <ReportTh>Tanggal</ReportTh>
                  <ReportTh>Produk</ReportTh>
                  <ReportTh align="center">Jenis</ReportTh>
                  <ReportTh align="right">Jumlah</ReportTh>
                  <ReportTh>Referensi</ReportTh>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-white">
                    <ReportTd className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                    </ReportTd>
                    <ReportTd className="font-mono text-xs">{m.productId}</ReportTd>
                    <ReportTd align="center" className="text-xs">{m.type}</ReportTd>
                    <ReportTd align="right" numeric>{formatDecimalString(m.quantity)}</ReportTd>
                    <ReportTd className="text-xs text-muted-foreground">
                      {m.referenceType ? `${m.referenceType} · ${m.referenceId ?? ''}` : '—'}
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