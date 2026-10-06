import BigNumber from 'bignumber.js';
import { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES } from '@padupos/config';

// Configure BigNumber for financial grade calculations
BigNumber.config({
  DECIMAL_PLACES: 4,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
  EXPONENTIAL_AT: [-10, 20],
});

export * from './offline';

// ================================================================
// 1. DECIMAL ARITHMETIC UTILITIES
// ================================================================

export function toBN(val: string | number | BigNumber): BigNumber {
  if (val instanceof BigNumber) return val;
  const str = typeof val === 'number' ? val.toString() : (val || '0');
  return new BigNumber(str);
}

export function formatDecimal(val: string | number | BigNumber, places = 2): string {
  return toBN(val).toFixed(places);
}

// ================================================================
// 2. POS CALCULATION ENGINE
// ================================================================

export interface CalculateLineInput {
  unitPrice: string | number;
  quantity: string | number;
  discountAmount?: string | number;
}

export interface LineCalculationResult {
  lineSubtotal: string;
  discountAmount: string;
  total: string;
}

export function calculateLineSubtotal(unitPrice: string | number, quantity: string | number): string {
  const price = toBN(unitPrice);
  const qty = toBN(quantity);
  return price.multipliedBy(qty).toFixed(4);
}

export function calculateLineItem(input: CalculateLineInput): LineCalculationResult {
  const subtotalBN = toBN(calculateLineSubtotal(input.unitPrice, input.quantity));
  const discountBN = toBN(input.discountAmount || 0);

  // Line discount cannot exceed line subtotal
  const effectiveDiscount = BigNumber.minimum(subtotalBN, discountBN);
  const totalBN = subtotalBN.minus(effectiveDiscount);

  return {
    lineSubtotal: subtotalBN.toFixed(4),
    discountAmount: effectiveDiscount.toFixed(4),
    total: totalBN.toFixed(4),
  };
}

export interface OrderCalculationInput {
  items: Array<{
    unitPrice: string | number;
    unitCost?: string | number;
    quantity: string | number;
    discountAmount?: string | number;
  }>;
  orderDiscountAmount?: string | number;
  taxRatePercentage?: string | number; // e.g. "11" for 11%
  isTaxInclusive?: boolean;
  feeAmount?: string | number;
}

export interface OrderCalculationResult {
  subtotal: string;
  itemsDiscountTotal: string;
  orderDiscount: string;
  netSubtotal: string; // after all discounts
  taxableAmount: string;
  taxAmount: string;
  feeAmount: string;
  grandTotal: string;
  totalCOGS: string;
  grossProfit: string;
  grossMarginPercentage: string;
  items: Array<{
    lineSubtotal: string;
    discountAmount: string;
    lineTotal: string;
    cogsTotal: string;
  }>;
}

export function calculateOrder(input: OrderCalculationInput): OrderCalculationResult {
  let subtotalSum = new BigNumber(0);
  let itemsDiscountSum = new BigNumber(0);
  let cogsSum = new BigNumber(0);

  const calculatedItems = input.items.map((item) => {
    const res = calculateLineItem(item);
    const lineTotalBN = toBN(res.total);
    const costBN = toBN(item.unitCost || 0);
    const itemCogsBN = costBN.multipliedBy(toBN(item.quantity));

    subtotalSum = subtotalSum.plus(toBN(res.lineSubtotal));
    itemsDiscountSum = itemsDiscountSum.plus(toBN(res.discountAmount));
    cogsSum = cogsSum.plus(itemCogsBN);

    return {
      lineSubtotal: res.lineSubtotal,
      discountAmount: res.discountAmount,
      lineTotal: res.total,
      cogsTotal: itemCogsBN.toFixed(4),
    };
  });

  const linesNetTotal = subtotalSum.minus(itemsDiscountSum);
  const orderDiscountBN = BigNumber.minimum(linesNetTotal, toBN(input.orderDiscountAmount || 0));
  const netSubtotal = linesNetTotal.minus(orderDiscountBN);

  const taxRate = toBN(input.taxRatePercentage || 0).dividedBy(100);
  const feesBN = toBN(input.feeAmount || 0);

  let taxAmountBN = new BigNumber(0);
  let taxableAmountBN = netSubtotal;
  let grandTotalBN = new BigNumber(0);

  if (input.isTaxInclusive) {
    // If tax inclusive: netSubtotal = base * (1 + rate)
    // base = netSubtotal / (1 + rate)
    // tax = netSubtotal - base
    if (taxRate.isGreaterThan(0)) {
      const divisor = new BigNumber(1).plus(taxRate);
      taxableAmountBN = netSubtotal.dividedBy(divisor);
      taxAmountBN = netSubtotal.minus(taxableAmountBN);
    }
    grandTotalBN = netSubtotal.plus(feesBN);
  } else {
    // If tax exclusive: tax = netSubtotal * rate
    taxAmountBN = netSubtotal.multipliedBy(taxRate);
    grandTotalBN = netSubtotal.plus(taxAmountBN).plus(feesBN);
  }

  // Gross profit = Net Revenue (excluding tax) - COGS
  const grossProfitBN = taxableAmountBN.minus(cogsSum);
  const grossMarginBN = taxableAmountBN.isGreaterThan(0)
    ? grossProfitBN.dividedBy(taxableAmountBN).multipliedBy(100)
    : new BigNumber(0);

  return {
    subtotal: subtotalSum.toFixed(4),
    itemsDiscountTotal: itemsDiscountSum.toFixed(4),
    orderDiscount: orderDiscountBN.toFixed(4),
    netSubtotal: netSubtotal.toFixed(4),
    taxableAmount: taxableAmountBN.toFixed(4),
    taxAmount: taxAmountBN.toFixed(4),
    feeAmount: feesBN.toFixed(4),
    grandTotal: grandTotalBN.toFixed(4),
    totalCOGS: cogsSum.toFixed(4),
    grossProfit: grossProfitBN.toFixed(4),
    grossMarginPercentage: grossMarginBN.toFixed(2),
    items: calculatedItems,
  };
}

