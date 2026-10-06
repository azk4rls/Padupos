// ================================================================
// PADUPOS — Core Domain Types (Global-First)
// ================================================================

// --- Global & Country Architecture ---
export interface Country {
  id: string;
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "ID", "SG", "US"
  iso3: string;        // ISO 3166-1 alpha-3, e.g. "IDN", "SGP", "USA"
  name: string;
  defaultCurrency: string;
  defaultLocale: string;
  defaultTimezone: string;
  taxSystemType: 'VAT' | 'GST' | 'SALES_TAX' | 'NONE';
  dateFormat: string;
  numberFormat: {
    decimalSeparator: string;
    thousandSeparator: string;
    decimalPlaces: number;
    currencySymbol: string;
    symbolPlacement: 'BEFORE' | 'AFTER';
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  country: string;
  region?: string;        // State / Province
  locality: string;      // City / District
  postalCode?: string;
  addressLine1: string;
  addressLine2?: string;
  additionalData?: Record<string, unknown>;
}

// --- Multi-Tenancy & Identity ---
export type RoleName = 'OWNER' | 'MANAGER' | 'CASHIER' | 'STAFF' | 'ENTERPRISE_ADMIN';

export interface Profile {
  id: string; // auth.users.id
  name: string;
  phone?: string;
  avatarUrl?: string;
  locale: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export type BusinessType =
  | 'RETAIL'
  | 'FOOD_AND_BEVERAGE'
  | 'SERVICES'
  | 'LAUNDRY'
  | 'BEAUTY'
  | 'WHOLESALE'
  | 'ECOMMERCE'
  | 'PROFESSIONAL_SERVICES'
  | 'OTHER';

export interface Business {
  id: string;
  ownerUserId: string;
  name: string;
  legalName?: string;
  businessType: BusinessType;
  countryId: string;
  baseCurrency: string;
  displayCurrency?: string;
  locale: string;
  timezone: string;
  fiscalYearStartMonth: number; // 1 = January, 4 = April, etc.
  taxId?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export interface BusinessMember {
  id: string;
  businessId: string;
  userId: string;
  roleId: string;
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  code: string;
  address?: Address;
  phone?: string;
  timezone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  businessId?: string | null; // null for system standard roles
  name: RoleName | string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  code: string; // e.g. "sales.create", "inventory.adjust"
  category: string;
  description?: string;
}

// --- Product Catalog ---
export type CostMethod = 'WEIGHTED_AVERAGE' | 'FIFO' | 'STANDARD';

export interface ProductCategory {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  categoryId?: string;
  name: string;
  localizedNames?: Record<string, string>; // e.g. { "en-US": "Chicken Rice", "id-ID": "Nasi Ayam" }
  sku?: string;
  barcode?: string;
  unit: string; // "pcs", "kg", "g", "L", "ml", "box", etc.
  description?: string;
  costMethod: CostMethod;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  attributes: Record<string, string>; // e.g. { "size": "L", "color": "Red" }
  createdAt: string;
  updatedAt: string;
}

export interface ProductPrice {
  id: string;
  productId: string;
  variantId?: string;
  branchId?: string; // null means all branches
  currency: string;
  costPrice: string;    // String representation of Decimal/Numeric
  sellingPrice: string; // String representation of Decimal/Numeric
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
}

export interface Recipe {
  id: string;
  businessId: string;
  productId: string;
  variantId?: string;
  yieldQuantity: string;
  yieldUnit: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  ingredientProductId: string;
  ingredientVariantId?: string;
  quantity: string; // Numeric
  unit: string;
  wasteFactorPercentage: string; // e.g. "5.00" for 5% waste
}

// --- Inventory & Costing ---
export interface Inventory {
  id: string;
  businessId: string;
  branchId: string;
  productId: string;
  variantId?: string;
  quantity: string;          // Numeric
  reservedQuantity: string;  // Numeric
  availableQuantity: string; // quantity - reservedQuantity
  averageCost: string;       // Weighted average unit cost
  minimumStock: string;
  maximumStock?: string;
  updatedAt: string;
}

export type InventoryMovementType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'SALE_RETURN_IN'
  | 'PURCHASE_RETURN_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE_OUT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'OPNAME_ADJUSTMENT';

export interface InventoryMovement {
  id: string;
  businessId: string;
  branchId: string;
  productId: string;
  variantId?: string;
  type: InventoryMovementType;
  quantity: string; // Positive or negative
  unitCost: string; // Cost at movement time
  totalCost: string;
  referenceType: 'SALE' | 'PURCHASE' | 'TRANSFER' | 'OPNAME' | 'ADJUSTMENT';
  referenceId: string;
  createdBy: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  businessId: string;
  branchId: string;
  productId: string;
  variantId?: string;
  previousQuantity: string;
  adjustedQuantity: string;
  reason: string;
  unitCost: string;
  createdBy: string;
  createdAt: string;
}

export type StockTransferStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface StockTransfer {
  id: string;
  businessId: string;
  sourceBranchId: string;
  destinationBranchId: string;
  referenceNumber: string;
  status: StockTransferStatus;
  requestedBy: string;
  receivedBy?: string;
  shippedAt?: string;
  receivedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferItem {
  id: string;
  transferId: string;
  productId: string;
  variantId?: string;
  quantity: string;
  unitCost: string;
}

export type StockOpnameStatus = 'OPEN' | 'COUNT' | 'REVIEW' | 'APPLIED' | 'CLOSED';

export interface StockOpname {
  id: string;
  businessId: string;
  branchId: string;
  referenceNumber: string;
  status: StockOpnameStatus;
  startedAt: string;
  completedAt?: string;
  createdBy: string;
  reviewedBy?: string;
  notes?: string;
}

export interface StockOpnameItem {
  id: string;
  opnameId: string;
  productId: string;
  variantId?: string;
  systemQuantity: string;
  physicalQuantity: string;
  differenceQuantity: string;
  unitCost: string;
  notes?: string;
}

// --- POS & Sales ---
export type SaleStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED';

export interface Sale {
  id: string;
  businessId: string;
  branchId: string;
  cashSessionId?: string;
  customerId?: string;
  invoiceNumber: string;
  status: SaleStatus;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  feeAmount: string;
  totalAmount: string;
  cogsAmount: string;
  grossProfitAmount: string;
  currency: string;
  taxSnapshot?: Record<string, unknown>;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  variantId?: string;
  quantity: string;
  unitPrice: string;
  unitCost: string; // Historical WAC at sale time
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  cogsTotal: string;
}

export type CashSessionStatus = 'OPEN' | 'CLOSED';

export interface CashSession {
  id: string;
  businessId: string;
  branchId: string;
  cashierUserId: string;
  openedAt: string;
  closedAt?: string;
  openingCash: string;
  cashSales: string;
  cashExpenses: string;
  cashIn: string;
  cashOut: string;
  expectedCash: string;
  actualCash?: string;
  difference?: string;
  status: CashSessionStatus;
  notes?: string;
}

export interface CashMovement {
  id: string;
  businessId: string;
  branchId: string;
  cashSessionId: string;
  type: 'IN' | 'OUT' | 'EXPENSE';
  amount: string;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface Return {
  id: string;
  businessId: string;
  branchId: string;
  saleId: string;
  referenceNumber: string;
  refundAmount: string;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  saleItemId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  refundSubtotal: string;
  restockToInventory: boolean;
}

// --- Payment Domain ---
export type PaymentMethodType = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'QR' | 'EWALLET' | 'OTHER';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export type SettlementStatus = 'NOT_SETTLED' | 'SETTLEMENT_PENDING' | 'SETTLED' | 'RECONCILIATION_REQUIRED';

export interface Payment {
  id: string;
  businessId: string;
  saleId: string;
  provider: string; // 'CASH', 'XENDIT', 'MIDTRANS', 'MOCK_SANDBOX'
  providerPaymentId?: string;
  providerReference?: string;
  method: PaymentMethodType;
  amount: string;
  currency: string;
  exchangeRate?: string;
  baseAmount?: string;
  status: PaymentStatus;
  settlementStatus: SettlementStatus;
  expiresAt?: string;
  paidAt?: string;
  settledAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProviderEvent {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  processed: boolean;
  receivedAt: string;
}

export type ReconciliationStatus = 'MATCHED' | 'MISMATCH' | 'MISSING' | 'DUPLICATE' | 'REVIEW';

export interface PaymentReconciliation {
  id: string;
  businessId: string;
  paymentId?: string;
  provider: string;
  providerReference: string;
  providerAmount: string;
  systemAmount: string;
  status: ReconciliationStatus;
  discrepancyDetails?: Record<string, unknown>;
  reconciledAt: string;
  reconciledBy?: string;
}

export interface PaymentProvider {
  name: string;
  createPayment(params: {
    businessId: string;
    saleId: string;
    amount: string;
    currency: string;
    method: PaymentMethodType;
    description: string;
    customerEmail?: string;
    customerName?: string;
  }): Promise<{
    providerPaymentId: string;
    providerReference: string;
    paymentUrl?: string;
    qrCodeString?: string;
    expiresAt?: string;
    status: PaymentStatus;
    rawResponse: Record<string, unknown>;
  }>;

  getPaymentStatus(providerPaymentId: string): Promise<{
    status: PaymentStatus;
    settlementStatus?: SettlementStatus;
    paidAt?: string;
    rawResponse: Record<string, unknown>;
  }>;

  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, rawBody: string): boolean;

  parseWebhook(payload: Record<string, unknown>): {
    providerEventId: string;
    providerPaymentId: string;
    providerReference: string;
    amount: string;
    currency: string;
    status: PaymentStatus;
    settlementStatus?: SettlementStatus;
    paidAt?: string;
  };

  reconcilePayment(providerReference: string): Promise<PaymentReconciliation>;
}

// --- Finance & True Double-Entry Accounting ---
export interface ExpenseCategory {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  businessId: string;
  branchId?: string;
  categoryId: string;
  amount: string;
  currency: string;
  paymentMethod: PaymentMethodType;
  receiptUrl?: string;
  description: string;
  incurredAt: string;
  createdBy: string;
  createdAt: string;
}

export type ReceivableStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Receivable {
  id: string;
  businessId: string;
  customerId: string;
  saleId: string;
  originalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  dueDate: string;
  status: ReceivableStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReceivablePayment {
  id: string;
  businessId: string;
  receivableId: string;
  amount: string;
  paymentMethod: PaymentMethodType;
  referenceNumber?: string;
  recordedBy: string;
  paidAt: string;
}

export type PayableStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Payable {
  id: string;
  businessId: string;
  supplierId: string;
  purchaseId: string;
  originalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  dueDate: string;
  status: PayableStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PayablePayment {
  id: string;
  businessId: string;
  payableId: string;
  amount: string;
  paymentMethod: PaymentMethodType;
  referenceNumber?: string;
  recordedBy: string;
  paidAt: string;
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
  id: string;
  businessId: string;
  code: string; // e.g. "1010" Cash, "4010" Sales Revenue
  name: string;
  type: AccountType;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface AccountingPeriod {
  id: string;
  businessId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  businessId: string;
  branchId?: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceType: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'RECEIVABLE_PAYMENT' | 'PAYABLE_PAYMENT' | 'MANUAL' | 'REVERSAL' | 'REFUND';
  sourceId?: string;
  isPosted: boolean;
  createdBy: string;
  createdAt: string;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  description?: string;
  debit: string;  // Numeric
  credit: string; // Numeric
}

// --- Suppliers & Purchases ---
export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: Address;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  businessId: string;
  branchId: string;
  supplierId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  expectedDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  variantId?: string;
  orderedQuantity: string;
  receivedQuantity: string;
  unitCost: string;
  subtotal: string;
}

export interface Purchase {
  id: string;
  businessId: string;
  branchId: string;
  supplierId: string;
  purchaseOrderId?: string;
  invoiceNumber: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  isCredit: boolean;
  dueDate?: string;
  purchasedAt: string;
  receivedBy: string;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  variantId?: string;
  quantity: string;
  unitCost: string;
  subtotal: string;
}

// --- Customer ---
export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: Address;
  taxId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Tax Engine ---
export interface TaxRegime {
  id: string;
  countryId: string;
  code: string; // e.g. "ID_PPN", "SG_GST", "US_SALES_TAX"
  name: string;
  description?: string;
}

export interface TaxRate {
  id: string;
  taxRegimeId: string;
  name: string; // e.g. "Standard Rate", "Zero Rate", "Exempt"
  ratePercentage: string; // Numeric e.g. "11.00", "9.00", "0.00"
  effectiveFrom: string;
  effectiveTo?: string;
  isInclusiveDefault: boolean;
}

// --- Subscriptions & Entitlements ---
export type PlanTier = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export interface Plan {
  id: string;
  tier: PlanTier;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface PlanPrice {
  id: string;
  planId: string;
  countryId: string;
  currency: string;
  amount: string; // Numeric
  billingInterval: 'MONTHLY' | 'ANNUAL';
  taxBehavior: 'INCLUSIVE' | 'EXCLUSIVE';
  isActive: boolean;
}

export interface Entitlement {
  maxBranches: number;
  maxUsers: number;
  maxMonthlyTransactions: number; // -1 for unlimited
  hasAiInsights: boolean;
  hasMlForecast: boolean;
  hasAnomalyDetection: boolean;
  hasAdvancedFinance: boolean;
  hasPurchases: boolean;
  hasMultiOutlet: boolean;
  hasCustomReports: boolean;
  hasApiAccess: boolean;
  hasAds: boolean;
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';

export interface Subscription {
  id: string;
  businessId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- ML & AI Models ---
export type MLModelStatus = 'TRAINING' | 'VALIDATED' | 'ACTIVE' | 'RETIRED' | 'FAILED';

export interface MLModel {
  id: string;
  name: string; // 'sales_forecast', 'stock_forecast', 'anomaly_detector'
  version: string;
  modelType: string;
  featureSchema: Record<string, unknown>;
  trainingDataStart: string;
  trainingDataEnd: string;
  metrics: Record<string, number>; // e.g. { mae: 12.4, rmse: 18.2 }
  status: MLModelStatus;
  artifactReference: string;
  createdAt: string;
}

export interface MLPrediction {
  id: string;
  businessId: string;
  branchId?: string;
  modelId: string;
  predictionType: 'SALES_FORECAST' | 'STOCK_FORECAST' | 'ANOMALY_DETECTION';
  target: string; // Product ID or aggregated metric
  prediction: string; // Numeric value or JSON summary
  lowerBound?: string;
  upperBound?: string;
  generatedAt: string;
  validUntil: string;
  sourceDataRange: { start: string; end: string };
  createdAt: string;
}

export type AnomalySeverity = 'NORMAL' | 'UNUSUAL' | 'SEVERE_UNUSUAL';

export interface AnomalyEvent {
  id: string;
  businessId: string;
  branchId?: string;
  entityType: 'TRANSACTION' | 'EXPENSE' | 'STOCK_MOVEMENT';
  entityId: string;
  metricName: string;
  expectedValue: string;
  actualValue: string;
  severity: AnomalySeverity;
  notes: string;
  detectedAt: string;
}

// ================================================================
// PHASE 8.1 — ML DATA CONTRACTS
// ================================================================

/**
 * ML Data Sufficiency Status
 * Centralized concept for when the system can/cannot produce ML output.
 */
export type MLDataSufficiencyStatus =
  | 'SUFFICIENT'
  | 'INSUFFICIENT_DATA'
  | 'INVALID_DATA'
  | 'MODEL_FAILURE';

export interface MLDataSufficiencyResult {
  status: MLDataSufficiencyStatus;
  /** Human-readable message for UI display. */
  message: string;
  /** Minimum observations required. */
  requiredObservations?: number;
  /** Actual observations available. */
  actualObservations?: number;
  /** Specific reason for insufficiency (for debugging). */
  reason?: string;
}

/**
 * Scope for all ML datasets - enforces tenant and branch isolation.
 */
export interface MLDatasetScope {
  businessId: string;
  branchId?: string | null;
  timeZone: string;
}

/**
 * Daily sales observation - the atomic unit for sales forecasting.
 */
export interface SalesDailyObservation {
  /** Scope-local calendar day, YYYY-MM-DD. */
  date: string;
  /** Total revenue for the day (exact decimal string). */
  revenue: string;
  /** Total units sold across all products. */
  unitsSold: string;
  /** Number of transactions. */
  transactionCount: number;
  /** Gross profit for the day. */
  grossProfit: string;
  /** COGS for the day. */
  cogs: string;
}

/**
 * Complete daily sales dataset for a business/branch over a date range.
 */
export interface SalesDailyDataset {
  scope: MLDatasetScope;
  range: { startDate: string; endDate: string; dayCount: number };
  granularity: 'DAY';
  observations: SalesDailyObservation[];
  totals: {
    revenue: string;
    unitsSold: string;
    transactionCount: number;
    grossProfit: string;
    cogs: string;
  };
  sufficiency: MLDataSufficiencyResult;
}

/**
 * Daily inventory observation for stock forecasting.
 */
export interface InventoryDailyObservation {
  /** Scope-local calendar day, YYYY-MM-DD. */
  date: string;
  /** Product ID. */
  productId: string;
  /** Product SKU. */
  sku: string | null;
  /** Product name. */
  productName: string;
  /** Closing available stock for the day. */
  closingStock: string;
  /** Units sold (demand) for the day. */
  demand: string;
  /** Stock movements in (receipts, transfers in). */
  stockIn: string;
  /** Stock movements out (sales, transfers out, adjustments). */
  stockOut: string;
  /** Weighted average cost at day end. */
  averageCost: string;
}

/**
 * Daily inventory dataset for a business/branch over a date range.
 */
export interface InventoryDailyDataset {
  scope: MLDatasetScope;
  range: { startDate: string; endDate: string; dayCount: number };
  granularity: 'DAY';
  productIds: string[];
  observations: InventoryDailyObservation[];
  sufficiency: MLDataSufficiencyResult;
}

/**
 * Product demand features for ML models.
 */
export interface ProductDemandFeatures {
  productId: string;
  sku: string | null;
  productName: string;
  /** Total units sold in the lookback window. */
  totalDemand: string;
  /** Average daily demand. */
  avgDailyDemand: string;
  /** Standard deviation of daily demand. */
  demandStdDev: string;
  /** Coefficient of variation (std/mean). */
  demandCV: string;
  /** Days with zero demand. */
  zeroDemandDays: number;
  /** Current available stock. */
  currentStock: string;
  /** Weighted average cost. */
  averageCost: string;
  /** Days of cover at current demand rate. */
  daysOfCover: string | 'INFINITE';
  /** Trend direction: 'UP' | 'DOWN' | 'FLAT'. */
  trend: 'UP' | 'DOWN' | 'FLAT';
  /** Moving average (7-day). */
  movingAvg7d: string;
  /** Moving average (30-day). */
  movingAvg30d: string;
}

/**
 * Product demand dataset for a business/branch.
 */
export interface ProductDemandDataset {
  scope: MLDatasetScope;
  range: { startDate: string; endDate: string; dayCount: number };
  products: ProductDemandFeatures[];
  sufficiency: MLDataSufficiencyResult;
}

/**
 * Business insight dataset - aggregated metrics for AI insights.
 */
export interface BusinessInsightDataset {
  scope: MLDatasetScope;
  range: { startDate: string; endDate: string; dayCount: number };
  /** Daily sales time series. */
  salesSeries: SalesDailyObservation[];
  /** Top products by revenue. */
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: string;
    unitsSold: string;
    grossProfit: string;
  }>;
  /** Payment method distribution. */
  paymentMix: Record<string, string>;
  /** Expense breakdown by category. */
  expensesByCategory: Array<{
    categoryId: string;
    categoryName: string;
    amount: string;
  }>;
  /** Inventory health summary. */
  inventoryHealth: {
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalStockValue: string;
  };
  /** Receivables aging. */
  receivablesAging: {
    current: string;
    days1to30: string;
    days31to60: string;
    days61to90: string;
    over90: string;
  };
  /** Payables aging. */
  payablesAging: {
    current: string;
    days1to30: string;
    days31to60: string;
    days61to90: string;
    over90: string;
  };
  sufficiency: MLDataSufficiencyResult;
}

/**
 * Feature vector for ML models - generic container.
 */
export interface MLFeatureVector {
  /** Feature names in order. */
  featureNames: string[];
  /** Feature values as decimal strings. */
  values: string[];
  /** Metadata about the observation. */
  metadata: Record<string, unknown>;
}

/**
 * Training data request from Python worker.
 */
export interface MLTrainingDataRequest {
  businessId: string;
  branchId?: string | null;
  predictionType: 'SALES_FORECAST' | 'STOCK_FORECAST' | 'ANOMALY_DETECTION';
  lookbackDays: number;
  maxTrainingDays?: number;
}

/**
 * Training data response to Python worker.
 */
export interface MLTrainingDataResponse {
  businessId: string;
  branchId?: string | null;
  predictionType: 'SALES_FORECAST' | 'STOCK_FORECAST' | 'ANOMALY_DETECTION';
  features: MLFeatureVector[];
  targets: string[];
  scope: MLDatasetScope;
  range: { startDate: string; endDate: string; dayCount: number };
  sufficiency: MLDataSufficiencyResult;
}

/**
 * Inference request from Python worker.
 */
export interface MLInferenceRequest {
  businessId: string;
  branchId?: string | null;
  modelId: string;
  predictionType: 'SALES_FORECAST' | 'STOCK_FORECAST' | 'ANOMALY_DETECTION';
  features: MLFeatureVector;
}

/**
 * Inference response from Python worker.
 */
export interface MLInferenceResponse {
  prediction: string;
  lowerBound?: string;
  upperBound?: string;
  confidence?: number;
  modelVersion: string;
  generatedAt: string;
}

/**
 * Anomaly observation for transaction anomaly detection.
 */
export interface TransactionAnomalyObservation {
  transactionId: string;
  date: string;
  branchId: string;
  amount: string;
  itemCount: number;
  paymentMethod: string;
  baselineMeanAmount: string;
  baselineStdDevAmount: string;
  deviationScore: string;
  isUnusual: boolean;
  reason?: string;
}

/**
 * Anomaly detection dataset for a business/branch.
 */
export interface AnomalyDetectionDataset {
  scope: MLDatasetScope;
  range: { startDate: string; endDate: string; dayCount: number };
  observations: TransactionAnomalyObservation[];
  baseline: {
    meanAmount: string;
    stdDevAmount: string;
    sampleSize: number;
  };
  sufficiency: MLDataSufficiencyResult;
}

export interface AIInsight {
  id: string;
  businessId: string;
  insightType: 'SALES_TREND' | 'INVENTORY_RISK' | 'EXPENSE_SPIKE' | 'BUSINESS_SUMMARY';
  title: string;
  summary: string;
  dataPeriod: { start: string; end: string };
  metricsSnapshot: Record<string, unknown>; // Deterministic numbers fed into LLM
  promptTemplateVersion: string;
  modelUsed: string;
  status: 'ACTIVE' | 'STALE' | 'DISMISSED';
  generatedAt: string;
}

// --- Audit & Observability ---
export interface AuditLog {
  id: string;
  businessId?: string;
  branchId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  businessId: string;
  userId?: string;
  type: 'LOW_STOCK' | 'PAYMENT_RECEIVED' | 'RECEIVABLE_OVERDUE' | 'PAYABLE_OVERDUE' | 'INSIGHT_READY';
  title: string;
  message: string;
  status: 'CREATED' | 'READ' | 'DELIVERED' | 'FAILED';
  createdAt: string;
}

export interface IdempotencyKey {
  id: string;
  businessId: string;
  key: string;
  scope: string; // 'SALE_FINALIZATION', 'PAYMENT_WEBHOOK', 'OFFLINE_SYNC'
  requestPayloadHash: string;
  responsePayload?: Record<string, unknown>;
  statusCode?: number;
  lockedAt: string;
  completedAt?: string;
}

export interface OfflineSyncQueueItem {
  id: string;
  deviceId: string;
  branchId: string;
  operation: 'FINALIZE_SALE' | 'OPEN_CASH_SESSION' | 'CLOSE_CASH_SESSION' | 'RECORD_CASH_MOVEMENT';
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  retryCount: number;
}

export interface OfflineSyncBatch {
  deviceId: string;
  batch: OfflineSyncQueueItem[];
}

export interface SyncBatchResponse {
  successful: Array<{ id: string; idempotencyKey: string; serverId: string }>;
  conflicts: Array<{ id: string; idempotencyKey: string; reason: string }>;
  failed: Array<{ id: string; idempotencyKey: string; error: string; shouldRetry: boolean }>;
}
