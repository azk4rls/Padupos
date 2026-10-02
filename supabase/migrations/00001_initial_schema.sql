-- ================================================================
-- PADUPOS — Complete Database Schema & Multi-Tenant RLS Policies
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 1. GLOBAL & REFERENCE TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS countries (
    id VARCHAR(50) PRIMARY KEY,
    country_code VARCHAR(2) NOT NULL UNIQUE,
    iso3 VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    default_currency VARCHAR(3) NOT NULL,
    default_locale VARCHAR(10) NOT NULL,
    default_timezone VARCHAR(50) NOT NULL,
    tax_system_type VARCHAR(20) NOT NULL DEFAULT 'VAT',
    date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    number_format JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS currencies (
    code VARCHAR(3) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    fraction_digits INT NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 2. IDENTITY, TENANCY & RBAC
-- ================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- Maps to auth.users.id
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    avatar_url TEXT,
    locale VARCHAR(10) NOT NULL DEFAULT 'id-ID',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    legal_name VARCHAR(150),
    business_type VARCHAR(50) NOT NULL DEFAULT 'RETAIL',
    country_id VARCHAR(50) NOT NULL REFERENCES countries(id),
    base_currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    display_currency VARCHAR(3) REFERENCES currencies(code),
    locale VARCHAR(10) NOT NULL DEFAULT 'id-ID',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    fiscal_year_start_month INT NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    tax_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, -- NULL for system roles
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED')),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, user_id)
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    address JSONB,
    phone VARCHAR(30),
    timezone VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, code)
);

-- ================================================================
-- 3. PRODUCTS, RECIPES & PRICING
-- ================================================================

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    localized_names JSONB DEFAULT '{}'::jsonb,
    sku VARCHAR(50),
    barcode VARCHAR(50),
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    description TEXT,
    cost_method VARCHAR(20) NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, sku),
    UNIQUE(business_id, barcode)
);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sku VARCHAR(50),
    barcode VARCHAR(50),
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    cost_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    selling_price NUMERIC(18, 4) NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    yield_quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
    yield_unit VARCHAR(20) NOT NULL DEFAULT 'portion',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_product_id UUID NOT NULL REFERENCES products(id),
    ingredient_variant_id UUID REFERENCES product_variants(id),
    quantity NUMERIC(18, 4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    waste_factor_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0
);

-- ================================================================
-- 4. TAX ENGINE
-- ================================================================

CREATE TABLE IF NOT EXISTS tax_regimes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id VARCHAR(50) NOT NULL REFERENCES countries(id),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS tax_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tax_regime_id UUID NOT NULL REFERENCES tax_regimes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    rate_percentage NUMERIC(7, 4) NOT NULL, -- e.g. 11.0000 or 9.0000
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    is_inclusive_default BOOLEAN NOT NULL DEFAULT FALSE
);

-- ================================================================
-- 5. INVENTORY & WAC MOVEMENTS
-- ================================================================

CREATE TABLE IF NOT EXISTS inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    available_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    average_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
    minimum_stock NUMERIC(18, 4) NOT NULL DEFAULT 0,
    maximum_stock NUMERIC(18, 4),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(branch_id, product_id, variant_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    unit_cost NUMERIC(18, 4) NOT NULL,
    total_cost NUMERIC(18, 4) NOT NULL,
    reference_type VARCHAR(30) NOT NULL,
    reference_id UUID NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    previous_quantity NUMERIC(18, 4) NOT NULL,
    adjusted_quantity NUMERIC(18, 4) NOT NULL,
    reason TEXT NOT NULL,
    unit_cost NUMERIC(18, 4) NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    source_branch_id UUID NOT NULL REFERENCES branches(id),
    destination_branch_id UUID NOT NULL REFERENCES branches(id),
    reference_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
    requested_by UUID NOT NULL,
    received_by UUID,
    shipped_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, reference_number)
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    quantity NUMERIC(18, 4) NOT NULL,
    unit_cost NUMERIC(18, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_opnames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id),
    reference_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'COUNT', 'REVIEW', 'APPLIED', 'CLOSED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    reviewed_by UUID,
    notes TEXT,
    UNIQUE(business_id, reference_number)
);

CREATE TABLE IF NOT EXISTS stock_opname_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opname_id UUID NOT NULL REFERENCES stock_opnames(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    system_quantity NUMERIC(18, 4) NOT NULL,
    physical_quantity NUMERIC(18, 4) NOT NULL,
    difference_quantity NUMERIC(18, 4) NOT NULL,
    unit_cost NUMERIC(18, 4) NOT NULL,
    notes TEXT
);

-- ================================================================
-- 6. CUSTOMERS
-- ================================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(100),
    address JSONB,
    tax_id VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 7. POS, SALES & CASHIER SESSIONS
-- ================================================================

