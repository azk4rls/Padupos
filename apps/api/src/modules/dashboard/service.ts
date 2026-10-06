import { domainStore } from '../domainStore.js';
import { toBN } from '@padupos/shared';
import BigNumber from 'bignumber.js';
import {
  type ResolvedDateRange,
  addCalendarDays,
  countCalendarDays,
  enumerateDays,
  isWithinRangeIso,
  startOfMonth,
  startOfWeek,
  startOfZonedDay,
  todayInTimeZone,
} from '../../lib/dateRange.js';

/**
 * Dashboard metrics.
 *
 * Scope
 * -----
 * `businessId` is always required (tenant boundary, already proven by resolveTenant).
 * `branchId` is optional. `null` => business-level rollup. A concrete id => only that
 * branch's activity, and only after branch membership was authorized upstream by
 * resolveBranchScope.
 *
 * Period
 * ------
 * `range` is the explicitly requested window. All period aggregates below are computed
 * from it in the scope timezone, so the dashboard no longer mixes server-local dates
 * with business-local business rules.
 *
 * When the caller supplies no date range at all, the service additionally computes the
 * three conventional rolling windows (today / this week / this month) that the product
 * requires. These are always business-timezone aware.
 */

export interface DashboardMetrics {
  scope: { businessId: string; branchId: string | null; timeZone: string };
  range: { startDate: string; endDate: string; dayCount: number };
  /** Total sales inside the requested range. */
  sales: string;
  transactions: number;
  totalCOGS: string;
  grossProfit: string;
  operatingExpenses: string;
  operatingProfit: string;
  /** Rolling windows, business-timezone aware. */
  salesToday: string;
  salesThisWeek: string;
  salesThisMonth: string;
  cashOnHand: string;
  totalReceivables: string;
  totalPayables: string;
  lowStockCount: number;
  topProducts: Array<{ productId: string; productName: string; unitsSold: string; totalRevenue: string }>;
  paymentDistribution: Record<string, string>;
  /**
   * Exact sum of `paymentDistribution`. Supplied by the backend so the frontend can
   * draw proportional bars without ever doing money arithmetic itself.
   */
  paymentDistributionTotal: string;
}

export interface DashboardTimeSeriesPoint {
  /** Scope-local calendar day, `YYYY-MM-DD`. */
  date: string;
  sales: string;
  revenue: string;
  cogs: string;
  grossProfit: string;
  transactions: number;
}

export interface DashboardTimeSeries {
  scope: { businessId: string; branchId: string | null; timeZone: string };
  range: { startDate: string; endDate: string; dayCount: number };
  granularity: 'DAY';
  series: DashboardTimeSeriesPoint[];
  totals: {
    sales: string;
    revenue: string;
    cogs: string;
    grossProfit: string;
    transactions: number;
  };
}

function inBranch(recordBranchId: string | undefined, branchId: string | null): boolean {
  if (branchId === null) return true;
  return recordBranchId === branchId;
}

function saleMatchesScope(
  sale: { businessId: string; branchId?: string; status: string; createdAt: string },
  businessId: string,
  branchId: string | null,
): boolean {
  return (
    sale.businessId === businessId &&
    inBranch(sale.branchId, branchId) &&
    sale.status === 'PAID'
  );
}

