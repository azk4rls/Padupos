import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ================================================================
// 1. GLOBAL & REFERENCE TABLES
// ================================================================

export const countries = pgTable('countries', {
  id: varchar('id', { length: 50 }).primaryKey(),
  countryCode: varchar('country_code', { length: 2 }).notNull().unique(),
  iso3: varchar('iso3', { length: 3 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  defaultCurrency: varchar('default_currency', { length: 3 }).notNull(),
  defaultLocale: varchar('default_locale', { length: 10 }).notNull(),
  defaultTimezone: varchar('default_timezone', { length: 50 }).notNull(),
  taxSystemType: varchar('tax_system_type', { length: 20 }).notNull().default('VAT'),
  dateFormat: varchar('date_format', { length: 20 }).notNull().default('DD/MM/YYYY'),
  numberFormat: jsonb('number_format').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const currencies = pgTable('currencies', {
  code: varchar('code', { length: 3 }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull(),
  symbol: varchar('symbol', { length: 10 }).notNull(),
  fractionDigits: integer('fraction_digits').notNull().default(2),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ================================================================
// 2. IDENTITY, TENANCY & RBAC
// ================================================================

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  avatarUrl: text('avatar_url'),
  locale: varchar('locale', { length: 10 }).notNull().default('id-ID'),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Jakarta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  legalName: varchar('legal_name', { length: 150 }),
  businessType: varchar('business_type', { length: 50 }).notNull().default('RETAIL'),
  countryId: varchar('country_id', { length: 50 }).notNull().references(() => countries.id),
  baseCurrency: varchar('base_currency', { length: 3 }).notNull().references(() => currencies.code),
  displayCurrency: varchar('display_currency', { length: 3 }).references(() => currencies.code),
  locale: varchar('locale', { length: 10 }).notNull().default('id-ID'),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Jakarta'),
  fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(1),
  taxId: varchar('tax_id', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  category: varchar('category', { length: 50 }).notNull(),
  description: text('description'),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  })
);

export const businessMembers = pgTable('business_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  joinedAt: timestamp('joined_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  address: jsonb('address'),
  phone: varchar('phone', { length: 30 }),
  timezone: varchar('timezone', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ================================================================
// 3. PRODUCTS, RECIPES & PRICING
// ================================================================

export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 150 }).notNull(),
  localizedNames: jsonb('localized_names').default({}),
  sku: varchar('sku', { length: 50 }),
  barcode: varchar('barcode', { length: 50 }),
  unit: varchar('unit', { length: 20 }).notNull().default('pcs'),
  description: text('description'),
  costMethod: varchar('cost_method', { length: 20 }).notNull().default('WEIGHTED_AVERAGE'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  sku: varchar('sku', { length: 50 }),
  barcode: varchar('barcode', { length: 50 }),
  attributes: jsonb('attributes').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const productPrices = pgTable('product_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  costPrice: numeric('cost_price', { precision: 18, scale: 4 }).notNull().default('0'),
  sellingPrice: numeric('selling_price', { precision: 18, scale: 4 }).notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  yieldQuantity: numeric('yield_quantity', { precision: 18, scale: 4 }).notNull().default('1'),
  yieldUnit: varchar('yield_unit', { length: 20 }).notNull().default('portion'),
  isActive: boolean('is_active').notNull().default(true),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recipeItems = pgTable('recipe_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  ingredientProductId: uuid('ingredient_product_id').notNull().references(() => products.id),
  ingredientVariantId: uuid('ingredient_variant_id').references(() => productVariants.id),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  wasteFactorPercentage: numeric('waste_factor_percentage', { precision: 5, scale: 2 }).notNull().default('0'),
});

// ================================================================
// 4. TAX ENGINE
// ================================================================

export const taxRegimes = pgTable('tax_regimes', {
  id: uuid('id').primaryKey().defaultRandom(),
  countryId: varchar('country_id', { length: 50 }).notNull().references(() => countries.id),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
});

export const taxRates = pgTable('tax_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  taxRegimeId: uuid('tax_regime_id').notNull().references(() => taxRegimes.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  ratePercentage: numeric('rate_percentage', { precision: 7, scale: 4 }).notNull(),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  isInclusiveDefault: boolean('is_inclusive_default').notNull().default(false),
});

// ================================================================
// 5. INVENTORY & WAC MOVEMENTS
// ================================================================

export const inventories = pgTable('inventories', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  reservedQuantity: numeric('reserved_quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  availableQuantity: numeric('available_quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  averageCost: numeric('average_cost', { precision: 18, scale: 4 }).notNull().default('0'),
  minimumStock: numeric('minimum_stock', { precision: 18, scale: 4 }).notNull().default('0'),
  maximumStock: numeric('maximum_stock', { precision: 18, scale: 4 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryMovements = pgTable('inventory_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  totalCost: numeric('total_cost', { precision: 18, scale: 4 }).notNull(),
  referenceType: varchar('reference_type', { length: 30 }).notNull(),
  referenceId: uuid('reference_id').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockAdjustments = pgTable('stock_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  previousQuantity: numeric('previous_quantity', { precision: 18, scale: 4 }).notNull(),
  adjustedQuantity: numeric('adjusted_quantity', { precision: 18, scale: 4 }).notNull(),
  reason: text('reason').notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockTransfers = pgTable('stock_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  sourceBranchId: uuid('source_branch_id').notNull().references(() => branches.id),
  destinationBranchId: uuid('destination_branch_id').notNull().references(() => branches.id),
  referenceNumber: varchar('reference_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
  requestedBy: uuid('requested_by').notNull(),
  receivedBy: uuid('received_by'),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockTransferItems = pgTable('stock_transfer_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id').notNull().references(() => stockTransfers.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
});

export const stockOpnames = pgTable('stock_opnames', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  referenceNumber: varchar('reference_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('OPEN'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull(),
  reviewedBy: uuid('reviewed_by'),
  notes: text('notes'),
});

export const stockOpnameItems = pgTable('stock_opname_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  opnameId: uuid('opname_id').notNull().references(() => stockOpnames.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  systemQuantity: numeric('system_quantity', { precision: 18, scale: 4 }).notNull(),
  physicalQuantity: numeric('physical_quantity', { precision: 18, scale: 4 }).notNull(),
  differenceQuantity: numeric('difference_quantity', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  notes: text('notes'),
});

// ================================================================
// 6. CUSTOMERS
// ================================================================

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 100 }),
  address: jsonb('address'),
  taxId: varchar('tax_id', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ================================================================
// 7. POS, SALES & CASHIER SESSIONS
// ================================================================

export const cashSessions = pgTable('cash_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  cashierUserId: uuid('cashier_user_id').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  openingCash: numeric('opening_cash', { precision: 18, scale: 4 }).notNull(),
  cashSales: numeric('cash_sales', { precision: 18, scale: 4 }).notNull().default('0'),
  cashExpenses: numeric('cash_expenses', { precision: 18, scale: 4 }).notNull().default('0'),
  cashIn: numeric('cash_in', { precision: 18, scale: 4 }).notNull().default('0'),
  cashOut: numeric('cash_out', { precision: 18, scale: 4 }).notNull().default('0'),
  expectedCash: numeric('expected_cash', { precision: 18, scale: 4 }).notNull().default('0'),
  actualCash: numeric('actual_cash', { precision: 18, scale: 4 }),
  difference: numeric('difference', { precision: 18, scale: 4 }),
  status: varchar('status', { length: 20 }).notNull().default('OPEN'),
  notes: text('notes'),
});

export const cashMovements = pgTable('cash_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  cashSessionId: uuid('cash_session_id').notNull().references(() => cashSessions.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  reason: text('reason').notNull(),
  performedBy: uuid('performed_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sales = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  cashSessionId: uuid('cash_session_id').references(() => cashSessions.id),
  customerId: uuid('customer_id').references(() => customers.id),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 25 }).notNull().default('PENDING_PAYMENT'),
  subtotal: numeric('subtotal', { precision: 18, scale: 4 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  feeAmount: numeric('fee_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 4 }).notNull(),
  cogsAmount: numeric('cogs_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  grossProfitAmount: numeric('gross_profit_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  taxSnapshot: jsonb('tax_snapshot'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const saleItems = pgTable('sale_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  saleId: uuid('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  subtotal: numeric('subtotal', { precision: 18, scale: 4 }).notNull(),
  discountAmount: numeric('discount_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  total: numeric('total', { precision: 18, scale: 4 }).notNull(),
  cogsTotal: numeric('cogs_total', { precision: 18, scale: 4 }).notNull(),
});

export const returns = pgTable('returns', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  saleId: uuid('sale_id').notNull().references(() => sales.id),
  referenceNumber: varchar('reference_number', { length: 50 }).notNull(),
  refundAmount: numeric('refund_amount', { precision: 18, scale: 4 }).notNull(),
  reason: text('reason').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const returnItems = pgTable('return_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  returnId: uuid('return_id').notNull().references(() => returns.id, { onDelete: 'cascade' }),
  saleItemId: uuid('sale_item_id').notNull().references(() => saleItems.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  unitPrice: numeric('unit_price', { precision: 18, scale: 4 }).notNull(),
  refundSubtotal: numeric('refund_subtotal', { precision: 18, scale: 4 }).notNull(),
  restockToInventory: boolean('restock_to_inventory').notNull().default(true),
});

// ================================================================
// 8. PAYMENT DOMAIN (NON-CUSTODIAL)
// ================================================================

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  saleId: uuid('sale_id').notNull().references(() => sales.id),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerPaymentId: varchar('provider_payment_id', { length: 100 }),
  providerReference: varchar('provider_reference', { length: 100 }),
  method: varchar('method', { length: 30 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  exchangeRate: numeric('exchange_rate', { precision: 18, scale: 6 }),
  baseAmount: numeric('base_amount', { precision: 18, scale: 4 }),
  status: varchar('status', { length: 30 }).notNull().default('CREATED'),
  settlementStatus: varchar('settlement_status', { length: 30 }).notNull().default('NOT_SETTLED'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  settledAt: timestamp('settled_at', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const paymentProviderEvents = pgTable('payment_provider_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerEventId: varchar('provider_event_id', { length: 100 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').notNull().default(false),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});

export const paymentReconciliations = pgTable('payment_reconciliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => payments.id),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerReference: varchar('provider_reference', { length: 100 }).notNull(),
  providerAmount: numeric('provider_amount', { precision: 18, scale: 4 }).notNull(),
  systemAmount: numeric('system_amount', { precision: 18, scale: 4 }).notNull(),
  status: varchar('status', { length: 30 }).notNull(),
  discrepancyDetails: jsonb('discrepancy_details'),
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }).notNull().defaultNow(),
  reconciledBy: uuid('reconciled_by'),
});

// ================================================================
// 9. FINANCE & TRUE DOUBLE-ENTRY ACCOUNTING
// ================================================================

export const expenseCategories = pgTable('expense_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').notNull().references(() => expenseCategories.id),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(),
  receiptUrl: text('receipt_url'),
  description: text('description').notNull(),
  incurredAt: timestamp('incurred_at', { withTimezone: true }).notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const receivables = pgTable('receivables', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  saleId: uuid('sale_id').notNull().references(() => sales.id),
  originalAmount: numeric('original_amount', { precision: 18, scale: 4 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  remainingAmount: numeric('remaining_amount', { precision: 18, scale: 4 }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('OPEN'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const receivablePayments = pgTable('receivable_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  receivableId: uuid('receivable_id').notNull().references(() => receivables.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(),
  referenceNumber: varchar('reference_number', { length: 50 }),
  recordedBy: uuid('recorded_by').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payables = pgTable('payables', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id').notNull(),
  purchaseId: uuid('purchase_id').notNull(),
  originalAmount: numeric('original_amount', { precision: 18, scale: 4 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  remainingAmount: numeric('remaining_amount', { precision: 18, scale: 4 }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('OPEN'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payablePayments = pgTable('payable_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  payableId: uuid('payable_id').notNull().references(() => payables.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(),
  referenceNumber: varchar('reference_number', { length: 50 }),
  recordedBy: uuid('recorded_by').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accountingPeriods = pgTable('accounting_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('OPEN'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: uuid('closed_by'),
});

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id),
  entryNumber: varchar('entry_number', { length: 50 }).notNull(),
  entryDate: date('entry_date').notNull(),
  description: text('description').notNull(),
  sourceType: varchar('source_type', { length: 30 }).notNull(),
  sourceId: uuid('source_id'),
  isPosted: boolean('is_posted').notNull().default(true),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const journalEntryLines = pgTable('journal_entry_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  description: text('description'),
  debit: numeric('debit', { precision: 18, scale: 4 }).notNull().default('0'),
  credit: numeric('credit', { precision: 18, scale: 4 }).notNull().default('0'),
});

// ================================================================
// 10. SUPPLIERS & PURCHASES
// ================================================================

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  contactPerson: varchar('contact_person', { length: 100 }),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 100 }),
  address: jsonb('address'),
  taxId: varchar('tax_id', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
  poNumber: varchar('po_number', { length: 50 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
  subtotal: numeric('subtotal', { precision: 18, scale: 4 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  expectedDate: date('expected_date'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  orderedQuantity: numeric('ordered_quantity', { precision: 18, scale: 4 }).notNull(),
  receivedQuantity: numeric('received_quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  subtotal: numeric('subtotal', { precision: 18, scale: 4 }).notNull(),
});

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  subtotal: numeric('subtotal', { precision: 18, scale: 4 }).notNull(),
  taxAmount: numeric('tax_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  totalAmount: numeric('total_amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  isCredit: boolean('is_credit').notNull().default(false),
  dueDate: timestamp('due_date', { withTimezone: true }),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  receivedBy: uuid('received_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseItems = pgTable('purchase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseId: uuid('purchase_id').notNull().references(() => purchases.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id),
  variantId: uuid('variant_id').references(() => productVariants.id),
  quantity: numeric('quantity', { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 18, scale: 4 }).notNull(),
  subtotal: numeric('subtotal', { precision: 18, scale: 4 }).notNull(),
});

// ================================================================
// 11. SUBSCRIPTIONS & ENTITLEMENTS
// ================================================================

export const plans = pgTable('plans', {
  id: varchar('id', { length: 50 }).primaryKey(),
  tier: varchar('tier', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
});

export const planPrices = pgTable('plan_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: varchar('plan_id', { length: 50 }).notNull().references(() => plans.id, { onDelete: 'cascade' }),
  countryId: varchar('country_id', { length: 50 }).notNull().references(() => countries.id),
  currency: varchar('currency', { length: 3 }).notNull().references(() => currencies.code),
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  billingInterval: varchar('billing_interval', { length: 20 }).notNull(),
  taxBehavior: varchar('tax_behavior', { length: 20 }).notNull().default('EXCLUSIVE'),
  isActive: boolean('is_active').notNull().default(true),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  planId: varchar('plan_id', { length: 50 }).notNull().references(() => plans.id),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ================================================================
// 12. MACHINE LEARNING & GROUNDED AI INSIGHTS
// ================================================================

export const mlModels = pgTable('ml_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  version: varchar('version', { length: 30 }).notNull(),
  modelType: varchar('model_type', { length: 50 }).notNull(),
  featureSchema: jsonb('feature_schema').notNull().default({}),
  trainingDataStart: timestamp('training_data_start', { withTimezone: true }).notNull(),
  trainingDataEnd: timestamp('training_data_end', { withTimezone: true }).notNull(),
  metrics: jsonb('metrics').notNull().default({}),
  status: varchar('status', { length: 20 }).notNull().default('VALIDATED'),
  artifactReference: text('artifact_reference').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mlPredictions = pgTable('ml_predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id),
  modelId: uuid('model_id').notNull().references(() => mlModels.id),
  predictionType: varchar('prediction_type', { length: 50 }).notNull(),
  target: varchar('target', { length: 100 }).notNull(),
  prediction: text('prediction').notNull(),
  lowerBound: numeric('lower_bound', { precision: 18, scale: 4 }),
  upperBound: numeric('upper_bound', { precision: 18, scale: 4 }),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  sourceDataRange: jsonb('source_data_range').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const anomalyEvents = pgTable('anomaly_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  expectedValue: numeric('expected_value', { precision: 18, scale: 4 }).notNull(),
  actualValue: numeric('actual_value', { precision: 18, scale: 4 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  notes: text('notes'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiInsights = pgTable('ai_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  insightType: varchar('insight_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  summary: text('summary').notNull(),
  dataPeriod: jsonb('data_period').notNull(),
  metricsSnapshot: jsonb('metrics_snapshot').notNull(),
  promptTemplateVersion: varchar('prompt_template_version', { length: 20 }).notNull(),
  modelUsed: varchar('model_used', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ================================================================
// 13. AUDIT LOGS, NOTIFICATIONS & IDEMPOTENCY
// ================================================================

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  userId: uuid('user_id'),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 100 }).notNull(),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  requestId: varchar('request_id', { length: 100 }).notNull(),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('CREATED'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull().references(() => businesses.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 64 }).notNull(),
  scope: varchar('scope', { length: 50 }).notNull(),
  requestPayloadHash: varchar('request_payload_hash', { length: 64 }).notNull(),
  responsePayload: jsonb('response_payload'),
  statusCode: integer('status_code'),
  lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
