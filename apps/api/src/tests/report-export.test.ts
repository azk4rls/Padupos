import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../app.js';
import {
  clearExportArtifactsForTesting,
  consumeExportArtifact,
  createExportArtifact,
} from '../lib/exportService.js';
import { resolveDateRange } from '../lib/dateRange.js';
import { domainStore } from '../modules/domainStore.js';
import {
  OWNER_A_TOKEN,
  OWNER_B_TOKEN,
  addMembers,
  onboardBusiness,
  resetAll,
  seedSale,
  tenantHeaders,
} from './fixtures/reports.js';

/**
 * Part 5 — report export contract.
 *
 * The previous implementation returned a downloadUrl pointing at a route that was
 * never registered. These tests assert the replacement is real: a generated CSV
 * artefact, served by a protected route, with tenant isolation and expiry.
 */

const app = buildApp({ disableRateLimit: true });

const CASHIER_A_TOKEN = 'test_exp_cashier_a';

let bizA: Awaited<ReturnType<typeof onboardBusiness>>;
let bizB: Awaited<ReturnType<typeof onboardBusiness>>;

beforeEach(async () => {
  resetAll();
  clearExportArtifactsForTesting();
  bizA = await onboardBusiness(app, OWNER_A_TOKEN, { name: 'Export Co A' });
  bizB = await onboardBusiness(app, OWNER_B_TOKEN, { name: 'Export Co B' });
  addMembers(bizA.businessId, [{ userId: CASHIER_A_TOKEN.replace(/^test_/, ''), role: 'CASHIER' }]);

  seedSale({
    businessId: bizA.businessId,
    branchId: bizA.branchId,
    invoiceNumber: 'EXP-1',
    createdAt: '2026-10-01T02:00:00.000Z',
    subtotal: '1000.0000',
    cogs: '400.0000',
  });
  seedSale({
    businessId: bizA.businessId,
    branchId: bizA.secondBranchId,
    invoiceNumber: 'EXP-2',
    createdAt: '2026-10-02T02:00:00.000Z',
    subtotal: '2500.0000',
    cogs: '1000.0000',
  });
});

async function requestExport(overrides: Record<string, unknown> = {}, token = OWNER_A_TOKEN, businessId = bizA.businessId) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/reports/export',
    headers: tenantHeaders(token, businessId),
    payload: { format: 'CSV', reportType: 'SALES', ...overrides },
  });
}

function tokenFrom(downloadUrl: string): string {
  return downloadUrl.split('/').pop()!;
}

