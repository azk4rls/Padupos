import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting } from '../plugins/rbac.js';

describe('PADUPOS — Payment Provider Sandbox, Webhook & Idempotency Tests (Sections 17, 18, 46, 47, 48)', () => {
  const app = buildApp();
  const testUserId = 'test_owner_pay';

  beforeEach(() => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();
  });

  it('handles complete non-custodial digital payment lifecycle with verified webhook and idempotency', async () => {
    // 1. Setup Business & Branch
    const onboard = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${testUserId}` },
      payload: {
        name: 'Toko Elektronik Digital',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
      },
    });
    const businessId = onboard.json().business.id;
    const branchId = onboard.json().branch.id;
    const tenantHeaders = { authorization: `Bearer ${testUserId}`, 'x-business-id': businessId };

    // 2. Add product & stock
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: { name: 'Wireless Earbuds', sellingPrice: '250000', costPrice: '150000' },
    });
    const productId = prodRes.json().product.id;

    // Add stock adjustment
    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: tenantHeaders,
      payload: { branchId, productId, adjustedQuantity: '20', reason: 'Initial inventory' },
    });

    // 3. POS Checkout with QR payment -> Status is PENDING_PAYMENT
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items: [{ productId, quantity: '1', unitPrice: '250000' }],
        paymentMethod: 'QR',
        idempotencyKey: 'idem_qr_checkout_1',
      },
    });
    expect(checkoutRes.statusCode).toBe(201);
    const saleId = checkoutRes.json().sale.id;
    expect(checkoutRes.json().sale.status).toBe('PENDING_PAYMENT');

    // 4. Create Payment Request with provider
    const payRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: tenantHeaders,
      payload: {
        saleId,
        method: 'QR',
        customerName: 'Customer John',
      },
    });
    expect(payRes.statusCode).toBe(201);
    const payData = payRes.json();
    const providerPaymentId = payData.payment.providerPaymentId;
    const providerReference = payData.payment.providerReference;
    expect(providerPaymentId).toBeDefined();

    // 5. Test Invalid Signature Webhook -> Rejected with 401
    const invalidWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/payments/MOCK_SANDBOX',
      headers: { 'x-callback-token': 'wrong_token' },
      payload: {
        id: 'evt_tampered_1',
        payment_id: providerPaymentId,
        reference: providerReference,
        amount: '250000.0000',
        status: 'SUCCESS',
      },
    });
    expect(invalidWebhookRes.statusCode).toBe(401);
    expect(invalidWebhookRes.json().error.code).toBe('INVALID_SIGNATURE');

    // 6. Test Valid Verified Webhook -> Transitions to PAID, finalizes sale
    const validWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/payments/MOCK_SANDBOX',
      headers: { 'x-callback-token': 'valid_sandbox_token' },
      payload: {
        id: 'evt_valid_1',
        payment_id: providerPaymentId,
        reference: providerReference,
        amount: '250000.0000',
        currency: 'IDR',
        status: 'SUCCESS',
        paid_at: new Date().toISOString(),
      },
    });
    expect(validWebhookRes.statusCode).toBe(200);

    // Verify sale status is now PAID
    const saleRes = await app.inject({
      method: 'GET',
      url: `/api/v1/pos/sales/${saleId}/receipt`,
      headers: tenantHeaders,
    });
    expect(saleRes.json().receipt.status).toBe('PAID');

    // 7. Test Idempotent Duplicate Webhook -> Does not duplicate
    const duplicateWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/payments/MOCK_SANDBOX',
      headers: { 'x-callback-token': 'valid_sandbox_token' },
      payload: {
        id: 'evt_valid_1', // Same event ID
        payment_id: providerPaymentId,
        reference: providerReference,
        amount: '250000.0000',
        status: 'SUCCESS',
      },
    });
    expect(duplicateWebhookRes.statusCode).toBe(200);
    expect(duplicateWebhookRes.json().message).toBe('Event already processed');

    // 8. Verify Payment Reconciliation list contains MATCHED record
    const recRes = await app.inject({
      method: 'GET',
      url: '/api/v1/payments/reconciliation',
      headers: tenantHeaders,
    });
    expect(recRes.statusCode).toBe(200);
    const reconciliations = recRes.json().reconciliations;
    expect(reconciliations.length).toBeGreaterThanOrEqual(1);
    expect(reconciliations[0].status).toBe('MATCHED');
  });

  it('detects amount mismatch in webhook and flags PAYMENT_MISMATCH in reconciliation', async () => {
    // 1. Setup Business
    const onboard = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: 'Bearer user_mismatch' },
      payload: {
        name: 'Toko Mismatch',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
      },
    });
    const businessId = onboard.json().business.id;
    const branchId = onboard.json().branch.id;
    const tenantHeaders = { authorization: 'Bearer user_mismatch', 'x-business-id': businessId };

    // 2. Add product & stock
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: { name: 'Item Test', sellingPrice: '100000', costPrice: '50000' },
    });
    const productId = prodRes.json().product.id;
    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: tenantHeaders,
      payload: { branchId, productId, adjustedQuantity: '10', reason: 'Stock' },
    });

    // 3. Sale for 100000
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: { branchId, items: [{ productId, quantity: '1', unitPrice: '100000' }], paymentMethod: 'QR', idempotencyKey: 'idem_mismatch_1' },
    });
    const saleId = saleRes.json().sale.id;

    // 4. Create Payment
    const payRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: tenantHeaders,
      payload: { saleId, method: 'QR' },
    });
    const { providerPaymentId, providerReference } = payRes.json().payment;

    // 5. Send Webhook with DIFFERENT amount (e.g. 50000 instead of 100000)
    const mismatchWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/payments/MOCK_SANDBOX',
      headers: { 'x-callback-token': 'valid_sandbox_token' },
      payload: {
        id: 'evt_mismatch_1',
        payment_id: providerPaymentId,
        reference: providerReference,
        amount: '50000.0000', // Mismatch!
        currency: 'IDR',
        status: 'SUCCESS',
      },
    });
    expect(mismatchWebhookRes.statusCode).toBe(422);
    expect(mismatchWebhookRes.json().error.code).toBe('PAYMENT_MISMATCH');

    // 6. Verify Reconciliation flagged MISMATCH
    const recRes = await app.inject({
      method: 'GET',
      url: '/api/v1/payments/reconciliation',
      headers: tenantHeaders,
    });
    const mismatches = recRes.json().reconciliations.filter((r: any) => r.status === 'MISMATCH');
    expect(mismatches.length).toBe(1);
    expect(mismatches[0].providerAmount).toBe('50000.0000');
  });

  it('detects currency mismatch in webhook and flags PAYMENT_MISMATCH with 422', async () => {
    // 1. Setup Business
    const onboard = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: 'Bearer user_cur_mismatch' },
      payload: { name: 'Toko Cur Mismatch', businessType: 'RETAIL', countryCode: 'ID', currency: 'IDR' },
    });
    const businessId = onboard.json().business.id;
    const branchId = onboard.json().branch.id;
    const tenantHeaders = { authorization: 'Bearer user_cur_mismatch', 'x-business-id': businessId };

    // 2. Add product & stock
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: { name: 'Item Cur Test', sellingPrice: '100000', costPrice: '50000' },
    });
    const productId = prodRes.json().product.id;
    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: tenantHeaders,
      payload: { branchId, productId, adjustedQuantity: '10', reason: 'Stock' },
    });

    // 3. Sale for 100000 IDR
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: { branchId, items: [{ productId, quantity: '1', unitPrice: '100000' }], paymentMethod: 'QR', idempotencyKey: 'idem_cur_mismatch_1' },
    });
    const saleId = saleRes.json().sale.id;

    // 4. Create Payment
    const payRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: tenantHeaders,
      payload: { saleId, method: 'QR' },
    });
    const { providerPaymentId, providerReference } = payRes.json().payment;

    // 5. Send Webhook with WRONG currency (USD instead of IDR)
    const mismatchWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/payments/MOCK_SANDBOX',
      headers: { 'x-callback-token': 'valid_sandbox_token' },
      payload: {
        id: 'evt_cur_mismatch_1',
        payment_id: providerPaymentId,
        reference: providerReference,
        amount: '100000.0000',
        currency: 'USD', // Currency mismatch!
        status: 'SUCCESS',
      },
    });
    expect(mismatchWebhookRes.statusCode).toBe(422);
    expect(mismatchWebhookRes.json().error.code).toBe('PAYMENT_MISMATCH');
  });

  it('rejects cross-tenant payment request creation and reconciliation access', async () => {
    // Tenant A
    const onboardA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: 'Bearer user_tenant_a' },
      payload: { name: 'Tenant A Store', businessType: 'RETAIL', countryCode: 'ID', currency: 'IDR' },
    });
    const businessAId = onboardA.json().business.id;
    const branchAId = onboardA.json().branch.id;
    const tenantAHeaders = { authorization: 'Bearer user_tenant_a', 'x-business-id': businessAId };

    // Tenant B
    const onboardB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: 'Bearer user_tenant_b' },
      payload: { name: 'Tenant B Store', businessType: 'RETAIL', countryCode: 'ID', currency: 'IDR' },
    });
    const businessBId = onboardB.json().business.id;
    const tenantBHeaders = { authorization: 'Bearer user_tenant_b', 'x-business-id': businessBId };

    // Create product and sale in Tenant A
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantAHeaders,
      payload: { name: 'Tenant A Product', sellingPrice: '75000', costPrice: '40000' },
    });
    const productId = prodRes.json().product.id;
    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: tenantAHeaders,
      payload: { branchId: branchAId, productId, adjustedQuantity: '5', reason: 'Stock' },
    });
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantAHeaders,
      payload: { branchId: branchAId, items: [{ productId, quantity: '1', unitPrice: '75000' }], paymentMethod: 'QR', idempotencyKey: 'idem_iso_pay_1' },
    });
    const saleAId = saleRes.json().sale.id;

    // Tenant B attempts to create payment for Tenant A's sale -> 404 SALE_NOT_FOUND
    const crossPayRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: tenantBHeaders,
      payload: { saleId: saleAId, method: 'QR' },
    });
    expect(crossPayRes.statusCode).toBe(404);
    expect(crossPayRes.json().error.code).toBe('SALE_NOT_FOUND');
  });
});
