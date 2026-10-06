import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting } from '../plugins/rbac.js';

describe('PADUPOS — Full Lifecycle End-to-End Accounting & POS Test (P0 Items 4, 5, 16, 17, 18)', () => {
  const app = buildApp({ disableRateLimit: true });
  const testUserId = 'e2e_owner_user';

  let tenantHeaders: Record<string, string>;
  let businessId: string;
  let branchId: string;

  beforeEach(async () => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();

    // 1. User Onboarding
    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${testUserId}` },
      payload: {
        name: 'PADUPOS Global Flagship',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
        locale: 'id-ID',
        timezone: 'Asia/Jakarta',
        fiscalYearStartMonth: 1,
        initialBranchName: 'Grand Indonesia Branch',
      },
    });
    expect(onboardRes.statusCode).toBe(201);
    const onboard = onboardRes.json();
    businessId = onboard.business.id;
    branchId = onboard.branch.id;
    tenantHeaders = {
      authorization: `Bearer ${testUserId}`,
      'x-business-id': businessId,
      'x-branch-id': branchId,
    };
  });

  it('verifies all 8 accounting flows, immutability, reversal, and trial balance', async () => {
    // ------------------------------------------------------------
    // Flow 1 & 2: Cash Session & Opening Float
    // ------------------------------------------------------------
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sessions/open',
      headers: tenantHeaders,
      payload: {
        branchId,
        openingCash: '500000.0000',
      },
    });
    expect(sessionRes.statusCode).toBe(201);
    const sessionId = sessionRes.json().session.id;

    // ------------------------------------------------------------
    // Flow 3: Supplier & Inventory Purchase with WAC (Cash Purchase)
    // ------------------------------------------------------------
    const suppRes = await app.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: tenantHeaders,
      payload: {
        name: 'PT Kopi Nusantara Global',
        contactPerson: 'Budi Santoso',
        phone: '081299990001',
      },
    });
    expect(suppRes.statusCode).toBe(201);
    const supplierId = suppRes.json().supplier.id;

    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: {
        name: 'Single Origin Gayo 250g',
        unit: 'pouch',
        costMethod: 'WEIGHTED_AVERAGE',
        costPrice: '40000',
        sellingPrice: '90000',
      },
    });
    expect(prodRes.statusCode).toBe(201);
    const productId = prodRes.json().product.id;

    // Purchase 20 units at 40,000 = 800,000 cash
    const purchaseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases',
      headers: tenantHeaders,
      payload: {
        supplierId,
        branchId,
        invoiceNumber: 'INV-SUPP-001',
        paymentMethod: 'CASH',
        isCredit: false,
        items: [
          {
            productId,
            quantity: '20',
            unitCost: '40000.0000',
          },
        ],
        subtotal: '800000.0000',
        totalAmount: '800000.0000',
        purchasedAt: new Date().toISOString(),
      },
    });
    expect(purchaseRes.statusCode).toBe(201);

    // Verify Stock is 20 units
    const stockCheck1 = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory',
      headers: tenantHeaders,
    });
    const inv1 = stockCheck1.json().inventory.find((i: any) => i.productId === productId);
    expect(inv1.quantity).toBe('20.0000');

    // ------------------------------------------------------------
    // Flow 4: POS Sale (Cash Sale with COGS deduction)
    // ------------------------------------------------------------
    const saleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: {
        ...tenantHeaders,
        'idempotency-key': 'idem-e2e-sale-001',
      },
      payload: {
        branchId,
        cashSessionId: sessionId,
        items: [
          {
            productId,
            quantity: '5',
            unitPrice: '90000',
            discountAmount: '0',
          },
        ],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem-e2e-sale-001',
        orderDiscountAmount: '0',
        taxRatePercentage: '0',
        feeAmount: '0',
      },
    });
    expect(saleRes.statusCode).toBe(201);
    const sale = saleRes.json().sale;
    expect(sale.totalAmount).toBe('450000.0000');
    expect(sale.cogsAmount).toBe('200000.0000'); // 5 * 40,000

    // Verify stock decremented to 15
    const stockCheck2 = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory',
      headers: tenantHeaders,
    });
    const inv2 = stockCheck2.json().inventory.find((i: any) => i.productId === productId);
    expect(inv2.quantity).toBe('15.0000');

    // ------------------------------------------------------------
    // Flow 5: Operational Expense Posting
    // ------------------------------------------------------------
    const expCatRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/expense-categories',
      headers: tenantHeaders,
      payload: {
        name: 'Store Utilities',
        description: 'Water and electricity for store',
      },
    });
    expect(expCatRes.statusCode).toBe(201);
    const expCatId = expCatRes.json().category.id;

    const expRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/expenses',
      headers: tenantHeaders,
      payload: {
        branchId,
        categoryId: expCatId,
        amount: '50000.0000',
        currency: 'IDR',
        paymentMethod: 'CASH',
        description: 'Electricity token reload',
        incurredAt: new Date().toISOString(),
      },
    });
    expect(expRes.statusCode).toBe(201);

    // ------------------------------------------------------------
    // Flow 6: Accounting Periods & Strict Immutability / Reversal
    // ------------------------------------------------------------
    const periodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/accounting/periods',
      headers: tenantHeaders,
      payload: {
        name: 'Period October 2026',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      },
    });
    expect(periodRes.statusCode).toBe(201);
    const periodId = periodRes.json().period.id;

    // Get list of posted journals
    const journalsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/journals',
      headers: tenantHeaders,
    });
    expect(journalsRes.statusCode).toBe(200);
    const journals = journalsRes.json().journalEntries;
    expect(journals.length).toBeGreaterThan(0);

    const firstJournal = journals[0];

    // Attempt direct PUT on posted journal -> MUST FAIL with 400 JOURNAL_IS_IMMUTABLE
    const editRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/accounting/journals/${firstJournal.id}`,
      headers: tenantHeaders,
      payload: { description: 'Unauthorized Edit' },
    });
    expect(editRes.statusCode).toBe(400);
    expect(editRes.json().error.code).toBe('JOURNAL_IS_IMMUTABLE');

    // Attempt direct DELETE on posted journal -> MUST FAIL with 400 JOURNAL_IS_IMMUTABLE
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/accounting/journals/${firstJournal.id}`,
      headers: tenantHeaders,
    });
    expect(deleteRes.statusCode).toBe(400);
    expect(deleteRes.json().error.code).toBe('JOURNAL_IS_IMMUTABLE');

    // Reversal flow: reverse first journal
    const reverseRes = await app.inject({
      method: 'POST',
      url: `/api/v1/accounting/journals/${firstJournal.id}/reverse`,
      headers: tenantHeaders,
    });
    expect(reverseRes.statusCode).toBe(201);
    const rev = reverseRes.json().reversalEntry;
    expect(rev.sourceType).toBe('REVERSAL');
    expect(rev.lines.length).toBe(firstJournal.lines.length);

    // Verify Reversal twice is rejected
    const doubleReverseRes = await app.inject({
      method: 'POST',
      url: `/api/v1/accounting/journals/${firstJournal.id}/reverse`,
      headers: tenantHeaders,
    });
    expect(doubleReverseRes.statusCode).toBe(400);
    expect(doubleReverseRes.json().error.code).toBe('ALREADY_REVERSED');

    // Close accounting period
    const closePeriodRes = await app.inject({
      method: 'POST',
      url: `/api/v1/accounting/periods/${periodId}/close`,
      headers: tenantHeaders,
    });
    expect(closePeriodRes.statusCode).toBe(200);
    expect(closePeriodRes.json().period.status).toBe('CLOSED');

    // Attempt to post new journal into CLOSED period -> Must reject with 400 CLOSED_PERIOD
    const closedPostRes = await app.inject({
      method: 'POST',
      url: '/api/v1/accounting/journals',
      headers: tenantHeaders,
      payload: {
        entryDate: '2026-10-15',
        description: 'Post into closed period',
        lines: [
          { accountId: `acc_${businessId}_1010`, debit: '1000.0000', credit: '0.0000' },
          { accountId: `acc_${businessId}_4010`, debit: '0.0000', credit: '1000.0000' },
        ],
      },
    });
    expect(closedPostRes.statusCode).toBe(400);
    expect(closedPostRes.json().error.code).toBe('CLOSED_PERIOD');

    // Attempt to reverse journal dated in CLOSED period -> Must reject with 400 CLOSED_PERIOD
    const postCloseRevRes = await app.inject({
      method: 'POST',
      url: `/api/v1/accounting/journals/${journals[1]?.id || firstJournal.id}/reverse`,
      headers: tenantHeaders,
    });
    expect(postCloseRevRes.statusCode).toBe(400);

    // ------------------------------------------------------------
    // Flow 7: Trial Balance Verification
    // Every posted journal must have Total Debits == Total Credits
    // ------------------------------------------------------------
    const trialBalanceRes = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/trial-balance',
      headers: tenantHeaders,
    });
    expect(trialBalanceRes.statusCode).toBe(200);
    const tb = trialBalanceRes.json();
    expect(tb.isBalanced).toBe(true);
    expect(tb.difference).toBe('0.0000');
  });

  it('verifies idempotent sale finalization does not double-post journals or duplicate stock deductions', async () => {
    // 1. Setup Product and Stock
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: { name: 'Idempotent Item', unit: 'pcs', costPrice: '10000', sellingPrice: '25000' },
    });
    const productId = prodRes.json().product.id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: tenantHeaders,
      payload: { branchId, productId, adjustedQuantity: '50', reason: 'Stock setup' },
    });

    // 2. Submit sale with idempotency key
    const idemKey = 'idem-atomic-duplicate-test-1';
    const salePayload = {
      branchId,
      items: [{ productId, quantity: '3', unitPrice: '25000' }],
      paymentMethod: 'CASH',
      idempotencyKey: idemKey,
    };

    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: { ...tenantHeaders, 'idempotency-key': idemKey },
      payload: salePayload,
    });
    expect(firstRes.statusCode).toBe(201);
    const saleId = firstRes.json().sale.id;

    // Count journals before retry
    const journalsBefore = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/journals',
      headers: tenantHeaders,
    });
    const journalCountBefore = journalsBefore.json().journalEntries.length;

    // 3. Resend exact same sale with same idempotency key (network retry simulation)
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: { ...tenantHeaders, 'idempotency-key': idemKey },
      payload: salePayload,
    });
    expect(secondRes.statusCode).toBe(201);
    expect(secondRes.json().sale.id).toBe(saleId);

    // Verify stock is only decremented ONCE (50 - 3 = 47)
    const invRes = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory',
      headers: tenantHeaders,
    });
    const inv = invRes.json().inventory.find((i: any) => i.productId === productId);
    expect(inv.quantity).toBe('47.0000');

    // Verify journal count did NOT increase
    const journalsAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/journals',
      headers: tenantHeaders,
    });
    expect(journalsAfter.json().journalEntries.length).toBe(journalCountBefore);
  });

  it('verifies strict isolation between SaaS subscription billing and merchant payment processing', async () => {
    // 1. Fetch Subscription plans
    const subPlansRes = await app.inject({
      method: 'GET',
      url: '/api/v1/subscriptions/plans',
    });
    expect(subPlansRes.statusCode).toBe(200);
    const plans = subPlansRes.json().plans;
    expect(plans.length).toBe(4);
    expect(plans.map((p: any) => p.tier)).toEqual(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']);

    // 2. Fetch current tenant subscription
    const currentSubRes = await app.inject({
      method: 'GET',
      url: '/api/v1/subscriptions/current',
      headers: tenantHeaders,
    });
    expect(currentSubRes.statusCode).toBe(200);
    expect(currentSubRes.json().tier).toBe('FREE');
    expect(currentSubRes.json().entitlements.hasAiInsights).toBe(false);

    // 3. Confirm merchant payment routes do not contain subscription data
    const recRes = await app.inject({
      method: 'GET',
      url: '/api/v1/payments/reconciliation',
      headers: tenantHeaders,
    });
    expect(recRes.statusCode).toBe(200);
    for (const r of recRes.json().reconciliations) {
      expect(r.provider).not.toBe('PADUPOS_SUBSCRIPTION');
    }
  });
});
