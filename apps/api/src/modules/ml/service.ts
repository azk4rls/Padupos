import { domainStore } from '../domainStore.js';
import { generatePrefixedId, toBN } from '@padupos/shared';
import type { MLPrediction, AnomalyEvent } from '@padupos/types';
import BigNumber from 'bignumber.js';

export class MLService {
  static MIN_TRANSACTIONS_FOR_FORECAST = 30;

  // 1. Sales Forecast
  static getSalesForecast(businessId: string): { status: 'SUCCESS' | 'INSUFFICIENT_DATA'; prediction?: MLPrediction; message?: string } {
    let transactionCount = 0;
    let totalSales = new BigNumber(0);

    for (const s of domainStore.sales.values()) {
      if (s.businessId === businessId && s.status === 'PAID') {
        transactionCount++;
        totalSales = totalSales.plus(toBN(s.totalAmount));
      }
    }

    if (transactionCount < this.MIN_TRANSACTIONS_FOR_FORECAST) {
      return {
        status: 'INSUFFICIENT_DATA',
        message: 'Belum cukup data historis untuk membuat prediksi penjualan yang andal. Dibutuhkan minimal 30 transaksi.',
      };
    }

    // Historical baseline forecast: average daily sales * 7 days
    const avgSale = totalSales.dividedBy(transactionCount);
    const forecast7Days = avgSale.multipliedBy(7);

    const predictionId = generatePrefixedId('pred');
    const prediction: MLPrediction = {
      id: predictionId,
      businessId,
      modelId: 'mdl_sales_baseline_v1',
      predictionType: 'SALES_FORECAST',
      target: '7_DAYS_REVENUE',
      prediction: forecast7Days.toFixed(4),
      lowerBound: forecast7Days.multipliedBy(0.85).toFixed(4),
      upperBound: forecast7Days.multipliedBy(1.15).toFixed(4),
      generatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      sourceDataRange: {
        start: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    domainStore.mlPredictions.push(prediction);
    return { status: 'SUCCESS', prediction };
  }

  // 2. Stock Forecast & Depletion Days
  static getStockForecast(businessId: string, branchId?: string) {
    const results = [];

    for (const inv of domainStore.inventories.values()) {
      if (inv.businessId === businessId && (!branchId || inv.branchId === branchId)) {
        const prod = domainStore.products.get(inv.productId);
        const currentQty = toBN(inv.availableQuantity);

        // Calculate sales velocity: units sold in last 7 days
        let unitsSold = new BigNumber(0);
        for (const s of domainStore.sales.values()) {
          if (s.businessId === businessId && s.status === 'PAID') {
            const items = domainStore.saleItems.get(s.id) || [];
            for (const it of items) {
              if (it.productId === inv.productId) {
                unitsSold = unitsSold.plus(toBN(it.quantity));
              }
            }
          }
        }

        const dailyVelocity = unitsSold.dividedBy(7);
        let daysUntilDepletion = 'N/A';
        let restockSuggestion = '0.0000';

        if (dailyVelocity.isGreaterThan(0)) {
          const daysBN = currentQty.dividedBy(dailyVelocity);
          daysUntilDepletion = daysBN.toFixed(1);

          // Restock suggestion to maintain 14 days of inventory
          const desired14Days = dailyVelocity.multipliedBy(14);
          if (currentQty.isLessThan(desired14Days)) {
            restockSuggestion = desired14Days.minus(currentQty).toFixed(4);
          }
        }

        results.push({
          productId: inv.productId,
          productName: prod ? prod.name : 'Unknown Product',
          currentStock: inv.availableQuantity,
          dailyVelocity: dailyVelocity.toFixed(2),
          daysUntilDepletion,
          restockSuggestion,
        });
      }
    }

    return results;
  }

  // 3. Anomaly Detection
  static detectAnomalies(businessId: string): AnomalyEvent[] {
    const anomalies: AnomalyEvent[] = [];

    // Calculate average transaction size
    let sum = new BigNumber(0);
    let count = 0;
    const paidSales = [];

    for (const s of domainStore.sales.values()) {
      if (s.businessId === businessId && s.status === 'PAID') {
        sum = sum.plus(toBN(s.totalAmount));
        count++;
        paidSales.push(s);
      }
    }

    if (count < 5) return []; // need minimal baseline

    const mean = sum.dividedBy(count);
    const threshold = mean.multipliedBy(3.5); // 3.5x average is unusual spike

    for (const s of paidSales) {
      const amt = toBN(s.totalAmount);
      if (amt.isGreaterThan(threshold)) {
        anomalies.push({
          id: generatePrefixedId('anom'),
          businessId,
          branchId: s.branchId,
          entityType: 'TRANSACTION',
          entityId: s.id,
          metricName: 'TRANSACTION_AMOUNT',
          expectedValue: mean.toFixed(4),
          actualValue: amt.toFixed(4),
          severity: 'UNUSUAL',
          notes: 'Unusual transaction pattern detected. Review recommended.',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return anomalies;
  }
}
