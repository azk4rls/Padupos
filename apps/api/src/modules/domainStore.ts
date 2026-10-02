import type {
  Business,
  Branch,
  BusinessMember,
  Product,
  ProductCategory,
  ProductPrice,
  Recipe,
  Inventory,
  InventoryMovement,
  Customer,
  CashSession,
  CashMovement,
  Sale,
  SaleItem,
  Return,
  Payment,
  PaymentReconciliation,
  Expense,
  ExpenseCategory,
  Receivable,
  Payable,
  Supplier,
  Purchase,
  PurchaseOrder,
  Account,
  AccountingPeriod,
  JournalEntry,
  JournalEntryLine,
  Subscription,
  MLPrediction,
  AIInsight,
  AuditLog,
} from '@padupos/types';
import { DEFAULT_CHART_OF_ACCOUNTS } from '@padupos/config';

// In-memory tenant data store for development, testing, and transactional simulation
class DomainStore {
  public businesses = new Map<string, Business>();
  public branches = new Map<string, Branch>();
  public members = new Map<string, BusinessMember>();
  public categories = new Map<string, ProductCategory>();
  public products = new Map<string, Product>();
  public prices = new Map<string, ProductPrice>();
  public recipes = new Map<string, Recipe>();
  public inventories = new Map<string, Inventory>(); // key: `${branchId}:${productId}:${variantId || ''}`
  public movements: InventoryMovement[] = [];
  public customers = new Map<string, Customer>();
  public cashSessions = new Map<string, CashSession>();
  public cashMovements: CashMovement[] = [];
  public sales = new Map<string, Sale>();
  public saleItems = new Map<string, SaleItem[]>();
  public returns = new Map<string, Return>();
  public payments = new Map<string, Payment>();
  public reconciliations: PaymentReconciliation[] = [];
  public expenseCategories = new Map<string, ExpenseCategory>();
  public expenses: Expense[] = [];
  public receivables = new Map<string, Receivable>();
  public payables = new Map<string, Payable>();
  public suppliers = new Map<string, Supplier>();
  public purchaseOrders = new Map<string, PurchaseOrder>();
  public purchases = new Map<string, Purchase>();
  public accounts = new Map<string, Account>();
  public accountingPeriods = new Map<string, AccountingPeriod>();
  public journalEntries = new Map<string, JournalEntry>();
  public journalLines = new Map<string, JournalEntryLine[]>();
  public subscriptions = new Map<string, Subscription>();
  public mlPredictions: MLPrediction[] = [];
  public aiInsights: AIInsight[] = [];
  public auditLogs: AuditLog[] = [];
  public idempotencyKeys = new Map<string, { payloadHash: string; response: Record<string, unknown>; statusCode: number }>();

  public initializeDefaultAccounts(businessId: string, currency: string) {
    for (const def of DEFAULT_CHART_OF_ACCOUNTS) {
      const id = `acc_${businessId}_${def.code}`;
      if (!this.accounts.has(id)) {
        this.accounts.set(id, {
          id,
          businessId,
          code: def.code,
          name: def.name,
          type: def.type,
          currency,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  public isDateInClosedPeriod(businessId: string, dateStr: string): boolean {
    const date = dateStr.split('T')[0];
    for (const p of this.accountingPeriods.values()) {
      if (p.businessId === businessId && p.status === 'CLOSED') {
        if (date >= p.startDate && date <= p.endDate) {
          return true;
        }
      }
    }
    return false;
  }

  public clearAll() {
    this.businesses.clear();
    this.branches.clear();
    this.members.clear();
    this.categories.clear();
    this.products.clear();
    this.prices.clear();
    this.recipes.clear();
    this.inventories.clear();
    this.movements = [];
    this.customers.clear();
    this.cashSessions.clear();
    this.cashMovements = [];
    this.sales.clear();
    this.saleItems.clear();
    this.returns.clear();
    this.payments.clear();
    this.reconciliations = [];
    this.expenseCategories.clear();
    this.expenses = [];
    this.receivables.clear();
    this.payables.clear();
    this.suppliers.clear();
    this.purchaseOrders.clear();
    this.purchases.clear();
    this.accounts.clear();
    this.accountingPeriods.clear();
    this.journalEntries.clear();
    this.journalLines.clear();
    this.subscriptions.clear();
    this.mlPredictions = [];
    this.aiInsights = [];
    this.auditLogs = [];
    this.idempotencyKeys.clear();
  }
}

export const domainStore = new DomainStore();
