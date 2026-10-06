import BigNumber from 'bignumber.js';
import { toBN } from '@padupos/shared';
import { domainStore } from '../domainStore.js';

/**
 * Balance Sheet derivation.
 *
 * Accounting treatment
 * --------------------
 *   Assets                = SUM(net ASSET accounts)                  (debit - credit)
 *   Liabilities           = SUM(net LIABILITY accounts)               (credit - debit)
 *   Equity (accounts)     = SUM(net EQUITY accounts)                  (credit - debit)
 *   Current Period Earnings = SUM(net REVENUE accounts) - SUM(net EXPENSE accounts)
 *   Equity (total)        = Equity (accounts) + Current Period Earnings
 *
 * Invariant asserted on every call:
 *   Assets === Liabilities + Equity
 *
 * Because REVENUE and EXPENSE accounts are closed into Current Period Earnings,
 * a business with trading activity still satisfies the equation. A previous
 * implementation omitted revenue and expense accounts entirely, which made the
 * balance sheet report `balanced: false` for any business that had ever sold
 * anything, and silently dropped Current Period Earnings.
 *
 * Source of truth
 * ---------------
 * Posted journal entries only, joined to the business's own accounts. This is the
 * same ledger the Trial Balance endpoint reads, so the two must always agree.
 * Unposted entries are excluded.
 */

export interface BalanceSheetLine {
  code: string;
  name: string;
  type: string;
  amount: string;
}

export interface BalanceSheetResponse {
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  currentPeriodEarnings: {
    revenue: string;
    expenses: string;
    net: string;
  };
  totals: {
    assets: string;
    liabilities: string;
    equity: string;
    retainedEquity: string;
    currentPeriodEarnings: string;
    liabilitiesPlusEquity: string;
  };
  balanceCheck: {
    balanced: boolean;
    difference: string;
  };
  /** Projected Assets == Liabilities + Equity line, for reporting clarity. */
  reportingEquation: {
    label: string;
    left: string;
    right: string;
    difference: string;
    satisfied: boolean;
  };
}

interface AccumulatedAccount {
  code: string;
  name: string;
  type: string;
  debit: BigNumber;
  credit: BigNumber;
}

function accumulatePostedBalances(businessId: string): Map<string, AccumulatedAccount> {
  const balances = new Map<string, AccumulatedAccount>();

  for (const entry of domainStore.journalEntries.values()) {
    if (entry.businessId !== businessId || !entry.isPosted) continue;

    const lines = domainStore.journalLines.get(entry.id);
    if (!lines) continue;

    for (const line of lines) {
      const account = domainStore.accounts.get(line.accountId);
      if (!account || account.businessId !== businessId) continue;

      let accumulated = balances.get(account.id);
      if (!accumulated) {
        accumulated = {
          code: account.code,
          name: account.name,
          type: account.type,
          debit: new BigNumber(0),
          credit: new BigNumber(0),
        };
        balances.set(account.id, accumulated);
      }

      accumulated.debit = accumulated.debit.plus(toBN(line.debit));
      accumulated.credit = accumulated.credit.plus(toBN(line.credit));
    }
  }

  return balances;
}

function netBalance(account: AccumulatedAccount): BigNumber {
  // Natural balance side per account type.
  switch (account.type) {
    case 'ASSET':
    case 'EXPENSE':
      return account.debit.minus(account.credit);
    case 'LIABILITY':
    case 'EQUITY':
    case 'REVENUE':
      return account.credit.minus(account.debit);
    default:
      return new BigNumber(0);
  }
}

function toLine(account: AccumulatedAccount, amount: BigNumber): BalanceSheetLine {
  return {
    code: account.code,
    name: account.name,
    type: account.type,
    amount: amount.toFixed(4),
  };
}

export function buildBalanceSheet(businessId: string): BalanceSheetResponse {
  const balances = accumulatePostedBalances(businessId);

  const assets: BalanceSheetLine[] = [];
  const liabilities: BalanceSheetLine[] = [];
  const equityAccounts: BalanceSheetLine[] = [];

  let totalAssets = new BigNumber(0);
  let totalLiabilities = new BigNumber(0);
  let totalRetainedEquity = new BigNumber(0);
  let totalRevenue = new BigNumber(0);
  let totalExpenses = new BigNumber(0);

  for (const account of balances.values()) {
    const amount = netBalance(account);

    // Activity-based presentation: an account that nets to exactly zero carries no
    // balance-sheet information. Negative (contra) balances ARE reported.
    if (amount.isZero()) continue;

    if (account.type === 'ASSET') {
      assets.push(toLine(account, amount));
      totalAssets = totalAssets.plus(amount);
    } else if (account.type === 'LIABILITY') {
      liabilities.push(toLine(account, amount));
      totalLiabilities = totalLiabilities.plus(amount);
    } else if (account.type === 'EQUITY') {
      equityAccounts.push(toLine(account, amount));
      totalRetainedEquity = totalRetainedEquity.plus(amount);
    } else if (account.type === 'REVENUE') {
      // Contra-revenue (e.g. 4020 Sales Discounts) posts on the debit side and
      // therefore nets to a negative revenue, which is the correct treatment.
      totalRevenue = totalRevenue.plus(amount);
    } else if (account.type === 'EXPENSE') {
      totalExpenses = totalExpenses.plus(amount);
    }
  }

  const sortByCode = (a: BalanceSheetLine, b: BalanceSheetLine) => a.code.localeCompare(b.code);
  assets.sort(sortByCode);
  liabilities.sort(sortByCode);
  equityAccounts.sort(sortByCode);

  const currentPeriodEarnings = totalRevenue.minus(totalExpenses);
  const totalEquity = totalRetainedEquity.plus(currentPeriodEarnings);
  const liabilitiesPlusEquity = totalLiabilities.plus(totalEquity);
  const difference = totalAssets.minus(liabilitiesPlusEquity);

  return {
    assets,
    liabilities,
    equity: equityAccounts,
    currentPeriodEarnings: {
      revenue: totalRevenue.toFixed(4),
      expenses: totalExpenses.toFixed(4),
      net: currentPeriodEarnings.toFixed(4),
    },
    totals: {
      assets: totalAssets.toFixed(4),
      liabilities: totalLiabilities.toFixed(4),
      equity: totalEquity.toFixed(4),
      retainedEquity: totalRetainedEquity.toFixed(4),
      currentPeriodEarnings: currentPeriodEarnings.toFixed(4),
      liabilitiesPlusEquity: liabilitiesPlusEquity.toFixed(4),
    },
    balanceCheck: {
      balanced: difference.isZero(),
      difference: difference.toFixed(4),
    },
    reportingEquation: {
      label: 'Assets = Liabilities + Equity',
      left: totalAssets.toFixed(4),
      right: liabilitiesPlusEquity.toFixed(4),
      difference: difference.toFixed(4),
      satisfied: difference.isZero(),
    },
  };
}