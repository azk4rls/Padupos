import BigNumber from 'bignumber.js';
import { domainStore } from '../domainStore.js';
import { generatePrefixedId, toBN } from '@padupos/shared';
import type {
  AIInsight,
  InsightSeverity,
  MLDataSufficiencyResult,
} from '@padupos/types';
import {
  type DateRangeQuery,
  type ResolvedDateRange,
  resolveDateRange,
} from '../../lib/dateRange.js';
import {
  buildSalesDailyDataset,
  buildProductDemandDataset,
  buildBusinessInsightDataset,
} from './dataReadiness.js';
import {
  generateInsightExplanation,
  type LLMExplanationProvider,
} from './llmProvider.js';

export class DeterministicInsightEngine {
  /**
   * 1. SALES TREND INSIGHT
   * Deterministically analyzes daily sales velocity, trajectory (UP/DOWN/FLAT),
   * peak sales day, and top contributing product.
   */
  static async generateSalesTrendInsight(
    businessId: string,
    branchId: string | null,
    range: ResolvedDateRange,
    llmProvider?: LLMExplanationProvider,
  ): Promise<AIInsight> {
    const salesDataset = buildSalesDailyDataset(businessId, branchId, range);
    const businessDataset = buildBusinessInsightDataset(businessId, branchId, range);
    const business = domainStore.businesses.get(businessId);
    const branch = branchId ? domainStore.branches.get(branchId) : null;

    const periodStart = range.startDate;
    const periodEnd = range.endDate;
    const insightId = generatePrefixedId('ins');
    const nowIso = new Date().toISOString();

    const txCount = salesDataset.totals.transactionCount;

    // Check data sufficiency: requires at least 1 paid sale in the scope
    if (txCount === 0) {
      const sufficiency: MLDataSufficiencyResult = {
        status: 'INSUFFICIENT_DATA',
        message: 'Data belum cukup untuk membuat insight yang andal.',
        requiredObservations: 1,
        actualObservations: 0,
        reason: 'Belum ada transaksi penjualan yang tercatat pada periode analisis.',
      };

      const insight: AIInsight = {
        id: insightId,
        businessId,
        branchId,
        insightType: 'SALES_TREND',
        title: 'Data Belum Cukup',
        summary:
          'Data transaksi belum cukup untuk menganalisis tren penjualan secara andal. Mulai catat transaksi penjualan untuk mendapatkan analisis tren yang akurat.',
        severity: 'INFO',
        recommendation: 'Lakukan pencatatan transaksi secara rutin melalui POS.',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot: {
          paidSaleCount: 0,
          salesThisWeek: '0.0000',
          totalRevenue: '0.0000',
          grossProfit: '0.0000',
          totalCOGS: '0.0000',
        },
        promptTemplateVersion: '2.0.0',
        modelUsed: 'deterministic_engine_v2',
        status: 'ACTIVE',
        generatedAt: nowIso,
        sufficiency,
      };

      domainStore.aiInsights.push(insight);
      return insight;
    }

    // Deterministic trend calculations
    const obs = salesDataset.observations;
    const totalRev = toBN(salesDataset.totals.revenue);
    const totalGrossProfit = toBN(salesDataset.totals.grossProfit);
    const totalCogs = toBN(salesDataset.totals.cogs);
    const totalUnits = toBN(salesDataset.totals.unitsSold);

    // Split observations into prior half vs recent half to determine trajectory
    let growthPercent = new BigNumber(0);
    let trendDirection: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';

    if (obs.length >= 2) {
      const mid = Math.floor(obs.length / 2);
      const priorObs = obs.slice(0, mid);
      const recentObs = obs.slice(mid);

      let priorRevBN = new BigNumber(0);
      for (const o of priorObs) {
        priorRevBN = priorRevBN.plus(toBN(o.revenue));
      }

      let recentRevBN = new BigNumber(0);
      for (const o of recentObs) {
        recentRevBN = recentRevBN.plus(toBN(o.revenue));
      }

      if (priorRevBN.isGreaterThan(0)) {
        growthPercent = recentRevBN.minus(priorRevBN).dividedBy(priorRevBN).multipliedBy(100);
      } else if (recentRevBN.isGreaterThan(0)) {
        growthPercent = new BigNumber(100);
      }

      if (growthPercent.isGreaterThan(5)) {
        trendDirection = 'UP';
      } else if (growthPercent.isLessThan(-5)) {
        trendDirection = 'DOWN';
      } else {
        trendDirection = 'FLAT';
      }
    }

    // Identify peak sales day
    let peakDay = obs[0]?.date || periodStart;
    let peakDayRevenue = toBN(obs[0]?.revenue || 0);
    for (const o of obs) {
      const rev = toBN(o.revenue);
      if (rev.isGreaterThan(peakDayRevenue)) {
        peakDayRevenue = rev;
        peakDay = o.date;
      }
    }

    // Top product
    const topProd = businessDataset.topProducts[0];
    const topProdName = topProd ? topProd.productName : 'N/A';
    const topProdRevenue = topProd ? topProd.revenue : '0.0000';

    // Deterministic Title, Severity, and Summary
    let title = 'Tren Penjualan Stabil';
    let severity: InsightSeverity = 'INFO';

    if (trendDirection === 'UP') {
      title = `Tren Penjualan Meningkat (+${growthPercent.toFixed(1)}%)`;
      severity = 'POSITIVE';
    } else if (trendDirection === 'DOWN') {
      if (growthPercent.isLessThan(-15)) {
        title = `Peringatan: Penurunan Penjualan (${growthPercent.toFixed(1)}%)`;
        severity = 'WARNING';
      } else {
        title = `Tren Penjualan Melambat (${growthPercent.toFixed(1)}%)`;
        severity = 'INFO';
      }
    }

    const deterministicSummary = `Total penjualan tercatat sebesar ${totalRev.toFixed(4)} dari ${txCount} transaksi dengan laba kotor ${totalGrossProfit.toFixed(4)}. Produk teratas adalah ${topProdName} dengan kontribusi ${topProdRevenue}. Hari dengan penjualan tertinggi tercatat pada ${peakDay} (${peakDayRevenue.toFixed(4)}).`;

    const metricsSnapshot: Record<string, unknown> = {
      paidSaleCount: txCount,
      salesThisWeek: totalRev.toFixed(4), // Backwards compatibility for dashboard/integration assertions
      totalRevenue: totalRev.toFixed(4),
      grossProfit: totalGrossProfit.toFixed(4),
      totalCOGS: totalCogs.toFixed(4),
      transactionCount: txCount,
      unitsSold: totalUnits.toFixed(4),
      growthPercent: growthPercent.toFixed(2),
      trendDirection,
      peakDate: peakDay,
      peakRevenue: peakDayRevenue.toFixed(4),
      topProductName: topProdName,
      topProductRevenue: topProdRevenue,
    };

    // LLM Explanation boundary
    const explanation = await generateInsightExplanation(
      {
        insightType: 'SALES_TREND',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot,
        deterministicTitle: title,
        deterministicSummary,
        businessName: business?.name,
        branchName: branch?.name,
      },
      llmProvider,
    );

    const insight: AIInsight = {
      id: insightId,
      businessId,
      branchId,
      insightType: 'SALES_TREND',
      title: explanation.title || title,
      summary: explanation.summary || deterministicSummary,
      severity,
      recommendation: explanation.recommendation,
      dataPeriod: { start: periodStart, end: periodEnd },
      metricsSnapshot,
      promptTemplateVersion: '2.0.0',
      modelUsed: explanation.modelUsed || 'deterministic_engine_v2',
      status: 'ACTIVE',
      generatedAt: nowIso,
      sufficiency: salesDataset.sufficiency,
    };

    domainStore.aiInsights.push(insight);
    return insight;
  }

