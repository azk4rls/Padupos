import { domainStore } from '../domainStore.js';
import { toBN } from '@padupos/shared';
import BigNumber from 'bignumber.js';
import {
  type ResolvedDateRange,
  enumerateDays,
  isWithinRangeIso,
  todayInTimeZone,
} from '../../lib/dateRange.js';
import type {
  MLDataSufficiencyResult,
  MLDataSufficiencyStatus,
  MLDatasetScope,
  SalesDailyObservation,
  SalesDailyDataset,
  InventoryDailyObservation,
  InventoryDailyDataset,
  ProductDemandFeatures,
  ProductDemandDataset,
  BusinessInsightDataset,
  TransactionAnomalyObservation,
  AnomalyDetectionDataset,
  MLFeatureVector,
  MLTrainingDataResponse,
} from '@padupos/types';

// ================================================================
// 1. DATA SUFFICIENCY CONSTANTS & RULES
// ================================================================

export const ML_SUFFICIENCY_RULES = {
  SALES_FORECAST: {
    MIN_OBSERVATIONS: 14,
    MIN_TRANSACTIONS: 30,
    MESSAGE_INSUFFICIENT: 'Data belum cukup untuk membuat prediksi penjualan. Minimal 14 hari data historis dan 30 transaksi diperlukan.',
  },
  STOCK_FORECAST: {
    MIN_OBSERVATIONS: 7,
    MIN_MOVEMENTS: 1,
    MESSAGE_INSUFFICIENT: 'Data belum cukup untuk membuat prediksi stok. Belum ada riwayat pergerakan stok atau penjualan.',
  },
  ANOMALY_DETECTION: {
    MIN_TRANSACTIONS: 5,
    MESSAGE_INSUFFICIENT: 'Data transaksi belum mencukupi untuk membentuk baseline statistik (minimal 5 transaksi).',
  },
  BUSINESS_INSIGHT: {
    MIN_DAYS: 1,
    MESSAGE_INSUFFICIENT: 'Data belum cukup untuk analisis insight bisnis pada periode ini.',
  },
} as const;

export function createSufficiencyResult(
  status: MLDataSufficiencyStatus,
  message: string,
  actualObservations?: number,
  requiredObservations?: number,
  reason?: string,
): MLDataSufficiencyResult {
  return {
    status,
    message,
    actualObservations,
    requiredObservations,
    reason,
  };
}

// ================================================================
// 2. SCOPE & ISOLATION HELPERS
// ================================================================

function inBranch(recordBranchId: string | undefined | null, branchId: string | null): boolean {
  if (branchId === null || branchId === undefined) return true;
  return recordBranchId === branchId;
}

function saleMatchesScope(
  sale: { businessId: string; branchId?: string; status: string },
  businessId: string,
  branchId: string | null,
): boolean {
  return (
    sale.businessId === businessId &&
    inBranch(sale.branchId, branchId) &&
    sale.status === 'PAID'
  );
}

// ================================================================
// 3. DAILY SALES DATASET BUILDER
// ================================================================

