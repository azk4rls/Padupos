import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting } from '../plugins/rbac.js';

describe('PADUPOS — Real-World End-to-End Acceptance Test (Section 216)', () => {
  const app = buildApp();
  const testUserId = 'test_owner_1';

  beforeEach(() => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();
  });

  it('completes the entire business operating loop from onboarding to sale, inventory, journal, and AI insights', async () => {
    // ------------------------------------------------------------
    // 1. User Onboarding: Creates Business, Branch, Owner, COA
    // ------------------------------------------------------------
    const onboardRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${testUserId}` },
      payload: {
        name: 'Kopi Kenangan Senopati',
        businessType: 'FOOD_AND_BEVERAGE',
        countryCode: 'ID',
        currency: 'IDR',
        locale: 'id-ID',
        timezone: 'Asia/Jakarta',
        fiscalYearStartMonth: 1,
        initialBranchName: 'Outlet Senopati',
      },
    });

    expect(onboardRes.statusCode).toBe(201);
    const onboardData = onboardRes.json();
    const businessId = onboardData.business.id;
    const branchId = onboardData.branch.id;
    expect(businessId).toBeDefined();
    expect(branchId).toBeDefined();

    // Headers for all subsequent tenant requests
    const tenantHeaders = {
      authorization: `Bearer ${testUserId}`,
      'x-business-id': businessId,
    };

    // ------------------------------------------------------------
    // 2. Add Product: Kopi Susu Aren
    // ------------------------------------------------------------
    const productRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: {
        name: 'Kopi Susu Aren',
        unit: 'cup',
        costMethod: 'WEIGHTED_AVERAGE',
        costPrice: '5000',
        sellingPrice: '18000',
      },
    });

    expect(productRes.statusCode).toBe(201);
    const productId = productRes.json().product.id;

    // Verify initial inventory record created with 0 quantity
    const invRes1 = await app.inject({
      method: 'GET',
      url: `/api/v1/inventory?branchId=${branchId}`,
      headers: tenantHeaders,
    });
    expect(invRes1.statusCode).toBe(200);
    const invItems1 = invRes1.json().inventory;
    expect(invItems1.length).toBe(1);
    expect(invItems1[0].quantity).toBe('0.0000');

    // ------------------------------------------------------------
    // 3. Purchase Stock: Add 100 units @ 6000 unit cost (WAC update)
    // ------------------------------------------------------------
    const supplierRes = await app.inject({
      method: 'POST',
      url: '/api/v1/suppliers',
      headers: tenantHeaders,
      payload: {
        name: 'Supplier Kopi Nusantara',
        contactPerson: 'Budi',
        phone: '08123456789',
      },
    });
    expect(supplierRes.statusCode).toBe(201);
    const supplierId = supplierRes.json().supplier.id;

    const purchaseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/purchases',
      headers: tenantHeaders,
      payload: {
        branchId,
        supplierId,
        invoiceNumber: 'PCH-001',
        purchasedAt: new Date().toISOString(),
        items: [
          {
            productId,
            quantity: '100',
            unitCost: '6000', // New cost is 6000
          },
        ],
        isCredit: false,
      },
    });
    expect(purchaseRes.statusCode).toBe(201);

    // Verify inventory increased to 100 with WAC updated
    const invRes2 = await app.inject({
      method: 'GET',
      url: `/api/v1/inventory?branchId=${branchId}`,
      headers: tenantHeaders,
    });
    const invItems2 = invRes2.json().inventory;
    expect(invItems2[0].quantity).toBe('100.0000');
    expect(invItems2[0].averageCost).toBe('6000.0000');

    // ------------------------------------------------------------
    // 4. Cashier Shift: Open Session
    // ------------------------------------------------------------
    const openSessionRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sessions/open',
      headers: tenantHeaders,
      payload: {
        branchId,
        openingCash: '200000',
      },
    });
    expect(openSessionRes.statusCode).toBe(201);
    const sessionId = openSessionRes.json().session.id;

    // ------------------------------------------------------------
    // 5. POS Checkout: Sell 2 cups of Kopi Susu Aren for Cash
    // ------------------------------------------------------------
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        cashSessionId: sessionId,
        items: [
          {
            productId,
            quantity: '2',
            unitPrice: '18000',
            discountAmount: '0',
          },
        ],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_test_sale_001',
        orderDiscountAmount: '0',
        taxRatePercentage: '0',
        feeAmount: '0',
      },
    });

    expect(checkoutRes.statusCode).toBe(201);
    const saleData = checkoutRes.json();
    const saleId = saleData.sale.id;

    // Verify calculated totals: subtotal = 36000, cogs = 2 * 6000 = 12000, profit = 24000
    expect(saleData.sale.totalAmount).toBe('36000.0000');
    expect(saleData.sale.cogsAmount).toBe('12000.0000');
    expect(saleData.sale.grossProfitAmount).toBe('24000.0000');
    expect(saleData.sale.status).toBe('PAID');

    // ------------------------------------------------------------
    // 6. Verify Inventory Decreased (100 - 2 = 98)
    // ------------------------------------------------------------
    const invRes3 = await app.inject({
      method: 'GET',
      url: `/api/v1/inventory?branchId=${branchId}`,
      headers: tenantHeaders,
    });
    const invItems3 = invRes3.json().inventory;
    expect(invItems3[0].quantity).toBe('98.0000');

    // ------------------------------------------------------------
    // 7. Verify Receipt Generation
    // ------------------------------------------------------------
    const receiptRes = await app.inject({
      method: 'GET',
      url: `/api/v1/pos/sales/${saleId}/receipt`,
      headers: tenantHeaders,
    });
    expect(receiptRes.statusCode).toBe(200);
    const receipt = receiptRes.json().receipt;
    expect(receipt.invoiceNumber).toBe(saleData.sale.invoiceNumber);
    expect(receipt.total).toBe('36000.0000');
    expect(receipt.items[0].productName).toBe('Kopi Susu Aren');

    // ------------------------------------------------------------
    // 8. Record Operating Expense: Cleaning Supplies (10000)
    // ------------------------------------------------------------
    const expCatRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/expense-categories',
      headers: tenantHeaders,
      payload: { name: 'Kebersihan' },
    });
    const expCatId = expCatRes.json().category.id;

    const expenseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/expenses',
      headers: tenantHeaders,
      payload: {
        branchId,
        categoryId: expCatId,
        amount: '10000',
        currency: 'IDR',
        paymentMethod: 'CASH',
        description: 'Beli sabun cuci dan spons',
        incurredAt: new Date().toISOString(),
      },
    });
    expect(expenseRes.statusCode).toBe(201);

    // ------------------------------------------------------------
    // 9. Close Cashier Shift: Expected = 200000 (open) + 36000 (sale) = 236000
    // ------------------------------------------------------------
    const closeSessionRes = await app.inject({
      method: 'POST',
      url: `/api/v1/pos/sessions/${sessionId}/close`,
      headers: tenantHeaders,
      payload: {
        actualCash: '236000',
      },
    });
    expect(closeSessionRes.statusCode).toBe(200);
    const closeData = closeSessionRes.json();
    expect(closeData.isBalanced).toBe(true);
    expect(closeData.difference).toBe('0.0000');

    // ------------------------------------------------------------
    // 10. Verify Accounting: True Double-Entry Trial Balance
    // ------------------------------------------------------------
    const trialBalanceRes = await app.inject({
      method: 'GET',
      url: '/api/v1/accounting/trial-balance',
      headers: tenantHeaders,
    });
    expect(trialBalanceRes.statusCode).toBe(200);
    const trialBalance = trialBalanceRes.json();
    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.difference).toBe('0.0000');

    // ------------------------------------------------------------
    // 11. Verify Profit & Loss:
    // Revenue = 36000, COGS = 12000, Gross Profit = 24000, Operating Exp = 10000, Operating Profit = 14000
    // ------------------------------------------------------------
    const pnlRes = await app.inject({
      method: 'GET',
      url: '/api/v1/finance/profit-loss',
      headers: tenantHeaders,
    });
    expect(pnlRes.statusCode).toBe(200);
    const pnl = pnlRes.json();
    expect(pnl.revenue).toBe('36000.0000');
    expect(pnl.cogs).toBe('12000.0000');
    expect(pnl.grossProfit).toBe('24000.0000');
    expect(pnl.operatingExpenses).toBe('10000.0000');
    expect(pnl.operatingProfit).toBe('14000.0000');

    // ------------------------------------------------------------
    // 12. Verify Dashboard Metrics: Dynamic, honest, matching data
    // ------------------------------------------------------------
    const dashboardRes = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/metrics',
      headers: tenantHeaders,
    });
    expect(dashboardRes.statusCode).toBe(200);
    const metrics = dashboardRes.json().metrics;
    expect(metrics.salesToday).toBe('36000.0000');
    expect(metrics.grossProfit).toBe('24000.0000');
    expect(metrics.operatingProfit).toBe('14000.0000');
    expect(metrics.topProducts[0].productName).toBe('Kopi Susu Aren');

    // ------------------------------------------------------------
    // 13. Generate Grounded AI Business Insight
    // ------------------------------------------------------------
    const aiRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/insights/generate',
      headers: tenantHeaders,
      payload: {
        insightType: 'SALES_TREND',
      },
    });
    expect(aiRes.statusCode).toBe(201);
    const aiInsight = aiRes.json().insight;
    expect(aiInsight.summary).toContain('Kopi Susu Aren');
    expect(aiInsight.metricsSnapshot.salesThisWeek).toBe('36000.0000');
  });
});