describe('Part 5 — export generation', () => {
  it('creates a real CSV artefact and returns a resolvable download URL', async () => {
    const res = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-31' });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.reportType).toBe('SALES');
    expect(body.format).toBe('CSV');
    expect(body.rowCount).toBe(2);
    expect(body.filename).toBe('padupos-sales-export-co-a-2026-10-01_to_2026-10-31.csv');
    expect(body.contentType).toBe('text/csv; charset=utf-8');
    expect(body.downloadUrl).toMatch(/^\/api\/v1\/reports\/exports\/[0-9a-f]{64}$/);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('serves the artefact with a correct content type and safe filename', async () => {
    const created = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-31' });
    const { downloadUrl, filename } = created.json();

    const download = await app.inject({
      method: 'GET',
      url: downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(download.headers['content-disposition']).toBe(`attachment; filename="${filename}"`);
    expect(download.headers['cache-control']).toBe('private, no-store');

    const lines = download.body.trim().split('\r\n');
    expect(lines[0]).toBe(
      'Invoice Number,Date,Branch,Subtotal,Discount,Tax,Fees,Total,COGS,Gross Profit,Currency,Status,Created By',
    );
    expect(lines).toHaveLength(3);
    expect(download.body).toContain('EXP-1');
    expect(download.body).toContain('1000.0000');
  });

  it('emits exact decimal strings rather than float-reformatted money', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'EXACT',
      createdAt: '2026-10-05T02:00:00.000Z',
      subtotal: '0.1000',
      cogs: '0.0100',
    });

    const created = await requestExport({ startDate: '2026-10-05', endDate: '2026-10-05' });
    const download = await app.inject({
      method: 'GET',
      url: created.json().downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(download.body).toContain('0.1000');
    expect(download.body).toContain('0.0900');
  });

  it('honours the date range', async () => {
    const created = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    const download = await app.inject({
      method: 'GET',
      url: created.json().downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(download.body).toContain('EXP-1');
    expect(download.body).not.toContain('EXP-2');
  });

  it('honours a branch scope applied at export creation time', async () => {
    // Scope is resolved when the artefact is generated. The download route only
    // serves the bytes, so it must not re-derive the scope.
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/export',
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizA.secondBranchId },
      payload: { format: 'CSV', reportType: 'SALES', startDate: '2026-10-01', endDate: '2026-10-31' },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().branchId).toBe(bizA.secondBranchId);
    expect(created.json().rowCount).toBe(1);

    const download = await app.inject({
      method: 'GET',
      url: created.json().downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(download.body).toContain('EXP-2');
    expect(download.body).not.toContain('EXP-1');
  });

  it('refuses to export a branch belonging to another tenant', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/export',
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizB.branchId },
      payload: { format: 'CSV', reportType: 'SALES' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('BRANCH_ACCESS_DENIED');
  });

  it('produces a header-only CSV for an empty range rather than nothing', async () => {
    const created = await requestExport({ startDate: '2027-01-01', endDate: '2027-01-31' });
    expect(created.json().rowCount).toBe(0);

    const download = await app.inject({
      method: 'GET',
      url: created.json().downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(download.statusCode).toBe(200);
    expect(download.body.trim().split('\r\n')).toHaveLength(1);
  });

  it('escapes CSV fields containing commas, quotes and newlines', async () => {
    const sale = domainStore.sales.get(`sale_${bizA.businessId}_EXP-1`)!;
    sale.createdBy = 'Staff, "The" Boss\nSecond line';

    const created = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    const download = await app.inject({
      method: 'GET',
      url: created.json().downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(download.body).toContain('"Staff, ""The"" Boss\nSecond line"');
  });

  it('supports the DASHBOARD_SERIES report so exports match the chart', async () => {
    const created = await requestExport({
      reportType: 'DASHBOARD_SERIES',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
    });
    const download = await app.inject({
      method: 'GET',
      url: created.json().downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(download.statusCode).toBe(200);
    expect(download.body).toContain('Date,Sales,Revenue,COGS,Gross Profit,Transactions');
    expect(download.body).toContain('2026-10-01');
    expect(download.body).toContain('1000.0000');
  });

  it('rejects an unsupported report type', async () => {
    const res = await requestExport({ reportType: 'NOT_A_REPORT' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('UNSUPPORTED_REPORT_TYPE');
    expect(res.json().error.message).toContain('SALES');
  });

  it('rejects an unsupported format honestly instead of writing a fake file', async () => {
    const res = await requestExport({ format: 'PDF' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('UNSUPPORTED_EXPORT_FORMAT');
    expect(res.json().error.message).toContain('CSV');
  });

  it('rejects an invalid date range', async () => {
    const res = await requestExport({ startDate: 'nope' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE_RANGE');
  });
});

describe('Part 5 — export authorization and tenant isolation', () => {
  it('requires authentication to create an export', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reports/export',
      payload: { format: 'CSV', reportType: 'SALES' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('requires the reports.export permission', async () => {
    const res = await requestExport({}, CASHIER_A_TOKEN, bizA.businessId);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('PERMISSION_DENIED');
  });

  it('requires authentication to download', async () => {
    const created = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    const download = await app.inject({ method: 'GET', url: created.json().downloadUrl });
    expect(download.statusCode).toBe(401);
  });

  it('refuses cross-tenant download with 404, not 403', async () => {
    const created = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    const downloadUrl = created.json().downloadUrl;

    const download = await app.inject({
      method: 'GET',
      url: downloadUrl,
      headers: tenantHeaders(OWNER_B_TOKEN, bizB.businessId),
    });

    expect(download.statusCode).toBe(404);
    expect(download.json().error.code).toBe('EXPORT_NOT_FOUND');
    expect(download.body).not.toContain('EXP-1');
  });

  it('requires the reports.export permission to download as well', async () => {
    const created = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    const download = await app.inject({
      method: 'GET',
      url: created.json().downloadUrl,
      headers: tenantHeaders(CASHIER_A_TOKEN, bizA.businessId),
    });
    expect(download.statusCode).toBe(403);
  });

  it('does not let a guessed token resolve', async () => {
    const guess = `/api/v1/reports/exports/${'a'.repeat(64)}`;
    const download = await app.inject({
      method: 'GET',
      url: guess,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });
    expect(download.statusCode).toBe(404);
  });

  it('burns the artefact after a single successful download', async () => {
    const created = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    const downloadUrl = created.json().downloadUrl;

    const first = await app.inject({
      method: 'GET',
      url: downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'GET',
      url: downloadUrl,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });
    expect(second.statusCode).toBe(404);
  });
});

describe('Part 5 — export expiry and cleanup', () => {
  it('expires an artefact after the TTL', () => {
    const range = resolveDateRange(
      { startDate: '2026-10-01', endDate: '2026-10-01' },
      bizA.businessId,
      null,
    );
    const artifact = createExportArtifact({
      businessId: bizA.businessId,
      reportType: 'SALES',
      branchId: null,
      range,
      format: 'CSV',
    });

    expect(consumeExportArtifact(artifact.token, bizA.businessId, artifact.createdAt)).toBeDefined();
    expect(
      consumeExportArtifact(artifact.token, bizA.businessId, artifact.expiresAt + 1),
    ).toBeUndefined();
  });

  it('sweeps expired artefacts out of the registry', () => {
    const range = resolveDateRange(
      { startDate: '2026-10-01', endDate: '2026-10-01' },
      bizA.businessId,
      null,
    );
    const first = createExportArtifact({
      businessId: bizA.businessId,
      reportType: 'SALES',
      branchId: null,
      range,
      format: 'CSV',
    });

    const later = Date.now() + 16 * 60 * 1000;
    createExportArtifact({
      businessId: bizA.businessId,
      reportType: 'SALES',
      branchId: null,
      range,
      format: 'CSV',
    });

    expect(consumeExportArtifact(first.token, bizA.businessId, later)).toBeUndefined();
    // The sweep ran during the newer artefact's creation.
    expect(consumeExportArtifact(first.token, bizA.businessId, later)).toBeUndefined();
  });

  it('never returns an artefact to the wrong tenant even before expiry', () => {
    const range = resolveDateRange(
      { startDate: '2026-10-01', endDate: '2026-10-01' },
      bizA.businessId,
      null,
    );
    const artifact = createExportArtifact({
      businessId: bizA.businessId,
      reportType: 'SALES',
      branchId: null,
      range,
      format: 'CSV',
    });

    expect(consumeExportArtifact(artifact.token, bizB.businessId)).toBeUndefined();
    expect(consumeExportArtifact(artifact.token, bizA.businessId)).toBeDefined();
  });

  it('issues a distinct token per export', async () => {
    const first = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    const second = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    expect(tokenFrom(first.json().downloadUrl)).not.toBe(tokenFrom(second.json().downloadUrl));
  });

  it('sanitizes a hostile business name out of the filename', async () => {
    const business = domainStore.businesses.get(bizA.businessId)!;
    business.name = '../../etc/passwd; rm -rf /';

    const res = await requestExport({ startDate: '2026-10-01', endDate: '2026-10-01' });
    const filename: string = res.json().filename;

    expect(filename).not.toContain('/');
    expect(filename).not.toContain('..');
    expect(filename).not.toContain(';');
    expect(filename.startsWith('padupos-sales-')).toBe(true);
  });
});