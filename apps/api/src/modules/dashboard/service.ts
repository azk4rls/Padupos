import { domainStore } from '../domainStore.js';
import { toBN } from '@padupos/shared';
import BigNumber from 'bignumber.js';

export interface DashboardMetrics {
  salesToday: string;
  salesThisWeek: string;
  salesThisMonth: string;
  totalCOGS: string;
  grossProfit: string;
  operatingExpenses: string;
  operatingProfit: string;
  cashOnHand: string;
  totalReceivables: string;
  totalPayables: string;
  lowStockCount: number;
  topProducts: Array<{ productId: string; productName: string; unitsSold: string; totalRevenue: string }>;
  paymentDistribution: Record<string, string>;
}

export class DashboardMetricsService {
  static getMetrics(businessId: string): DashboardMetrics {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Compute start of week (Monday)
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    weekStart.setHours(0, 0, 0, 0);

    // Compute start of month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let salesTodayBN = new BigNumber(0);
    let salesWeekBN = new BigNumber(0);
    let salesMonthBN = new BigNumber(0);
    let totalCogsBN = new BigNumber(0);
    let grossProfitBN = new BigNumber(0);

    const productSalesMap = new Map<string, { qty: BigNumber; revenue: BigNumber }>();
    const paymentMethodMap: Record<string, BigNumber> = {};

    for (const s of domainStore.sales.values()) {
      if (s.businessId === businessId && s.status === 'PAID') {
        const saleDate = new Date(s.createdAt);
        const saleAmount = toBN(s.totalAmount);
        const saleCogs = toBN(s.cogsAmount);

        // Date breakdowns
        if (s.createdAt.startsWith(todayStr)) {
          salesTodayBN = salesTodayBN.plus(saleAmount);
        }
        if (saleDate >= weekStart) {
          salesWeekBN = salesWeekBN.plus(saleAmount);
        }
        if (saleDate >= monthStart) {
          salesMonthBN = salesMonthBN.plus(saleAmount);
        }

        totalCogsBN = totalCogsBN.plus(saleCogs);
        grossProfitBN = grossProfitBN.plus(toBN(s.grossProfitAmount));

        // Track items for top products
        const items = domainStore.saleItems.get(s.id) || [];
        for (const it of items) {
          const prev = productSalesMap.get(it.productId) || { qty: new BigNumber(0), revenue: new BigNumber(0) };
          productSalesMap.set(it.productId, {
            qty: prev.qty.plus(toBN(it.quantity)),
            revenue: prev.revenue.plus(toBN(it.total)),
          });
        }
      }
    }

    // Payment distribution
    for (const p of domainStore.payments.values()) {
      if (p.businessId === businessId && p.status === 'PAID') {
        const m = p.method;
        paymentMethodMap[m] = (paymentMethodMap[m] || new BigNumber(0)).plus(toBN(p.amount));
      }
    }

    // Operating expenses
    let operatingExpensesBN = new BigNumber(0);
    for (const e of domainStore.expenses) {
      if (e.businessId === businessId) {
        operatingExpensesBN = operatingExpensesBN.plus(toBN(e.amount));
      }
    }

    const operatingProfitBN = grossProfitBN.minus(operatingExpensesBN);

    // Cash on Hand from journal accounts (1010)
    let cashOnHandBN = new BigNumber(0);
    const cashAccId = `acc_${businessId}_1010`;
    for (const j of domainStore.journalEntries.values()) {
      if (j.businessId === businessId && j.isPosted) {
        const lines = domainStore.journalLines.get(j.id) || [];
        for (const l of lines) {
          if (l.accountId === cashAccId) {
            cashOnHandBN = cashOnHandBN.plus(toBN(l.debit)).minus(toBN(l.credit));
          }
        }
      }
    }

    // Receivables outstanding
    let totalReceivablesBN = new BigNumber(0);
    for (const r of domainStore.receivables.values()) {
      if (r.businessId === businessId && r.status !== 'PAID' && r.status !== 'CANCELLED') {
        totalReceivablesBN = totalReceivablesBN.plus(toBN(r.remainingAmount));
      }
    }

    // Payables outstanding
    let totalPayablesBN = new BigNumber(0);
    for (const p of domainStore.payables.values()) {
      if (p.businessId === businessId && p.status !== 'PAID' && p.status !== 'CANCELLED') {
        totalPayablesBN = totalPayablesBN.plus(toBN(p.remainingAmount));
      }
    }

    // Low stock count
    let lowStockCount = 0;
    for (const inv of domainStore.inventories.values()) {
      if (inv.businessId === businessId) {
        if (toBN(inv.availableQuantity).isLessThanOrEqualTo(toBN(inv.minimumStock))) {
          lowStockCount++;
        }
      }
    }

    // Top products (top 5)
    const topProducts = Array.from(productSalesMap.entries())
      .map(([productId, stats]) => {
        const prod = domainStore.products.get(productId);
        return {
          productId,
          productName: prod ? prod.name : 'Unknown Product',
          unitsSold: stats.qty.toFixed(0),
          totalRevenue: stats.revenue.toFixed(4),
        };
      })
      .sort((a, b) => toBN(b.totalRevenue).comparedTo(toBN(a.totalRevenue)) ?? 0)
      .slice(0, 5);

    const paymentDistributionFormatted: Record<string, string> = {};
    for (const [k, v] of Object.entries(paymentMethodMap)) {
      paymentDistributionFormatted[k] = v.toFixed(4);
    }

    return {
      salesToday: salesTodayBN.toFixed(4),
      salesThisWeek: salesWeekBN.toFixed(4),
      salesThisMonth: salesMonthBN.toFixed(4),
      totalCOGS: totalCogsBN.toFixed(4),
      grossProfit: grossProfitBN.toFixed(4),
      operatingExpenses: operatingExpensesBN.toFixed(4),
      operatingProfit: operatingProfitBN.toFixed(4),
      cashOnHand: cashOnHandBN.toFixed(4),
      totalReceivables: totalReceivablesBN.toFixed(4),
      totalPayables: totalPayablesBN.toFixed(4),
      lowStockCount,
      topProducts,
      paymentDistribution: paymentDistributionFormatted,
    };
  }
}
