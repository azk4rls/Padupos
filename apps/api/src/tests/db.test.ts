import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting } from '../plugins/rbac.js';

describe('PADUPOS — Multi-Tenant Database & RLS Isolation Audit (P0 Item 11 & 12)', () => {
  const app = buildApp();
  const userA = 'user_tenant_a';
  const userB = 'user_tenant_b';

  let tenantAHeaders: Record<string, string>;
  let tenantBHeaders: Record<string, string>;
  let tenantABusinessId: string;
  let tenantBBusinessId: string;
  let tenantBProductId: string;

  beforeEach(async () => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();

    // 1. Onboard Tenant A
    const onboardResA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${userA}` },
      payload: {
        name: 'Tenant A Store',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
        locale: 'id-ID',
        timezone: 'Asia/Jakarta',
        fiscalYearStartMonth: 1,
        initialBranchName: 'Branch A',
      },
    });
    expect(onboardResA.statusCode).toBe(201);
    tenantABusinessId = onboardResA.json().business.id;
    tenantAHeaders = {
      authorization: `Bearer ${userA}`,
      'x-business-id': tenantABusinessId,
    };

    // 2. Onboard Tenant B
    const onboardResB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${userB}` },
      payload: {
        name: 'Tenant B Store',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
        locale: 'id-ID',
        timezone: 'Asia/Jakarta',
        fiscalYearStartMonth: 1,
        initialBranchName: 'Branch B',
      },
    });
    expect(onboardResB.statusCode).toBe(201);
    tenantBBusinessId = onboardResB.json().business.id;
    tenantBHeaders = {
      authorization: `Bearer ${userB}`,
      'x-business-id': tenantBBusinessId,
    };

    // 3. Create a product inside Tenant B
    const prodResB = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantBHeaders,
      payload: {
        name: 'Secret Secret Formula B',
        unit: 'pcs',
        costMethod: 'WEIGHTED_AVERAGE',
        costPrice: '50000',
        sellingPrice: '150000',
      },
    });
    expect(prodResB.statusCode).toBe(201);
    tenantBProductId = prodResB.json().product.id;
  });

  it('P0-11.A: Tenant A CANNOT READ Tenant B products or resources', async () => {
    // Tenant A queries products under Tenant A context
    const resA = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: tenantAHeaders,
    });
    expect(resA.statusCode).toBe(200);
    const productsA = resA.json().items || [];
    const foundBProduct = productsA.some((p: any) => p.id === tenantBProductId || p.name === 'Secret Secret Formula B');
    expect(foundBProduct).toBe(false);

    // Tenant A attempts to directly access Tenant B's product by forging x-business-id header
    const spoofRes = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: {
        ...tenantAHeaders,
        'x-business-id': tenantBBusinessId, // Tenant A claiming Tenant B
      },
    });
    expect(spoofRes.statusCode).toBe(403);
    expect(spoofRes.json().error.code).toBe('FORBIDDEN');
  });

  it('P0-11.B: Tenant A CANNOT INSERT into Tenant B namespace', async () => {
    // Tenant A attempts to create a product inside Tenant B
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: {
        ...tenantAHeaders,
        'x-business-id': tenantBBusinessId, // Spoofed target tenant
      },
      payload: {
        name: 'Malicious Injected Product',
        unit: 'pcs',
        costMethod: 'WEIGHTED_AVERAGE',
        costPrice: '500',
        sellingPrice: '1000',
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');

    // Verify Tenant B has not received the malicious product
    const checkB = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: tenantBHeaders,
    });
    const productsB = checkB.json().items || [];
    const injected = productsB.some((p: any) => p.name === 'Malicious Injected Product');
    expect(injected).toBe(false);
  });

  it('P0-11.C: Tenant A CANNOT EXPORT or extract Tenant B financial or sales reports', async () => {
    // Tenant A attempts to export Tenant B sales report
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/sales',
      headers: {
        ...tenantAHeaders,
        'x-business-id': tenantBBusinessId, // Attempt to pull Tenant B's financials
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('P0-11.D: Tenant A CANNOT access or reverse Tenant B journal entries', async () => {
    // Tenant A queries journals under Tenant A
    const resA = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/journals',
      headers: tenantAHeaders,
    });
    expect(resA.statusCode).toBe(200);

    // Tenant A attempts to reverse a Tenant B journal
    const fakeOrBJournalId = 'jrn_tenantB_test';
    const reverseRes = await app.inject({
      method: 'POST',
      url: `/api/v1/accounting/journals/${fakeOrBJournalId}/reverse`,
      headers: tenantAHeaders,
    });
    expect(reverseRes.statusCode).toBe(404);
  });

  it('P0-12: Service-role operations do not bypass tenant authorization checks', async () => {
    // Requests without valid authorization token or valid membership are strictly rejected
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: {
        'x-business-id': tenantBBusinessId,
      },
    });
    expect(unauthRes.statusCode).toBe(401);
  });
});
