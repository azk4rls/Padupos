import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting, registerMemberForTesting } from '../plugins/rbac.js';
import {
  DeterministicInsightEngine,
} from '../modules/ml/insightEngine.js';
import {
  MockLLMProvider,
  setLLMExplanationProviderForTesting,
} from '../modules/ml/llmProvider.js';
import { resolveDateRange } from '../lib/dateRange.js';

describe('PADUPOS Phase 8.2 — AI Business Insights Tests', () => {
  const app = buildApp({ disableRateLimit: true });
  const ownerUserId = 'test_owner_p82';
  const otherUserId = 'test_other_p82';

  beforeEach(() => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();
    setLLMExplanationProviderForTesting(null); // Reset to default Deterministic provider
  });

  afterEach(() => {
    setLLMExplanationProviderForTesting(null);
  });

  // Helper to onboard a test business
  async function setupBusiness(name: string, userId: string = ownerUserId, tz: string = 'Asia/Jakarta') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${userId}` },
      payload: {
        name,
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
        timezone: tz,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    return {
      businessId: body.business.id as string,
      branchId: body.branch.id as string,
      headers: {
        authorization: `Bearer ${userId}`,
        'x-business-id': body.business.id as string,
      },
    };
  }

  // Helper to create product and adjust stock
  async function setupProductAndStock(
    tenantHeaders: Record<string, string>,
    branchId: string,
    name: string,
    sellingPrice = '10000',
    costPrice = '6000',
    initialStock = '100',
  ) {
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: { name, unit: 'pcs', costPrice, sellingPrice },
    });
    expect(prodRes.statusCode).toBe(201);
    const productId = prodRes.json().product.id as string;

    if (Number(initialStock) > 0) {
      const adjRes = await app.inject({
        method: 'POST',
        url: '/api/v1/inventory/adjust',
        headers: tenantHeaders,
        payload: {
          branchId,
          productId,
          adjustedQuantity: initialStock,
          reason: 'Initial stock',
        },
      });
      expect(adjRes.statusCode).toBe(200);
    }

    return { productId };
  }

  // Helper to record a sale
  async function recordSale(
    tenantHeaders: Record<string, string>,
    branchId: string,
    items: Array<{ productId: string; quantity: string; unitPrice: string }>,
    idempotencyKey: string,
  ) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items,
        paymentMethod: 'CASH',
        idempotencyKey,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().sale;
  }

  // Helper to record an expense
  async function recordExpense(
    tenantHeaders: Record<string, string>,
    branchId: string,
    categoryName: string,
    amount: string,
    description = 'Beban operasional',
  ) {
    const catRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/expense-categories',
      headers: tenantHeaders,
      payload: { name: categoryName },
    });
    expect(catRes.statusCode).toBe(201);
    const categoryId = catRes.json().category.id as string;

    const expRes = await app.inject({
      method: 'POST',
      url: '/api/v1/finance/expenses',
      headers: tenantHeaders,
      payload: {
        branchId,
        categoryId,
        amount,
        currency: 'IDR',
        paymentMethod: 'CASH',
        description,
        incurredAt: new Date().toISOString(),
      },
    });
    expect(expRes.statusCode).toBe(201);
    return expRes.json().expense;
  }

  // ================================================================
  // 1. TENANT & BRANCH ISOLATION
  // ================================================================

  it('strictly isolates AI insights between tenants (Tenant A data never leaks to Tenant B)', async () => {
    const bizA = await setupBusiness('Tenant A Coffee', ownerUserId);
    const bizB = await setupBusiness('Tenant B Retail', otherUserId);

    const { productId: prodA } = await setupProductAndStock(bizA.headers, bizA.branchId, 'Espresso A', '20000', '10000', '50');
    await recordSale(bizA.headers, bizA.branchId, [{ productId: prodA, quantity: '5', unitPrice: '20000' }], 'sale_biz_a_1');

    // Generate insight for Tenant B (has 0 sales)
    const resB = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: bizB.headers,
      payload: { insightType: 'SALES_TREND' },
    });
    expect(resB.statusCode).toBe(201);
    const insightB = resB.json().insight;
    expect(insightB.businessId).toBe(bizB.businessId);
    expect(insightB.title).toBe('Data Belum Cukup');
    expect(insightB.metricsSnapshot.totalRevenue).toBe('0.0000');
    expect(insightB.summary).not.toContain('Espresso A');

    // Generate insight for Tenant A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: bizA.headers,
      payload: { insightType: 'SALES_TREND' },
    });
    expect(resA.statusCode).toBe(201);
    const insightA = resA.json().insight;
    expect(insightA.businessId).toBe(bizA.businessId);
    expect(insightA.summary).toContain('Espresso A');
    expect(insightA.metricsSnapshot.totalRevenue).toBe('100000.0000');
  });

  it('strictly isolates insights between branches of the same tenant', async () => {
    const biz = await setupBusiness('Multi Branch Cafe', ownerUserId);

    // Set subscription to BUSINESS to allow multiple branches
    domainStore.subscriptions.set(`sub_${biz.businessId}`, {
      id: `sub_${biz.businessId}`,
      businessId: biz.businessId,
      planId: 'BUSINESS',
      status: 'ACTIVE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
      cancelAtPeriodEnd: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create second branch
    const branch2Res = await app.inject({
      method: 'POST',
      url: '/api/v1/branches',
      headers: biz.headers,
      payload: { name: 'Cabang Barat', code: 'BR02' },
    });
    expect(branch2Res.statusCode).toBe(201);
    const branch2Id = branch2Res.json().branch.id;

    const { productId: prod1 } = await setupProductAndStock(biz.headers, biz.branchId, 'Kopi Pusat', '15000', '8000', '100');
    const { productId: prod2 } = await setupProductAndStock(biz.headers, branch2Id, 'Kopi Barat', '18000', '9000', '100');

    // Sale in Branch 1 only
    await recordSale(biz.headers, biz.branchId, [{ productId: prod1, quantity: '4', unitPrice: '15000' }], 'sale_br1_1');

    // Query insights for Branch 2 (should be empty/insufficient)
    const resBr2 = await app.inject({
      method: 'GET',
      url: `/api/v1/ml/insights?branchId=${branch2Id}&insightType=SALES_TREND`,
      headers: biz.headers,
    });
    expect(resBr2.statusCode).toBe(200);
    const insightsBr2 = resBr2.json().insights;
    expect(insightsBr2[0].title).toBe('Data Belum Cukup');
    expect(insightsBr2[0].summary).not.toContain('Kopi Pusat');

    // Query insights for Branch 1
    const resBr1 = await app.inject({
      method: 'GET',
      url: `/api/v1/ml/insights?branchId=${biz.branchId}&insightType=SALES_TREND`,
      headers: biz.headers,
    });
    expect(resBr1.statusCode).toBe(200);
    const insightsBr1 = resBr1.json().insights;
    expect(insightsBr1[0].summary).toContain('Kopi Pusat');
    expect(insightsBr1[0].metricsSnapshot.totalRevenue).toBe('60000.0000');
  });

  // ================================================================
  // 2. DETERMINISTIC SALES TREND INSIGHT
  // ================================================================

  it('generates grounded sales trend insight with revenue, top product, and peak date', async () => {
    const biz = await setupBusiness('Toko Tren', ownerUserId);
    const { productId } = await setupProductAndStock(biz.headers, biz.branchId, 'Ayam Geprek', '25000', '15000', '200');

    await recordSale(biz.headers, biz.branchId, [{ productId, quantity: '10', unitPrice: '25000' }], 'sale_trend_1');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'SALES_TREND' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.insightType).toBe('SALES_TREND');
    expect(insight.summary).toContain('Ayam Geprek');
    expect(insight.metricsSnapshot.totalRevenue).toBe('250000.0000');
    expect(insight.metricsSnapshot.grossProfit).toBe('100000.0000');
    expect(insight.metricsSnapshot.transactionCount).toBe(1);
    expect(insight.metricsSnapshot.topProductName).toBe('Ayam Geprek');
    expect(insight.status).toBe('ACTIVE');
    expect(insight.modelUsed).toBe('deterministic_engine_v2');
  });

  // ================================================================
  // 3. DETERMINISTIC INVENTORY RISK INSIGHT
  // ================================================================

  it('detects critical out-of-stock and low-stock inventory risk deterministically', async () => {
    const biz = await setupBusiness('Toko Inventaris', ownerUserId);
    // Create product with 0 stock
    await setupProductAndStock(biz.headers, biz.branchId, 'Barang Habis', '50000', '30000', '0');
    // Create product with safe stock
    await setupProductAndStock(biz.headers, biz.branchId, 'Barang Aman', '20000', '10000', '100');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'INVENTORY_RISK' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.insightType).toBe('INVENTORY_RISK');
    expect(insight.severity).toBe('CRITICAL');
    expect(insight.title).toContain('Produk Habis');
    expect(insight.summary).toContain('Barang Habis');
    expect(insight.metricsSnapshot.outOfStockCount).toBeGreaterThanOrEqual(1);
  });

  it('generates positive healthy inventory insight when all stocks are sufficient', async () => {
    const biz = await setupBusiness('Toko Sehat', ownerUserId);
    await setupProductAndStock(biz.headers, biz.branchId, 'Barang Cukup 1', '10000', '5000', '500');
    await setupProductAndStock(biz.headers, biz.branchId, 'Barang Cukup 2', '15000', '8000', '300');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'INVENTORY_RISK' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.severity).toBe('POSITIVE');
    expect(insight.title).toContain('Aman');
    expect(insight.metricsSnapshot.outOfStockCount).toBe(0);
  });

  // ================================================================
  // 4. DETERMINISTIC EXPENSE SPIKE INSIGHT
  // ================================================================

  it('flags warning when operating expenses ratio exceeds safe threshold', async () => {
    const biz = await setupBusiness('Toko Beban Tinggi', ownerUserId);
    const { productId } = await setupProductAndStock(biz.headers, biz.branchId, 'Produk Jual', '10000', '5000', '100');
    
    // Revenue = 100,000
    await recordSale(biz.headers, biz.branchId, [{ productId, quantity: '10', unitPrice: '10000' }], 'sale_exp_1');

    // Expense = 80,000 (80% ratio -> spike warning)
    await recordExpense(biz.headers, biz.branchId, 'Sewa Tempat', '80000', 'Biaya sewa gedung');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'EXPENSE_SPIKE' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.insightType).toBe('EXPENSE_SPIKE');
    expect(insight.severity).toBe('WARNING');
    expect(insight.title).toContain('Tinggi');
    expect(insight.summary).toContain('Sewa Tempat');
    expect(insight.metricsSnapshot.operatingExpenses).toBe('80000.0000');
  });

  // ================================================================
  // 5. DETERMINISTIC BUSINESS SUMMARY INSIGHT
  // ================================================================

  it('generates complete grounded business summary with exact financial margins', async () => {
    const biz = await setupBusiness('Toko Ringkasan', ownerUserId);
    const { productId } = await setupProductAndStock(biz.headers, biz.branchId, 'Kopi Premium', '20000', '10000', '100');

    // Sale: 5 units @ 20,000 = 100,000 revenue, 50,000 cogs, 50,000 gross profit
    await recordSale(biz.headers, biz.branchId, [{ productId, quantity: '5', unitPrice: '20000' }], 'sale_sum_1');
    // Expense: 15,000 -> Operating profit = 35,000
    await recordExpense(biz.headers, biz.branchId, 'Listrik', '15000');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'BUSINESS_SUMMARY' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.insightType).toBe('BUSINESS_SUMMARY');
    expect(insight.severity).toBe('POSITIVE');
    expect(insight.metricsSnapshot.totalRevenue).toBe('100000.0000');
    expect(insight.metricsSnapshot.grossProfit).toBe('50000.0000');
    expect(insight.metricsSnapshot.totalCOGS).toBe('50000.0000');
    expect(insight.metricsSnapshot.operatingExpenses).toBe('15000.0000');
    expect(insight.metricsSnapshot.operatingProfit).toBe('35000.0000');
    expect(insight.metricsSnapshot.grossMarginPercentage).toBe('50.00');
    expect(insight.summary).toContain('100000.0000');
    expect(insight.summary).toContain('Kopi Premium');
  });

  // ================================================================
  // 6. DATA SUFFICIENCY & EMPTY DATASET BEHAVIOR
  // ================================================================

  it('honestly returns INSUFFICIENT_DATA when business has 0 sales or products without fabricating numbers', async () => {
    const biz = await setupBusiness('Toko Kosong', ownerUserId);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'SALES_TREND' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.title).toBe('Data Belum Cukup');
    expect(insight.sufficiency?.status).toBe('INSUFFICIENT_DATA');
    expect(insight.sufficiency?.message).toContain('Data belum cukup');
    expect(insight.metricsSnapshot.totalRevenue).toBe('0.0000');
    expect(insight.metricsSnapshot.paidSaleCount).toBe(0);
  });

  // ================================================================
  // 7. GET /ml/insights ENDPOINT & ALL CATEGORIES BATCHING
  // ================================================================

  it('returns all 4 core grounded insight categories on GET /ml/insights', async () => {
    const biz = await setupBusiness('Toko Lengkap', ownerUserId);
    const { productId } = await setupProductAndStock(biz.headers, biz.branchId, 'Item Serbaguna', '30000', '15000', '100');
    await recordSale(biz.headers, biz.branchId, [{ productId, quantity: '2', unitPrice: '30000' }], 'sale_all_1');
    await recordExpense(biz.headers, biz.branchId, 'Operasional', '10000');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/insights',
      headers: biz.headers,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.insights).toHaveLength(4);

    const types = body.insights.map((i: any) => i.insightType);
    expect(types).toContain('BUSINESS_SUMMARY');
    expect(types).toContain('SALES_TREND');
    expect(types).toContain('INVENTORY_RISK');
    expect(types).toContain('EXPENSE_SPIKE');
  });

  // ================================================================
  // 8. EXACT DECIMAL PRESERVATION (NO FLOATING POINT NOISE)
  // ================================================================

  it('preserves exact 4-decimal precision across complex arithmetic', async () => {
    const biz = await setupBusiness('Toko Presisi', ownerUserId);
    const { productId } = await setupProductAndStock(biz.headers, biz.branchId, 'Item Desimal', '33333.3333', '11111.1111', '100');
    await recordSale(biz.headers, biz.branchId, [{ productId, quantity: '3', unitPrice: '33333.3333' }], 'sale_dec_1');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'SALES_TREND' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.metricsSnapshot.totalRevenue).toBe('99999.9999');
    expect(insight.metricsSnapshot.totalCOGS).toBe('33333.3333');
    expect(insight.metricsSnapshot.grossProfit).toBe('66666.6666');
  });

  // ================================================================
  // 9. LLM PROVIDER BOUNDARY & RESILIENCE
  // ================================================================

  it('gracefully falls back to deterministic summary when LLM provider fails or times out', async () => {
    const mockProvider = new MockLLMProvider();
    mockProvider.shouldFail = true;
    setLLMExplanationProviderForTesting(mockProvider);

    const biz = await setupBusiness('Toko LLM Fail', ownerUserId);
    const { productId } = await setupProductAndStock(biz.headers, biz.branchId, 'Kopi Test', '10000', '5000', '100');
    await recordSale(biz.headers, biz.branchId, [{ productId, quantity: '2', unitPrice: '10000' }], 'sale_llm_1');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'SALES_TREND' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.modelUsed).toBe('deterministic_engine_v2');
    expect(insight.summary).toContain('Kopi Test');
    expect(insight.metricsSnapshot.totalRevenue).toBe('20000.0000');
  });

  it('gracefully falls back to deterministic summary when LLM returns malformed empty response', async () => {
    const mockProvider = new MockLLMProvider();
    mockProvider.malformedResponse = true;
    setLLMExplanationProviderForTesting(mockProvider);

    const biz = await setupBusiness('Toko LLM Empty', ownerUserId);
    const { productId } = await setupProductAndStock(biz.headers, biz.branchId, 'Teh Test', '8000', '4000', '100');
    await recordSale(biz.headers, biz.branchId, [{ productId, quantity: '3', unitPrice: '8000' }], 'sale_llm_2');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/insights/generate',
      headers: biz.headers,
      payload: { insightType: 'SALES_TREND' },
    });

    expect(res.statusCode).toBe(201);
    const insight = res.json().insight;
    expect(insight.modelUsed).toBe('deterministic_engine_v2');
    expect(insight.summary).toContain('Teh Test');
    expect(insight.title.length).toBeGreaterThan(0);
  });

  // ================================================================
  // 10. RBAC PERMISSIONS & AUTHORIZATION
  // ================================================================

  it('enforces RBAC permissions on AI insight endpoints', async () => {
    const biz = await setupBusiness('Toko RBAC', ownerUserId);
    const unauthedHeaders = { authorization: 'Bearer unauthed_user', 'x-business-id': biz.businessId };

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/insights',
      headers: unauthedHeaders,
    });

    expect(res.statusCode).toBe(403);
  });
});
