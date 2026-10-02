# PADUPOS — Financial & Double-Entry Accounting Rules

## 1. Pure Decimal Arithmetic

All financial arithmetic is conducted via arbitrary-precision decimal libraries (`bignumber.js` in TypeScript, `Decimal` in Python, `NUMERIC(15,4)` in PostgreSQL). IEEE 754 floating-point operations (`+`, `-`, `*`, `/`) are strictly prohibited in financial paths to prevent rounding drift.

---

## 2. Standard Chart of Accounts (COA)

Every business onboarded to PADUPOS receives an automated, industry-standard Chart of Accounts:

| Account Code | Account Name | Type | Normal Balance |
| :--- | :--- | :--- | :--- |
| **1010** | Cash on Hand | ASSET | DEBIT |
| **1020** | Bank Account | ASSET | DEBIT |
| **1040** | Accounts Receivable | ASSET | DEBIT |
| **1050** | Merchandise Inventory | ASSET | DEBIT |
| **2010** | Accounts Payable | LIABILITY | CREDIT |
| **2020** | Sales Tax Payable | LIABILITY | CREDIT |
| **3010** | Owner's Capital | EQUITY | CREDIT |
| **3020** | Retained Earnings | EQUITY | CREDIT |
| **4010** | Sales Revenue | REVENUE | CREDIT |
| **4020** | Sales Discounts | REVENUE (Contra) | DEBIT |
| **5010** | Cost of Goods Sold (COGS) | EXPENSE | DEBIT |
| **6010** | Operational Expense | EXPENSE | DEBIT |

---

## 3. Double-Entry Posting Matrix

Every operational event generates an immutable, balanced journal entry where:

$$\sum \text{Debits} = \sum \text{Credits}$$

### A. Cash Sale with Tax & COGS
- **Debit** 1010 Cash on Hand (Total amount paid)
- **Credit** 4010 Sales Revenue (Net sales before tax)
- **Credit** 2020 Sales Tax Payable (Tax portion, if applicable)
- **Debit** 5010 Cost of Goods Sold (Total COGS at WAC cost)
- **Credit** 1050 Merchandise Inventory (Inventory valuation reduction)

### B. Credit Sale (Accounts Receivable)
- **Debit** 1040 Accounts Receivable (Gross order total)
- **Credit** 4010 Sales Revenue (Net sales)
- **Credit** 2020 Sales Tax Payable (Tax portion)
- **Debit** 5010 Cost of Goods Sold (COGS)
- **Credit** 1050 Merchandise Inventory (Inventory reduction)

### C. Cash Inventory Purchase
- **Debit** 1050 Merchandise Inventory (Total purchase cost)
- **Credit** 1010 Cash on Hand (Disbursed cash)

### D. Credit Inventory Purchase (Accounts Payable)
- **Debit** 1050 Merchandise Inventory (Total purchase cost)
- **Credit** 2010 Accounts Payable (Supplier debt liability)

### E. Operational Expense
- **Debit** 6010 Operational Expense (Expense amount)
- **Credit** 1010 Cash on Hand (Disbursed cash)

### F. Debt Collections & Disbursements
- **Receivable Payment**: Debit 1010 Cash on Hand, Credit 1040 Accounts Receivable.
- **Payable Disbursement**: Debit 2010 Accounts Payable, Credit 1010 Cash on Hand.

---

## 4. Financial Statements (Derived from Actual Ledger)

### Profit & Loss Statement
$$\text{Gross Profit} = \text{Net Revenue} - \text{COGS}$$
$$\text{Operating Profit} = \text{Gross Profit} - \text{Operating Expenses}$$

### Direct Cash Flow Statement
$$\text{Net Cash Flow} = (\text{Cash Sales} + \text{Debt Collections}) - (\text{Cash Purchases} + \text{Supplier Disbursements} + \text{Cash Expenses})$$