// ================================================================
// 3. WEIGHTED AVERAGE COSTING (WAC) ENGINE
// ================================================================

export interface WACInput {
  oldQuantity: string | number;
  oldAverageCost: string | number;
  newQuantity: string | number;
  newUnitCost: string | number;
}

export function calculateWeightedAverageCost(input: WACInput): string {
  const oldQty = toBN(input.oldQuantity);
  const oldAvg = toBN(input.oldAverageCost);
  const newQty = toBN(input.newQuantity);
  const newCost = toBN(input.newUnitCost);

  if (newQty.isLessThanOrEqualTo(0)) {
    return oldAvg.toFixed(4);
  }

  const totalQty = oldQty.plus(newQty);
  if (totalQty.isLessThanOrEqualTo(0)) {
    return newCost.toFixed(4);
  }

  const oldTotalValue = oldQty.multipliedBy(oldAvg);
  const newTotalValue = newQty.multipliedBy(newCost);
  const newAverageCost = oldTotalValue.plus(newTotalValue).dividedBy(totalQty);

  return newAverageCost.toFixed(4);
}

// ================================================================
// 4. CASHIER SHIFT SESSION BALANCING
// ================================================================

export interface CashSessionBalancingInput {
  openingCash: string | number;
  cashSales: string | number;
  cashIn: string | number;
  cashOut: string | number;
  cashExpenses: string | number;
  actualCash?: string | number;
}

export interface CashSessionBalancingResult {
  expectedCash: string;
  actualCash: string | null;
  difference: string | null; // actual - expected
  isBalanced: boolean;
}

export function calculateCashSession(input: CashSessionBalancingInput): CashSessionBalancingResult {
  const opening = toBN(input.openingCash);
  const sales = toBN(input.cashSales);
  const inAmount = toBN(input.cashIn);
  const outAmount = toBN(input.cashOut);
  const expenses = toBN(input.cashExpenses);

  // Expected Cash = Opening + Cash Sales + Cash In - Cash Out - Cash Expenses
  const expected = opening.plus(sales).plus(inAmount).minus(outAmount).minus(expenses);

  if (input.actualCash === undefined || input.actualCash === null) {
    return {
      expectedCash: expected.toFixed(4),
      actualCash: null,
      difference: null,
      isBalanced: false,
    };
  }

  const actual = toBN(input.actualCash);
  const diff = actual.minus(expected);

  return {
    expectedCash: expected.toFixed(4),
    actualCash: actual.toFixed(4),
    difference: diff.toFixed(4),
    isBalanced: diff.isZero(),
  };
}

// ================================================================
// 5. GLOBAL LOCALE & CURRENCY FORMATTERS
// ================================================================

export function formatCurrency(amount: string | number, currencyCode: string, locale = 'en-US'): string {
  const bn = toBN(amount);
  const currencyInfo = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()];
  const fractionDigits = currencyInfo ? currencyInfo.fractionDigits : 2;

  try {
    const num = bn.toNumber();
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(num);
  } catch {
    return `${currencyCode} ${bn.toFixed(fractionDigits)}`;
  }
}

export function formatLocalizedNumber(num: string | number, locale = 'en-US', places = 2): string {
  const bn = toBN(num);
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: places,
      maximumFractionDigits: places,
    }).format(bn.toNumber());
  } catch {
    return bn.toFixed(places);
  }
}

// ================================================================
// 6. STRUCTURED ID GENERATOR
// ================================================================

export function generatePrefixedId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${randomPart}`;
}
