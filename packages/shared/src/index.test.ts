import { describe, it, expect } from 'vitest';
import {
  calculateLineItem,
  calculateOrder,
  calculateWeightedAverageCost,
  calculateCashSession,
  formatCurrency,
  generatePrefixedId,
} from './index.js';

describe('PADUPOS — Shared Pure Calculation Engines', () => {
  describe('1. Line Item Calculations', () => {
    it('calculates line subtotal without discount correctly', () => {
      const res = calculateLineItem({ unitPrice: '15000', quantity: '2' });
      expect(res.lineSubtotal).toBe('30000.0000');
      expect(res.discountAmount).toBe('0.0000');
      expect(res.total).toBe('30000.0000');
    });

    it('calculates line subtotal with discount correctly', () => {
      const res = calculateLineItem({ unitPrice: '15000', quantity: '2', discountAmount: '3000' });
      expect(res.lineSubtotal).toBe('30000.0000');
      expect(res.discountAmount).toBe('3000.0000');
      expect(res.total).toBe('27000.0000');
    });

    it('caps line discount at line subtotal to prevent negative totals', () => {
      const res = calculateLineItem({ unitPrice: '10000', quantity: '1', discountAmount: '15000' });
      expect(res.discountAmount).toBe('10000.0000');
      expect(res.total).toBe('0.0000');
    });
  });

  describe('2. Order & POS Calculation Engine', () => {
    it('calculates order with exclusive tax correctly', () => {
      const order = calculateOrder({
        items: [
          { unitPrice: '10000', unitCost: '6000', quantity: '2', discountAmount: '1000' }, // total 19000, cost 12000
          { unitPrice: '20000', unitCost: '14000', quantity: '1' },                        // total 20000, cost 14000
        ],
        orderDiscountAmount: '4000', // net subtotal = 39000 - 4000 = 35000
        taxRatePercentage: '10',     // 10% exclusive tax = 3500
        isTaxInclusive: false,
        feeAmount: '500',           // 500 fee
      });

      expect(order.subtotal).toBe('40000.0000');
      expect(order.itemsDiscountTotal).toBe('1000.0000');
      expect(order.orderDiscount).toBe('4000.0000');
      expect(order.netSubtotal).toBe('35000.0000');
      expect(order.taxableAmount).toBe('35000.0000');
      expect(order.taxAmount).toBe('3500.0000');
      expect(order.feeAmount).toBe('500.0000');
      expect(order.grandTotal).toBe('39000.0000'); // 35000 + 3500 + 500
      expect(order.totalCOGS).toBe('26000.0000');  // 12000 + 14000
      expect(order.grossProfit).toBe('9000.0000'); // 35000 - 26000
      expect(order.grossMarginPercentage).toBe('25.71'); // 9000 / 35000 * 100
    });

    it('calculates order with inclusive tax correctly', () => {
      const order = calculateOrder({
        items: [{ unitPrice: '11000', unitCost: '5000', quantity: '1' }],
        taxRatePercentage: '10', // 10% inclusive
        isTaxInclusive: true,
      });

      // Net subtotal = 11000
      // Base = 11000 / 1.1 = 10000
      // Tax = 1000
      expect(order.grandTotal).toBe('11000.0000');
      expect(order.taxableAmount).toBe('10000.0000');
      expect(order.taxAmount).toBe('1000.0000');
      expect(order.grossProfit).toBe('5000.0000'); // 10000 - 5000
      expect(order.grossMarginPercentage).toBe('50.00');
    });
  });

  describe('3. Weighted Average Costing (WAC) Engine', () => {
    it('computes weighted average cost across multiple purchase batches', () => {
      // Initial: 10 units @ 1000 = 10000
      // Batch 1: buy 10 units @ 2000 = 20000
      // New WAC = (10000 + 20000) / 20 = 30000 / 20 = 1500
      const wac1 = calculateWeightedAverageCost({
        oldQuantity: '10',
        oldAverageCost: '1000',
        newQuantity: '10',
        newUnitCost: '2000',
      });
      expect(wac1).toBe('1500.0000');

      // Batch 2: now have 20 units @ 1500 = 30000
      // buy 5 units @ 2500 = 12500
      // New WAC = (30000 + 12500) / 25 = 42500 / 25 = 1700
      const wac2 = calculateWeightedAverageCost({
        oldQuantity: '20',
        oldAverageCost: wac1,
        newQuantity: '5',
        newUnitCost: '2500',
      });
      expect(wac2).toBe('1700.0000');
    });

    it('handles zero or negative new quantities safely', () => {
      const res = calculateWeightedAverageCost({
        oldQuantity: '10',
        oldAverageCost: '1500',
        newQuantity: '0',
        newUnitCost: '2000',
      });
      expect(res).toBe('1500.0000');
    });
  });

  describe('4. Cash Session Balancing Engine', () => {
    it('accurately reconciles cashier shift session with balanced cash', () => {
      // Opening: 100000
      // Sales: 500000
      // In: 50000
      // Out: 20000
      // Expenses: 30000
      // Expected = 100000 + 500000 + 50000 - 20000 - 30000 = 600000
      const session = calculateCashSession({
        openingCash: '100000',
        cashSales: '500000',
        cashIn: '50000',
        cashOut: '20000',
        cashExpenses: '30000',
        actualCash: '600000',
      });

      expect(session.expectedCash).toBe('600000.0000');
      expect(session.actualCash).toBe('600000.0000');
      expect(session.difference).toBe('0.0000');
      expect(session.isBalanced).toBe(true);
    });

    it('detects cash discrepancy (shortage)', () => {
      const session = calculateCashSession({
        openingCash: '100000',
        cashSales: '200000',
        cashIn: '0',
        cashOut: '0',
        cashExpenses: '0',
        actualCash: '295000', // 5000 shortage
      });

      expect(session.expectedCash).toBe('300000.0000');
      expect(session.difference).toBe('-5000.0000');
      expect(session.isBalanced).toBe(false);
    });
  });

  describe('5. Global Currency Formatting', () => {
    it('formats IDR without decimal places', () => {
      const formatted = formatCurrency('150000', 'IDR', 'id-ID');
      expect(formatted).toContain('150.000');
    });

    it('formats USD and SGD with 2 decimal places', () => {
      const usd = formatCurrency('49.9', 'USD', 'en-US');
      expect(usd).toBe('$49.90');

      const sgd = formatCurrency('12.5', 'SGD', 'en-SG');
      expect(sgd).toContain('12.50');
    });
  });

  describe('6. Structured ID Generator', () => {
    it('generates IDs with expected prefix and structure', () => {
      const id1 = generatePrefixedId('biz');
      const id2 = generatePrefixedId('sale');
      expect(id1.startsWith('biz_')).toBe(true);
      expect(id2.startsWith('sale_')).toBe(true);
      expect(id1).not.toBe(id2);
    });
  });
});
