import BigNumber from 'bignumber.js';
import { toBN } from '@padupos/shared';
import { domainStore } from '../modules/domainStore.js';
import { DashboardMetricsService } from '../modules/dashboard/service.js';
import { type ResolvedDateRange, isWithinRangeIso } from './dateRange.js';

/**
 * Report export artefacts.
 *
 * Design decision (option A from the contract-completion brief): generate the
 * artefact synchronously and serve it from a protected, authenticated route.
 *
 * Why synchronous rather than a job queue:
 *   - The report sizes behind this endpoint are bounded by one tenant's ledger and
 *     the payload is assembled in memory already; a job table plus worker would be
 *     new infrastructure for no production benefit at this stage.
 *   - The previous contract returned `status: 'COMPLETED'` together with a download
 *     URL that could never resolve. Returning real bytes keeps the API honest.
 *
 * Security properties:
 *   - Artefacts are stored server-side and keyed by an opaque random token. The
 *     filename itself is NOT a secret and is never used to look one up, so a
 *     predictable or guessed filename grants nothing.
 *   - Every download re-runs `authenticate` -> `resolveTenant` -> `reports.export`,
 *     then verifies the artefact belongs to the caller's business. A token belonging
 *     to another tenant returns 404, not 403, so the endpoint cannot be used to probe
 *     for the existence of other tenants' artefacts.
 *   - Artefacts expire (TTL) and are swept on every new request.
 *   - Money is emitted from the exact decimal string, never reformatted through a
 *     float, so exported figures reconcile to the ledger byte-for-byte.
 */

export const EXPORT_ARTIFACT_TTL_MS = 15 * 60 * 1000;

export type ExportFormat = 'CSV';

export interface ExportArtifact {
  token: string;
  businessId: string;
  reportType: string;
  format: ExportFormat;
  filename: string;
  contentType: string;
  body: string;
  createdAt: number;
  expiresAt: number;
  rowCount: number;
}

const artifacts = new Map<string, ExportArtifact>();

/** RFC 4180 field escaping. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

/**
 * Filenames are derived from a fixed vocabulary plus a slugified business name.
 * No user-supplied path segments ever reach the filename.
 */
function safeFilename(reportType: string, businessName: string, startDate: string, endDate: string): string {
  const slug = businessName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase() || 'business';
  return `padupos-${reportType}-${slug}-${startDate}_to_${endDate}.csv`;
}

function sweepExpiredArtifacts(now: number): void {
  for (const [token, artifact] of artifacts) {
    if (artifact.expiresAt <= now) artifacts.delete(token);
  }
}

export function clearExportArtifactsForTesting(): void {
  artifacts.clear();
}

export interface ExportRequest {
  businessId: string;
  reportType: string;
  branchId: string | null;
  range: ResolvedDateRange;
  format: ExportFormat;
}

type RowBuilder = (scope: ExportScope) => { header: string[]; rows: unknown[][] };

export interface ExportScope {
  businessId: string;
  branchId: string | null;
  range: ResolvedDateRange;
}

