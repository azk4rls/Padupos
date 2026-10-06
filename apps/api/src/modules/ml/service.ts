import { domainStore } from '../domainStore.js';
import { generatePrefixedId, toBN } from '@padupos/shared';
import type {
  MLPrediction,
  AnomalyEvent,
  SalesDailyDataset,
  InventoryDailyDataset,
  ProductDemandDataset,
  AnomalyDetectionDataset,
  BusinessInsightDataset,
  MLTrainingDataResponse,
  MLTrainingDataRequest,
  AIInsight,
} from '@padupos/types';
import BigNumber from 'bignumber.js';
import {
  type DateRangeQuery,
  resolveDateRange,
  todayInTimeZone,
  resolveScopeTimeZone,
  addCalendarDays,
} from '../../lib/dateRange.js';
import {
  buildSalesDailyDataset,
  buildInventoryDailyDataset,
  buildProductDemandDataset,
  buildAnomalyDetectionDataset,
  buildBusinessInsightDataset,
  buildMLTrainingData,
} from './dataReadiness.js';
import { DeterministicInsightEngine } from './insightEngine.js';

export class MLService {
  static MIN_TRANSACTIONS_FOR_FORECAST = 30;

  // ================================================================
  // 1. BASELINE PREDICTIONS (EXISTING PHASE 7 COMPATIBILITY)
  // ================================================================

  static getSalesForecast(businessId: string): {
    status: 'SUCCESS' | 'INSUFFICIENT_DATA';
    prediction?: MLPrediction;
    message?: string;
  } {
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
        message:
          'Belum cukup data historis untuk membuat prediksi penjualan yang andal. Dibutuhkan minimal 30 transaksi.',
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

  // ================================================================
  // 2. PHASE 8.1 ML DATA READINESS PIPELINES & DATASETS
  // ================================================================

  static getSalesDailyDataset(
    businessId: string,
    branchId: string | null,
    query: DateRangeQuery,
  ): SalesDailyDataset {
    const range = resolveDateRange(query, businessId, branchId);
    return buildSalesDailyDataset(businessId, branchId, range);
  }

  static getInventoryDailyDataset(
    businessId: string,
    branchId: string | null,
    query: DateRangeQuery,
    productIds?: string[],
  ): InventoryDailyDataset {
    const range = resolveDateRange(query, businessId, branchId);
    return buildInventoryDailyDataset(businessId, branchId, range, productIds);
  }

  static getProductDemandDataset(
    businessId: string,
    branchId: string | null,
    query: DateRangeQuery,
    productIds?: string[],
  ): ProductDemandDataset {
    const range = resolveDateRange(query, businessId, branchId);
    return buildProductDemandDataset(businessId, branchId, range, productIds);
  }

  static getAnomalyDetectionDataset(
    businessId: string,
    branchId: string | null,
    query: DateRangeQuery,
  ): AnomalyDetectionDataset {
    const range = resolveDateRange(query, businessId, branchId);
    return buildAnomalyDetectionDataset(businessId, branchId, range);
  }

  static getBusinessInsightDataset(
    businessId: string,
    branchId: string | null,
    query: DateRangeQuery,
  ): BusinessInsightDataset {
    const range = resolveDateRange(query, businessId, branchId);
    return buildBusinessInsightDataset(businessId, branchId, range);
  }

  static getTrainingData(
    businessId: string,
    branchId: string | null,
    req: MLTrainingDataRequest,
  ): MLTrainingDataResponse {
    const tz = resolveScopeTimeZone(businessId, branchId);
    const today = todayInTimeZone(tz);
    const daysToLookback = req.lookbackDays || 30;
    const startDate = addCalendarDays(today, -daysToLookback);

    const range = resolveDateRange(
      { startDate, endDate: today },
      businessId,
      branchId,
    );

    return buildMLTrainingData(businessId, branchId, req.predictionType, range);
  }

  // ================================================================
  // 3. PHASE 8.2 AI BUSINESS INSIGHTS
  // ================================================================

  static async getInsights(
    businessId: string,
    branchId: string | null,
    query?: DateRangeQuery & { insightType?: AIInsight['insightType'] },
  ) {
    return DeterministicInsightEngine.getInsights(businessId, branchId, query);
  }

  static async generateInsight(
    businessId: string,
    branchId: string | null,
    insightType: AIInsight['insightType'],
    query?: DateRangeQuery,
  ) {
    return DeterministicInsightEngine.generateInsight(businessId, branchId, insightType, query);
  }
}

