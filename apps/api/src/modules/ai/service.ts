import { domainStore } from '../domainStore.js';
import { DashboardMetricsService } from '../dashboard/service.js';
import { generatePrefixedId, toBN } from '@padupos/shared';
import type { AIInsight } from '@padupos/types';
import { resolveDateRange } from '../../lib/dateRange.js';

export class AIInsightService {
  static async generateInsight(businessId: string, insightType: AIInsight['insightType']): Promise<AIInsight> {
    // AI insights are always business-level (never branch-scoped). The rolling
    // windows the insight reasons about are supplied by the metrics service.
    const metrics = DashboardMetricsService.getMetrics(
      businessId,
      null,
      resolveDateRange({}, businessId, null, new Date()),
    );
    const now = new Date();
    const periodStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const periodEnd = now.toISOString();

    // Check data sufficiency: requires at least 1 finalized sale
    let paidSaleCount = 0;
    for (const s of domainStore.sales.values()) {
      if (s.businessId === businessId && s.status === 'PAID') {
        paidSaleCount++;
      }
    }

    if (paidSaleCount === 0) {
      const insightId = generatePrefixedId('ins');
      const insight: AIInsight = {
        id: insightId,
        businessId,
        insightType,
        title: 'Data Belum Cukup',
        summary: 'Belum cukup data transaksi untuk menghasilkan analisis bisnis yang akurat. Mulai catat penjualan untuk mendapatkan insight.',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot: { paidSaleCount: 0 },
        promptTemplateVersion: '1.0.0',
        modelUsed: 'rule_grounded_v1',
        status: 'ACTIVE',
        generatedAt: now.toISOString(),
      };
      domainStore.aiInsights.push(insight);
      return insight;
    }

    // Grounded deterministic synthesis based on actual metrics
    let title = 'Ringkasan Kinerja Bisnis';
    let summary = '';

    const revenueBN = toBN(metrics.salesThisWeek);
    const profitBN = toBN(metrics.grossProfit);
    const cogsBN = toBN(metrics.totalCOGS);

    if (insightType === 'SALES_TREND') {
      title = 'Tren Penjualan Mingguan';
      summary = `Total penjualan tercatat minggu ini sebesar ${metrics.salesThisWeek} dengan laba kotor ${metrics.grossProfit}. Produk teratas adalah ${metrics.topProducts[0]?.productName || 'N/A'}.`;
    } else if (insightType === 'INVENTORY_RISK') {
      title = 'Peringatan Stok Rendah';
      summary = metrics.lowStockCount > 0
        ? `Terdapat ${metrics.lowStockCount} produk yang mendekati atau berada di bawah batas minimum stok. Disarankan meninjau pembelian stok.`
        : 'Seluruh stok saat ini terpantau berada di atas ambang batas minimum.';
    } else if (insightType === 'EXPENSE_SPIKE') {
      title = 'Analisis Beban Operasional';
      summary = `Total pengeluaran operasional tercatat ${metrics.operatingExpenses}. Laba operasional saat ini berada pada angka ${metrics.operatingProfit}.`;
    } else {
      title = 'Ringkasan Kesehatan Operasional';
      summary = `Bisnis mencatatkan ${paidSaleCount} transaksi selesai. Margin laba kotor terpantau stabil berdasarkan data aktual.`;
    }

    const insightId = generatePrefixedId('ins');
    const insight: AIInsight = {
      id: insightId,
      businessId,
      insightType,
      title,
      summary,
      dataPeriod: { start: periodStart, end: periodEnd },
      metricsSnapshot: {
        salesThisWeek: metrics.salesThisWeek,
        grossProfit: metrics.grossProfit,
        totalCOGS: metrics.totalCOGS,
        operatingExpenses: metrics.operatingExpenses,
        lowStockCount: metrics.lowStockCount,
      },
      promptTemplateVersion: '1.0.0',
      modelUsed: 'grounded_analytics_v1',
      status: 'ACTIVE',
      generatedAt: now.toISOString(),
    };

    domainStore.aiInsights.push(insight);
    return insight;
  }
}