  /**
   * 2. INVENTORY RISK INSIGHT
   * Deterministically evaluates out-of-stock items, low stock warnings,
   * and days-of-cover depletion risks based on real inventory balances.
   */
  static async generateInventoryRiskInsight(
    businessId: string,
    branchId: string | null,
    range: ResolvedDateRange,
    llmProvider?: LLMExplanationProvider,
  ): Promise<AIInsight> {
    const demandDataset = buildProductDemandDataset(businessId, branchId, range);
    const businessDataset = buildBusinessInsightDataset(businessId, branchId, range);
    const business = domainStore.businesses.get(businessId);
    const branch = branchId ? domainStore.branches.get(branchId) : null;

    const periodStart = range.startDate;
    const periodEnd = range.endDate;
    const insightId = generatePrefixedId('ins');
    const nowIso = new Date().toISOString();

    const invHealth = businessDataset.inventoryHealth;

    if (invHealth.totalProducts === 0) {
      const sufficiency: MLDataSufficiencyResult = {
        status: 'INSUFFICIENT_DATA',
        message: 'Data belum cukup untuk membuat insight yang andal.',
        reason: 'No products registered in business catalog.',
      };

      const insight: AIInsight = {
        id: insightId,
        businessId,
        branchId,
        insightType: 'INVENTORY_RISK',
        title: 'Data Belum Cukup',
        summary: 'Belum ada produk yang terdaftar dalam katalog untuk dievaluasi stoknya.',
        severity: 'INFO',
        recommendation: 'Tambahkan produk dan lakukan pencatatan stok awal.',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot: {
          totalProducts: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalStockValue: '0.0000',
        },
        promptTemplateVersion: '2.0.0',
        modelUsed: 'deterministic_engine_v2',
        status: 'ACTIVE',
        generatedAt: nowIso,
        sufficiency,
      };

      domainStore.aiInsights.push(insight);
      return insight;
    }

    // Classify stock risks from real product demand features
    const outOfStockItems: Array<{ id: string; name: string }> = [];
    const lowStockItems: Array<{ id: string; name: string; currentStock: string; daysOfCover: string }> = [];

    for (const prod of demandDataset.products) {
      const stockBN = toBN(prod.currentStock);
      if (stockBN.isLessThanOrEqualTo(0)) {
        outOfStockItems.push({ id: prod.productId, name: prod.productName });
      } else if (
        prod.daysOfCover !== 'INFINITE' &&
        Number(prod.daysOfCover) <= 7 &&
        Number(prod.avgDailyDemand) > 0
      ) {
        lowStockItems.push({
          id: prod.productId,
          name: prod.productName,
          currentStock: prod.currentStock,
          daysOfCover: prod.daysOfCover,
        });
      }
    }

    // Also include count from static inventory health if larger
    const effectiveOutOfStockCount = Math.max(invHealth.outOfStockCount, outOfStockItems.length);
    const effectiveLowStockCount = Math.max(invHealth.lowStockCount, lowStockItems.length);

    let title = 'Kondisi Stok Inventaris Sehat';
    let severity: InsightSeverity = 'POSITIVE';
    let deterministicSummary = '';

    if (effectiveOutOfStockCount > 0) {
      severity = 'CRITICAL';
      title = `Peringatan: ${effectiveOutOfStockCount} Produk Habis (Out of Stock)`;
      const sampleNames = outOfStockItems.map((i) => i.name).slice(0, 3).join(', ') || 'beberapa item';
      deterministicSummary = `Terdapat ${effectiveOutOfStockCount} produk dengan stok habis (${sampleNames}) dan total valuasi persediaan saat ini ${invHealth.totalStockValue}. Segera lakukan pemesanan ulang untuk mencegah potensi kehilangan omzet.`;
    } else if (effectiveLowStockCount > 0) {
      severity = 'WARNING';
      title = `Peringatan: ${effectiveLowStockCount} Produk Mendekati Batas Kritis`;
      const sampleNames = lowStockItems.map((i) => i.name).slice(0, 3).join(', ') || 'beberapa item';
      deterministicSummary = `Terdapat ${effectiveLowStockCount} produk yang mendekati batas minimum stok atau memiliki estimasi ketahanan di bawah 7 hari (${sampleNames}). Disarankan meninjau pesanan pembelian stok.`;
    } else {
      severity = 'POSITIVE';
      title = 'Kondisi Stok Inventaris Aman';
      deterministicSummary = `Seluruh produk (${invHealth.totalProducts} produk) memiliki ketersediaan stok yang memadai di atas ambang batas aman dengan total valuasi persediaan ${invHealth.totalStockValue}.`;
    }

    const metricsSnapshot: Record<string, unknown> = {
      totalProducts: invHealth.totalProducts,
      lowStockCount: effectiveLowStockCount,
      outOfStockCount: effectiveOutOfStockCount,
      totalStockValue: invHealth.totalStockValue,
      outOfStockItems: outOfStockItems.slice(0, 10),
      lowStockItems: lowStockItems.slice(0, 10),
    };

    const explanation = await generateInsightExplanation(
      {
        insightType: 'INVENTORY_RISK',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot,
        deterministicTitle: title,
        deterministicSummary,
        businessName: business?.name,
        branchName: branch?.name,
      },
      llmProvider,
    );

    const insight: AIInsight = {
      id: insightId,
      businessId,
      branchId,
      insightType: 'INVENTORY_RISK',
      title: explanation.title || title,
      summary: explanation.summary || deterministicSummary,
      severity,
      recommendation: explanation.recommendation,
      dataPeriod: { start: periodStart, end: periodEnd },
      metricsSnapshot,
      promptTemplateVersion: '2.0.0',
      modelUsed: explanation.modelUsed || 'deterministic_engine_v2',
      status: 'ACTIVE',
      generatedAt: nowIso,
      sufficiency: demandDataset.sufficiency,
    };

    domainStore.aiInsights.push(insight);
    return insight;
  }