export function buildSalesDailyDataset(
  businessId: string,
  branchId: string | null,
  range: ResolvedDateRange,
): SalesDailyDataset {
  const scope: MLDatasetScope = {
    businessId,
    branchId,
    timeZone: range.timeZone,
  };

  interface DayBucket {
    revenue: BigNumber;
    unitsSold: BigNumber;
    transactionCount: number;
    grossProfit: BigNumber;
    cogs: BigNumber;
  }

  const buckets = new Map<string, DayBucket>();
  for (const day of enumerateDays(range)) {
    buckets.set(day, {
      revenue: new BigNumber(0),
      unitsSold: new BigNumber(0),
      transactionCount: 0,
      grossProfit: new BigNumber(0),
      cogs: new BigNumber(0),
    });
  }

  let totalRevenue = new BigNumber(0);
  let totalUnitsSold = new BigNumber(0);
  let totalTransactions = 0;
  let totalGrossProfit = new BigNumber(0);
  let totalCogs = new BigNumber(0);

  for (const sale of domainStore.sales.values()) {
    if (!saleMatchesScope(sale, businessId, branchId)) continue;
    if (!isWithinRangeIso(range, sale.createdAt)) continue;

    const day = todayInTimeZone(range.timeZone, new Date(sale.createdAt));
    const bucket = buckets.get(day);
    if (!bucket) continue;

    const saleAmount = toBN(sale.totalAmount);
    const saleCogs = toBN(sale.cogsAmount || '0');
    const saleGrossProfit = toBN(sale.grossProfitAmount || '0');

    let saleUnits = new BigNumber(0);
    const items = domainStore.saleItems.get(sale.id) || [];
    for (const item of items) {
      saleUnits = saleUnits.plus(toBN(item.quantity));
    }

    bucket.revenue = bucket.revenue.plus(saleAmount);
    bucket.unitsSold = bucket.unitsSold.plus(saleUnits);
    bucket.transactionCount += 1;
    bucket.cogs = bucket.cogs.plus(saleCogs);
    bucket.grossProfit = bucket.grossProfit.plus(saleGrossProfit);

    totalRevenue = totalRevenue.plus(saleAmount);
    totalUnitsSold = totalUnitsSold.plus(saleUnits);
    totalTransactions += 1;
    totalGrossProfit = totalGrossProfit.plus(saleGrossProfit);
    totalCogs = totalCogs.plus(saleCogs);
  }

  const observations: SalesDailyObservation[] = Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, b]) => ({
      date,
      revenue: b.revenue.toFixed(4),
      unitsSold: b.unitsSold.toFixed(4),
      transactionCount: b.transactionCount,
      grossProfit: b.grossProfit.toFixed(4),
      cogs: b.cogs.toFixed(4),
    }));

  // Sufficiency evaluation
  const activeDaysCount = observations.filter((o) => o.transactionCount > 0).length;
  let sufficiency: MLDataSufficiencyResult;

  if (
    range.dayCount < ML_SUFFICIENCY_RULES.SALES_FORECAST.MIN_OBSERVATIONS ||
    totalTransactions < ML_SUFFICIENCY_RULES.SALES_FORECAST.MIN_TRANSACTIONS
  ) {
    sufficiency = createSufficiencyResult(
      'INSUFFICIENT_DATA',
      ML_SUFFICIENCY_RULES.SALES_FORECAST.MESSAGE_INSUFFICIENT,
      totalTransactions,
      ML_SUFFICIENCY_RULES.SALES_FORECAST.MIN_TRANSACTIONS,
      `Range has ${range.dayCount} calendar days and ${totalTransactions} transactions (minimum ${ML_SUFFICIENCY_RULES.SALES_FORECAST.MIN_OBSERVATIONS} days and ${ML_SUFFICIENCY_RULES.SALES_FORECAST.MIN_TRANSACTIONS} transactions)`,
    );
  } else {
    sufficiency = createSufficiencyResult(
      'SUFFICIENT',
      'Data mencukupi untuk pemodelan deret waktu penjualan.',
      totalTransactions,
      ML_SUFFICIENCY_RULES.SALES_FORECAST.MIN_TRANSACTIONS,
    );
  }

  return {
    scope,
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      dayCount: range.dayCount,
    },
    granularity: 'DAY',
    observations,
    totals: {
      revenue: totalRevenue.toFixed(4),
      unitsSold: totalUnitsSold.toFixed(4),
      transactionCount: totalTransactions,
      grossProfit: totalGrossProfit.toFixed(4),
      cogs: totalCogs.toFixed(4),
    },
    sufficiency,
  };
}

// ================================================================
// 4. DAILY INVENTORY DATASET BUILDER
// ================================================================

