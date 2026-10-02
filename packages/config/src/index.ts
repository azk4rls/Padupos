import type { Country, Entitlement, PlanTier, RoleName } from '@padupos/types';

// ================================================================
// PADUPOS — Global Country Registry
// ================================================================

export const SUPPORTED_COUNTRIES: Record<string, Country> = {
  ID: {
    id: 'cnt_indonesia',
    countryCode: 'ID',
    iso3: 'IDN',
    name: 'Indonesia',
    defaultCurrency: 'IDR',
    defaultLocale: 'id-ID',
    defaultTimezone: 'Asia/Jakarta',
    taxSystemType: 'VAT', // PPN
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimalSeparator: ',',
      thousandSeparator: '.',
      decimalPlaces: 0,
      currencySymbol: 'Rp',
      symbolPlacement: 'BEFORE',
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  SG: {
    id: 'cnt_singapore',
    countryCode: 'SG',
    iso3: 'SGP',
    name: 'Singapore',
    defaultCurrency: 'SGD',
    defaultLocale: 'en-SG',
    defaultTimezone: 'Asia/Singapore',
    taxSystemType: 'GST',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimalSeparator: '.',
      thousandSeparator: ',',
      decimalPlaces: 2,
      currencySymbol: 'S$',
      symbolPlacement: 'BEFORE',
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  MY: {
    id: 'cnt_malaysia',
    countryCode: 'MY',
    iso3: 'MYS',
    name: 'Malaysia',
    defaultCurrency: 'MYR',
    defaultLocale: 'ms-MY',
    defaultTimezone: 'Asia/Kuala_Lumpur',
    taxSystemType: 'SALES_TAX', // SST
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimalSeparator: '.',
      thousandSeparator: ',',
      decimalPlaces: 2,
      currencySymbol: 'RM',
      symbolPlacement: 'BEFORE',
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  US: {
    id: 'cnt_united_states',
    countryCode: 'US',
    iso3: 'USA',
    name: 'United States',
    defaultCurrency: 'USD',
    defaultLocale: 'en-US',
    defaultTimezone: 'America/New_York',
    taxSystemType: 'SALES_TAX',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: {
      decimalSeparator: '.',
      thousandSeparator: ',',
      decimalPlaces: 2,
      currencySymbol: '$',
      symbolPlacement: 'BEFORE',
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  GB: {
    id: 'cnt_united_kingdom',
    countryCode: 'GB',
    iso3: 'GBR',
    name: 'United Kingdom',
    defaultCurrency: 'GBP',
    defaultLocale: 'en-GB',
    defaultTimezone: 'Europe/London',
    taxSystemType: 'VAT',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimalSeparator: '.',
      thousandSeparator: ',',
      decimalPlaces: 2,
      currencySymbol: '£',
      symbolPlacement: 'BEFORE',
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  AU: {
    id: 'cnt_australia',
    countryCode: 'AU',
    iso3: 'AUS',
    name: 'Australia',
    defaultCurrency: 'AUD',
    defaultLocale: 'en-AU',
    defaultTimezone: 'Australia/Sydney',
    taxSystemType: 'GST',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: {
      decimalSeparator: '.',
      thousandSeparator: ',',
      decimalPlaces: 2,
      currencySymbol: 'A$',
      symbolPlacement: 'BEFORE',
    },
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
};

// ================================================================
// Currencies & Precision Rules
// ================================================================

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  fractionDigits: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  IDR: { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', fractionDigits: 0 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', fractionDigits: 2 },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', fractionDigits: 2 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', fractionDigits: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', fractionDigits: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', fractionDigits: 2 },
  PHP: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', fractionDigits: 2 },
  THB: { code: 'THB', name: 'Thai Baht', symbol: '฿', fractionDigits: 2 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', fractionDigits: 2 },
};

// ================================================================
// Granular Permissions
// ================================================================

export const SYSTEM_PERMISSIONS = [
  // Sales
  'sales.view',
  'sales.create',
  'sales.update',
  'sales.cancel',
  'sales.refund',

  // Products
  'products.view',
  'products.create',
  'products.update',
  'products.archive',

  // Inventory
  'inventory.view',
  'inventory.adjust',
  'inventory.transfer',
  'inventory.opname',

  // Finance & Accounting
  'finance.view',
  'finance.create',
  'finance.update',
  'accounting.view',
  'accounting.manage',

  // Reports
  'reports.view',
  'reports.export',

  // Purchases & Suppliers
  'purchases.view',
  'purchases.create',
  'purchases.update',
  'purchases.receive',
  'suppliers.view',
  'suppliers.manage',

  // Customers
  'customers.view',
  'customers.manage',

  // Employees & RBAC
  'employees.view',
  'employees.manage',

  // Settings
  'settings.view',
  'settings.manage',

  // Payments
  'payment.view',
  'payment.create',
  'payment.reconcile',

  // Subscriptions
  'subscriptions.view',
  'subscriptions.manage',

  // AI & ML
  'ai.view',
  'ml.view',

  // Audit
  'audit.view',
] as const;

export type SystemPermission = (typeof SYSTEM_PERMISSIONS)[number];

// Standard Role Mapping
export const ROLE_PERMISSIONS: Record<RoleName, readonly SystemPermission[]> = {
  OWNER: SYSTEM_PERMISSIONS, // Owner has all permissions
  MANAGER: [
    'sales.view',
    'sales.create',
    'sales.update',
    'sales.cancel',
    'sales.refund',
    'products.view',
    'products.create',
    'products.update',
    'inventory.view',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.opname',
    'finance.view',
    'finance.create',
    'reports.view',
    'reports.export',
    'purchases.view',
    'purchases.create',
    'purchases.update',
    'purchases.receive',
    'suppliers.view',
    'suppliers.manage',
    'customers.view',
    'customers.manage',
    'employees.view',
    'payment.view',
    'payment.create',
    'payment.reconcile',
    'ai.view',
    'ml.view',
    'audit.view',
  ],
  CASHIER: [
    'sales.view',
    'sales.create',
    'products.view',
    'inventory.view',
    'customers.view',
    'customers.manage',
    'payment.view',
    'payment.create',
  ],
  STAFF: [
    'products.view',
    'inventory.view',
  ],
  ENTERPRISE_ADMIN: SYSTEM_PERMISSIONS,
};

// ================================================================
// Subscription Plan Entitlements
// ================================================================

export const PLAN_ENTITLEMENTS: Record<PlanTier, Entitlement> = {
  FREE: {
    maxBranches: 1,
    maxUsers: 1,
    maxMonthlyTransactions: 100,
    hasAiInsights: false,
    hasMlForecast: false,
    hasAnomalyDetection: false,
    hasAdvancedFinance: false,
    hasPurchases: false,
    hasMultiOutlet: false,
    hasCustomReports: false,
    hasApiAccess: false,
    hasAds: true,
  },
  PRO: {
    maxBranches: 2,
    maxUsers: 5,
    maxMonthlyTransactions: -1, // unlimited
    hasAiInsights: false,
    hasMlForecast: false,
    hasAnomalyDetection: false,
    hasAdvancedFinance: true,
    hasPurchases: true,
    hasMultiOutlet: false,
    hasCustomReports: true,
    hasApiAccess: false,
    hasAds: false,
  },
  BUSINESS: {
    maxBranches: 10,
    maxUsers: 25,
    maxMonthlyTransactions: -1,
    hasAiInsights: true,
    hasMlForecast: true,
    hasAnomalyDetection: true,
    hasAdvancedFinance: true,
    hasPurchases: true,
    hasMultiOutlet: true,
    hasCustomReports: true,
    hasApiAccess: false,
    hasAds: false,
  },
  ENTERPRISE: {
    maxBranches: 100,
    maxUsers: 200,
    maxMonthlyTransactions: -1,
    hasAiInsights: true,
    hasMlForecast: true,
    hasAnomalyDetection: true,
    hasAdvancedFinance: true,
    hasPurchases: true,
    hasMultiOutlet: true,
    hasCustomReports: true,
    hasApiAccess: true,
    hasAds: false,
  },
};

// ================================================================
// Standard Chart of Accounts (COA) Template
// ================================================================

export interface StandardAccountDefinition {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
}

export const DEFAULT_CHART_OF_ACCOUNTS: StandardAccountDefinition[] = [
  // Assets (1000s)
  { code: '1010', name: 'Cash on Hand', type: 'ASSET' },
  { code: '1020', name: 'Bank Account', type: 'ASSET' },
  { code: '1030', name: 'Payment Gateway Clearing', type: 'ASSET' },
  { code: '1040', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1050', name: 'Merchandise Inventory', type: 'ASSET' },
  
  // Liabilities (2000s)
  { code: '2010', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2020', name: 'Sales Tax / VAT Payable', type: 'LIABILITY' },
  
  // Equity (3000s)
  { code: '3010', name: "Owner's Capital", type: 'EQUITY' },
  { code: '3020', name: 'Retained Earnings', type: 'EQUITY' },
  
  // Revenue (4000s)
  { code: '4010', name: 'Sales Revenue', type: 'REVENUE' },
  { code: '4020', name: 'Sales Discounts', type: 'REVENUE' }, // Contra-revenue
  { code: '4030', name: 'Service Revenue', type: 'REVENUE' },
  
  // Expenses (5000s - 6000s)
  { code: '5010', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE' },
  { code: '6010', name: 'Operational Expenses', type: 'EXPENSE' },
  { code: '6020', name: 'Rent Expense', type: 'EXPENSE' },
  { code: '6030', name: 'Utilities Expense', type: 'EXPENSE' },
  { code: '6040', name: 'Salaries & Wages Expense', type: 'EXPENSE' },
  { code: '6050', name: 'Payment Gateway Fees', type: 'EXPENSE' },
  { code: '6060', name: 'Inventory Shrinkage / Damage', type: 'EXPENSE' },
];
