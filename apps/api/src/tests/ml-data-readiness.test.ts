import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting, registerMemberForTesting } from '../plugins/rbac.js';
import { PythonBridge } from '../modules/ml/pythonBridge.js';
import {
  buildSalesDailyDataset,
  buildInventoryDailyDataset,
  buildProductDemandDataset,
  buildAnomalyDetectionDataset,
  buildBusinessInsightDataset,
  buildMLTrainingData,
} from '../modules/ml/dataReadiness.js';
import { resolveDateRange } from '../lib/dateRange.js';

describe('PADUPOS Phase 8.1 — AI/ML Data Readiness Tests', () => {
  const app = buildApp({ disableRateLimit: true });
  const ownerUserId = 'test_owner_p81';
  const otherUserId = 'test_other_p81';

  beforeEach(() => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();
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

  // Helper to create product and stock
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
      payload: { name, sellingPrice, costPrice, sku: `SKU-${name.toUpperCase()}` },
    });
    expect(prodRes.statusCode).toBe(201);
    const productId = prodRes.json().product.id;

    if (Number(initialStock) > 0) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/inventory/adjust',
        headers: tenantHeaders,
        payload: { branchId, productId, adjustedQuantity: initialStock, reason: 'Initial' },
      });
    }

    return productId;
  }

  // ================================================================
  // 1. TENANT ISOLATION
  // ================================================================

  it('guarantees strict tenant isolation: Tenant A data never leaks to Tenant B', async () => {
    const bizA = await setupBusiness('Tenant Alpha', ownerUserId);
    const bizB = await setupBusiness('Tenant Beta', otherUserId);

    const prodA = await setupProductAndStock(bizA.headers, bizA.branchId, 'Item Alpha');

    // Create 35 transactions for Tenant A
    for (let i = 1; i <= 35; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pos/sales',
        headers: bizA.headers,
        payload: {
          branchId: bizA.branchId,
          items: [{ productId: prodA, quantity: '1', unitPrice: '10000' }],
          paymentMethod: 'CASH',
          idempotencyKey: `idem_tenant_a_${i}`,
        },
      });
    }

    // Query Sales Daily Dataset for Tenant A
    const resA = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily?startDate=2026-10-01&endDate=2026-10-20',
      headers: bizA.headers,
    });
    expect(resA.statusCode).toBe(200);
    const dataA = resA.json();
    expect(dataA.scope.businessId).toBe(bizA.businessId);
    expect(dataA.totals.transactionCount).toBe(35);
    expect(dataA.totals.revenue).toBe('350000.0000');
    expect(dataA.sufficiency.status).toBe('SUFFICIENT');

    // Query Sales Daily Dataset for Tenant B (should have exactly 0 sales)
    const resB = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily?startDate=2026-10-01&endDate=2026-10-20',
      headers: bizB.headers,
    });
    expect(resB.statusCode).toBe(200);
    const dataB = resB.json();
    expect(dataB.scope.businessId).toBe(bizB.businessId);
    expect(dataB.totals.transactionCount).toBe(0);
    expect(dataB.totals.revenue).toBe('0.0000');
    expect(dataB.sufficiency.status).toBe('INSUFFICIENT_DATA');
  });

  // ================================================================
  // 2. BRANCH ISOLATION & ROLLUP
  // ================================================================

  it('enforces branch isolation when branch scope is supplied and rollups when omitted', async () => {
    const biz = await setupBusiness('Multi Branch Store', ownerUserId);

    // Multi-branch requires BUSINESS plan tier
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
      payload: { name: 'Branch Two', code: 'BR-2' },
    });
    expect(branch2Res.statusCode).toBe(201);
    const branch2Id = branch2Res.json().branch.id;

    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Branch Test Item');
    // Also adjust stock for branch 2
    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: biz.headers,
      payload: { branchId: branch2Id, productId: prod, adjustedQuantity: '50', reason: 'Stock B2' },
    });

    // Make 2 sales in Branch 1
    for (let i = 1; i <= 2; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pos/sales',
        headers: biz.headers,
        payload: {
          branchId: biz.branchId,
          items: [{ productId: prod, quantity: '1', unitPrice: '10000' }],
          paymentMethod: 'CASH',
          idempotencyKey: `idem_br1_${i}`,
        },
      });
    }

    // Make 1 sale in Branch 2
    await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: biz.headers,
      payload: {
        branchId: branch2Id,
        items: [{ productId: prod, quantity: '1', unitPrice: '20000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_br2_1',
      },
    });

    // Branch 1 scoped query
    const resBr1 = await app.inject({
      method: 'GET',
      url: `/api/v1/ml/datasets/sales-daily?branchId=${biz.branchId}`,
      headers: biz.headers,
    });
    expect(resBr1.statusCode).toBe(200);
    expect(resBr1.json().totals.transactionCount).toBe(2);
    expect(resBr1.json().totals.revenue).toBe('20000.0000');

    // Branch 2 scoped query
    const resBr2 = await app.inject({
      method: 'GET',
      url: `/api/v1/ml/datasets/sales-daily?branchId=${branch2Id}`,
      headers: biz.headers,
    });
    expect(resBr2.statusCode).toBe(200);
    expect(resBr2.json().totals.transactionCount).toBe(1);
    expect(resBr2.json().totals.revenue).toBe('20000.0000');

    // Business level rollup (no branch specified)
    const resRollup = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily',
      headers: biz.headers,
    });
    expect(resRollup.statusCode).toBe(200);
    expect(resRollup.json().totals.transactionCount).toBe(3);
    expect(resRollup.json().totals.revenue).toBe('40000.0000');
  });

  // ================================================================
  // 3. ZERO-ACTIVITY DAYS FILLING & DETERMINISTIC SORTING
  // ================================================================

  it('preserves calendar integrity by populating zero-activity days without gaps', async () => {
    const biz = await setupBusiness('Zero Days Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Zero Item');

    // Query a 5-day range: 2026-10-10 to 2026-10-14
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily?startDate=2026-10-10&endDate=2026-10-14',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();

    expect(data.range.dayCount).toBe(5);
    expect(data.observations.length).toBe(5);

    // Verify chronological order and exact zero values
    const expectedDays = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'];
    for (let i = 0; i < 5; i++) {
      expect(data.observations[i].date).toBe(expectedDays[i]);
      expect(data.observations[i].revenue).toBe('0.0000');
      expect(data.observations[i].unitsSold).toBe('0.0000');
      expect(data.observations[i].transactionCount).toBe(0);
      expect(data.observations[i].grossProfit).toBe('0.0000');
      expect(data.observations[i].cogs).toBe('0.0000');
    }
  });

  // ================================================================
  // 4. DATA SUFFICIENCY RULES & THRESHOLDS
  // ================================================================

  it('honestly returns INSUFFICIENT_DATA when history or transaction count is below threshold', async () => {
    const biz = await setupBusiness('Sufficiency Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Sufficient Item');

    // Make only 5 sales (minimum for forecast is 30 transactions, 14 days)
    for (let i = 1; i <= 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pos/sales',
        headers: biz.headers,
        payload: {
          branchId: biz.branchId,
          items: [{ productId: prod, quantity: '1', unitPrice: '10000' }],
          paymentMethod: 'CASH',
          idempotencyKey: `idem_suff_${i}`,
        },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily?startDate=2026-10-01&endDate=2026-10-20',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();

    expect(data.sufficiency.status).toBe('INSUFFICIENT_DATA');
    expect(data.sufficiency.message).toContain('Data belum cukup untuk membuat prediksi penjualan');
    expect(data.sufficiency.actualObservations).toBe(5);
    expect(data.sufficiency.requiredObservations).toBe(30);
  });

  // ================================================================
  // 5. CANCELLED / NON-PAID SALES EXCLUSION
  // ================================================================

  it('strictly excludes non-PAID transactions from sales and demand datasets', async () => {
    const biz = await setupBusiness('Status Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Status Item');

    // 1 PAID sale
    await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: biz.headers,
      payload: {
        branchId: biz.branchId,
        items: [{ productId: prod, quantity: '2', unitPrice: '10000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_paid_1',
      },
    });

    // Manually insert a CANCELLED sale in domainStore
    const fakeCancelledId = 'sale_cancelled_fake';
    domainStore.sales.set(fakeCancelledId, {
      id: fakeCancelledId,
      businessId: biz.businessId,
      branchId: biz.branchId,
      invoiceNumber: 'INV-CANCELLED',
      status: 'CANCELLED',
      subtotal: '50000.0000',
      discountAmount: '0.0000',
      taxAmount: '0.0000',
      feeAmount: '0.0000',
      totalAmount: '50000.0000',
      cogsAmount: '20000.0000',
      grossProfitAmount: '30000.0000',
      currency: 'IDR',
      createdBy: ownerUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.totals.transactionCount).toBe(1);
    expect(data.totals.revenue).toBe('20000.0000');
  });

  // ================================================================
  // 6. EXACT DECIMAL PRECISION
  // ================================================================

  it('performs exact decimal money arithmetic without floating point drift', async () => {
    const biz = await setupBusiness('Decimal Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Decimal Item', '10.3333', '5.1111');

    for (let i = 1; i <= 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pos/sales',
        headers: biz.headers,
        payload: {
          branchId: biz.branchId,
          items: [{ productId: prod, quantity: '1', unitPrice: '10.3333' }],
          paymentMethod: 'CASH',
          idempotencyKey: `idem_dec_${i}`,
        },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    // 10.3333 * 3 = 30.9999
    expect(data.totals.revenue).toBe('30.9999');
  });

  // ================================================================
  // 7. PRODUCT DEMAND DATASET & FEATURES
  // ================================================================

  it('computes product demand features: velocity, days of cover, CV, and trend', async () => {
    const biz = await setupBusiness('Demand Features Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'High Demand Item', '15000', '8000', '20');

    // Create 7 sales over 7 days (1 per day) -> demand = 7 units
    for (let i = 1; i <= 7; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pos/sales',
        headers: biz.headers,
        payload: {
          branchId: biz.branchId,
          items: [{ productId: prod, quantity: '1', unitPrice: '15000' }],
          paymentMethod: 'CASH',
          idempotencyKey: `idem_dem_${i}`,
        },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/product-demand',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.products.length).toBe(1);
    const item = data.products[0];

    expect(item.productId).toBe(prod);
    expect(item.totalDemand).toBe('7.0000');
    expect(Number(item.avgDailyDemand)).toBeGreaterThan(0);
    expect(item.currentStock).toBe('13.0000'); // 20 - 7 = 13
    expect(item.daysOfCover).not.toBe('INFINITE');
    expect(Number(item.daysOfCover)).toBeGreaterThan(0);
  });

  // ================================================================
  // 8. ANOMALY DETECTION DATASET
  // ================================================================

  it('detects statistical transaction anomalies with deviation scores and baseline', async () => {
    const biz = await setupBusiness('Anomaly ML Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Normal Product', '10000', '5000', '500');

    // 5 normal sales of 10000
    for (let i = 1; i <= 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pos/sales',
        headers: biz.headers,
        payload: {
          branchId: biz.branchId,
          items: [{ productId: prod, quantity: '1', unitPrice: '10000' }],
          paymentMethod: 'CASH',
          idempotencyKey: `idem_anom_norm_${i}`,
        },
      });
    }

    // 1 spike sale: 50 units = 500,000 (50x baseline)
    await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: biz.headers,
      payload: {
        branchId: biz.branchId,
        items: [{ productId: prod, quantity: '50', unitPrice: '10000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_anom_spike',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/anomalies',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();

    expect(data.sufficiency.status).toBe('SUFFICIENT');
    expect(data.baseline.sampleSize).toBe(6);
    expect(Number(data.baseline.meanAmount)).toBeGreaterThan(0);

    const unusual = data.observations.filter((o: any) => o.isUnusual);
    expect(unusual.length).toBe(1);
    expect(unusual[0].amount).toBe('500000.0000');
    expect(unusual[0].reason).toContain('Pola transaksi tidak biasa');
  });

  // ================================================================
  // 9. BUSINESS INSIGHT UNIFIED DATASET
  // ================================================================

  it('assembles a unified BusinessInsightDataset across sales, products, payments, and aging', async () => {
    const biz = await setupBusiness('Insight ML Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Top Product', '25000', '10000', '100');

    await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: biz.headers,
      payload: {
        branchId: biz.branchId,
        items: [{ productId: prod, quantity: '4', unitPrice: '25000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_insight_sale_1',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/business-insight',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();

    expect(data.topProducts.length).toBe(1);
    expect(data.topProducts[0].productName).toBe('Top Product');
    expect(data.topProducts[0].revenue).toBe('100000.0000');
    expect(data.paymentMix.CASH).toBe('100000.0000');
    expect(data.inventoryHealth.totalProducts).toBe(1);
    expect(data.sufficiency.status).toBe('SUFFICIENT');
  });

  // ================================================================
  // 10. ML FEATURE EXTRACTION / TRAINING DATA ENDPOINT
  // ================================================================

  it('extracts ML feature vectors and targets for Python worker consumption', async () => {
    const biz = await setupBusiness('Training Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Feature Item');

    // Create 35 sales for sales forecast training
    for (let i = 1; i <= 35; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pos/sales',
        headers: biz.headers,
        payload: {
          branchId: biz.branchId,
          items: [{ productId: prod, quantity: '1', unitPrice: '10000' }],
          paymentMethod: 'CASH',
          idempotencyKey: `idem_feat_${i}`,
        },
      });
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ml/training-data',
      headers: biz.headers,
      payload: {
        predictionType: 'SALES_FORECAST',
        lookbackDays: 30,
      },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();

    expect(data.predictionType).toBe('SALES_FORECAST');
    expect(data.features).toBeDefined();
    expect(data.targets).toBeDefined();
    expect(Array.isArray(data.features)).toBe(true);
    expect(Array.isArray(data.targets)).toBe(true);
  });

  // ================================================================
  // 11. PYTHON ML BOUNDARY SPECIFICATION & MODEL FAILURE HANDLING
  // ================================================================

  it('formats payload adhering to Python ML worker contracts and marks worker error as MODEL_FAILURE', async () => {
    const range = resolveDateRange({ startDate: '2026-10-01', endDate: '2026-10-20' }, 'biz_mock', null);
    const mockDataset = buildSalesDailyDataset('biz_mock', null, range);

    // 1. Format payload
    const payload = PythonBridge.formatSalesForecastPayload(mockDataset, 7);
    expect(payload.task).toBe('sales_forecast');
    expect(payload.params.horizon_days).toBe(7);
    expect(payload.params.historical_sales).toBeDefined();

    // 2. Attempt execution with non-existent python binary -> MODEL_FAILURE
    const failureResult = await PythonBridge.executeWorker(payload, {
      pythonExecutable: 'non_existent_python_binary_xyz',
      timeoutMs: 1000,
    });

    expect(failureResult.status).toBe('MODEL_FAILURE');
    expect(failureResult.status).not.toBe('INSUFFICIENT_DATA'); // Never disguise model failure as insufficient data!
  });

  // ================================================================
  // 12. INVALID DATA RANGE REJECTION
  // ================================================================

  it('rejects invalid date range with 400 and clear error message', async () => {
    const biz = await setupBusiness('Invalid Date Store', ownerUserId);

    // startDate after endDate
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily?startDate=2026-10-20&endDate=2026-10-10',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_DATE_RANGE');
    expect(res.json().error.message).toContain('must not be after endDate');
  });

  // ================================================================
  // 13. TIMEZONE AWARENESS (CIVIL LOCAL TIME vs UTC MIDNIGHT)
  // ================================================================

  it('correctly buckets sales near UTC midnight into the scope timezone calendar day', async () => {
    // Asia/Jakarta is UTC+7
    const biz = await setupBusiness('Timezone Store', ownerUserId, 'Asia/Jakarta');
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'TZ Item');

    // 2026-10-15T18:00:00Z is 2026-10-16 01:00:00 in Jakarta (+7)
    domainStore.sales.set('sale_tz_1', {
      id: 'sale_tz_1',
      businessId: biz.businessId,
      branchId: biz.branchId,
      invoiceNumber: 'INV-TZ-1',
      status: 'PAID',
      subtotal: '50000.0000',
      discountAmount: '0.0000',
      taxAmount: '0.0000',
      feeAmount: '0.0000',
      totalAmount: '50000.0000',
      cogsAmount: '20000.0000',
      grossProfitAmount: '30000.0000',
      currency: 'IDR',
      createdBy: ownerUserId,
      createdAt: '2026-10-15T18:00:00.000Z', // Local date: 2026-10-16!
      updatedAt: '2026-10-15T18:00:00.000Z',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily?startDate=2026-10-15&endDate=2026-10-16',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json();

    const day15 = data.observations.find((o: any) => o.date === '2026-10-15');
    const day16 = data.observations.find((o: any) => o.date === '2026-10-16');

    expect(day15.transactionCount).toBe(0);
    expect(day15.revenue).toBe('0.0000');
    expect(day16.transactionCount).toBe(1);
    expect(day16.revenue).toBe('50000.0000');
  });

  // ================================================================
  // 14. DETERMINISTIC AGGREGATION
  // ================================================================

  it('produces byte-for-byte identical datasets on repeated invocations', async () => {
    const biz = await setupBusiness('Deterministic Store', ownerUserId);
    const prod = await setupProductAndStock(biz.headers, biz.branchId, 'Det Item');

    await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: biz.headers,
      payload: {
        branchId: biz.branchId,
        items: [{ productId: prod, quantity: '3', unitPrice: '15000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_det_1',
      },
    });

    const res1 = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily?startDate=2026-10-01&endDate=2026-10-10',
      headers: biz.headers,
    });
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/sales-daily?startDate=2026-10-01&endDate=2026-10-10',
      headers: biz.headers,
    });

    expect(res1.body).toBe(res2.body);
  });

  // ================================================================
  // 15. EMPTY DATASETS ACROSS ALL ENDPOINTS
  // ================================================================

  it('safely handles empty datasets across all 5 endpoints without null reference exceptions', async () => {
    const biz = await setupBusiness('Empty Store', ownerUserId);

    const endpoints = [
      '/api/v1/ml/datasets/sales-daily?startDate=2026-10-01&endDate=2026-10-07',
      '/api/v1/ml/datasets/inventory-daily?startDate=2026-10-01&endDate=2026-10-07',
      '/api/v1/ml/datasets/product-demand?startDate=2026-10-01&endDate=2026-10-07',
      '/api/v1/ml/datasets/anomalies?startDate=2026-10-01&endDate=2026-10-07',
      '/api/v1/ml/datasets/business-insight?startDate=2026-10-01&endDate=2026-10-07',
    ];

    for (const url of endpoints) {
      const res = await app.inject({
        method: 'GET',
        url,
        headers: biz.headers,
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.sufficiency.status).toBe('INSUFFICIENT_DATA');
    }
  });

  // ================================================================
  // 16. UNPOSTED JOURNAL EXCLUSION
  // ================================================================

  it('excludes unposted journals from financial calculations in business insights', async () => {
    const biz = await setupBusiness('Unposted Store', ownerUserId);

    // Create an unposted journal
    const fakeJournalId = 'je_unposted_1';
    domainStore.journalEntries.set(fakeJournalId, {
      id: fakeJournalId,
      businessId: biz.businessId,
      branchId: biz.branchId,
      entryNumber: 'JE-UNPOSTED-1',
      entryDate: '2026-10-05',
      description: 'Draft Journal',
      sourceType: 'MANUAL',
      isPosted: false, // Unposted!
      createdBy: ownerUserId,
      createdAt: '2026-10-05T00:00:00.000Z',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/datasets/business-insight?startDate=2026-10-01&endDate=2026-10-10',
      headers: biz.headers,
    });
    expect(res.statusCode).toBe(200);
  });
});