  /**
   * 3. EXPENSE SPIKE INSIGHT
   * Deterministically analyzes operating expenses by category,
   * expense-to-revenue ratios, and sudden expense spikes.
   */
  static async generateExpenseSpikeInsight(
    businessId: string,
    branchId: string | null,
    range: ResolvedDateRange,
    llmProvider?: LLMExplanationProvider,
  ): Promise<AIInsight> {
    const businessDataset = buildBusinessInsightDataset(businessId, branchId, range);
    const salesDataset = buildSalesDailyDataset(businessId, branchId, range);
    const business = domainStore.businesses.get(businessId);
    const branch = branchId ? domainStore.branches.get(branchId) : null;

    const periodStart = range.startDate;
    const periodEnd = range.endDate;
    const insightId = generatePrefixedId('ins');
    const nowIso = new Date().toISOString();

    const expensesByCategory = businessDataset.expensesByCategory;
    const totalRevBN = toBN(salesDataset.totals.revenue);

    let totalExpenseBN = new BigNumber(0);
    for (const exp of expensesByCategory) {
      totalExpenseBN = totalExpenseBN.plus(toBN(exp.amount));
    }

    if (expensesByCategory.length === 0 && totalExpenseBN.isZero()) {
      const insight: AIInsight = {
        id: insightId,
        businessId,
        branchId,
        insightType: 'EXPENSE_SPIKE',
        title: 'Beban Operasional Belum Ada',
        summary: 'Tidak tercatat beban operasional pada rentang waktu analisis yang dipilih.',
        severity: 'INFO',
        recommendation: 'Catat pengeluaran operasional secara teratur untuk memonitor margin laba bersih.',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot: {
          operatingExpenses: '0.0000',
          totalExpenses: '0.0000',
          totalRevenue: totalRevBN.toFixed(4),
          expenseRatio: '0.00',
          categoriesCount: 0,
        },
        promptTemplateVersion: '2.0.0',
        modelUsed: 'deterministic_engine_v2',
        status: 'ACTIVE',
        generatedAt: nowIso,
        sufficiency: {
          status: 'SUFFICIENT',
          message: 'Data beban operasional valid.',
        },
      };

      domainStore.aiInsights.push(insight);
      return insight;
    }

    // Identify top expense category
    let topExpenseCategory = expensesByCategory[0] || { categoryId: '', categoryName: 'Lainnya', amount: '0.0000' };
    for (const cat of expensesByCategory) {
      if (toBN(cat.amount).isGreaterThan(toBN(topExpenseCategory.amount))) {
        topExpenseCategory = cat;
      }
    }

    const topCategoryBN = toBN(topExpenseCategory.amount);
    const topCategoryPercent = totalExpenseBN.isGreaterThan(0)
      ? topCategoryBN.dividedBy(totalExpenseBN).multipliedBy(100)
      : new BigNumber(0);

    let expenseRatioBN = new BigNumber(0);
    if (totalRevBN.isGreaterThan(0)) {
      expenseRatioBN = totalExpenseBN.dividedBy(totalRevBN).multipliedBy(100);
    }

    // Determine severity & title
    let title = 'Beban Operasional Terkendali';
    let severity: InsightSeverity = 'INFO';

    if (expenseRatioBN.isGreaterThan(60)) {
      title = `Peringatan: Rasio Beban Operasional Tinggi (${expenseRatioBN.toFixed(1)}%)`;
      severity = 'WARNING';
    } else if (topCategoryPercent.isGreaterThan(60) && expensesByCategory.length > 1) {
      title = `Konsentrasi Beban Operasional pada ${topExpenseCategory.categoryName}`;
      severity = 'WARNING';
    }

    const deterministicSummary = `Total pengeluaran operasional tercatat ${totalExpenseBN.toFixed(4)} terbagi dalam ${expensesByCategory.length} pos beban. Kategori terbesar adalah ${topExpenseCategory.categoryName} sebesar ${topCategoryBN.toFixed(4)} (${topCategoryPercent.toFixed(1)}% dari total beban). Rasio beban terhadap pendapatan tercatat ${expenseRatioBN.toFixed(1)}%.`;

    const metricsSnapshot: Record<string, unknown> = {
      operatingExpenses: totalExpenseBN.toFixed(4),
      totalExpenses: totalExpenseBN.toFixed(4),
      totalRevenue: totalRevBN.toFixed(4),
      expenseRatio: expenseRatioBN.toFixed(2),
      topExpenseCategoryName: topExpenseCategory.categoryName,
      topExpenseAmount: topCategoryBN.toFixed(4),
      topExpenseSharePercentage: topCategoryPercent.toFixed(2),
      expensesByCategory,
    };

    const explanation = await generateInsightExplanation(
      {
        insightType: 'EXPENSE_SPIKE',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot,
        deterministicTitle: title,
        deterministicSummary,
        businessName: business?.name,
        branchName: branch?.name,
      },
      llmProvider,
    );

    const insight: AIInsight = {
      id: insightId,
      businessId,
      branchId,
      insightType: 'EXPENSE_SPIKE',
      title: explanation.title || title,
      summary: explanation.summary || deterministicSummary,
      severity,
      recommendation: explanation.recommendation,
      dataPeriod: { start: periodStart, end: periodEnd },
      metricsSnapshot,
      promptTemplateVersion: '2.0.0',
      modelUsed: explanation.modelUsed || 'deterministic_engine_v2',
      status: 'ACTIVE',
      generatedAt: nowIso,
      sufficiency: {
        status: 'SUFFICIENT',
        message: 'Data beban operasional valid.',
      },
    };

    domainStore.aiInsights.push(insight);
    return insight;
  }

