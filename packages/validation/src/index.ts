import { z } from 'zod';
import { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES } from '@padupos/config';

// ================================================================
// PADUPOS — Global Zod Validation Schemas
// ================================================================

// Numeric string regex (strictly positive or non-negative decimal/numeric)
export const numericString = z.string().regex(/^\d+(\.\d{1,4})?$/, {
  message: 'Must be a valid decimal string with up to 4 decimal places',
});

export const signedNumericString = z.string().regex(/^-?\d+(\.\d{1,4})?$/, {
  message: 'Must be a valid decimal string with up to 4 decimal places',
});

// Common Pagination & Filtering
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  branchId: z.string().uuid().optional(),
});

// Address Schema
export const addressSchema = z.object({
  country: z.string().min(2).max(2).toUpperCase(),
  region: z.string().max(100).optional(),
  locality: z.string().min(1).max(100),
  postalCode: z.string().max(20).optional(),
  addressLine1: z.string().min(1).max(255),
  addressLine2: z.string().max(255).optional(),
  additionalData: z.record(z.unknown()).optional(),
});

// Onboarding & Business Creation
export const createBusinessSchema = z.object({
  name: z.string().trim().min(2).max(100),
  legalName: z.string().trim().max(150).optional(),
  businessType: z.enum([
    'RETAIL',
    'FOOD_AND_BEVERAGE',
    'SERVICES',
    'LAUNDRY',
    'BEAUTY',
    'WHOLESALE',
    'ECOMMERCE',
    'PROFESSIONAL_SERVICES',
    'OTHER',
  ]),
  countryCode: z.string().length(2).toUpperCase().refine(
    (code) => Boolean(SUPPORTED_COUNTRIES[code]),
    { message: 'Unsupported country code' }
  ),
  currency: z.string().length(3).toUpperCase().refine(
    (code) => Boolean(SUPPORTED_CURRENCIES[code]),
    { message: 'Unsupported currency code' }
  ),
  locale: z.string().min(2).max(10).default('id-ID'),
  timezone: z.string().min(2).max(50).default('Asia/Jakarta'),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  taxId: z.string().trim().max(50).optional(),
  initialBranchName: z.string().trim().min(2).max(100).default('Main Branch'),
});

export const updateBusinessSchema = createBusinessSchema.partial();

// Branch Schema
export const createBranchSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  address: addressSchema.optional(),
  phone: z.string().max(30).optional(),
  timezone: z.string().max(50).optional(),
});

export const updateBranchSchema = createBranchSchema.partial();

// Member Invitation
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  roleName: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'STAFF']),
});

// Product Schemas
export const createProductCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).optional(),
  parentId: z.string().min(1).optional(),
});

export const createProductSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(150),
  localizedNames: z.record(z.string()).optional(),
  sku: z.string().trim().max(50).optional(),
  barcode: z.string().trim().max(50).optional(),
  unit: z.string().trim().min(1).max(20).default('pcs'),
  description: z.string().trim().max(500).optional(),
  costMethod: z.enum(['WEIGHTED_AVERAGE', 'FIFO', 'STANDARD']).default('WEIGHTED_AVERAGE'),
  costPrice: numericString.default('0'),
  sellingPrice: numericString,
});

export const updateProductSchema = createProductSchema.partial();

// Product Variant Schema
export const createProductVariantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().max(50).optional(),
  barcode: z.string().trim().max(50).optional(),
  attributes: z.record(z.string()),
  costPrice: numericString.default('0'),
  sellingPrice: numericString,
});

// Recipe Schemas (F&B)
export const createRecipeItemSchema = z.object({
  ingredientProductId: z.string().min(1),
  ingredientVariantId: z.string().min(1).optional(),
  quantity: numericString,
  unit: z.string().trim().min(1).max(20),
  wasteFactorPercentage: numericString.default('0'),
});

export const createRecipeSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  yieldQuantity: numericString.default('1'),
  yieldUnit: z.string().trim().min(1).max(20).default('portion'),
  items: z.array(createRecipeItemSchema).min(1, 'A recipe requires at least 1 ingredient'),
});

// Inventory Movement & Adjustment
export const createStockAdjustmentSchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  adjustedQuantity: signedNumericString, // New physical quantity
  reason: z.string().trim().min(3).max(255),
});

export const createStockTransferSchema = z.object({
  sourceBranchId: z.string().min(1),
  destinationBranchId: z.string().min(1),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().min(1).optional(),
      quantity: numericString,
    })
  ).min(1),
  notes: z.string().trim().max(255).optional(),
});

// Cash Session Schemas
export const openCashSessionSchema = z.object({
  branchId: z.string().min(1),
  openingCash: numericString,
  notes: z.string().trim().max(255).optional(),
});

