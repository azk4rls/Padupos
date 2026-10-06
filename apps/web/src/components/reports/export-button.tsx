'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import type { DateRangeQuery } from '@/lib/dateRange';

export type ExportReportType = 'SALES' | 'EXPENSES' | 'PRODUCTS' | 'DASHBOARD_SERIES';

/** Shape of `POST /reports/export`. */
interface ExportTicket {
  token: string;
  downloadUrl: string;
  reportType: string;
  format: string;
  rowCount: number;
  fileName: string;
  expiresAt: string;
}

interface ExportButtonProps {
  reportType: ExportReportType;
  range: DateRangeQuery;
  /** Label for the default state. */
  label?: string;
  className?: string;
}

/**
 * Real CSV export against `POST /reports/export` + `GET /reports/exports/:token`.
 *
 * Two details matter and are easy to get wrong:
 *
 * 1. The download URL is *not* a public link. It requires the same Authorization,
 *    x-business-id and x-branch-id headers as every other call, so we fetch the bytes
 *    and hand them to the browser. Navigating to the URL would send an unauthenticated
 *    GET and 401.
 * 2. The ticket is one-shot. A second download of the same token 410s by design, so
 *    each click requests a fresh ticket rather than caching one.
 *
 * Row count is taken from the backend and only ever displayed; the browser never
 * builds the file, so it cannot invent or alter figures.
 */
export function ExportButton({ reportType, range, label = 'Ekspor CSV', className }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setMessage(null);

    const created = await api.post<ExportTicket>('/reports/export', {
      format: 'CSV',
      reportType,
      startDate: range.startDate,
      endDate: range.endDate,
    });

    if (created.error || !created.data) {
      setMessage(created.error?.message || 'Gagal menyiapkan ekspor.');
      setIsExporting(false);
      return;
    }

    const ticket = created.data;

    try {
      const downloaded = await api.download(ticket.downloadUrl);
      if (!downloaded.ok) {
        const body = await downloaded.json().catch(() => null);
        setMessage(body?.error?.message || `Unduhan gagal (HTTP ${downloaded.status}).`);
        setIsExporting(false);
        return;
      }

      const blob = await downloaded.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = ticket.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      setMessage(`${ticket.rowCount} baris diekspor.`);
    } catch {
      setMessage('Gagal mengunduh berkas ekspor.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={className}>
      <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
        {isExporting ? 'Menyiapkan…' : label}
      </Button>
      {message && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}