CREATE TABLE IF NOT EXISTS cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cashier_user_id UUID NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_cash NUMERIC(18, 4) NOT NULL,
    cash_sales NUMERIC(18, 4) NOT NULL DEFAULT 0,
    cash_expenses NUMERIC(18, 4) NOT NULL DEFAULT 0,
    cash_in NUMERIC(18, 4) NOT NULL DEFAULT 0,
    cash_out NUMERIC(18, 4) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(18, 4) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(18, 4),
    difference NUMERIC(18, 4),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('IN', 'OUT', 'EXPENSE')),
    amount NUMERIC(18, 4) NOT NULL,
    reason TEXT NOT NULL,
    performed_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cash_session_id UUID REFERENCES cash_sessions(id),
    customer_id UUID REFERENCES customers(id),
    invoice_number VARCHAR(50) NOT NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'COMPLETED', 'CANCELLED', 'REFUND_REQUESTED', 'REFUNDED')),
    subtotal NUMERIC(18, 4) NOT NULL,
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    fee_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18, 4) NOT NULL,
    cogs_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    gross_profit_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    tax_snapshot JSONB,
    notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    quantity NUMERIC(18, 4) NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL,
    unit_cost NUMERIC(18, 4) NOT NULL,
    subtotal NUMERIC(18, 4) NOT NULL,
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total NUMERIC(18, 4) NOT NULL,
    cogs_total NUMERIC(18, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id),
    reference_number VARCHAR(50) NOT NULL,
    refund_amount NUMERIC(18, 4) NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, reference_number)
);

CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES sale_items(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity NUMERIC(18, 4) NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL,
    refund_subtotal NUMERIC(18, 4) NOT NULL,
    restock_to_inventory BOOLEAN NOT NULL DEFAULT TRUE
);

-- ================================================================
-- 8. PAYMENT DOMAIN (NON-CUSTODIAL)
-- ================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id),
    provider VARCHAR(50) NOT NULL,
    provider_payment_id VARCHAR(100),
    provider_reference VARCHAR(100),
    method VARCHAR(30) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    exchange_rate NUMERIC(18, 6),
    base_amount NUMERIC(18, 4),
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED')),
    settlement_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SETTLED' CHECK (settlement_status IN ('NOT_SETTLED', 'SETTLEMENT_PENDING', 'SETTLED', 'RECONCILIATION_REQUIRED')),
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_provider_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS payment_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id),
    provider VARCHAR(50) NOT NULL,
    provider_reference VARCHAR(100) NOT NULL,
    provider_amount NUMERIC(18, 4) NOT NULL,
    system_amount NUMERIC(18, 4) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('MATCHED', 'MISMATCH', 'MISSING', 'DUPLICATE', 'REVIEW')),
    discrepancy_details JSONB,
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reconciled_by UUID
);

-- ================================================================
-- 9. FINANCE & TRUE DOUBLE-ENTRY ACCOUNTING
-- ================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    category_id UUID NOT NULL REFERENCES expense_categories(id),
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    payment_method VARCHAR(30) NOT NULL,
    receipt_url TEXT,
    description TEXT NOT NULL,
    incurred_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receivables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    sale_id UUID NOT NULL REFERENCES sales(id),
    original_amount NUMERIC(18, 4) NOT NULL,
    paid_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(18, 4) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receivable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    receivable_id UUID NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
    amount NUMERIC(18, 4) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    reference_number VARCHAR(50),
    recorded_by UUID NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL,
    purchase_id UUID NOT NULL,
    original_amount NUMERIC(18, 4) NOT NULL,
    paid_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(18, 4) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payable_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    payable_id UUID NOT NULL REFERENCES payables(id) ON DELETE CASCADE,
    amount NUMERIC(18, 4) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    reference_number VARCHAR(50),
    recorded_by UUID NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, code)
);

CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
    closed_at TIMESTAMPTZ,
    closed_by UUID,
    UNIQUE(business_id, name)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    entry_number VARCHAR(50) NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    source_type VARCHAR(30) NOT NULL,
    source_id UUID,
    is_posted BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, entry_number)
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    description TEXT,
    debit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    credit NUMERIC(18, 4) NOT NULL DEFAULT 0,
    CHECK (debit >= 0 AND credit >= 0),
    CHECK ((debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0))
);

-- ================================================================
-- 10. SUPPLIERS & PURCHASES
-- ================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(30),
    email VARCHAR(100),
    address JSONB,
    tax_id VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    po_number VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED')),
    subtotal NUMERIC(18, 4) NOT NULL,
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    expected_date DATE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, po_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    ordered_quantity NUMERIC(18, 4) NOT NULL,
    received_quantity NUMERIC(18, 4) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(18, 4) NOT NULL,
    subtotal NUMERIC(18, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    invoice_number VARCHAR(50) NOT NULL,
    subtotal NUMERIC(18, 4) NOT NULL,
    tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    is_credit BOOLEAN NOT NULL DEFAULT FALSE,
    due_date TIMESTAMPTZ,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    quantity NUMERIC(18, 4) NOT NULL,
    unit_cost NUMERIC(18, 4) NOT NULL,
    subtotal NUMERIC(18, 4) NOT NULL
);