export function buildInventoryDailyDataset(
  businessId: string,
  branchId: string | null,
  range: ResolvedDateRange,
  productIds?: string[],
): InventoryDailyDataset {
  const scope: MLDatasetScope = {
    businessId,
    branchId,
    timeZone: range.timeZone,
  };

  // 1. Resolve products belonging to this tenant
  const targetProducts = Array.from(domainStore.products.values()).filter((p) => {
    if (p.businessId !== businessId) return false;
    if (productIds && productIds.length > 0) return productIds.includes(p.id);
    return true;
  });

  const resolvedProductIds = targetProducts.map((p) => p.id);
  const days = enumerateDays(range);

  // 2. Pre-calculate daily sales demand per product per day
  const dailyProductDemand = new Map<string, BigNumber>(); // key: `${productId}:${day}`
  for (const sale of domainStore.sales.values()) {
    if (!saleMatchesScope(sale, businessId, branchId)) continue;
    if (!isWithinRangeIso(range, sale.createdAt)) continue;

    const day = todayInTimeZone(range.timeZone, new Date(sale.createdAt));
    const items = domainStore.saleItems.get(sale.id) || [];
    for (const item of items) {
      if (resolvedProductIds.includes(item.productId)) {
        const key = `${item.productId}:${day}`;
        const prev = dailyProductDemand.get(key) || new BigNumber(0);
        dailyProductDemand.set(key, prev.plus(toBN(item.quantity)));
      }
    }
  }

  // 3. Pre-calculate daily stock movements in / out per product per day
  const dailyStockIn = new Map<string, BigNumber>();
  const dailyStockOut = new Map<string, BigNumber>();

  for (const m of domainStore.movements) {
    if (m.businessId !== businessId) continue;
    if (!inBranch(m.branchId, branchId)) continue;
    if (!isWithinRangeIso(range, m.createdAt)) continue;
    if (!resolvedProductIds.includes(m.productId)) continue;

    const day = todayInTimeZone(range.timeZone, new Date(m.createdAt));
    const key = `${m.productId}:${day}`;
    const qty = toBN(m.quantity);

    if (qty.isGreaterThan(0)) {
      const prev = dailyStockIn.get(key) || new BigNumber(0);
      dailyStockIn.set(key, prev.plus(qty));
    } else if (qty.isLessThan(0)) {
      const prev = dailyStockOut.get(key) || new BigNumber(0);
      dailyStockOut.set(key, prev.plus(qty.abs()));
    }
  }

  // 4. Build daily observations
  const observations: InventoryDailyObservation[] = [];
  let totalObservationsWithDemand = 0;

  for (const prod of targetProducts) {
    // Current stock balance for this product in scope
    let currentStockBN = new BigNumber(0);
    let avgCost = '0.0000';
    for (const inv of domainStore.inventories.values()) {
      if (inv.businessId === businessId && inv.productId === prod.id && inBranch(inv.branchId, branchId)) {
        currentStockBN = currentStockBN.plus(toBN(inv.availableQuantity));
        if (inv.averageCost && Number(inv.averageCost) > 0) {
          avgCost = toBN(inv.averageCost).toFixed(4);
        }
      }
    }
    if (avgCost === '0.0000') {
      for (const p of domainStore.prices.values()) {
        if (p.productId === prod.id && p.costPrice) {
          avgCost = toBN(p.costPrice).toFixed(4);
          break;
        }
      }
    }

    for (const day of days) {
      const key = `${prod.id}:${day}`;
      const demandBN = dailyProductDemand.get(key) || new BigNumber(0);
      const stockInBN = dailyStockIn.get(key) || new BigNumber(0);
      const stockOutBN = dailyStockOut.get(key) || new BigNumber(0);

      if (demandBN.isGreaterThan(0)) {
        totalObservationsWithDemand += 1;
      }

      observations.push({
        date: day,
        productId: prod.id,
        sku: prod.sku || null,
        productName: prod.name,
        closingStock: currentStockBN.toFixed(4),
        demand: demandBN.toFixed(4),
        stockIn: stockInBN.toFixed(4),
        stockOut: stockOutBN.toFixed(4),
        averageCost: avgCost,
      });
    }
  }

  // Sufficiency evaluation
  let sufficiency: MLDataSufficiencyResult;
  if (targetProducts.length === 0) {
    sufficiency = createSufficiencyResult(
      'INSUFFICIENT_DATA',
      'Tidak ada produk yang terdaftar untuk ruang lingkup ini.',
      0,
      1,
      'No products found in scope',
    );
  } else if (totalObservationsWithDemand === 0 && domainStore.movements.length === 0) {
    sufficiency = createSufficiencyResult(
      'INSUFFICIENT_DATA',
      ML_SUFFICIENCY_RULES.STOCK_FORECAST.MESSAGE_INSUFFICIENT,
      0,
      ML_SUFFICIENCY_RULES.STOCK_FORECAST.MIN_OBSERVATIONS,
      'Zero stock movements or demand observations recorded in range',
    );
  } else {
    sufficiency = createSufficiencyResult(
      'SUFFICIENT',
      'Data inventaris mencukupi untuk analisis stok.',
      observations.length,
      ML_SUFFICIENCY_RULES.STOCK_FORECAST.MIN_OBSERVATIONS,
    );
  }

  return {
    scope,
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      dayCount: range.dayCount,
    },
    granularity: 'DAY',
    productIds: resolvedProductIds,
    observations,
    sufficiency,
  };
}

// ================================================================
// 5. PRODUCT DEMAND FEATURES BUILDER
// ================================================================