  /**
   * 4. BUSINESS SUMMARY INSIGHT
   * Grounded holistic overview: Revenue, COGS, Gross Profit, Operating Expenses,
   * Operating Profit, Inventory Health, and Receivables/Payables Aging.
   */
  static async generateBusinessSummaryInsight(
    businessId: string,
    branchId: string | null,
    range: ResolvedDateRange,
    llmProvider?: LLMExplanationProvider,
  ): Promise<AIInsight> {
    const businessDataset = buildBusinessInsightDataset(businessId, branchId, range);
    const salesDataset = buildSalesDailyDataset(businessId, branchId, range);
    const business = domainStore.businesses.get(businessId);
    const branch = branchId ? domainStore.branches.get(branchId) : null;

    const periodStart = range.startDate;
    const periodEnd = range.endDate;
    const insightId = generatePrefixedId('ins');
    const nowIso = new Date().toISOString();

    if (businessDataset.sufficiency.status !== 'SUFFICIENT') {
      const sufficiency: MLDataSufficiencyResult = {
        status: 'INSUFFICIENT_DATA',
        message: 'Data belum cukup untuk membuat insight yang andal.',
        requiredObservations: businessDataset.sufficiency.requiredObservations,
        actualObservations: businessDataset.sufficiency.actualObservations,
        reason: businessDataset.sufficiency.reason,
      };

      const insight: AIInsight = {
        id: insightId,
        businessId,
        branchId,
        insightType: 'BUSINESS_SUMMARY',
        title: 'Data Belum Cukup',
        summary:
          'Belum cukup data transaksi dan keuangan untuk menghasilkan ringkasan bisnis yang komprehensif. Mulai catat transaksi untuk melihat ringkasan performa.',
        severity: 'INFO',
        recommendation: 'Gunakan sistem kasir dan pembukuan secara aktif untuk membangun rekam jejak keuangan bisnis.',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot: {
          paidSaleCount: 0,
          salesThisWeek: '0.0000',
          totalRevenue: '0.0000',
          grossProfit: '0.0000',
          operatingExpenses: '0.0000',
          operatingProfit: '0.0000',
        },
        promptTemplateVersion: '2.0.0',
        modelUsed: 'deterministic_engine_v2',
        status: 'ACTIVE',
        generatedAt: nowIso,
        sufficiency,
      };

      domainStore.aiInsights.push(insight);
      return insight;
    }

    const totalRev = toBN(salesDataset.totals.revenue);
    const totalGrossProfit = toBN(salesDataset.totals.grossProfit);
    const totalCogs = toBN(salesDataset.totals.cogs);
    const txCount = salesDataset.totals.transactionCount;

    let totalExpensesBN = new BigNumber(0);
    for (const exp of businessDataset.expensesByCategory) {
      totalExpensesBN = totalExpensesBN.plus(toBN(exp.amount));
    }

    const operatingProfitBN = totalGrossProfit.minus(totalExpensesBN);
    const grossMarginPercent = totalRev.isGreaterThan(0)
      ? totalGrossProfit.dividedBy(totalRev).multipliedBy(100)
      : new BigNumber(0);

    const avgBasketSize = txCount > 0
      ? totalRev.dividedBy(txCount)
      : new BigNumber(0);

    let title = 'Ringkasan Kinerja Bisnis';
    let severity: InsightSeverity = 'INFO';

    if (operatingProfitBN.isGreaterThan(0) && grossMarginPercent.isGreaterThanOrEqualTo(20)) {
      title = 'Kinerja Bisnis Sehat & Menguntungkan';
      severity = 'POSITIVE';
    } else if (operatingProfitBN.isLessThan(0)) {
      title = 'Peringatan: Defisit Operasional Terdeteksi';
      severity = 'WARNING';
    }

    const topProd = businessDataset.topProducts[0];
    const topProdName = topProd ? topProd.productName : 'N/A';

    const deterministicSummary = `Bisnis mencatatkan total pendapatan ${totalRev.toFixed(4)} dari ${txCount} transaksi dengan rata-rata nilai transaksi ${avgBasketSize.toFixed(4)}. Laba kotor tercatat ${totalGrossProfit.toFixed(4)} (margin ${grossMarginPercent.toFixed(1)}%). Setelah dikurangi beban operasional sebesar ${totalExpensesBN.toFixed(4)}, laba operasional berada pada angka ${operatingProfitBN.toFixed(4)}. Produk unggulan adalah ${topProdName}.`;

    const metricsSnapshot: Record<string, unknown> = {
      paidSaleCount: txCount,
      salesThisWeek: totalRev.toFixed(4),
      totalRevenue: totalRev.toFixed(4),
      grossProfit: totalGrossProfit.toFixed(4),
      totalCOGS: totalCogs.toFixed(4),
      operatingExpenses: totalExpensesBN.toFixed(4),
      operatingProfit: operatingProfitBN.toFixed(4),
      grossMarginPercentage: grossMarginPercent.toFixed(2),
      transactionCount: txCount,
      averageBasketSize: avgBasketSize.toFixed(4),
      topProductName: topProdName,
      lowStockCount: businessDataset.inventoryHealth.lowStockCount,
      outOfStockCount: businessDataset.inventoryHealth.outOfStockCount,
      totalStockValue: businessDataset.inventoryHealth.totalStockValue,
    };

    const explanation = await generateInsightExplanation(
      {
        insightType: 'BUSINESS_SUMMARY',
        dataPeriod: { start: periodStart, end: periodEnd },
        metricsSnapshot,
        deterministicTitle: title,
        deterministicSummary,
        businessName: business?.name,
        branchName: branch?.name,
      },
      llmProvider,
    );

    const insight: AIInsight = {
      id: insightId,
      businessId,
      branchId,
      insightType: 'BUSINESS_SUMMARY',
      title: explanation.title || title,
      summary: explanation.summary || deterministicSummary,
      severity,
      recommendation: explanation.recommendation,
      dataPeriod: { start: periodStart, end: periodEnd },
      metricsSnapshot,
      promptTemplateVersion: '2.0.0',
      modelUsed: explanation.modelUsed || 'deterministic_engine_v2',
      status: 'ACTIVE',
      generatedAt: nowIso,
      sufficiency: businessDataset.sufficiency,
    };

    domainStore.aiInsights.push(insight);
    return insight;
  }

