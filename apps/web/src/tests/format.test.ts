import { describe, it, expect } from 'vitest';
import {
  formatMoneyString,
  formatDecimalString,
  proportionOf,
  formatDate,
  formatDateTime,
} from '../lib/format';
import { buildQuery } from '../lib/query';

describe('exact decimal money formatting', () => {
  it('groups IDR amounts without showing minor units', () => {
    expect(formatMoneyString('3600000.0000', { currency: 'IDR' })).toBe('Rp 3,600,000');
    expect(formatMoneyString('0.0000', { currency: 'IDR' })).toBe('Rp 0');
  });

  it('preserves every decimal digit the backend returned for non-IDR currencies', () => {
    expect(formatMoneyString('1234.5000', { currency: 'USD' })).toBe('USD 1,234.5000');
    expect(formatMoneyString('1234.5678', { currency: 'EUR' })).toBe('EUR 1,234.5678');
  });

  it('never loses precision on values a float would round', () => {
    // 9007199254740993 is not representable as a JS number.
    expect(formatMoneyString('9007199254740993.0001', { currency: 'USD' })).toBe(
      'USD 9,007,199,254,740,993.0001'
    );
    expect(formatMoneyString('0.000000000000001', { currency: 'USD' })).toBe('USD 0.000000000000001');
  });

  it('handles missing, empty and non-numeric input without producing NaN', () => {
    expect(formatMoneyString(undefined, { currency: 'IDR' })).toBe('Rp 0');
    expect(formatMoneyString(null, { currency: 'USD' })).toBe('USD 0');
    expect(formatMoneyString('', { currency: 'IDR' })).toBe('Rp 0');
  });

  it('preserves the sign of negative backend values', () => {
    expect(formatMoneyString('-500000.0000', { currency: 'IDR' })).toBe('Rp -500,000');
    expect(formatMoneyString('-12.3400', { currency: 'USD' })).toBe('USD -12.3400');
  });

  it('can append the currency code when requested', () => {
    expect(formatMoneyString('10.0000', { currency: 'SGD', showCode: true })).toBe('SGD 10.0000 SGD');
  });

  it('groups plain decimal strings without a currency prefix', () => {
    expect(formatDecimalString('1234567.8900')).toBe('1,234,567.8900');
    expect(formatDecimalString('-42.0000')).toBe('-42.0000');
    expect(formatDecimalString(undefined)).toBe('0');
  });
});

describe('proportionOf — bar geometry', () => {
  it('returns a 0..1 ratio for display bars', () => {
    expect(proportionOf('50.0000', '200.0000')).toBeCloseTo(0.25, 10);
    expect(proportionOf('200.0000', '200.0000')).toBe(1);
  });

  it('returns null when the total is zero so callers show an honest empty bar', () => {
    expect(proportionOf('0.0000', '0.0000')).toBeNull();
    expect(proportionOf('100.0000', '0.0000')).toBeNull();
    expect(proportionOf(undefined, undefined)).toBeNull();
  });
});

describe('date formatting', () => {
  it('renders an em dash for missing or invalid timestamps', () => {
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });

  it('formats a valid timestamp', () => {
    expect(formatDate('2026-03-04T08:15:00.000Z')).not.toBe('—');
  });
});

describe('buildQuery', () => {
  it('returns an empty string when nothing is defined', () => {
    expect(buildQuery({ a: undefined, b: null, c: '' })).toBe('');
  });

  it('encodes only the provided values', () => {
    expect(buildQuery({ branchId: 'brn_1' })).toBe('?branchId=brn_1');
    expect(buildQuery({ page: 2, limit: 20 })).toBe('?page=2&limit=20');
  });

  it('percent-encodes values', () => {
    expect(buildQuery({ search: 'kopi susu' })).toBe('?search=kopi+susu');
  });
});