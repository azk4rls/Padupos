# PADUPOS — Database Schema Specification

## 1. Relational Design Principles

The database schema is written in PostgreSQL 15+ syntax, utilizing:
- **`NUMERIC(15,4)`**: Mandatory for all monetary values, unit costs, tax amounts, and stock quantities. Never `FLOAT` or `REAL`.
- **`TIMESTAMPTZ`**: All timestamps are UTC-aware ISO-8601 timestamps.
- **`UUID` & Prefixed IDs**: Foreign keys enforce strict referential integrity.
- **Row Level Security (RLS)**: Automated row filtering by tenant session context `app.current_business_id`.

---

## 2. Table Catalog

### A. Global & Reference Domain
- `countries`: ISO-3166 definitions (`country_code`, `iso3`, `default_currency`, `default_locale`, `default_timezone`, `tax_system_type`, `number_format`).
- `currencies`: ISO-4217 definitions (`code`, `name`, `symbol`, `fraction_digits`).

### B. Tenancy, Identity & Access Control
- `profiles`: User identity details mapped to Supabase Auth (`id`, `name`, `phone`, `locale`, `timezone`).
- `businesses`: Primary tenant entity (`id`, `owner_user_id`, `name`, `business_type`, `country_id`, `base_currency`, `tax_identifier`).
- `branches`: Physical store locations (`id`, `business_id`, `name`, `code`, `address`, `phone`, `is_main`).
- `business_members`: Membership table linking users to businesses (`business_id`, `user_id`, `role`, `status`).
- `roles` & `permissions`: Granular capability matrix (`pos.use`, `finance.view`, `inventory.manage`, etc.).

### C. Catalog & Pricing Domain
- `categories`: Product classifications (`id`, `business_id`, `name`, `parent_id`).
- `products`: Sellable items (`id`, `business_id`, `category_id`, `name`, `sku`, `barcode`, `base_price`, `cost_price`, `pricing_model`, `track_inventory`).
- `product_variants`: Optional size/color/type combinations with SKU and price overrides.
- `product_ingredients`: Recipe/BOM mapping for F&B production (`product_id`, `ingredient_product_id`, `quantity`, `unit`).

### D. Inventory & Costing Domain
- `inventory`: Stock records per product per branch (`id`, `business_id`, `branch_id`, `product_id`, `quantity`, `allocated_quantity`, `reorder_point`, `min_stock_level`).
- `inventory_movements`: Immutable stock ledger (`id`, `movement_type`, `quantity`, `unit_cost`, `total_cost`, `reference_type`, `reference_id`).
- `inventory_audits`: Physical cycle counting & discrepancy reconciliation (`id`, `status`, `counted_by`, `reconciled_at`).
- `inventory_audit_items`: Item-level expected vs counted physical inventory.

### E. Point of Sale & Sessions Domain
- `cash_sessions`: Register drawer shifts (`id`, `cashier_user_id`, `branch_id`, `opening_cash`, `closing_cash_counted`, `expected_cash`, `difference`, `status`).
- `cash_movements`: Cash In / Cash Out drawer adjustments (`cash_session_id`, `movement_type`, `amount`, `reason`).
- `sales`: Order records (`id`, `invoice_number`, `branch_id`, `cashier_id`, `customer_id`, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `cogs_amount`, `status`).
- `sale_items`: Line items with snapshot unit price, cost price, and applied taxes.
- `returns`: Return vouchers (`id`, `sale_id`, `refund_amount`, `reason`, `status`).
- `return_items`: Returned items with inventory restock flags.

### F. Payments & Invoicing Domain
- `payments`: Transaction ledger (`id`, `sale_id`, `payment_method`, `provider`, `amount`, `status`, `gateway_transaction_id`).
- `payment_methods`: Configured payment options per business/branch (CASH, CARD, QRIS, BANK_TRANSFER).
- `payment_gateway_configs`: Non-custodial sandbox/production credentials for payment aggregators (Midtrans, Xendit, Stripe).

### G. Double-Entry Accounting Domain
- `chart_of_accounts`: Standardized template (`account_code`, `account_name`, `account_type`, `normal_balance`).
- `accounts`: Tenant-specific COA (`id`, `business_id`, `code`, `name`, `type`, `normal_balance`, `current_balance`).
- `journal_entries`: Transaction journals (`id`, `business_id`, `entry_number`, `entry_date`, `source_type`, `source_id`, `is_posted`).
- `journal_entry_lines`: Debit and Credit legs (`journal_entry_id`, `account_id`, `debit`, `credit`).

### H. Receivables, Payables & Procurement
- `suppliers`: Supplier directory (`id`, `business_id`, `name`, `contact_name`, `email`, `phone`).
- `purchases`: Purchase orders & incoming stock (`id`, `supplier_id`, `invoice_number`, `subtotal`, `total_amount`, `is_credit`, `due_date`).
- `purchase_items`: Purchased line items with received quantities and purchase costs.
- `receivables`: Customer debt ledger (`id`, `sale_id`, `customer_id`, `original_amount`, `paid_amount`, `remaining_amount`, `status`, `due_date`).
- `payables`: Supplier debt ledger (`id`, `purchase_id`, `supplier_id`, `original_amount`, `paid_amount`, `remaining_amount`, `status`, `due_date`).

### I. Operations, Analytics & Offline Sync
- `idempotency_keys`: Strict deduplication store (`key`, `scope`, `business_id`, `request_payload_hash`, `response_payload`).
- `offline_sync_queue`: Device synchronization mutations (`device_id`, `branch_id`, `operation`, `payload`, `status`).
- `ml_predictions`: Cached ML predictions with status and confidence intervals (`business_id`, `model_type`, `prediction_data`).
- `anomaly_events`: Flagged fraud/outlier events (`business_id`, `anomaly_type`, `severity`, `reference_id`, `metric_value`).
- `audit_logs`: Immutable trail of critical actions (`business_id`, `user_id`, `action`, `entity_type`, `entity_id`, `metadata`).
