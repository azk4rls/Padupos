// Exact decimal display formatting for backend money strings.
// The backend is the accounting authority and returns exact decimal strings
// (e.g. "36000.0000"). Display grouping here is string-based, and the one
// division we need (proportional bar widths) uses BigNumber rather than float,
// so no floating point rounding can alter a backend value.

import BigNumber from 'bignumber.js';
import { toBN } from '@padupos/shared';

export interface MoneyFormatOptions {
  currency?: string;
  /** Drop the decimal part entirely (used for IDR, which has no minor unit). */
  wholeOnly?: boolean;
  /** Append the ISO currency code after the amount. */
  showCode?: boolean;
}

const ZERO_DECIMALS = new Set(['IDR', 'JPY', 'KRW', 'VND', 'CLP', 'ISK']);

function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats an exact decimal string for display without converting to a float.
 * Preserves every digit the backend returned (minus insignificant trailing zeros
 * when `wholeOnly` is requested).
 */
export function formatMoneyString(
  value: string | number | null | undefined,
  options: MoneyFormatOptions = {}
): string {
  const { currency = 'IDR', wholeOnly, showCode = false } = options;

  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (raw === '' || raw === '-') return currency === 'IDR' ? 'Rp 0' : `${currency} 0`;

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;

  const [intPart = '0', fracPart = ''] = unsigned.split('.');
  const useWhole = wholeOnly ?? ZERO_DECIMALS.has(currency.toUpperCase());

  const grouped = groupDigits(intPart || '0');
  let body = grouped;
  if (!useWhole && fracPart) {
    body += `.${fracPart}`;
  }

  const prefix = currency === 'IDR' ? 'Rp' : currency;
  const sign = negative ? '-' : '';
  const amount = `${sign}${body}`;
  const suffix = currency === 'IDR' || !showCode ? '' : ` ${currency}`;

  return `${prefix} ${amount}${suffix}`;
}

/** Formats an exact decimal string as a plain grouped number (no currency). */
export function formatDecimalString(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (raw === '' || raw === '-') return '0';
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPart = '0', fracPart = ''] = unsigned.split('.');
  const body = fracPart ? `${groupDigits(intPart || '0')}.${fracPart}` : groupDigits(intPart || '0');
  return `${negative ? '-' : ''}${body}`;
}

/**
 * Returns a 0..1 ratio for proportional bars, using decimal-string comparison
 * only. Returns null when the total is zero so callers can render an honest
 * "no data" state instead of a misleading full-width bar.
 */
export function proportionOf(value: string | null | undefined, total: string | null | undefined): number | null {
  const v = toBN(value ?? '0');
  const t = toBN(total ?? '0');
  if (!v.isFinite() || !t.isFinite() || t.isZero()) return null;
  const ratio = v.dividedBy(t);
  if (!ratio.isFinite()) return null;
  return ratio.toNumber();
}

/**
 * Exact decimal sum of a set of backend money strings.
 *
 * This is a *view subtotal* over whatever rows are currently displayed (after the
 * user's own search and filter). It is deliberately not the authoritative ledger
 * total — that comes from the backend. Summation still uses BigNumber rather than
 * `Number` so a filtered subtotal can never drift by a rounding error, which would
 * contradict the figure the backend reports for the same rows.
 */
export function sumDecimals(values: Array<string | null | undefined>): string {
  return values
    .reduce<BigNumber>((acc, value) => acc.plus(toBN(value ?? '0')), toBN('0'))
    .toFixed(4);
}

/** Exact decimal sign test, used only to choose a display tone. */
export function isNonNegative(value: string | null | undefined): boolean {
  return !toBN(value ?? '0').isNegative();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}