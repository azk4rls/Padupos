import { describe, it, expect } from 'vitest';
import {
  createBusinessSchema,
  finalizeSaleSchema,
  createProductSchema,
  numericString,
} from './index.js';

describe('PADUPOS — Zod Validation Schemas', () => {
  it('validates business onboarding successfully with supported country and currency', () => {
    const input = {
      name: 'Padu Kopi Barito',
      businessType: 'FOOD_AND_BEVERAGE',
      countryCode: 'ID',
      currency: 'IDR',
      locale: 'id-ID',
      timezone: 'Asia/Jakarta',
      fiscalYearStartMonth: 1,
      initialBranchName: 'Outlet Barito',
    };

    const res = createBusinessSchema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it('rejects unsupported country or currency', () => {
    const input = {
      name: 'Test Business',
      businessType: 'RETAIL',
      countryCode: 'XX', // Invalid
      currency: 'ZZZ', // Invalid
      locale: 'id-ID',
      timezone: 'Asia/Jakarta',
      fiscalYearStartMonth: 1,
    };

    const res = createBusinessSchema.safeParse(input);
    expect(res.success).toBe(false);
  });

  it('validates sale finalization with proper decimal numeric strings and idempotency key', () => {
    const input = {
      branchId: '00000000-0000-0000-0000-000000000001',
      items: [
        {
          productId: '00000000-0000-0000-0000-000000000002',
          quantity: '2',
          unitPrice: '15000',
          discountAmount: '0',
        },
      ],
      paymentMethod: 'CASH',
      idempotencyKey: 'idem_checkout_12345678',
      orderDiscountAmount: '0',
      taxRatePercentage: '11',
      isTaxInclusive: true,
      feeAmount: '0',
    };

    const res = finalizeSaleSchema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it('rejects floating point or invalid numeric strings for monetary precision', () => {
    expect(numericString.safeParse('100.50').success).toBe(true);
    expect(numericString.safeParse('100.1234').success).toBe(true);
    expect(numericString.safeParse('100.12345').success).toBe(false); // exceeds 4 places
    expect(numericString.safeParse('abc').success).toBe(false);
  });
});
