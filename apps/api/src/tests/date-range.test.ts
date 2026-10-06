import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import {
  InvalidDateRangeError,
  addCalendarDays,
  countCalendarDays,
  enumerateDays,
  resolveDateRange,
  resolveScopeTimeZone,
  startOfMonth,
  startOfWeek,
  startOfZonedDay,
  todayInTimeZone,
  zonedWallTimeToInstant,
} from '../lib/dateRange.js';
import { domainStore } from '../modules/domainStore.js';
import {
  OWNER_A_TOKEN,
  onboardBusiness,
  resetAll,
  seedSale,
  tenantHeaders,
} from './fixtures/reports.js';

/**
 * Part 4 — date-range contract.
 *
 * Documented semantics under test:
 *   * bare `YYYY-MM-DD` is interpreted in the SCOPE timezone, never server-local
 *   * an ISO instant with a time REQUIRES an explicit UTC offset
 *   * startDate inclusive; endDate inclusive as a calendar day
 *     (internally a half-open [start, end+1day) interval)
 *   * branch timezone wins over business timezone when a branch is scoped
 */

const app = buildApp({ disableRateLimit: true });

const BIZ_ID = 'dr_business';
const BRANCH_ID = 'dr_branch';

function seedBusiness(timezone: string, branchTimezone?: string): void {
  domainStore.businesses.set(BIZ_ID, {
    id: BIZ_ID,
    ownerUserId: 'dr_owner',
    name: 'Date Range Co',
    businessType: 'RETAIL',
    countryCode: 'ID',
    currency: 'IDR',
    locale: 'id-ID',
    timezone,
    fiscalYearStartMonth: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);

  domainStore.branches.set(BRANCH_ID, {
    id: BRANCH_ID,
    businessId: BIZ_ID,
    name: 'Jakarta Outlet',
    code: 'JKT',
    ...(branchTimezone ? { timezone: branchTimezone } : {}),
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);
}

describe('Part 4 — date range: pure resolution semantics', () => {
  beforeEach(() => {
    resetAll();
    seedBusiness('Asia/Jakarta');
  });

  it('defaults to the current business-local calendar day when nothing is supplied', () => {
    const now = new Date('2026-10-05T20:00:00.000Z'); // 2026-10-06 03:00 in Jakarta
    const range = resolveDateRange({}, BIZ_ID, null, now);

    expect(range.timeZone).toBe('Asia/Jakarta');
    expect(range.startDate).toBe('2026-10-06');
    expect(range.endDate).toBe('2026-10-06');
    expect(range.dayCount).toBe(1);
  });

  it('treats startDate as inclusive', () => {
    const range = resolveDateRange({ startDate: '2026-10-01', endDate: '2026-10-03' }, BIZ_ID, null);
    // 2026-10-01T00:00 +07:00 == 2026-09-30T17:00Z
    expect(range.startInclusive.toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });

  it('treats endDate as an inclusive calendar day', () => {
    const range = resolveDateRange({ startDate: '2026-10-01', endDate: '2026-10-03' }, BIZ_ID, null);
    // exclusive bound is start of 2026-10-04 +07:00 == 2026-10-03T17:00Z
    expect(range.endExclusive.toISOString()).toBe('2026-10-03T17:00:00.000Z');
    expect(range.dayCount).toBe(3);
  });

  it('includes every instant of the final day, up to but excluding the next midnight', () => {
    const range = resolveDateRange({ startDate: '2026-10-01', endDate: '2026-10-01' }, BIZ_ID, null);
    const lastInstant = new Date('2026-10-01T16:59:59.999Z'); // 23:59:59.999 Jakarta
    const nextMidnight = new Date('2026-10-01T17:00:00.000Z');

    expect(lastInstant.getTime()).toBeLessThan(range.endExclusive.getTime());
    expect(nextMidnight.getTime()).toBe(range.endExclusive.getTime());
  });

  it('honours an explicit UTC offset rather than the scope timezone', () => {
    const range = resolveDateRange(
      { startDate: '2026-10-01T00:00:00Z', endDate: '2026-10-01T23:59:59Z' },
      BIZ_ID,
      null,
    );
    expect(range.startInclusive.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('rejects a timestamp with a time but no UTC offset', () => {
    expect(() =>
      resolveDateRange({ startDate: '2026-10-01T00:00:00' }, BIZ_ID, null),
    ).toThrowError(InvalidDateRangeError);
  });

  it('rejects an unparseable date', () => {
    expect(() => resolveDateRange({ startDate: 'yesterday' }, BIZ_ID, null)).toThrowError(
      InvalidDateRangeError,
    );
    expect(() => resolveDateRange({ endDate: '01-10-2026' }, BIZ_ID, null)).toThrowError(
      InvalidDateRangeError,
    );
  });

  it('rejects a calendar date that does not exist', () => {
    expect(() => resolveDateRange({ startDate: '2026-02-30' }, BIZ_ID, null)).toThrowError(
      InvalidDateRangeError,
    );
    expect(() => resolveDateRange({ startDate: '2026-13-01' }, BIZ_ID, null)).toThrowError(
      InvalidDateRangeError,
    );
  });

  it('rejects startDate after endDate', () => {
    expect(() =>
      resolveDateRange({ startDate: '2026-10-05', endDate: '2026-10-01' }, BIZ_ID, null),
    ).toThrowError(/must not be after/);
  });

  it('rejects an over-long range', () => {
    expect(() =>
      resolveDateRange({ startDate: '2020-01-01', endDate: '2026-01-01' }, BIZ_ID, null),
    ).toThrowError(/exceeds the maximum/);
  });

  it('supports an empty range result (a day with no activity)', () => {
    const range = resolveDateRange({ startDate: '2030-02-14', endDate: '2030-02-14' }, BIZ_ID, null);
    expect(range.dayCount).toBe(1);
    expect(enumerateDays(range)).toEqual(['2030-02-14']);
  });
});

describe('Part 4 — date range: timezone correctness', () => {
  beforeEach(() => {
    resetAll();
  });

  it('uses the branch timezone when a branch is scoped', () => {
    seedBusiness('Asia/Jakarta', 'America/New_York');
    expect(resolveScopeTimeZone(BIZ_ID, BRANCH_ID)).toBe('America/New_York');
    expect(resolveScopeTimeZone(BIZ_ID, null)).toBe('Asia/Jakarta');
  });

  it('falls back to UTC when the business declares no timezone', () => {
    domainStore.businesses.set('no_tz', { id: 'no_tz', name: 'No TZ' } as never);
    expect(resolveScopeTimeZone('no_tz', null)).toBe('UTC');
  });

  it('places a UTC instant on the correct local calendar day', () => {
    seedBusiness('Asia/Jakarta');
    // 2026-10-04T20:00Z is already 2026-10-05 in Jakarta (UTC+7).
    const instant = new Date('2026-10-04T20:00:00.000Z');
    expect(todayInTimeZone('Asia/Jakarta', instant)).toBe('2026-10-05');
    expect(todayInTimeZone('UTC', instant)).toBe('2026-10-04');
    expect(todayInTimeZone('America/New_York', instant)).toBe('2026-10-04');
  });

  it('resolves a DST spring-forward midnight correctly', () => {
    // 2026-03-08 02:00 does not exist in New York; midnight must still resolve.
    const start = startOfZonedDay('2026-03-08', 'America/New_York');
    expect(start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
  });

  it('keeps a full 24h day across a DST transition', () => {
    const start = startOfZonedDay('2026-03-08', 'America/New_York');
    const next = startOfZonedDay('2026-03-09', 'America/New_York');
    expect((next.getTime() - start.getTime()) / 3600000).toBe(23);
  });

  it('computes Monday-based week starts', () => {
    expect(startOfWeek('2026-10-08')).toBe('2026-10-05'); // Thursday -> Monday
    expect(startOfWeek('2026-10-05')).toBe('2026-10-05'); // Monday -> itself
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05'); // Sunday -> prior Monday
  });

  it('computes month starts and day counts', () => {
    expect(startOfMonth('2026-10-17')).toBe('2026-10-01');
    expect(countCalendarDays('2026-10-01', '2026-10-31')).toBe(31);
    expect(countCalendarDays('2026-02-01', '2026-02-28')).toBe(28);
    expect(countCalendarDays('2024-02-01', '2024-02-29')).toBe(29);
  });

  it('adds calendar days across month and year boundaries', () => {
    expect(addCalendarDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addCalendarDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('resolves wall-clock times in two zones to different instants', () => {
    const jakarta = zonedWallTimeToInstant(2026, 10, 5, 0, 0, 0, 'Asia/Jakarta');
    const newYork = zonedWallTimeToInstant(2026, 10, 5, 0, 0, 0, 'America/New_York');
    expect(jakarta.toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(newYork.toISOString()).toBe('2026-10-05T04:00:00.000Z');
  });
});

describe('Part 4 — date range: HTTP surface', () => {
  let biz: Awaited<ReturnType<typeof onboardBusiness>>;

  beforeEach(async () => {
    resetAll();
    biz = await onboardBusiness(app, OWNER_A_TOKEN, { name: 'HTTP Range Co' });
  });

  it('defaults the report to today when no dates are given', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/sales',
      headers: tenantHeaders(OWNER_A_TOKEN, biz.businessId),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.range.dayCount).toBe(1);
    expect(body.range.startDate).toBe(body.range.endDate);
    expect(body.scope.timeZone).toBe('Asia/Jakarta');
  });

  it('filters to a custom range', async () => {
    seedSale({
      businessId: biz.businessId,
      branchId: biz.branchId,
      invoiceNumber: 'IN-1',
      createdAt: '2026-03-05T02:00:00.000Z',
      subtotal: '1000.0000',
      cogs: '400.0000',
    });
    seedSale({
      businessId: biz.businessId,
      branchId: biz.branchId,
      invoiceNumber: 'IN-2',
      createdAt: '2026-03-20T02:00:00.000Z',
      subtotal: '2000.0000',
      cogs: '800.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/sales?startDate=2026-03-01&endDate=2026-03-31',
      headers: tenantHeaders(OWNER_A_TOKEN, biz.businessId),
    });

    const body = res.json();
    expect(body.range.dayCount).toBe(31);
    expect(body.summary.totalRevenue).toBe('3000.0000');
    expect(body.sales).toHaveLength(2);
  });

  it('returns an honest empty result for a range with no activity', async () => {
    seedSale({
      businessId: biz.businessId,
      branchId: biz.branchId,
      invoiceNumber: 'IN-1',
      createdAt: '2026-03-05T02:00:00.000Z',
      subtotal: '1000.0000',
      cogs: '400.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/sales?startDate=2026-05-01&endDate=2026-05-31',
      headers: tenantHeaders(OWNER_A_TOKEN, biz.businessId),
    });

    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.sales).toEqual([]);
    expect(body.summary.totalRevenue).toBe('0.0000');
    expect(body.summary.transactionCount).toBe(0);
  });

  it('respects inclusive boundary dates', async () => {
    seedSale({
      businessId: biz.businessId,
      branchId: biz.branchId,
      invoiceNumber: 'FIRST',
      createdAt: '2026-04-01T00:00:00.000Z', // exactly local midnight 01 Apr
      subtotal: '111.0000',
      cogs: '11.0000',
    });
    seedSale({
      businessId: biz.businessId,
      branchId: biz.branchId,
      invoiceNumber: 'LAST',
      createdAt: '2026-04-30T16:59:59.999Z', // last millisecond of 30 Apr in Jakarta
      subtotal: '222.0000',
      cogs: '22.0000',
    });
    seedSale({
      businessId: biz.businessId,
      branchId: biz.branchId,
      invoiceNumber: 'AFTER',
      createdAt: '2026-04-30T17:00:00.000Z', // first instant of 01 May in Jakarta
      subtotal: '333.0000',
      cogs: '33.0000',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/sales?startDate=2026-04-01&endDate=2026-04-30',
      headers: tenantHeaders(OWNER_A_TOKEN, biz.businessId),
    });

    const body = res.json();
    expect(body.summary.transactionCount).toBe(2);
    expect(body.summary.totalRevenue).toBe('333.0000');
  });

  it('rejects an invalid date with 400 and a machine-readable code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/sales?startDate=not-a-date',
      headers: tenantHeaders(OWNER_A_TOKEN, biz.businessId),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE_RANGE');
    expect(res.json().error.message).toContain('startDate');
  });

  it('rejects an inverted range with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/sales?startDate=2026-04-30&endDate=2026-04-01',
      headers: tenantHeaders(OWNER_A_TOKEN, biz.businessId),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE_RANGE');
  });

  it('applies the same contract to the dashboard', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics?startDate=2026-06-01&endDate=2026-06-30',
      headers: tenantHeaders(OWNER_A_TOKEN, biz.businessId),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().metrics.range.dayCount).toBe(30);
  });

  it('rejects an invalid date on the dashboard too', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics?endDate=2026-02-30',
      headers: tenantHeaders(OWNER_A_TOKEN, biz.businessId),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE_RANGE');
  });
});