export class DashboardMetricsService {
  static getMetrics(
    businessId: string,
    branchId: string | null,
    range: ResolvedDateRange,
    now: Date = new Date(),
  ): DashboardMetrics {
    let salesTodayBN = new BigNumber(0);
    let salesWeekBN = new BigNumber(0);
    let salesMonthBN = new BigNumber(0);
    let salesRangeBN = new BigNumber(0);
    let totalCogsBN = new BigNumber(0);
    let grossProfitBN = new BigNumber(0);
    let rangeTransactions = 0;

    const productSalesMap = new Map<string, { qty: BigNumber; revenue: BigNumber }>();
    const paymentMethodMap: Record<string, BigNumber> = {};
    let paymentDistributionTotalBN = new BigNumber(0);

    const today = todayInTimeZone(range.timeZone, now);
    const weekStartInstant = startOfZonedDay(startOfWeek(today), range.timeZone);
    const monthStartInstant = startOfZonedDay(startOfMonth(today), range.timeZone);

    for (const sale of domainStore.sales.values()) {
      if (!saleMatchesScope(sale, businessId, branchId)) continue;

      const createdAt = sale.createdAt;
      const saleInstant = new Date(createdAt);
      if (Number.isNaN(saleInstant.getTime())) continue;

      const saleAmount = toBN(sale.totalAmount);

      // Rolling windows are evaluated in the scope timezone. A bare UTC comparison
      // would misclassify sales made near midnight local time.
      if (todayInTimeZone(range.timeZone, saleInstant) === today) {
        salesTodayBN = salesTodayBN.plus(saleAmount);
      }
      if (saleInstant.getTime() >= weekStartInstant.getTime()) {
        salesWeekBN = salesWeekBN.plus(saleAmount);
      }
      if (saleInstant.getTime() >= monthStartInstant.getTime()) {
        salesMonthBN = salesMonthBN.plus(saleAmount);
      }

      if (!isWithinRangeIso(range, createdAt)) continue;

      salesRangeBN = salesRangeBN.plus(saleAmount);
      totalCogsBN = totalCogsBN.plus(toBN(sale.cogsAmount));
      grossProfitBN = grossProfitBN.plus(toBN(sale.grossProfitAmount));
      rangeTransactions += 1;

      const items = domainStore.saleItems.get(sale.id) ?? [];
      for (const item of items) {
        const previous = productSalesMap.get(item.productId) ?? {
          qty: new BigNumber(0),
          revenue: new BigNumber(0),
        };
        productSalesMap.set(item.productId, {
          qty: previous.qty.plus(toBN(item.quantity)),
          revenue: previous.revenue.plus(toBN(item.total)),
        });
      }
    }

    for (const payment of domainStore.payments.values()) {
      if (payment.businessId !== businessId || payment.status !== 'PAID') continue;
      // Payment carries no branch or date of its own; the branch comes from its parent
      // sale. The payment instant is used for the requested range, so this section
      // always describes the same window as every other metric above.
      const sale = domainStore.sales.get(payment.saleId);
      if (branchId !== null && (!sale || sale.branchId !== branchId)) continue;

      const paidAt = payment.paidAt ?? payment.createdAt;
      if (!paidAt || !isWithinRangeIso(range, paidAt)) continue;

      const method = payment.method;
      const amount = toBN(payment.amount);
      paymentMethodMap[method] = (paymentMethodMap[method] ?? new BigNumber(0)).plus(amount);
      paymentDistributionTotalBN = paymentDistributionTotalBN.plus(amount);
    }

    let operatingExpensesBN = new BigNumber(0);
    for (const expense of domainStore.expenses) {
      if (expense.businessId !== businessId || !inBranch(expense.branchId, branchId)) continue;
      if (!isWithinRangeIso(range, expense.incurredAt)) continue;
      operatingExpensesBN = operatingExpensesBN.plus(toBN(expense.amount));
    }

    const operatingProfitBN = grossProfitBN.minus(operatingExpensesBN);

    // Cash on Hand is a ledger balance, not a period figure: it is always the
    // business-wide (or branch-wide) posted cash position, unaffected by date range.
    let cashOnHandBN = new BigNumber(0);
    for (const entry of domainStore.journalEntries.values()) {
      if (entry.businessId !== businessId || !entry.isPosted) continue;
      if (branchId !== null && entry.branchId !== undefined && entry.branchId !== branchId) {
        continue;
      }
      for (const line of domainStore.journalLines.get(entry.id) ?? []) {
        // 1010 Cash on Hand and 1020 Bank Account are both liquid cash equivalents.
        if (line.accountId.endsWith('_1010') || line.accountId.endsWith('_1020')) {
          cashOnHandBN = cashOnHandBN.plus(toBN(line.debit)).minus(toBN(line.credit));
        }
      }
    }

    let totalReceivablesBN = new BigNumber(0);
    for (const receivable of domainStore.receivables.values()) {
      if (
        receivable.businessId !== businessId ||
        receivable.status === 'PAID' ||
        receivable.status === 'CANCELLED'
      ) {
        continue;
      }
      // A receivable has no branch of its own; it inherits its parent sale's branch.
      if (branchId !== null) {
        const sale = domainStore.sales.get(receivable.saleId);
        if (!sale || sale.branchId !== branchId) continue;
      }
      totalReceivablesBN = totalReceivablesBN.plus(toBN(receivable.remainingAmount));
    }

    let totalPayablesBN = new BigNumber(0);
    for (const payable of domainStore.payables.values()) {
      if (
        payable.businessId !== businessId ||
        payable.status === 'PAID' ||
        payable.status === 'CANCELLED'
      ) {
        continue;
      }
      // A payable has no branch of its own; it inherits its parent purchase's branch.
      if (branchId !== null) {
        const purchase = domainStore.purchases.get(payable.purchaseId);
        if (!purchase || purchase.branchId !== branchId) continue;
      }
      totalPayablesBN = totalPayablesBN.plus(toBN(payable.remainingAmount));
    }

    let lowStockCount = 0;
    for (const inventory of domainStore.inventories.values()) {
      if (inventory.businessId !== businessId) continue;
      if (branchId !== null && inventory.branchId !== branchId) continue;
      if (toBN(inventory.availableQuantity).isLessThanOrEqualTo(toBN(inventory.minimumStock))) {
        lowStockCount += 1;
      }
    }

    const topProducts = Array.from(productSalesMap.entries())
      .map(([productId, stats]) => {
        const product = domainStore.products.get(productId);
        return {
          productId,
          productName: product ? product.name : 'Unknown Product',
          unitsSold: stats.qty.toFixed(0),
          totalRevenue: stats.revenue.toFixed(4),
        };
      })
      .sort((left, right) => toBN(right.totalRevenue).comparedTo(toBN(left.totalRevenue)) ?? 0)
      .slice(0, 5);

    const paymentDistributionFormatted: Record<string, string> = {};
    for (const [method, amount] of Object.entries(paymentMethodMap)) {
      paymentDistributionFormatted[method] = amount.toFixed(4);
    }

    return {
      scope: { businessId, branchId, timeZone: range.timeZone },
      range: { startDate: range.startDate, endDate: range.endDate, dayCount: range.dayCount },
      sales: salesRangeBN.toFixed(4),
      transactions: rangeTransactions,
      totalCOGS: totalCogsBN.toFixed(4),
      grossProfit: grossProfitBN.toFixed(4),
      operatingExpenses: operatingExpensesBN.toFixed(4),
      operatingProfit: operatingProfitBN.toFixed(4),
      salesToday: salesTodayBN.toFixed(4),
      salesThisWeek: salesWeekBN.toFixed(4),
      salesThisMonth: salesMonthBN.toFixed(4),
      cashOnHand: cashOnHandBN.toFixed(4),
      totalReceivables: totalReceivablesBN.toFixed(4),
      totalPayables: totalPayablesBN.toFixed(4),
      lowStockCount,
      topProducts,
      paymentDistribution: paymentDistributionFormatted,
      paymentDistributionTotal: paymentDistributionTotalBN.toFixed(4),
    };
  }

