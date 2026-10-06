import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import {
  OWNER_A_TOKEN,
  OWNER_B_TOKEN,
  onboardBusiness,
  resetAll,
  seedSale,
  tenantHeaders,
} from './fixtures/reports.js';

/**
 * Part 6 — dashboard daily time series.
 *
 * Granularity: DAY, in the scope timezone.
 * Every day in the requested range is emitted. A zero is a real assertion about a
 * calendar day with no activity, which is what lets a chart plot without gaps.
 */

const app = buildApp({ disableRateLimit: true });

let bizA: Awaited<ReturnType<typeof onboardBusiness>>;
let bizB: Awaited<ReturnType<typeof onboardBusiness>>;

beforeEach(async () => {
  resetAll();
  bizA = await onboardBusiness(app, OWNER_A_TOKEN, { name: 'Series Co A' });
  bizB = await onboardBusiness(app, OWNER_B_TOKEN, { name: 'Series Co B' });
});

function seriesQuery(startDate: string, endDate: string): string {
  return `startDate=${startDate}&endDate=${endDate}`;
}

describe('Part 6 — dashboard time series', () => {
  it('returns an empty but fully-shaped series for a business with no sales', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-05')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(200);
    const series = res.json().series;
    expect(series.granularity).toBe('DAY');
    expect(series.scope.branchId).toBeNull();
    expect(series.series).toHaveLength(5);
    expect(series.series.map((point: { date: string }) => point.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ]);
    for (const point of series.series) {
      expect(point.sales).toBe('0.0000');
      expect(point.grossProfit).toBe('0.0000');
      expect(point.transactions).toBe(0);
    }
    expect(series.totals.sales).toBe('0.0000');
    expect(series.totals.transactions).toBe(0);
  });

  it('buckets sales onto multiple distinct dates', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'S1',
      createdAt: '2026-10-01T04:00:00.000Z',
      subtotal: '100.0000',
      cogs: '40.0000',
    });
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'S2',
      createdAt: '2026-10-01T09:00:00.000Z',
      subtotal: '200.0000',
      cogs: '60.0000',
    });
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'S3',
      createdAt: '2026-10-03T04:00:00.000Z',
      subtotal: '50.0000',
      cogs: '25.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-04')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    const series = res.json().series;
    expect(series.series).toHaveLength(4);

    const first = series.series[0];
    expect(first.date).toBe('2026-10-01');
    expect(first.sales).toBe('300.0000');
    expect(first.cogs).toBe('100.0000');
    expect(first.grossProfit).toBe('200.0000');
    expect(first.transactions).toBe(2);

    // 2026-10-02 genuinely had no sales.
    expect(series.series[1].sales).toBe('0.0000');

    expect(series.series[2].date).toBe('2026-10-03');
    expect(series.series[2].sales).toBe('50.0000');

    expect(series.totals.sales).toBe('350.0000');
    expect(series.totals.grossProfit).toBe('225.0000');
    expect(series.totals.transactions).toBe(3);
  });

  it('buckets by business-local day, not UTC day', async () => {
    // 2026-10-04T20:00Z is 2026-10-05 03:00 in Jakarta.
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'LATE',
      createdAt: '2026-10-04T20:00:00.000Z',
      subtotal: '750.0000',
      cogs: '250.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-04', '2026-10-05')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    const series = res.json().series;
    expect(series.series[0].date).toBe('2026-10-04');
    expect(series.series[0].sales).toBe('0.0000');
    expect(series.series[1].date).toBe('2026-10-05');
    expect(series.series[1].sales).toBe('750.0000');
  });

  it('scopes the series to a branch', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'B1',
      createdAt: '2026-10-02T02:00:00.000Z',
      subtotal: '1000.0000',
      cogs: '400.0000',
    });
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.secondBranchId,
      invoiceNumber: 'B2',
      createdAt: '2026-10-02T03:00:00.000Z',
      subtotal: '2500.0000',
      cogs: '1000.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-03')}`,
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizA.branchId },
    });

    const series = res.json().series;
    expect(series.scope.branchId).toBe(bizA.branchId);
    expect(series.totals.sales).toBe('1000.0000');
    expect(series.series[1].sales).toBe('1000.0000');
  });

  it('excludes sales outside the requested date range', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'INSIDE',
      createdAt: '2026-10-10T02:00:00.000Z',
      subtotal: '500.0000',
      cogs: '200.0000',
    });
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'BEFORE',
      createdAt: '2026-10-09T16:59:59.999Z',
      subtotal: '999.0000',
      cogs: '1.0000',
    });
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'AFTER',
      createdAt: '2026-10-11T17:00:00.000Z',
      subtotal: '888.0000',
      cogs: '1.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-10', '2026-10-10')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    const series = res.json().series;
    expect(series.series).toHaveLength(1);
    expect(series.totals.sales).toBe('500.0000');
    expect(series.totals.transactions).toBe(1);
  });

  it('isolates tenants', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'A-ONLY',
      createdAt: '2026-10-01T02:00:00.000Z',
      subtotal: '111.0000',
      cogs: '11.0000',
    });
    seedSale({
      businessId: bizB.businessId,
      branchId: bizB.branchId,
      invoiceNumber: 'B-ONLY',
      createdAt: '2026-10-01T02:00:00.000Z',
      subtotal: '777.0000',
      cogs: '77.0000',
    });

    const viewA = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-02')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });
    const viewB = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-02')}`,
      headers: tenantHeaders(OWNER_B_TOKEN, bizB.businessId),
    });

    expect(viewA.json().series.totals.sales).toBe('111.0000');
    expect(viewB.json().series.totals.sales).toBe('777.0000');
    expect(viewA.body).not.toContain('777');
  });

  it('keeps exact decimals that a float could not represent', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'EXACT',
      createdAt: '2026-10-01T02:00:00.000Z',
      subtotal: '0.1000',
      cogs: '0.0100',
    });
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'EXACT2',
      createdAt: '2026-10-01T03:00:00.000Z',
      subtotal: '0.2000',
      cogs: '0.0100',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-01')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    const series = res.json().series;
    expect(series.series[0].sales).toBe('0.3000');
    expect(series.series[0].cogs).toBe('0.0200');
    expect(series.series[0].grossProfit).toBe('0.2800');
    expect(series.totals.sales).toBe('0.3000');
  });

  it('excludes non-PAID sales', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'PAID',
      createdAt: '2026-10-01T02:00:00.000Z',
      subtotal: '100.0000',
      cogs: '10.0000',
    });
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'REFUNDED',
      createdAt: '2026-10-01T03:00:00.000Z',
      subtotal: '9999.0000',
      cogs: '1.0000',
      status: 'REFUNDED',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-01')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.json().series.totals.sales).toBe('100.0000');
  });

  it('requires authentication and a tenant header', async () => {
    const anonymous = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-02')}`,
    });
    expect(anonymous.statusCode).toBe(401);

    const noTenant = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-02')}`,
      headers: { authorization: `Bearer ${OWNER_A_TOKEN}` },
    });
    expect(noTenant.statusCode).toBe(400);
    expect(noTenant.json().error.code).toBe('TENANT_REQUIRED');
  });

  it('agrees with the dashboard metrics totals for the same range', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'M1',
      createdAt: '2026-10-02T02:00:00.000Z',
      subtotal: '1000.0000',
      cogs: '400.0000',
    });
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'M2',
      createdAt: '2026-10-03T02:00:00.000Z',
      subtotal: '2500.0000',
      cogs: '1000.0000',
    });

    const query = seriesQuery('2026-10-01', '2026-10-31');
    const [metricsRes, seriesRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/metrics?${query}`,
        headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/dashboard/metrics/series?${query}`,
        headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
      }),
    ]);

    const metrics = metricsRes.json().metrics;
    const series = seriesRes.json().series;
    expect(series.totals.sales).toBe(metrics.sales);
    expect(series.totals.grossProfit).toBe(metrics.grossProfit);
    expect(series.totals.cogs).toBe(metrics.totalCOGS);
    expect(series.totals.transactions).toBe(metrics.transactions);
  });

  it('reports a loss as negative gross profit on the affected day', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'LOSS',
      createdAt: '2026-10-07T02:00:00.000Z',
      subtotal: '100.0000',
      cogs: '250.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-07', '2026-10-07')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.json().series.series[0].grossProfit).toBe('-150.0000');
  });

  it('rejects an invalid date range before doing any work', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics/series?startDate=oops',
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE_RANGE');
  });

  it('never leaks inventory or journal data into the series payload', async () => {
    // A business with ledger activity but no sales must still produce a clean shape.
    domainStore.journalEntries.set('leak_check', {
      id: 'leak_check',
      businessId: bizA.businessId,
      entryNumber: 'X',
      entryDate: '2026-10-01',
      description: 'x',
      sourceType: 'MANUAL',
      isPosted: true,
      createdBy: 'seed',
      createdAt: '2026-10-01T00:00:00.000Z',
    } as never);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${seriesQuery('2026-10-01', '2026-10-01')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.json().series.totals.sales).toBe('0.0000');
    expect(res.body).not.toContain('journalEntries');
  });

  it('returns a payment-mix total so the frontend never sums money itself', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'MIX-1',
      createdAt: '2026-10-01T09:00:00.000Z',
      subtotal: '100000.0000',
      cogs: '40000.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${seriesQuery('2026-10-01', '2026-10-31')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(200);
    const metrics = res.json().metrics;
    expect(metrics.paymentDistributionTotal).toBeDefined();

    // The total must equal the exact sum of the breakdown, computed in decimal.
    const summed = Object.values(metrics.paymentDistribution as Record<string, string>)
      .reduce((acc, value) => acc + Number(value), 0)
      .toFixed(4);
    expect(metrics.paymentDistributionTotal).toBe(summed);
  });

  it('excludes payments settled outside the requested window', async () => {
    seedSale({
      businessId: bizA.businessId,
      branchId: bizA.branchId,
      invoiceNumber: 'MIX-2',
      createdAt: '2026-10-05T09:00:00.000Z',
      subtotal: '50000.0000',
      cogs: '20000.0000',
    });
    const saleId = `sale_${bizA.businessId}_MIX-2`;

    // One payment settled inside the window, one long after it. The mix must
    // describe the requested window only, not all business history.
    domainStore.payments.set('pay_inside', {
      id: 'pay_inside',
      businessId: bizA.businessId,
      saleId,
      provider: 'CASH',
      method: 'CASH',
      amount: '50000.0000',
      currency: 'IDR',
      status: 'PAID',
      settlementStatus: 'SETTLED',
      paidAt: '2026-10-06T09:00:00.000Z',
      createdAt: '2026-10-06T09:00:00.000Z',
      updatedAt: '2026-10-06T09:00:00.000Z',
    } as never);

    domainStore.payments.set('pay_late', {
      id: 'pay_late',
      businessId: bizA.businessId,
      saleId,
      provider: 'CASH',
      method: 'QRIS',
      amount: '50000.0000',
      currency: 'IDR',
      status: 'PAID',
      settlementStatus: 'SETTLED',
      paidAt: '2026-11-20T09:00:00.000Z',
      createdAt: '2026-11-20T09:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    } as never);

    const inWindow = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${seriesQuery('2026-10-01', '2026-10-31')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });
    const laterWindow = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${seriesQuery('2026-11-01', '2026-11-30')}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(inWindow.json().metrics.paymentDistribution).toEqual({ CASH: '50000.0000' });
    expect(inWindow.json().metrics.paymentDistributionTotal).toBe('50000.0000');
    expect(laterWindow.json().metrics.paymentDistribution).toEqual({ QRIS: '50000.0000' });
  });
});