export function buildProductDemandDataset(
  businessId: string,
  branchId: string | null,
  range: ResolvedDateRange,
  productIds?: string[],
): ProductDemandDataset {
  const scope: MLDatasetScope = {
    businessId,
    branchId,
    timeZone: range.timeZone,
  };

  const inventoryDataset = buildInventoryDailyDataset(businessId, branchId, range, productIds);
  const productsFeatures: ProductDemandFeatures[] = [];
  const days = enumerateDays(range);
  const dayCountBN = toBN(range.dayCount || 1);

  // Group inventory observations by product
  const byProduct = new Map<string, InventoryDailyObservation[]>();
  for (const obs of inventoryDataset.observations) {
    const list = byProduct.get(obs.productId) || [];
    list.push(obs);
    byProduct.set(obs.productId, list);
  }

  for (const [pId, obsList] of byProduct.entries()) {
    const first = obsList[0];
    const sortedObs = [...obsList].sort((a, b) => a.date.localeCompare(b.date));

    let totalDemandBN = new BigNumber(0);
    let zeroDemandDays = 0;
    const demandValues: BigNumber[] = [];

    for (const obs of sortedObs) {
      const d = toBN(obs.demand);
      demandValues.push(d);
      totalDemandBN = totalDemandBN.plus(d);
      if (d.isZero()) {
        zeroDemandDays += 1;
      }
    }

    const avgDailyDemandBN = totalDemandBN.dividedBy(dayCountBN);

    // Standard deviation of daily demand
    let varianceSum = new BigNumber(0);
    for (const d of demandValues) {
      const diff = d.minus(avgDailyDemandBN);
      varianceSum = varianceSum.plus(diff.multipliedBy(diff));
    }
    const variance = varianceSum.dividedBy(dayCountBN);
    const stdDevBN = new BigNumber(Math.sqrt(variance.toNumber()));

    // Coefficient of variation: stdDev / mean
    const demandCVBN = avgDailyDemandBN.isGreaterThan(0)
      ? stdDevBN.dividedBy(avgDailyDemandBN)
      : new BigNumber(0);

    // Current stock from latest observation
    const currentStockBN = toBN(first.closingStock);
    const avgCost = first.averageCost;

    // Days of cover: currentStock / avgDailyDemand
    let daysOfCover: string | 'INFINITE' = 'INFINITE';
    if (avgDailyDemandBN.isGreaterThan(0)) {
      daysOfCover = currentStockBN.dividedBy(avgDailyDemandBN).toFixed(1);
    }

    // Moving averages: 7-day and 30-day
    const recent7 = demandValues.slice(-7);
    const sum7 = recent7.reduce((acc, v) => acc.plus(v), new BigNumber(0));
    const movingAvg7dBN = recent7.length > 0 ? sum7.dividedBy(recent7.length) : new BigNumber(0);

    const recent30 = demandValues.slice(-30);
    const sum30 = recent30.reduce((acc, v) => acc.plus(v), new BigNumber(0));
    const movingAvg30dBN = recent30.length > 0 ? sum30.dividedBy(recent30.length) : new BigNumber(0);

    // Trend determination
    let trend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
    if (avgDailyDemandBN.isGreaterThan(0)) {
      const ratio = movingAvg7dBN.dividedBy(avgDailyDemandBN);
      if (ratio.isGreaterThan(1.1)) {
        trend = 'UP';
      } else if (ratio.isLessThan(0.9)) {
        trend = 'DOWN';
      }
    }

    productsFeatures.push({
      productId: pId,
      sku: first.sku,
      productName: first.productName,
      totalDemand: totalDemandBN.toFixed(4),
      avgDailyDemand: avgDailyDemandBN.toFixed(4),
      demandStdDev: stdDevBN.toFixed(4),
      demandCV: demandCVBN.toFixed(4),
      zeroDemandDays,
      currentStock: currentStockBN.toFixed(4),
      averageCost: avgCost,
      daysOfCover,
      trend,
      movingAvg7d: movingAvg7dBN.toFixed(4),
      movingAvg30d: movingAvg30dBN.toFixed(4),
    });
  }

  return {
    scope,
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      dayCount: range.dayCount,
    },
    products: productsFeatures,
    sufficiency: inventoryDataset.sufficiency,
  };
}

// ================================================================
// 6. ANOMALY DETECTION DATASET BUILDER
// ================================================================

