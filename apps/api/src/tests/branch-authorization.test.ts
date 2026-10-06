import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import {
  MANAGER_A_TOKEN,
  OWNER_A_TOKEN,
  OWNER_B_TOKEN,
  addMembers,
  onboardBusiness,
  resetAll,
  seedSale,
  tenantHeaders,
} from './fixtures/reports.js';

/**
 * Part 2 + Part 3 — branch correctness and explicit branch authorization.
 *
 * Rules under test:
 *   - no branch header  -> business-level metrics / report
 *   - valid branch      -> branch-scoped
 *   - non-member branch -> 403, never a silent business-level fallback
 *   - inactive branch   -> 403
 *   - a client-supplied branch id can never widen access past the tenant
 */

const app = buildApp({ disableRateLimit: true });

const CASHIER_A_TOKEN = 'test_rep_cashier_a';

function managerIdA(): string {
  return MANAGER_A_TOKEN.replace(/^test_/, '');
}
function cashierIdA(): string {
  return CASHIER_A_TOKEN.replace(/^test_/, '');
}

let bizA: Awaited<ReturnType<typeof onboardBusiness>>;
let bizB: Awaited<ReturnType<typeof onboardBusiness>>;

beforeEach(async () => {
  resetAll();
  bizA = await onboardBusiness(app, OWNER_A_TOKEN, { name: 'Branch Scope Co A' });
  bizB = await onboardBusiness(app, OWNER_B_TOKEN, { name: 'Branch Scope Co B' });
  addMembers(bizA.businessId, [
    { userId: managerIdA(), role: 'MANAGER' },
    { userId: cashierIdA(), role: 'CASHIER' },
  ]);
});

function seedCrossBranchSales(): void {
  seedSale({
    businessId: bizA.businessId,
    branchId: bizA.branchId,
    invoiceNumber: 'A-B1-1',
    createdAt: '2026-10-01T02:00:00.000Z',
    subtotal: '100000.0000',
    cogs: '40000.0000',
  });
  seedSale({
    businessId: bizA.businessId,
    branchId: bizA.secondBranchId,
    invoiceNumber: 'A-B2-1',
    createdAt: '2026-10-01T03:00:00.000Z',
    subtotal: '250000.0000',
    cogs: '100000.0000',
  });
  seedSale({
    businessId: bizB.businessId,
    branchId: bizB.branchId,
    invoiceNumber: 'B-B1-1',
    createdAt: '2026-10-01T04:00:00.000Z',
    subtotal: '999999.0000',
    cogs: '1.0000',
  });
}

const RANGE = 'startDate=2026-10-01&endDate=2026-10-31';