  /**
   * Daily time series over the resolved range.
   *
   * Every day in the range is emitted, including days with no activity. A zero here
   * is a real assertion ("nothing was sold on this date"), not a fabricated point,
   * which is what a calendar chart needs in order to plot without gaps.
   */
  static getTimeSeries(
    businessId: string,
    branchId: string | null,
    range: ResolvedDateRange,
  ): DashboardTimeSeries {
    interface Bucket {
      sales: BigNumber;
      revenue: BigNumber;
      cogs: BigNumber;
      grossProfit: BigNumber;
      transactions: number;
    }

    const buckets = new Map<string, Bucket>();
    for (const day of enumerateDays(range)) {
      buckets.set(day, {
        sales: new BigNumber(0),
        revenue: new BigNumber(0),
        cogs: new BigNumber(0),
        grossProfit: new BigNumber(0),
        transactions: 0,
      });
    }

    let totalSales = new BigNumber(0);
    let totalRevenue = new BigNumber(0);
    let totalCogs = new BigNumber(0);
    let totalGrossProfit = new BigNumber(0);
    let totalTransactions = 0;

    for (const sale of domainStore.sales.values()) {
      if (!saleMatchesScope(sale, businessId, branchId)) continue;
      if (!isWithinRangeIso(range, sale.createdAt)) continue;

      const day = todayInTimeZone(range.timeZone, new Date(sale.createdAt));
      const bucket = buckets.get(day);
      if (!bucket) continue;

      const total = toBN(sale.totalAmount);
      const cogs = toBN(sale.cogsAmount);
      const grossProfit = toBN(sale.grossProfitAmount);

      bucket.sales = bucket.sales.plus(total);
      bucket.revenue = bucket.revenue.plus(total);
      bucket.cogs = bucket.cogs.plus(cogs);
      bucket.grossProfit = bucket.grossProfit.plus(grossProfit);
      bucket.transactions += 1;

      totalSales = totalSales.plus(total);
      totalRevenue = totalRevenue.plus(total);
      totalCogs = totalCogs.plus(cogs);
      totalGrossProfit = totalGrossProfit.plus(grossProfit);
      totalTransactions += 1;
    }

    const series: DashboardTimeSeriesPoint[] = Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, bucket]) => ({
        date,
        sales: bucket.sales.toFixed(4),
        revenue: bucket.revenue.toFixed(4),
        cogs: bucket.cogs.toFixed(4),
        grossProfit: bucket.grossProfit.toFixed(4),
        transactions: bucket.transactions,
      }));

    return {
      scope: { businessId, branchId, timeZone: range.timeZone },
      range: { startDate: range.startDate, endDate: range.endDate, dayCount: range.dayCount },
      granularity: 'DAY',
      series,
      totals: {
        sales: totalSales.toFixed(4),
        revenue: totalRevenue.toFixed(4),
        cogs: totalCogs.toFixed(4),
        grossProfit: totalGrossProfit.toFixed(4),
        transactions: totalTransactions,
      },
    };
  }

  /** Convenience: derive the rolling windows the dashboard header displays. */
  static rollingWindows(timeZone: string, now: Date = new Date()) {
    const today = todayInTimeZone(timeZone, now);
    return {
      today,
      weekStart: startOfWeek(today),
      monthStart: startOfMonth(today),
      daysInMonth: countCalendarDays(startOfMonth(today), today),
      tomorrow: addCalendarDays(today, 1),
    };
  }
}