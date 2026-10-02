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