-- ================================================================
-- 11. SUBSCRIPTIONS & ENTITLEMENTS
-- ================================================================

CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY,
    tier VARCHAR(20) NOT NULL UNIQUE CHECK (tier IN ('FREE', 'PRO', 'BUSINESS', 'ENTERPRISE')),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS plan_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id VARCHAR(50) NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    country_id VARCHAR(50) NOT NULL REFERENCES countries(id),
    currency VARCHAR(3) NOT NULL REFERENCES currencies(code),
    amount NUMERIC(18, 4) NOT NULL,
    billing_interval VARCHAR(20) NOT NULL CHECK (billing_interval IN ('MONTHLY', 'ANNUAL')),
    tax_behavior VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(plan_id, country_id, currency, billing_interval)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL REFERENCES plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('TRIAL', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED')),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 12. MACHINE LEARNING & GROUNDED AI INSIGHTS
-- ================================================================

CREATE TABLE IF NOT EXISTS ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    version VARCHAR(30) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    feature_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    training_data_start TIMESTAMPTZ NOT NULL,
    training_data_end TIMESTAMPTZ NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'VALIDATED' CHECK (status IN ('TRAINING', 'VALIDATED', 'ACTIVE', 'RETIRED', 'FAILED')),
    artifact_reference TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(name, version)
);

CREATE TABLE IF NOT EXISTS ml_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    model_id UUID NOT NULL REFERENCES ml_models(id),
    prediction_type VARCHAR(50) NOT NULL,
    target VARCHAR(100) NOT NULL,
    prediction TEXT NOT NULL,
    lower_bound NUMERIC(18, 4),
    upper_bound NUMERIC(18, 4),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    source_data_range JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomaly_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    expected_value NUMERIC(18, 4) NOT NULL,
    actual_value NUMERIC(18, 4) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('NORMAL', 'UNUSUAL', 'SEVERE_UNUSUAL')),
    notes TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    summary TEXT NOT NULL,
    data_period JSONB NOT NULL,
    metrics_snapshot JSONB NOT NULL,
    prompt_template_version VARCHAR(20) NOT NULL,
    model_used VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'STALE', 'DISMISSED')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 13. AUDIT LOGS, NOTIFICATIONS & IDEMPOTENCY
-- ================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    request_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id UUID,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'READ', 'DELIVERED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    key VARCHAR(64) NOT NULL,
    scope VARCHAR(50) NOT NULL,
    request_payload_hash VARCHAR(64) NOT NULL,
    response_payload JSONB,
    status_code INT,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(business_id, scope, key)
);

-- ================================================================
-- 14. PERFORMANCE INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user ON business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_branches_business ON branches(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(business_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(business_id, barcode);
CREATE INDEX IF NOT EXISTS idx_inventories_branch ON inventories(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON inventory_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_branch ON sales(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(business_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(business_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business_id, incurred_at);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(business_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business ON audit_logs(business_id, created_at);

-- ================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================================

-- Helper function to extract user ID from Supabase auth JWT
CREATE OR REPLACE FUNCTION auth_uid() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper function to check if current user is member of a business
CREATE OR REPLACE FUNCTION is_business_member(target_business_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM business_members
        WHERE business_id = target_business_id
          AND user_id = auth_uid()
          AND status = 'ACTIVE'
    ) OR EXISTS (
        SELECT 1 FROM businesses
        WHERE id = target_business_id
          AND owner_user_id = auth_uid()
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Enable RLS on all tenant tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies:
-- 1. Businesses
CREATE POLICY businesses_tenant_isolation ON businesses
    FOR ALL
    USING (owner_user_id = auth_uid() OR is_business_member(id));

-- 2. Business Members
CREATE POLICY business_members_tenant_isolation ON business_members
    FOR ALL
    USING (is_business_member(business_id));

-- 3. Branches
CREATE POLICY branches_tenant_isolation ON branches
    FOR ALL
    USING (is_business_member(business_id));

-- 4. Products
CREATE POLICY products_tenant_isolation ON products
    FOR ALL
    USING (is_business_member(business_id));

-- 5. Inventories
CREATE POLICY inventories_tenant_isolation ON inventories
    FOR ALL
    USING (is_business_member(business_id));

-- 6. Sales
CREATE POLICY sales_tenant_isolation ON sales
    FOR ALL
    USING (is_business_member(business_id));

-- 7. Payments
CREATE POLICY payments_tenant_isolation ON payments
    FOR ALL
    USING (is_business_member(business_id));

-- 8. Expenses
CREATE POLICY expenses_tenant_isolation ON expenses
    FOR ALL
    USING (is_business_member(business_id));

-- 9. Accounts & Journals
CREATE POLICY accounts_tenant_isolation ON accounts
    FOR ALL
    USING (is_business_member(business_id));

CREATE POLICY journal_entries_tenant_isolation ON journal_entries
    FOR ALL
    USING (is_business_member(business_id));

-- 10. Audit Logs
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    FOR ALL
    USING (is_business_member(business_id));