export const closeCashSessionSchema = z.object({
  actualCash: numericString,
  notes: z.string().trim().max(255).optional(),
});

export const recordCashMovementSchema = z.object({
  branchId: z.string().min(1),
  cashSessionId: z.string().min(1),
  type: z.enum(['IN', 'OUT', 'EXPENSE']),
  amount: numericString,
  reason: z.string().trim().min(3).max(255),
});

// POS & Sale Finalization
export const cartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: numericString,
  unitPrice: numericString,
  discountAmount: numericString.default('0'),
});

export const finalizeSaleSchema = z.object({
  branchId: z.string().min(1),
  cashSessionId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  items: z.array(cartItemSchema).min(1, 'Cart cannot be empty'),
  orderDiscountAmount: numericString.default('0'),
  taxRatePercentage: numericString.default('0'),
  isTaxInclusive: z.boolean().default(false),
  feeAmount: numericString.default('0'),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'QR', 'EWALLET', 'OTHER']),
  cashTendered: numericString.optional(),
  idempotencyKey: z.string().min(8).max(64),
  notes: z.string().trim().max(255).optional(),
});

// Return / Refund Schema
export const createReturnSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(3).max(255),
  items: z.array(
    z.object({
      saleItemId: z.string().min(1),
      quantity: numericString,
      restockToInventory: z.boolean().default(true),
    })
  ).min(1),
});

// Payment Initiation
export const createPaymentRequestSchema = z.object({
  saleId: z.string().min(1),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'QR', 'EWALLET', 'OTHER']),
  customerEmail: z.string().email().optional(),
  customerName: z.string().trim().optional(),
});

// Finance & Expenses
export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(255).optional(),
});

export const createExpenseSchema = z.object({
  branchId: z.string().min(1).optional(),
  categoryId: z.string().min(1),
  amount: numericString,
  currency: z.string().length(3).toUpperCase(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'QR', 'EWALLET', 'OTHER']),
  description: z.string().trim().min(3).max(255),
  incurredAt: z.string().min(1),
  receiptUrl: z.string().url().optional(),
});

export const recordReceivablePaymentSchema = z.object({
  amount: numericString,
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'QR', 'EWALLET', 'OTHER']),
  referenceNumber: z.string().trim().max(50).optional(),
});

export const recordPayablePaymentSchema = z.object({
  amount: numericString,
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'QR', 'EWALLET', 'OTHER']),
  referenceNumber: z.string().trim().max(50).optional(),
});

// Suppliers & Purchases
export const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(100),
  contactPerson: z.string().trim().max(100).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  address: addressSchema.optional(),
  taxId: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(255).optional(),
});

export const createPurchaseSchema = z.object({
  branchId: z.string().min(1),
  supplierId: z.string().min(1),
  invoiceNumber: z.string().trim().min(1).max(50),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().min(1).optional(),
      quantity: numericString,
      unitCost: numericString,
    })
  ).min(1),
  taxAmount: numericString.default('0'),
  isCredit: z.boolean().default(false),
  dueDate: z.string().optional(),
  purchasedAt: z.string().min(1),
});

// Offline Sync Schema
export const offlineSyncQueueItemSchema = z.object({
  id: z.string().min(1),
  deviceId: z.string().min(4).max(64),
  branchId: z.string().min(1),
  operation: z.enum(['FINALIZE_SALE', 'OPEN_CASH_SESSION', 'CLOSE_CASH_SESSION', 'RECORD_CASH_MOVEMENT']),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().min(8).max(64),
  createdAt: z.string().min(1),
  retryCount: z.number().int().nonnegative().default(0),
});

export const offlineSyncBatchSchema = z.object({
  deviceId: z.string().min(4).max(64),
  batch: z.array(offlineSyncQueueItemSchema).max(50),
});

// AI & ML
export const generateAiInsightSchema = z.object({
  insightType: z.enum(['SALES_TREND', 'INVENTORY_RISK', 'EXPENSE_SPIKE', 'BUSINESS_SUMMARY']),
  branchId: z.string().min(1).optional(),
});

// Accounting Period
export const createAccountingPeriodSchema = z.object({
  name: z.string().min(1).max(50),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

// ML Data Readiness Schemas
export const mlDatasetQuerySchema = z.object({
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  branchId: z.string().min(1).optional(),
  productIds: z.union([z.string(), z.array(z.string())]).optional(),
});

export const mlTrainingDataRequestSchema = z.object({
  branchId: z.string().min(1).nullable().optional(),
  predictionType: z.enum(['SALES_FORECAST', 'STOCK_FORECAST', 'ANOMALY_DETECTION']),
  lookbackDays: z.coerce.number().int().min(1).max(366).default(30),
  maxTrainingDays: z.coerce.number().int().min(1).max(366).optional(),
});