const BUILDERS: Record<string, RowBuilder> = {
  SALES({ businessId, branchId, range }) {
    const header = [
      'Invoice Number',
      'Date',
      'Branch',
      'Subtotal',
      'Discount',
      'Tax',
      'Fees',
      'Total',
      'COGS',
      'Gross Profit',
      'Currency',
      'Status',
      'Created By',
    ];
    const rows: unknown[][] = [];
    for (const sale of domainStore.sales.values()) {
      if (sale.businessId !== businessId) continue;
      if (sale.status !== 'PAID') continue;
      if (branchId !== null && sale.branchId !== branchId) continue;
      if (!isWithinRangeIso(range, sale.createdAt)) continue;
      rows.push([
        sale.invoiceNumber,
        sale.createdAt,
        sale.branchId,
        sale.subtotal,
        sale.discountAmount,
        sale.taxAmount,
        sale.feeAmount,
        sale.totalAmount,
        sale.cogsAmount,
        sale.grossProfitAmount,
        sale.currency,
        sale.status,
        sale.createdBy,
      ]);
    }
    return { header, rows };
  },

  EXPENSES({ businessId, branchId, range }) {
    const header = ['Date', 'Branch', 'Category', 'Description', 'Amount', 'Currency', 'Payment Method'];
    const rows: unknown[][] = [];
    for (const expense of domainStore.expenses) {
      if (expense.businessId !== businessId) continue;
      if (branchId !== null && expense.branchId !== branchId) continue;
      if (!isWithinRangeIso(range, expense.incurredAt)) continue;
      const category = domainStore.expenseCategories.get(expense.categoryId);
      rows.push([
        expense.incurredAt,
        expense.branchId ?? '',
        category?.name ?? expense.categoryId,
        expense.description,
        expense.amount,
        expense.currency,
        expense.paymentMethod,
      ]);
    }
    return { header, rows };
  },

  PRODUCTS({ businessId, branchId, range }) {
    const header = ['Product ID', 'Name', 'SKU', 'Unit', 'Units Sold', 'Revenue', 'Cost Method'];
    const aggregate = new Map<string, { qty: BigNumber; revenue: BigNumber }>();
    for (const sale of domainStore.sales.values()) {
      if (sale.businessId !== businessId) continue;
      if (sale.status !== 'PAID') continue;
      if (branchId !== null && sale.branchId !== branchId) continue;
      if (!isWithinRangeIso(range, sale.createdAt)) continue;
      for (const item of domainStore.saleItems.get(sale.id) ?? []) {
        const previous = aggregate.get(item.productId) ?? {
          qty: new BigNumber(0),
          revenue: new BigNumber(0),
        };
        aggregate.set(item.productId, {
          qty: previous.qty.plus(toBN(item.quantity)),
          revenue: previous.revenue.plus(toBN(item.total)),
        });
      }
    }
    const rows: unknown[][] = [];
    for (const [productId, stats] of aggregate) {
      const product = domainStore.products.get(productId);
      rows.push([
        productId,
        product?.name ?? 'Unknown Product',
        product?.sku ?? '',
        product?.unit ?? '',
        stats.qty.toFixed(4),
        stats.revenue.toFixed(4),
        product?.costMethod ?? '',
      ]);
    }
    return { header, rows };
  },

  DASHBOARD_SERIES({ businessId, branchId, range }) {
    const header = ['Date', 'Sales', 'Revenue', 'COGS', 'Gross Profit', 'Transactions'];
    // Reuse the authoritative dashboard series so the export cannot disagree with
    // the chart the user just looked at.
    const series = DashboardMetricsService.getTimeSeries(businessId, branchId, range);
    const rows: unknown[][] = series.series.map((point) => [
      point.date,
      point.sales,
      point.revenue,
      point.cogs,
      point.grossProfit,
      point.transactions,
    ]);
    return { header, rows };
  },
};

export const SUPPORTED_EXPORT_REPORTS = Object.keys(BUILDERS) as Array<keyof typeof BUILDERS>;
export const SUPPORTED_EXPORT_FORMATS: ExportFormat[] = ['CSV'];

export function isSupportedExportReport(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILDERS, value);
}

export function isSupportedExportFormat(value: string): value is ExportFormat {
  return (SUPPORTED_EXPORT_FORMATS as string[]).includes(value);
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

/**
 * Generates and registers an export artefact, returning its descriptor.
 */
export function createExportArtifact(request: ExportRequest): ExportArtifact {
  const now = Date.now();
  sweepExpiredArtifacts(now);

  const builder = BUILDERS[request.reportType];
  const { header, rows } = builder({
    businessId: request.businessId,
    branchId: request.branchId,
    range: request.range,
  });

  const body = [csvRow(header), ...rows.map(csvRow)].join('\r\n') + '\r\n';
  const business = domainStore.businesses.get(request.businessId);

  const artifact: ExportArtifact = {
    token: randomToken(),
    businessId: request.businessId,
    reportType: request.reportType,
    format: request.format,
    filename: safeFilename(
      request.reportType.toLowerCase(),
      business?.name ?? request.businessId,
      request.range.startDate,
      request.range.endDate,
    ),
    contentType: 'text/csv; charset=utf-8',
    body,
    createdAt: now,
    expiresAt: now + EXPORT_ARTIFACT_TTL_MS,
    rowCount: rows.length,
  };

  artifacts.set(artifact.token, artifact);
  return artifact;
}

/**
 * Fetches an artefact for a download.
 *
 * Returns `undefined` when the token is unknown, expired, or owned by another
 * business, so callers cannot distinguish those cases from the outside.
 */
export function consumeExportArtifact(
  token: string,
  businessId: string,
  now: number = Date.now(),
): ExportArtifact | undefined {
  sweepExpiredArtifacts(now);

  const artifact = artifacts.get(token);
  if (!artifact) return undefined;
  if (artifact.expiresAt <= now) {
    artifacts.delete(token);
    return undefined;
  }
  if (artifact.businessId !== businessId) return undefined;
  return artifact;
}

export function deleteExportArtifact(token: string): void {
  artifacts.delete(token);
}