export function buildAnomalyDetectionDataset(
  businessId: string,
  branchId: string | null,
  range: ResolvedDateRange,
): AnomalyDetectionDataset {
  const scope: MLDatasetScope = {
    businessId,
    branchId,
    timeZone: range.timeZone,
  };

  const paidSalesInScope: Array<{
    id: string;
    branchId?: string;
    totalAmount: string;
    createdAt: string;
    paymentMethod?: string;
    itemCount: number;
  }> = [];

  let sumAmount = new BigNumber(0);

  for (const sale of domainStore.sales.values()) {
    if (!saleMatchesScope(sale, businessId, branchId)) continue;
    if (!isWithinRangeIso(range, sale.createdAt)) continue;

    const items = domainStore.saleItems.get(sale.id) || [];
    const amt = toBN(sale.totalAmount);
    sumAmount = sumAmount.plus(amt);

    let paymentMethod = 'CASH';
    for (const p of domainStore.payments.values()) {
      if (p.saleId === sale.id) {
        paymentMethod = p.method;
        break;
      }
    }

    paidSalesInScope.push({
      id: sale.id,
      branchId: sale.branchId,
      totalAmount: sale.totalAmount,
      createdAt: sale.createdAt,
      paymentMethod,
      itemCount: items.length,
    });
  }

  const sampleSize = paidSalesInScope.length;

  if (sampleSize < ML_SUFFICIENCY_RULES.ANOMALY_DETECTION.MIN_TRANSACTIONS) {
    return {
      scope,
      range: {
        startDate: range.startDate,
        endDate: range.endDate,
        dayCount: range.dayCount,
      },
      observations: [],
      baseline: {
        meanAmount: '0.0000',
        stdDevAmount: '0.0000',
        sampleSize,
      },
      sufficiency: createSufficiencyResult(
        'INSUFFICIENT_DATA',
        ML_SUFFICIENCY_RULES.ANOMALY_DETECTION.MESSAGE_INSUFFICIENT,
        sampleSize,
        ML_SUFFICIENCY_RULES.ANOMALY_DETECTION.MIN_TRANSACTIONS,
        `Only ${sampleSize} transactions in range (minimum ${ML_SUFFICIENCY_RULES.ANOMALY_DETECTION.MIN_TRANSACTIONS} required for statistical baseline)`,
      ),
    };
  }

  // Calculate baseline mean
  const meanBN = sumAmount.dividedBy(sampleSize);

  // Calculate baseline standard deviation
  let varianceSum = new BigNumber(0);
  for (const s of paidSalesInScope) {
    const diff = toBN(s.totalAmount).minus(meanBN);
    varianceSum = varianceSum.plus(diff.multipliedBy(diff));
  }
  const varianceBN = varianceSum.dividedBy(sampleSize);
  const stdDev = Math.sqrt(varianceBN.toNumber());
  const stdDevBN = new BigNumber(stdDev);

  // Statistical threshold: 3 standard deviations or 3.5x mean
  const spikeThreshold = meanBN.multipliedBy(3.5);

  const observations: TransactionAnomalyObservation[] = [];
  for (const s of paidSalesInScope) {
    const amtBN = toBN(s.totalAmount);
    let deviationScore = new BigNumber(0);
    if (stdDevBN.isGreaterThan(0)) {
      deviationScore = amtBN.minus(meanBN).dividedBy(stdDevBN);
    }

    const isUnusual =
      deviationScore.isGreaterThan(3.0) ||
      amtBN.isGreaterThan(spikeThreshold);

    observations.push({
      transactionId: s.id,
      date: s.createdAt,
      branchId: s.branchId || '',
      amount: amtBN.toFixed(4),
      itemCount: s.itemCount,
      paymentMethod: s.paymentMethod || 'CASH',
      baselineMeanAmount: meanBN.toFixed(4),
      baselineStdDevAmount: stdDevBN.toFixed(4),
      deviationScore: deviationScore.toFixed(2),
      isUnusual,
      reason: isUnusual
        ? 'Pola transaksi tidak biasa terdeteksi: nilai transaksi menyimpang signifikan dari baseline statistik'
        : undefined,
    });
  }

  return {
    scope,
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      dayCount: range.dayCount,
    },
    observations,
    baseline: {
      meanAmount: meanBN.toFixed(4),
      stdDevAmount: stdDevBN.toFixed(4),
      sampleSize,
    },
    sufficiency: createSufficiencyResult(
      'SUFFICIENT',
      'Data transaksi mencukupi untuk deteksi anomali statistik.',
      sampleSize,
      ML_SUFFICIENCY_RULES.ANOMALY_DETECTION.MIN_TRANSACTIONS,
    ),
  };
}

// ================================================================
// 7. BUSINESS INSIGHT DATASET BUILDER
// ================================================================

