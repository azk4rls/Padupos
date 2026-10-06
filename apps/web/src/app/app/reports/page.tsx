'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/components/ui/utils';
import {
  FileText,
  Package,
  Boxes,
  TrendingUp,
  Receipt,
  HandCoins,
  Wallet,
  ArrowRight,
} from 'lucide-react';

interface ReportEntry {
  href: string;
  label: string;
  description: string;
  endpoint: string;
  icon: typeof FileText;
}

/**
 * Every entry maps to a route that the backend actually implements.
 * No report is listed here unless a real endpoint exists for it.
 */
const REPORTS: ReportEntry[] = [
  {
    href: '/app/reports/sales',
    label: 'Penjualan',
    description: 'Ringkasan pendapatan, margin, dan transaksi',
    endpoint: 'GET /reports/sales',
    icon: FileText,
  },
  {
    href: '/app/reports/products',
    label: 'Produk',
    description: 'Katalog produk, harga, dan paginasi',
    endpoint: 'GET /products',
    icon: Package,
  },
  {
    href: '/app/reports/inventory',
    label: 'Inventori',
    description: 'Level stok dan pergerakan stok',
    endpoint: 'GET /inventory',
    icon: Boxes,
  },
  {
    href: '/app/reports/profit',
    label: 'Laba Rugi',
    description: 'Pendapatan, HPP, laba kotor dan operasional',
    endpoint: 'GET /finance/profit-loss',
    icon: TrendingUp,
  },
  {
    href: '/app/reports/expenses',
    label: 'Beban',
    description: 'Catatan beban operasional',
    endpoint: 'GET /finance/expenses',
    icon: Receipt,
  },
  {
    href: '/app/reports/receivables',
    label: 'Piutang',
    description: 'Tagihan pelanggan dan status pelunasan',
    endpoint: 'GET /finance/receivables',
    icon: HandCoins,
  },
  {
    href: '/app/reports/payables',
    label: 'Hutang',
    description: 'Kewajiban kepada pemasok',
    endpoint: 'GET /finance/payables',
    icon: Wallet,
  },
];

/**
 * Capability table. Every capability listed here is backed by a registered backend
 * route; nothing is advertised as unavailable just because the UI has not built a
 * control for it yet.
 */
const CAPABILITIES: Array<{ label: string; endpoint: string; available: boolean }> = [
  { label: 'Filter rentang tanggal', endpoint: 'startDate / endDate', available: true },
  { label: 'Filter outlet', endpoint: 'x-branch-id', available: true },
  { label: 'Ekspor CSV', endpoint: 'POST /reports/export', available: true },
  { label: 'Ekspor PDF / XLSX', endpoint: '—', available: false },
];

export default function ReportsPage() {
  const { activeBusiness } = useAuth();

  return (
    <div className="space-y-8">
      <header className="pb-6 border-b border-border">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Laporan</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {activeBusiness?.name} · seluruh angka berasal dari backend
        </p>
      </header>

      <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          return (
            <li key={report.href}>
              <Link
                href={report.href}
                className={cn(
                  'group flex h-full flex-col justify-between gap-6 bg-background p-5',
                  'transition-colors hover:bg-white focus-visible:bg-white'
                )}
              >
                <div className="space-y-2">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-900">{report.label}</h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">{report.description}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <code className="truncate font-mono text-[10px] text-muted-foreground">{report.endpoint}</code>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform motion-safe:group-hover:translate-x-0.5" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Kemampuan Laporan
        </h2>
        <ul className="divide-y divide-border border-y border-border">
          {CAPABILITIES.map((capability) => (
            <li key={capability.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="flex items-baseline gap-2 text-sm text-slate-700">
                {capability.label}
                <span
                  className={
                    capability.available
                      ? 'text-[10px] font-semibold uppercase tracking-wide text-emerald-700'
                      : 'text-[10px] font-semibold uppercase tracking-wide text-slate-400'
                  }
                >
                  {capability.available ? 'Tersedia' : 'Belum ada'}
                </span>
              </span>
              <code className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {capability.endpoint}
              </code>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Ekspor CSV tersedia untuk penjualan, beban, produk, dan tren dashboard. Format lain belum
          ada karena backend belum menyediakannya.
        </p>
      </section>
    </div>
  );
}