  /**
   * Unified entry point for on-demand insight generation
   */
  static async generateInsight(
    businessId: string,
    branchId: string | null,
    insightType: AIInsight['insightType'],
    query?: DateRangeQuery,
    llmProvider?: LLMExplanationProvider,
  ): Promise<AIInsight> {
    const range = resolveDateRange(query || {}, businessId, branchId);

    switch (insightType) {
      case 'SALES_TREND':
        return this.generateSalesTrendInsight(businessId, branchId, range, llmProvider);
      case 'INVENTORY_RISK':
        return this.generateInventoryRiskInsight(businessId, branchId, range, llmProvider);
      case 'EXPENSE_SPIKE':
        return this.generateExpenseSpikeInsight(businessId, branchId, range, llmProvider);
      case 'BUSINESS_SUMMARY':
        return this.generateBusinessSummaryInsight(businessId, branchId, range, llmProvider);
      default:
        return this.generateBusinessSummaryInsight(businessId, branchId, range, llmProvider);
    }
  }

  /**
   * Returns all active insights for a business/branch.
   * If none exist in cache, generates all 4 categories on-the-fly.
   */
  static async getInsights(
    businessId: string,
    branchId: string | null,
    query?: DateRangeQuery & { insightType?: AIInsight['insightType'] },
  ): Promise<{ insights: AIInsight[]; sufficiency?: MLDataSufficiencyResult }> {
    const range = resolveDateRange(query || {}, businessId, branchId);

    // If a specific insightType is requested, generate/return that type
    if (query?.insightType) {
      const insight = await this.generateInsight(businessId, branchId, query.insightType, query);
      return { insights: [insight], sufficiency: insight.sufficiency };
    }

    // Return or generate all 4 core grounded categories
    const salesTrend = await this.generateSalesTrendInsight(businessId, branchId, range);
    const inventoryRisk = await this.generateInventoryRiskInsight(businessId, branchId, range);
    const expenseSpike = await this.generateExpenseSpikeInsight(businessId, branchId, range);
    const businessSummary = await this.generateBusinessSummaryInsight(businessId, branchId, range);

    const insights = [businessSummary, salesTrend, inventoryRisk, expenseSpike];

    return {
      insights,
      sufficiency: businessSummary.sufficiency,
    };
  }
}