export function buildBusinessInsightDataset(
  businessId: string,
  branchId: string | null,
  range: ResolvedDateRange,
): BusinessInsightDataset {
  const scope: MLDatasetScope = {
    businessId,
    branchId,
    timeZone: range.timeZone,
  };

  // 1. Sales Daily Series
  const salesDataset = buildSalesDailyDataset(businessId, branchId, range);

  // 2. Top Products by Revenue
  const productAgg = new Map<string, { name: string; revenue: BigNumber; units: BigNumber; cogs: BigNumber }>();
  for (const sale of domainStore.sales.values()) {
    if (!saleMatchesScope(sale, businessId, branchId)) continue;
    if (!isWithinRangeIso(range, sale.createdAt)) continue;

    const items = domainStore.saleItems.get(sale.id) || [];
    for (const it of items) {
      const p = domainStore.products.get(it.productId);
      const prev = productAgg.get(it.productId) || {
        name: p ? p.name : 'Unknown Product',
        revenue: new BigNumber(0),
        units: new BigNumber(0),
        cogs: new BigNumber(0),
      };
      const lineRev = toBN(it.total);
      const lineCost = toBN(it.unitCost || 0).multipliedBy(toBN(it.quantity));
      prev.revenue = prev.revenue.plus(lineRev);
      prev.units = prev.units.plus(toBN(it.quantity));
      prev.cogs = prev.cogs.plus(lineCost);
      productAgg.set(it.productId, prev);
    }
  }

  const topProducts = Array.from(productAgg.entries())
    .map(([pId, agg]) => ({
      productId: pId,
      productName: agg.name,
      revenue: agg.revenue.toFixed(4),
      unitsSold: agg.units.toFixed(4),
      grossProfit: agg.revenue.minus(agg.cogs).toFixed(4),
    }))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 10);

  // 3. Payment Mix
  const paymentMixBN: Record<string, BigNumber> = {};
  for (const payment of domainStore.payments.values()) {
    if (payment.businessId !== businessId || payment.status !== 'PAID') continue;
    const sale = domainStore.sales.get(payment.saleId);
    if (branchId !== null && (!sale || sale.branchId !== branchId)) continue;

    const paidAt = payment.paidAt || payment.createdAt;
    if (!paidAt || !isWithinRangeIso(range, paidAt)) continue;

    const m = payment.method;
    paymentMixBN[m] = (paymentMixBN[m] || new BigNumber(0)).plus(toBN(payment.amount));
  }
  const paymentMix: Record<string, string> = {};
  for (const [k, v] of Object.entries(paymentMixBN)) {
    paymentMix[k] = v.toFixed(4);
  }

  // 4. Expenses by Category
  const expenseCatBN = new Map<string, { name: string; amount: BigNumber }>();
  for (const exp of domainStore.expenses) {
    if (exp.businessId !== businessId || !inBranch(exp.branchId, branchId)) continue;
    if (!isWithinRangeIso(range, exp.incurredAt)) continue;

    const cat = domainStore.expenseCategories.get(exp.categoryId);
    const catName = cat ? cat.name : 'Other';
    const prev = expenseCatBN.get(exp.categoryId) || { name: catName, amount: new BigNumber(0) };
    prev.amount = prev.amount.plus(toBN(exp.amount));
    expenseCatBN.set(exp.categoryId, prev);
  }
  const expensesByCategory = Array.from(expenseCatBN.entries()).map(([cId, data]) => ({
    categoryId: cId,
    categoryName: data.name,
    amount: data.amount.toFixed(4),
  }));

  // 5. Inventory Health
  let totalProducts = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalStockValueBN = new BigNumber(0);

  for (const prod of domainStore.products.values()) {
    if (prod.businessId !== businessId) continue;
    totalProducts += 1;

    let prodStock = new BigNumber(0);
    let prodCost = '0.0000';
    for (const inv of domainStore.inventories.values()) {
      if (inv.businessId === businessId && inv.productId === prod.id && inBranch(inv.branchId, branchId)) {
        prodStock = prodStock.plus(toBN(inv.availableQuantity));
        if (inv.averageCost && Number(inv.averageCost) > 0) {
          prodCost = inv.averageCost;
        }
      }
    }
    if (prodCost === '0.0000') {
      for (const p of domainStore.prices.values()) {
        if (p.productId === prod.id && p.costPrice) {
          prodCost = p.costPrice;
          break;
        }
      }
    }

    const cost = toBN(prodCost);
    totalStockValueBN = totalStockValueBN.plus(prodStock.multipliedBy(cost));

    if (prodStock.isLessThanOrEqualTo(0)) {
      outOfStockCount += 1;
    } else if (prodStock.isLessThanOrEqualTo(10)) {
      lowStockCount += 1;
    }
  }

  // 6. Receivables Aging
  const receivablesAgingBN = {
    current: new BigNumber(0),
    days1to30: new BigNumber(0),
    days31to60: new BigNumber(0),
    days61to90: new BigNumber(0),
    over90: new BigNumber(0),
  };
  const nowMs = range.endExclusive.getTime();

  for (const rec of domainStore.receivables.values()) {
    if (rec.businessId !== businessId || rec.status === 'PAID' || rec.status === 'CANCELLED') continue;
    if (branchId !== null) {
      const sale = domainStore.sales.get(rec.saleId);
      if (!sale || sale.branchId !== branchId) continue;
    }
    const rem = toBN(rec.remainingAmount);
    const dueMs = new Date(rec.dueDate).getTime();
    const overdueDays = Math.floor((nowMs - dueMs) / 86400000);

    if (overdueDays <= 0) receivablesAgingBN.current = receivablesAgingBN.current.plus(rem);
    else if (overdueDays <= 30) receivablesAgingBN.days1to30 = receivablesAgingBN.days1to30.plus(rem);
    else if (overdueDays <= 60) receivablesAgingBN.days31to60 = receivablesAgingBN.days31to60.plus(rem);
    else if (overdueDays <= 90) receivablesAgingBN.days61to90 = receivablesAgingBN.days61to90.plus(rem);
    else receivablesAgingBN.over90 = receivablesAgingBN.over90.plus(rem);
  }

  // 7. Payables Aging
  const payablesAgingBN = {
    current: new BigNumber(0),
    days1to30: new BigNumber(0),
    days31to60: new BigNumber(0),
    days61to90: new BigNumber(0),
    over90: new BigNumber(0),
  };
  for (const pay of domainStore.payables.values()) {
    if (pay.businessId !== businessId || pay.status === 'PAID' || pay.status === 'CANCELLED') continue;
    if (branchId !== null) {
      const purchase = domainStore.purchases.get(pay.purchaseId);
      if (!purchase || purchase.branchId !== branchId) continue;
    }
    const rem = toBN(pay.remainingAmount);
    const dueMs = new Date(pay.dueDate).getTime();
    const overdueDays = Math.floor((nowMs - dueMs) / 86400000);

    if (overdueDays <= 0) payablesAgingBN.current = payablesAgingBN.current.plus(rem);
    else if (overdueDays <= 30) payablesAgingBN.days1to30 = payablesAgingBN.days1to30.plus(rem);
    else if (overdueDays <= 60) payablesAgingBN.days31to60 = payablesAgingBN.days31to60.plus(rem);
    else if (overdueDays <= 90) payablesAgingBN.days61to90 = payablesAgingBN.days61to90.plus(rem);
    else payablesAgingBN.over90 = payablesAgingBN.over90.plus(rem);
  }

  const hasActivity =
    salesDataset.totals.transactionCount > 0 ||
    expensesByCategory.length > 0 ||
    totalProducts > 0;

  const sufficiency = hasActivity
    ? createSufficiencyResult('SUFFICIENT', 'Data operasional tersedia untuk analisis insight bisnis.')
    : createSufficiencyResult(
        'INSUFFICIENT_DATA',
        ML_SUFFICIENCY_RULES.BUSINESS_INSIGHT.MESSAGE_INSUFFICIENT,
        0,
        1,
        'No business activity found in the selected range',
      );

  return {
    scope,
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      dayCount: range.dayCount,
    },
    salesSeries: salesDataset.observations,
    topProducts,
    paymentMix,
    expensesByCategory,
    inventoryHealth: {
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalStockValue: totalStockValueBN.toFixed(4),
    },
    receivablesAging: {
      current: receivablesAgingBN.current.toFixed(4),
      days1to30: receivablesAgingBN.days1to30.toFixed(4),
      days31to60: receivablesAgingBN.days31to60.toFixed(4),
      days61to90: receivablesAgingBN.days61to90.toFixed(4),
      over90: receivablesAgingBN.over90.toFixed(4),
    },
    payablesAging: {
      current: payablesAgingBN.current.toFixed(4),
      days1to30: payablesAgingBN.days1to30.toFixed(4),
      days31to60: payablesAgingBN.days31to60.toFixed(4),
      days61to90: payablesAgingBN.days61to90.toFixed(4),
      over90: payablesAgingBN.over90.toFixed(4),
    },
    sufficiency,
  };
}

