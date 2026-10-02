import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting } from '../plugins/rbac.js';

describe('PADUPOS — Refund & Returns Accounting Audit (Point 2)', () => {
  const app = buildApp();
  const testUserId = 'test_owner_refund';

  let businessId: string;
  let branchId: string;
  let tenantHeaders: Record<string, string>;
  let productId: string;

  beforeEach(async () => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();

    // 1. Setup Business & Branch
    const onboard = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${testUserId}` },
      payload: {
        name: 'Toko Refund Test',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
      },
    });
    businessId = onboard.json().business.id;
    branchId = onboard.json().branch.id;
    tenantHeaders = { authorization: `Bearer ${testUserId}`, 'x-business-id': businessId };

    // 2. Add Product & Stock (cost 50,000, price 100,000)
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: { name: 'Kemeja Katun', sellingPrice: '100000', costPrice: '50000' },
    });
    productId = prodRes.json().product.id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: tenantHeaders,
      payload: { branchId, productId, adjustedQuantity: '20', reason: 'Initial stock' },
    });
  });

  it('Case A: processes Cash sale refund with restock and creates balanced double-entry journal', async () => {
    // 1. Finalize Cash Sale (2 units = 200,000 IDR)
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items: [{ productId, quantity: '2', unitPrice: '100000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_refund_cash_1',
      },
    });
    expect(saleRes.statusCode).toBe(201);
    const sale = saleRes.json().sale;
    const saleItem = saleRes.json().items[0];

    // Inventory after sale: 20 - 2 = 18
    const invKey = `${branchId}:${productId}:`;
    expect(domainStore.inventories.get(invKey)?.quantity).toBe('18.0000');

    // 2. Process Return / Refund with restock
    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sales/${sale.id}/returns`,
      headers: tenantHeaders,
      payload: {
        reason: 'Wrong size customer requested return',
        items: [{ saleItemId: saleItem.id, quantity: '2', restockToInventory: true }],
      },
    });
    expect(refundRes.statusCode).toBe(201);
    const returnData = refundRes.json();
    expect(returnData.return.refundAmount).toBe('200000.0000');

    // 3. Verify Inventory restored: 18 + 2 = 20
    expect(domainStore.inventories.get(invKey)?.quantity).toBe('20.0000');

    // 4. Verify Double-Entry Journal Lines
    const jrn = returnData.journalEntry;
    expect(jrn).toBeDefined();
    expect(jrn.sourceType).toBe('REFUND');

    // Returns & Allowances (4020) Debited 200,000
    const returnsLine = jrn.lines.find((l: any) => l.accountId === `acc_${businessId}_4020`);
    expect(returnsLine.debit).toBe('200000.0000');
    expect(returnsLine.credit).toBe('0.0000');

    // Cash on Hand (1010) Credited 200,000
    const cashLine = jrn.lines.find((l: any) => l.accountId === `acc_${businessId}_1010`);
    expect(cashLine.debit).toBe('0.0000');
    expect(cashLine.credit).toBe('200000.0000');

    // Merchandise Inventory (1050) Debited 100,000 (2 * 50,000 cost)
    const invLine = jrn.lines.find((l: any) => l.accountId === `acc_${businessId}_1050`);
    expect(invLine.debit).toBe('100000.0000');
    expect(invLine.credit).toBe('0.0000');

    // COGS (5010) Credited 100,000
    const cogsLine = jrn.lines.find((l: any) => l.accountId === `acc_${businessId}_5010`);
    expect(cogsLine.debit).toBe('0.0000');
    expect(cogsLine.credit).toBe('100000.0000');

    // 5. Verify Trial Balance remains balanced
    const tbRes = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/trial-balance',
      headers: tenantHeaders,
    });
    expect(tbRes.json().isBalanced).toBe(true);
    expect(tbRes.json().difference).toBe('0.0000');
  });

  it('Case B: processes Gateway payment refund BEFORE settlement (credits Payment Gateway Clearing)', async () => {
    // 1. Digital Sale
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items: [{ productId, quantity: '1', unitPrice: '100000' }],
        paymentMethod: 'QR',
        idempotencyKey: 'idem_refund_gw_presettle',
      },
    });
    const sale = saleRes.json().sale;
    const saleItem = saleRes.json().items[0];

    // 2. Create Payment & simulate verified webhook (PAID, but settlementStatus NOT_SETTLED)
    const payRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: tenantHeaders,
      payload: { saleId: sale.id, method: 'QR' },
    });
    const { providerPaymentId, providerReference } = payRes.json().payment;

    await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/payments/MOCK_SANDBOX',
      headers: { 'x-callback-token': 'valid_sandbox_token' },
      payload: {
        id: 'evt_presettle_1',
        payment_id: providerPaymentId,
        reference: providerReference,
        amount: '100000.0000',
        currency: 'IDR',
        status: 'SUCCESS',
      },
    });

    // Mark payment settlementStatus explicitly as NOT_SETTLED
    const p = domainStore.payments.get(payRes.json().payment.id)!;
    p.settlementStatus = 'NOT_SETTLED';

    // 3. Process Refund
    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sales/${sale.id}/returns`,
      headers: tenantHeaders,
      payload: {
        reason: 'Refund before settlement',
        items: [{ saleItemId: saleItem.id, quantity: '1', restockToInventory: true }],
      },
    });
    expect(refundRes.statusCode).toBe(201);
    const jrn = refundRes.json().journalEntry;

    // Credits Gateway Clearing (1030)
    const clearingLine = jrn.lines.find((l: any) => l.accountId === `acc_${businessId}_1030`);
    expect(clearingLine.credit).toBe('100000.0000');
    expect(clearingLine.debit).toBe('0.0000');
  });

  it('Case C: processes Gateway payment refund AFTER settlement (credits Bank Account)', async () => {
    // 1. Digital Sale
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items: [{ productId, quantity: '1', unitPrice: '100000' }],
        paymentMethod: 'QR',
        idempotencyKey: 'idem_refund_gw_postsettle',
      },
    });
    const sale = saleRes.json().sale;
    const saleItem = saleRes.json().items[0];

    const payRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: tenantHeaders,
      payload: { saleId: sale.id, method: 'QR' },
    });
    const { providerPaymentId, providerReference } = payRes.json().payment;

    await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/payments/MOCK_SANDBOX',
      headers: { 'x-callback-token': 'valid_sandbox_token' },
      payload: {
        id: 'evt_postsettle_1',
        payment_id: providerPaymentId,
        reference: providerReference,
        amount: '100000.0000',
        currency: 'IDR',
        status: 'SUCCESS',
      },
    });

    // Mark payment as SETTLED
    const p = domainStore.payments.get(payRes.json().payment.id)!;
    p.settlementStatus = 'SETTLED';

    // 2. Process Refund
    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sales/${sale.id}/returns`,
      headers: tenantHeaders,
      payload: {
        reason: 'Refund after settlement',
        items: [{ saleItemId: saleItem.id, quantity: '1', restockToInventory: true }],
      },
    });
    expect(refundRes.statusCode).toBe(201);
    const jrn = refundRes.json().journalEntry;

    // Credits Bank Account (1020)
    const bankLine = jrn.lines.find((l: any) => l.accountId === `acc_${businessId}_1020`);
    expect(bankLine.credit).toBe('100000.0000');
    expect(bankLine.debit).toBe('0.0000');
  });

  it('rejects duplicate refunds, invalid amounts, unfinalized sales, and cross-tenant attempts', async () => {
    // 1. Unfinalized / PENDING sale cannot be refunded
    const pendingSaleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items: [{ productId, quantity: '1', unitPrice: '100000' }],
        paymentMethod: 'QR',
        idempotencyKey: 'idem_unpaid_sale',
      },
    });
    const unpaidSaleId = pendingSaleRes.json().sale.id;
    const unpaidItemId = pendingSaleRes.json().items[0].id;

    const unpaidRefundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sales/${unpaidSaleId}/returns`,
      headers: tenantHeaders,
      payload: {
        reason: 'Should fail',
        items: [{ saleItemId: unpaidItemId, quantity: '1', restockToInventory: true }],
      },
    });
    expect(unpaidRefundRes.statusCode).toBe(400);
    expect(unpaidRefundRes.json().error.code).toBe('INVALID_SALE_FOR_RETURN');

    // 2. Cash Sale
    const cashSaleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items: [{ productId, quantity: '1', unitPrice: '100000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_valid_cash_sale',
      },
    });
    const paidSaleId = cashSaleRes.json().sale.id;
    const paidItemId = cashSaleRes.json().items[0].id;

    // 3. Invalid refund quantity (requesting 5 units when only 1 bought)
    const invalidQtyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sales/${paidSaleId}/returns`,
      headers: tenantHeaders,
      payload: {
        reason: 'Excess quantity',
        items: [{ saleItemId: paidItemId, quantity: '5', restockToInventory: true }],
      },
    });
    expect(invalidQtyRes.statusCode).toBe(400);
    expect(invalidQtyRes.json().error.code).toBe('INVALID_REFUND_AMOUNT');

    // 4. Valid Refund
    const validRefund = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sales/${paidSaleId}/returns`,
      headers: tenantHeaders,
      payload: {
        reason: 'Legitimate refund',
        items: [{ saleItemId: paidItemId, quantity: '1', restockToInventory: true }],
      },
    });
    expect(validRefund.statusCode).toBe(201);

    // 5. Duplicate Refund on already-refunded sale -> MUST FAIL
    const dupRefund = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sales/${paidSaleId}/returns`,
      headers: tenantHeaders,
      payload: {
        reason: 'Duplicate refund attempt',
        items: [{ saleItemId: paidItemId, quantity: '1', restockToInventory: true }],
      },
    });
    expect(dupRefund.statusCode).toBe(400);
    expect(dupRefund.json().error.code).toBe('ALREADY_REFUNDED');

    // 6. Cross-Tenant Refund Attempt
    const onboardOther = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: 'Bearer other_user' },
      payload: { name: 'Other Business', businessType: 'RETAIL', countryCode: 'ID', currency: 'IDR' },
    });
    const otherBizId = onboardOther.json().business.id;

    const crossTenantRefund = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sales/${paidSaleId}/returns`,
      headers: { authorization: 'Bearer other_user', 'x-business-id': otherBizId },
      payload: {
        reason: 'Cross tenant attack',
        items: [{ saleItemId: paidItemId, quantity: '1', restockToInventory: true }],
      },
    });
    expect(crossTenantRefund.statusCode).toBe(404);
    expect(crossTenantRefund.json().error.code).toBe('SALE_NOT_FOUND');
  });
});
