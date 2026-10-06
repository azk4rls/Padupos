import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting, registerMemberForTesting } from '../plugins/rbac.js';

describe('PADUPOS â€” Multi-Tenant Isolation & RBAC Security Tests (Sections 97, 98, 170, 171)', () => {
  const app = buildApp();

  beforeEach(() => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();
  });

  it('strictly enforces multi-tenant boundary: Tenant A cannot access Tenant B data', async () => {
    // 1. Create Business A
    const onboardA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: 'Bearer user_A' },
      payload: {
        name: 'Business Alpha',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
      },
    });
    const bizA = onboardA.json().business.id;

    // 2. Create Business B
    const onboardB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: 'Bearer user_B' },
      payload: {
        name: 'Business Beta',
        businessType: 'RETAIL',
        countryCode: 'SG',
        currency: 'SGD',
      },
    });
    const bizB = onboardB.json().business.id;

    // 3. Business A creates Product A
    const prodARes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: { authorization: 'Bearer user_A', 'x-business-id': bizA },
      payload: {
        name: 'Product Alpha Special',
        sellingPrice: '50000',
      },
    });
    const prodAId = prodARes.json().product.id;

    // 4. Tenant B attempts to read Product A using Tenant B context -> Must be rejected (404 NOT FOUND or 403)
    const crossTenantRead = await app.inject({
      method: 'GET',
      url: `/api/v1/products/${prodAId}`,
      headers: { authorization: 'Bearer user_B', 'x-business-id': bizB },
    });
    expect(crossTenantRead.statusCode).toBe(404);

    // 5. Tenant B attempts to access Business A directly -> Must be rejected (403 FORBIDDEN)
    const crossTenantAccess = await app.inject({
      method: 'GET',
      url: `/api/v1/businesses/${bizA}`,
      headers: { authorization: 'Bearer user_B', 'x-business-id': bizA },
    });
    expect(crossTenantAccess.statusCode).toBe(403);
  });

  it('strictly enforces RBAC: Cashier cannot modify business settings or access restricted finance', async () => {
    // 1. Owner creates Business
    const onboard = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: 'Bearer owner_user' },
      payload: {
        name: 'Toko Roti Makmur',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
      },
    });
    const businessId = onboard.json().business.id;

    // 2. Register a user as CASHIER
    registerMemberForTesting(businessId, 'cashier_user', 'CASHIER');

    const cashierHeaders = {
      authorization: 'Bearer cashier_user',
      'x-business-id': businessId,
    };

    // 3. Cashier CAN view products
    const prodRes = await app.inject({
      method: 'GET',
      url: '/api/v1/products',
      headers: cashierHeaders,
    });
    expect(prodRes.statusCode).toBe(200);

    // 4. Cashier CANNOT update business settings (requires settings.manage)
    const settingsRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/businesses/${businessId}`,
      headers: cashierHeaders,
      payload: { name: 'Hacked Name' },
    });
    expect(settingsRes.statusCode).toBe(403);
    expect(settingsRes.json().error.code).toBe('PERMISSION_DENIED');

    // 5. Cashier CANNOT create expense (requires finance.create)
    const expenseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/expenses',
      headers: cashierHeaders,
      payload: {
        categoryId: '00000000-0000-0000-0000-000000000001',
        amount: '50000',
        currency: 'IDR',
        paymentMethod: 'CASH',
        description: 'Unauthorized Cash Disbursement',
        incurredAt: new Date().toISOString(),
      },
    });
    expect(expenseRes.statusCode).toBe(403);
    expect(expenseRes.json().error.code).toBe('PERMISSION_DENIED');
  });
});

// ================================================================
// Rate limiting — the only suite that runs WITH the limiter enabled.
// ================================================================
describe('PADUPOS - Rate Limiting', () => {
  const limitedApp = buildApp();

  it('throttles a flood of requests with 429', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const res = await limitedApp.inject({ method: 'GET', url: '/health' });
      statuses.push(res.statusCode);
    }
    expect(statuses).toContain(429);
  });
});