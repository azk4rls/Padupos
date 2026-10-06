'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/components/ui/utils';
import { Select } from '@/components/ui/select';

/**
 * Shared report page chrome: masthead, contextual scope line, and a
 * filter/toolbar slot. Keeps every report on the same editorial grid
 * without repeating markup.
 */
export function ReportHeader({
  title,
  scope,
  endpoint,
  children,
}: {
  title: string;
  scope?: React.ReactNode;
  endpoint?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-4 pb-6 border-b border-border">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <Link
            href="/app/reports"
            className="text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-slate-900"
          >
            ← Semua laporan
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {scope ? <p className="text-xs text-muted-foreground">{scope}</p> : null}
          {endpoint ? <code className="block font-mono text-[10px] text-muted-foreground/80">{endpoint}</code> : null}
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  );
}

/**
 * Report tables use a sticky header, subtle row dividers and tabular numerals
 * rather than boxed cells.
 */
export function ReportTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function ReportTh({
  align = 'left',
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-10 border-b border-border bg-background px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className
      )}
      {...props}
    />
  );
}

export function ReportTd({
  align = 'left',
  numeric,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center'; numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-border px-3 py-2.5 text-slate-800',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        numeric && 'tabular-nums',
        className
      )}
      {...props}
    />
  );
}

/** Summary figure block used above report tables. */
export function ReportStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-xl font-semibold tabular-nums',
          tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-rose-700' : 'text-slate-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Toolbar filter built on the project's native Select primitive.
 * Every option here corresponds to a value the backend actually returned or a
 * value the endpoint explicitly accepts — no fabricated filter dimensions.
 */
export function ReportFilter({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="sr-only">{label}</span>
      <Select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        className="h-9 w-full"
      />
    </label>
  );
}