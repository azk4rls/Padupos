import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import { domainStore } from '../modules/domainStore.js';
import { clearMemberDirectoryForTesting } from '../plugins/rbac.js';

describe('PADUPOS — Machine Learning & Data Sufficiency Tests (Sections 41, 42, 43, 81, 82)', () => {
  const app = buildApp();
  const testUserId = 'test_owner_ml';

  beforeEach(() => {
    domainStore.clearAll();
    clearMemberDirectoryForTesting();
  });

  it('honestly returns INSUFFICIENT_DATA when transaction history is below threshold (Rule 4)', async () => {
    // 1. Setup Business
    const onboard = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${testUserId}` },
      payload: {
        name: 'Toko Baru',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
      },
    });
    const businessId = onboard.json().business.id;
    const tenantHeaders = { authorization: `Bearer ${testUserId}`, 'x-business-id': businessId };

    // 2. Query Sales Forecast with 0 transactions
    const forecastRes = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/sales-forecast',
      headers: tenantHeaders,
    });

    expect(forecastRes.statusCode).toBe(200);
    const data = forecastRes.json();
    expect(data.status).toBe('INSUFFICIENT_DATA');
    expect(data.message).toContain('Belum cukup data historis');
    expect(data.prediction).toBeUndefined(); // Zero fake prediction!
  });

  it('calculates stock forecast with daily velocity and restock suggestions', async () => {
    // 1. Setup Business & Branch
    const onboard = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${testUserId}` },
      payload: {
        name: 'Toko Stok',
        businessType: 'RETAIL',
        countryCode: 'ID',
        currency: 'IDR',
      },
    });
    const businessId = onboard.json().business.id;
    const branchId = onboard.json().branch.id;
    const tenantHeaders = { authorization: `Bearer ${testUserId}`, 'x-business-id': businessId };

    // 2. Add product & 10 units stock
    const prodRes = await app.inject({
      method: 'POST',
      url: '/api/v1/products',
      headers: tenantHeaders,
      payload: { name: 'Item Cepat Habis', sellingPrice: '10000', costPrice: '5000' },
    });
    const productId = prodRes.json().product.id;

    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: tenantHeaders,
      payload: { branchId, productId, adjustedQuantity: '10', reason: 'Stock' },
    });

    // 3. Make sale of 7 units in last 7 days (velocity = 1 unit/day)
    await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items: [{ productId, quantity: '7', unitPrice: '10000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_stock_sale_1',
      },
    });

    // 4. Query Stock Forecast
    const stockForecastRes = await app.inject({
      method: 'GET',
      url: `/api/v1/ml/stock-forecast?branchId=${branchId}`,
      headers: tenantHeaders,
    });
    expect(stockForecastRes.statusCode).toBe(200);
    const forecast = stockForecastRes.json().stockForecast;
    expect(forecast.length).toBe(1);
    expect(forecast[0].dailyVelocity).toBe('1.00');
    expect(forecast[0].currentStock).toBe('3.0000'); // 10 - 7 = 3
    expect(forecast[0].daysUntilDepletion).toBe('3.0'); // 3 units / 1 per day = 3 days
    expect(Number(forecast[0].restockSuggestion)).toBeGreaterThan(0);
  });

  it('detects transaction anomalies without using the word fraud', async () => {
    // 1. Setup Business
    const onboard = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/onboarding',
      headers: { authorization: `Bearer ${testUserId}` },
      payload: {
        name: 'Toko Anomali',
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
      payload: { name: 'Normal Item', sellingPrice: '10000', costPrice: '5000' },
    });
    const productId = prodRes.json().product.id;
    await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/adjust',
      headers: tenantHeaders,
      payload: { branchId, productId, adjustedQuantity: '500', reason: 'Stock' },
    });

    // 3. Create 5 normal transactions around 10000
    for (let i = 1; i <= 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/pos/sales',
        headers: tenantHeaders,
        payload: {
          branchId,
          items: [{ productId, quantity: '1', unitPrice: '10000' }],
          paymentMethod: 'CASH',
          idempotencyKey: `idem_norm_${i}`,
        },
      });
    }

    // 4. Create an unusual spike transaction: 50 units = 500000 (50x average)
    await app.inject({
      method: 'POST',
      url: '/api/v1/pos/sales',
      headers: tenantHeaders,
      payload: {
        branchId,
        items: [{ productId, quantity: '50', unitPrice: '10000' }],
        paymentMethod: 'CASH',
        idempotencyKey: 'idem_spike_1',
      },
    });

    // 5. Query Anomalies
    const anomalyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/ml/anomalies',
      headers: tenantHeaders,
    });
    expect(anomalyRes.statusCode).toBe(200);
    const anomalies = anomalyRes.json().anomalies;
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].severity).toBe('UNUSUAL');
    expect(anomalies[0].notes).toContain('Unusual transaction pattern detected');
    expect(anomalies[0].notes).not.toContain('FRAUD'); // Never label as fraud!
  });
});