// ================================================================
// 8. ML FEATURE VECTORS / TRAINING DATA GENERATOR
// ================================================================

export function buildMLTrainingData(
  businessId: string,
  branchId: string | null,
  predictionType: 'SALES_FORECAST' | 'STOCK_FORECAST' | 'ANOMALY_DETECTION',
  range: ResolvedDateRange,
): MLTrainingDataResponse {
  const scope: MLDatasetScope = {
    businessId,
    branchId,
    timeZone: range.timeZone,
  };

  const features: MLFeatureVector[] = [];
  const targets: string[] = [];
  let sufficiency: MLDataSufficiencyResult;

  if (predictionType === 'SALES_FORECAST') {
    const dataset = buildSalesDailyDataset(businessId, branchId, range);
    sufficiency = dataset.sufficiency;
    const obs = dataset.observations;

    const featureNames = [
      'lag_1_revenue',
      'lag_2_revenue',
      'lag_3_revenue',
      'lag_7_revenue',
      'rolling_mean_7',
      'day_of_week',
      'is_weekend',
    ];

    // Build rolling feature vectors for observations where at least 7 days of lags are available
    for (let i = 7; i < obs.length; i++) {
      const targetRevenue = obs[i].revenue;
      const lag1 = obs[i - 1].revenue;
      const lag2 = obs[i - 2].revenue;
      const lag3 = obs[i - 3].revenue;
      const lag7 = obs[i - 7].revenue;

      // 7-day rolling mean
      let sum7 = new BigNumber(0);
      for (let j = i - 7; j < i; j++) {
        sum7 = sum7.plus(toBN(obs[j].revenue));
      }
      const rollingMean7 = sum7.dividedBy(7).toFixed(4);

      // Date features
      const obsDate = new Date(`${obs[i].date}T00:00:00Z`);
      const dayOfWeek = obsDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? '1' : '0';

      features.push({
        featureNames,
        values: [
          lag1,
          lag2,
          lag3,
          lag7,
          rollingMean7,
          dayOfWeek.toString(),
          isWeekend,
        ],
        metadata: {
          date: obs[i].date,
          transactionCount: obs[i].transactionCount,
        },
      });
      targets.push(targetRevenue);
    }
  } else if (predictionType === 'STOCK_FORECAST') {
    const demandDataset = buildProductDemandDataset(businessId, branchId, range);
    sufficiency = demandDataset.sufficiency;

    const featureNames = [
      'total_demand',
      'avg_daily_demand',
      'demand_std_dev',
      'demand_cv',
      'zero_demand_days',
      'current_stock',
      'moving_avg_7d',
      'moving_avg_30d',
    ];

    for (const prod of demandDataset.products) {
      features.push({
        featureNames,
        values: [
          prod.totalDemand,
          prod.avgDailyDemand,
          prod.demandStdDev,
          prod.demandCV,
          prod.zeroDemandDays.toString(),
          prod.currentStock,
          prod.movingAvg7d,
          prod.movingAvg30d,
        ],
        metadata: {
          productId: prod.productId,
          productName: prod.productName,
          daysOfCover: prod.daysOfCover,
          trend: prod.trend,
        },
      });
      // Target is expected 7-day demand: avgDailyDemand * 7
      const target7d = toBN(prod.avgDailyDemand).multipliedBy(7).toFixed(4);
      targets.push(target7d);
    }
  } else {
    // ANOMALY_DETECTION
    const anomalyDataset = buildAnomalyDetectionDataset(businessId, branchId, range);
    sufficiency = anomalyDataset.sufficiency;

    const featureNames = [
      'amount',
      'item_count',
      'baseline_mean',
      'baseline_std_dev',
      'deviation_score',
    ];

    for (const anom of anomalyDataset.observations) {
      features.push({
        featureNames,
        values: [
          anom.amount,
          anom.itemCount.toString(),
          anom.baselineMeanAmount,
          anom.baselineStdDevAmount,
          anom.deviationScore,
        ],
        metadata: {
          transactionId: anom.transactionId,
          date: anom.date,
          paymentMethod: anom.paymentMethod,
          isUnusual: anom.isUnusual,
        },
      });
      targets.push(anom.isUnusual ? '1' : '0');
    }
  }

  return {
    businessId,
    branchId,
    predictionType,
    features,
    targets,
    scope,
    range: {
      startDate: range.startDate,
      endDate: range.endDate,
      dayCount: range.dayCount,
    },
    sufficiency,
  };
}
