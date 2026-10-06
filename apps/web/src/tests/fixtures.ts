import type { Business, Branch } from '@padupos/types';

/**
 * Isolated fixtures for dashboard/report tests.
 * These mirror the shapes the backend returns; they are test-only data and are
 * never used by application code.
 */
export const testBusiness: Business = {
  id: 'biz_test_001',
  ownerUserId: 'usr_test_001',
  name: 'Kopi Nusantara',
  businessType: 'RETAIL',
  countryId: 'ID',
  baseCurrency: 'IDR',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta',
  fiscalYearStartMonth: 1,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const testBranch: Branch = {
  id: 'brn_test_001',
  businessId: 'biz_test_001',
  name: 'Outlet Pusat',
  code: 'OPS',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const testBranchTwo: Branch = {
  ...testBranch,
  id: 'brn_test_002',
  name: 'Outlet Timur',
  code: 'TIM',
};

/**
 * GET /dashboard/metrics payload with real field names and string money.
 *
 * `paymentDistributionTotal` is included because the backend now returns it: the UI
 * uses it for proportional bar widths instead of summing the breakdown client-side.
 */
export const metricsFixture = {
  metrics: {
    scope: { businessId: 'biz_1', branchId: null, timeZone: 'Asia/Jakarta' },
    range: { startDate: '2026-10-01', endDate: '2026-10-30', dayCount: 30 },
    sales: '3600000.0000',
    transactions: 42,
    salesToday: '150000.0000',
    salesThisWeek: '900000.0000',
    salesThisMonth: '3600000.0000',
    totalCOGS: '1200000.0000',
    grossProfit: '2400000.0000',
    operatingExpenses: '1000000.0000',
    operatingProfit: '1400000.0000',
    cashOnHand: '2500000.0000',
    totalReceivables: '350000.0000',
    totalPayables: '720000.0000',
    lowStockCount: 3,
    topProducts: [
      { productId: 'prd_1', productName: 'Kopi Susu Aren', unitsSold: '120', totalRevenue: '1800000.0000' },
      { productId: 'prd_2', productName: 'Kopi Susu Gula Aren', unitsSold: '60', totalRevenue: '900000.0000' },
      { productId: 'prd_3', productName: 'Es Teh Manis', unitsSold: '40', totalRevenue: '200000.0000' },
    ],
    paymentDistribution: {
      CASH: '2000000.0000',
      QRIS: '1000000.0000',
      CARD: '600000.0000',
    },
    paymentDistributionTotal: '3600000.0000',
  },
};

/** GET /dashboard/metrics/series — real calendar days, including zero days. */
export const seriesFixture = {
  series: {
    scope: { businessId: 'biz_1', branchId: null, timeZone: 'Asia/Jakarta' },
    range: { startDate: '2026-10-01', endDate: '2026-10-03', dayCount: 3 },
    granularity: 'DAY',
    series: [
      { date: '2026-10-01', sales: '120000.0000', revenue: '120000.0000', cogs: '40000.0000', grossProfit: '80000.0000', transactions: 5 },
      { date: '2026-10-02', sales: '0.0000', revenue: '0.0000', cogs: '0.0000', grossProfit: '0.0000', transactions: 0 },
      { date: '2026-10-03', sales: '300000.0000', revenue: '300000.0000', cogs: '100000.0000', grossProfit: '200000.0000', transactions: 12 },
    ],
    totals: {
      sales: '420000.0000',
      revenue: '420000.0000',
      cogs: '140000.0000',
      grossProfit: '280000.0000',
      transactions: 17,
    },
  },
};

export const emptyMetricsFixture = {
  metrics: {
    scope: { businessId: 'biz_1', branchId: null, timeZone: 'Asia/Jakarta' },
    range: { startDate: '2026-10-30', endDate: '2026-10-30', dayCount: 1 },
    sales: '0.0000',
    transactions: 0,
    salesToday: '0.0000',
    salesThisWeek: '0.0000',
    salesThisMonth: '0.0000',
    totalCOGS: '0.0000',
    grossProfit: '0.0000',
    operatingExpenses: '0.0000',
    operatingProfit: '0.0000',
    cashOnHand: '0.0000',
    totalReceivables: '0.0000',
    totalPayables: '0.0000',
    lowStockCount: 0,
    topProducts: [],
    paymentDistribution: {},
    paymentDistributionTotal: '0.0000',
  },
};

export const salesReportFixture = {
  summary: {
    totalRevenue: '3600000.0000',
    totalCogs: '1200000.0000',
    grossProfit: '2400000.0000',
    grossMarginPercentage: '66.67',
    totalDiscount: '50000.0000',
    totalTax: '180000.0000',
    transactionCount: 42,
  },
  sales: [
    {
      id: 'sal_1',
      invoiceNumber: 'INV-0001',
      status: 'PAID',
      subtotal: '900000.0000',
      discountAmount: '25000.0000',
      taxAmount: '45000.0000',
      totalAmount: '920000.0000',
      cogsAmount: '300000.0000',
      grossProfitAmount: '620000.0000',
      currency: 'IDR',
      createdAt: '2026-03-04T08:15:00.000Z',
    },
    {
      id: 'sal_2',
      invoiceNumber: 'INV-0002',
      status: 'PAID',
      subtotal: '450000.0000',
      discountAmount: '25000.0000',
      taxAmount: '22500.0000',
      totalAmount: '447500.0000',
      cogsAmount: '150000.0000',
      grossProfitAmount: '300000.0000',
      currency: 'IDR',
      createdAt: '2026-03-04T09:02:00.000Z',
    },
  ],
};

export const emptySalesReportFixture = {
  summary: {
    totalRevenue: '0.0000',
    totalCogs: '0.0000',
    grossProfit: '0.0000',
    grossMarginPercentage: '0.00',
    totalDiscount: '0.0000',
    totalTax: '0.0000',
    transactionCount: 0,
  },
  sales: [],
};

export const productsFixture = {
  products: [
    { id: 'prd_1', name: 'Kopi Susu Aren', sku: 'KSA-001', barcode: '8991234567890', sellingPrice: '18000.0000', costPrice: '7000.0000', isActive: true },
    { id: 'prd_2', name: 'Es Teh Manis', sku: 'ETM-002', barcode: '8991234567891', sellingPrice: '8000.0000', costPrice: '3000.0000', isActive: true },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

export const inventoryFixture = {
  inventory: [
    { id: 'inv_1', productId: 'prd_1', branchId: 'brn_test_001', quantity: '20.0000', availableQuantity: '20.0000', minimumStock: '10.0000', updatedAt: '2026-03-04T08:00:00.000Z' },
    { id: 'inv_2', productId: 'prd_2', branchId: 'brn_test_001', quantity: '4.0000', availableQuantity: '4.0000', minimumStock: '10.0000', updatedAt: '2026-03-04T08:00:00.000Z' },
  ],
};

export const inventoryMovementsFixture = {
  movements: [
    { id: 'mov_1', productId: 'prd_1', branchId: 'brn_test_001', type: 'SALE', quantity: '-2.0000', referenceType: 'SALE', referenceId: 'sal_1', createdAt: '2026-03-04T08:15:00.000Z' },
  ],
};

export const profitLossFixture = {
  revenue: '3600000.0000',
  cogs: '1200000.0000',
  grossProfit: '2400000.0000',
  operatingExpenses: '1000000.0000',
  operatingProfit: '1400000.0000',
};

export const expensesFixture = {
  expenses: [
    { id: 'exp_1', categoryId: 'cat_1', amount: '250000.0000', currency: 'IDR', paymentMethod: 'CASH', description: 'Sewa kios Maret', incurredAt: '2026-03-01T00:00:00.000Z', createdAt: '2026-03-01T01:00:00.000Z' },
    { id: 'exp_2', categoryId: 'cat_2', amount: '120000.0000', currency: 'IDR', paymentMethod: 'BANK_TRANSFER', description: 'Listrik', incurredAt: '2026-03-02T00:00:00.000Z', createdAt: '2026-03-02T01:00:00.000Z' },
  ],
};

export const expenseCategoriesFixture = {
  categories: [
    { id: 'cat_1', name: 'Sewa' },
    { id: 'cat_2', name: 'Utilitas' },
  ],
};

export const receivablesFixture = {
  receivables: [
    { id: 'rec_1', customerId: 'cus_1', saleId: 'sal_1', originalAmount: '500000.0000', paidAmount: '200000.0000', remainingAmount: '300000.0000', dueDate: '2026-03-10T00:00:00.000Z', status: 'PARTIAL' },
    { id: 'rec_2', customerId: 'cus_2', saleId: 'sal_9', originalAmount: '400000.0000', paidAmount: '0.0000', remainingAmount: '400000.0000', dueDate: '2026-02-01T00:00:00.000Z', status: 'OVERDUE' },
  ],
};

export const payablesFixture = {
  payables: [
    { id: 'pay_1', supplierId: 'sup_1', purchaseId: 'pur_1', originalAmount: '800000.0000', paidAmount: '300000.0000', remainingAmount: '500000.0000', dueDate: '2026-03-15T00:00:00.000Z', status: 'PARTIAL' },
  ],
};