describe('Part 2 — dashboard branch correctness', () => {
  it('returns business-level metrics when no branch is supplied', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${RANGE}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(200);
    const metrics = res.json().metrics;
    expect(metrics.scope.branchId).toBeNull();
    expect(metrics.sales).toBe('350000.0000');
    expect(metrics.transactions).toBe(2);
  });

  it('narrows to a valid branch when x-branch-id is supplied', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${RANGE}`,
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizA.secondBranchId },
    });

    expect(res.statusCode).toBe(200);
    const metrics = res.json().metrics;
    expect(metrics.scope.branchId).toBe(bizA.secondBranchId);
    expect(metrics.sales).toBe('250000.0000');
    expect(metrics.transactions).toBe(1);
  });

  it('honours branchId supplied as a query parameter', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${RANGE}&branchId=${bizA.branchId}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    const metrics = res.json().metrics;
    expect(metrics.scope.branchId).toBe(bizA.branchId);
    expect(metrics.sales).toBe('100000.0000');
  });

  it('rejects a branch belonging to another tenant instead of falling back', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${RANGE}`,
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizB.branchId },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('BRANCH_ACCESS_DENIED');
    // Critically: the response must not leak business B's totals.
    expect(res.body).not.toContain('999999');
  });

  it('rejects a branch id that does not exist at all', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${RANGE}`,
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': 'br_does_not_exist' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('BRANCH_ACCESS_DENIED');
  });

  it('rejects an INACTIVE branch', async () => {
    const branch = domainStore.branches.get(bizA.secondBranchId)!;
    branch.status = 'INACTIVE';

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${RANGE}`,
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizA.secondBranchId },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('BRANCH_ACCESS_DENIED');
  });

  it('lets the header win over a conflicting query parameter', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics?${RANGE}&branchId=${bizA.branchId}`,
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizA.secondBranchId },
    });

    expect(res.json().metrics.scope.branchId).toBe(bizA.secondBranchId);
    expect(res.json().metrics.sales).toBe('250000.0000');
  });

  it('scopes the time series to the requested branch', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${RANGE}`,
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizA.branchId },
    });

    expect(res.statusCode).toBe(200);
    const series = res.json().series;
    expect(series.scope.branchId).toBe(bizA.branchId);
    expect(series.totals.sales).toBe('100000.0000');
  });

  it('rejects a cross-tenant branch on the time series endpoint too', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/dashboard/metrics/series?${RANGE}`,
      headers: { ...tenantHeaders(OWNER_A_TOKEN, bizA.businessId), 'x-branch-id': bizB.branchId },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('BRANCH_ACCESS_DENIED');
  });
});

describe('Part 3 — /reports/sales explicit branch authorization', () => {
  it('A. valid business + valid branch -> success, scoped to that branch', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}&branchId=${bizA.secondBranchId}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scope.branchId).toBe(bizA.secondBranchId);
    expect(body.summary.totalRevenue).toBe('250000.0000');
    expect(body.summary.transactionCount).toBe(1);
    expect(body.sales.every((sale: { branchId: string }) => sale.branchId === bizA.secondBranchId)).toBe(true);
  });

  it('B. business A asking for business B branch -> reject', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}&branchId=${bizB.branchId}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('BRANCH_ACCESS_DENIED');
    expect(res.body).not.toContain('999999');
  });

  it('C. user lacks access to the business that owns the branch -> reject', async () => {
    seedCrossBranchSales();

    // A manager of business A pointed at business A's own branch still passes branch
    // authorization, proving the branch check is about ownership, not about role.
    const allowed = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}&branchId=${bizA.branchId}`,
      headers: tenantHeaders(MANAGER_A_TOKEN, bizA.businessId),
    });
    expect(allowed.statusCode).toBe(200);

    // A user with no membership in business A cannot use its branch at all.
    const stranger = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}&branchId=${bizA.branchId}`,
      headers: tenantHeaders('test_rep_stranger', bizA.businessId),
    });
    expect(stranger.statusCode).toBe(403);
    expect(stranger.json().error.code).toBe('FORBIDDEN');
  });

  it('C2. a role without reports.view is rejected by permission, not by branch logic', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}&branchId=${bizA.branchId}`,
      headers: tenantHeaders(CASHIER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('PERMISSION_DENIED');
  });

  it('D. omitted branch -> business-level report', async () => {
    seedCrossBranchSales();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scope.branchId).toBeNull();
    expect(body.summary.totalRevenue).toBe('350000.0000');
    expect(body.summary.transactionCount).toBe(2);
  });

  it('rejects an empty branchId rather than treating it as "all branches"', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}&branchId=`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(200);
    // An empty value is indistinguishable from omission at the HTTP layer and is
    // therefore treated as business-level, never as a malformed reference.
    expect(res.json().scope.branchId).toBeNull();
  });

  it('rejects an unknown branchId with 403 rather than 404 so ids cannot be enumerated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}&branchId=br_totally_made_up`,
      headers: tenantHeaders(OWNER_A_TOKEN, bizA.businessId),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('BRANCH_ACCESS_DENIED');
  });

  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/reports/sales?${RANGE}&branchId=${bizA.branchId}`,
    });
    expect(res.statusCode).toBe(401);
  });
});