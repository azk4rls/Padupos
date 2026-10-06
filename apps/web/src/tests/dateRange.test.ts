import { describe, it, expect } from 'vitest';
import {
  MAX_RANGE_DAYS,
  addDays,
  defaultDateRangeState,
  diffDays,
  isValidCalendarDate,
  resolvePreset,
  toCalendarDate,
  toQuery,
  validateCustomRange,
} from '@/lib/dateRange';

/**
 * The browser-side mirror of the backend range contract.
 *
 * These tests pin the two properties that actually caused bugs historically:
 * calendar arithmetic must not drift across a DST boundary or a month rollover, and
 * a client-supplied window must never silently widen. The backend still validates
 * everything independently — this is a usability guard, not the security boundary.
 */

const TODAY = new Date(2026, 9, 30, 14, 30); // 30 Oct 2026, 14:30 local

describe('lib/dateRange', () => {
  it('formats a date as a bare calendar day without timezone conversion', () => {
    // Late-evening local time must not roll into the next day via UTC conversion.
    expect(toCalendarDate(new Date(2026, 9, 30, 23, 45))).toBe('2026-10-30');
    expect(toCalendarDate(new Date(2026, 9, 30, 0, 5))).toBe('2026-10-30');
    expect(toCalendarDate(new Date(2026, 0, 1, 12, 0))).toBe('2026-01-01');
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-30', 1)).toBe('2026-10-31');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    // Brazil abolished DST in 2019; a spring-forward zone still shifts the offset
    // without changing the calendar-day count, which is exactly what we assert.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-26', 1)).toBe('2026-10-27');
  });

  it('counts inclusive days between two calendar dates', () => {
    expect(diffDays('2026-10-01', '2026-10-01')).toBe(0);
    expect(diffDays('2026-10-01', '2026-10-31')).toBe(30);
    // Leap year.
    expect(diffDays('2028-02-01', '2028-02-29')).toBe(28);
    expect(diffDays('2026-10-31', '2026-10-01')).toBe(-30);
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidCalendarDate('2026-02-30')).toBe(false);
    expect(isValidCalendarDate('2026-13-01')).toBe(false);
    expect(isValidCalendarDate('2026-00-10')).toBe(false);
    expect(isValidCalendarDate('2026-10-00')).toBe(false);
    expect(isValidCalendarDate('2026-1-1')).toBe(false);
    expect(isValidCalendarDate('not-a-date')).toBe(false);
    expect(isValidCalendarDate('')).toBe(false);
    expect(isValidCalendarDate('2028-02-29')).toBe(true); // leap day
    expect(isValidCalendarDate('2026-10-30')).toBe(true);
  });

  it('resolves presets to inclusive windows ending today', () => {
    expect(resolvePreset('today', TODAY)).toEqual({
      startDate: '2026-10-30',
      endDate: '2026-10-30',
    });
    // 7 days inclusive means start = today - 6.
    expect(resolvePreset('last7', TODAY)).toEqual({
      startDate: '2026-10-24',
      endDate: '2026-10-30',
    });
    expect(resolvePreset('last30', TODAY)).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-30',
    });
  });

  it('defaults to the last 30 days with no custom bounds set', () => {
    const state = defaultDateRangeState(TODAY);
    expect(state).toEqual({ preset: 'last30', startDate: '', endDate: '' });
    expect(toQuery(state, TODAY)).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-30',
    });
  });

  it('passes custom bounds through verbatim, including on the 366-day limit', () => {
    const custom = { preset: 'custom' as const, startDate: '2026-01-01', endDate: '2027-01-01' };
    expect(toQuery(custom, TODAY)).toEqual({ startDate: '2026-01-01', endDate: '2027-01-01' });
    expect(diffDays('2026-01-01', '2027-01-01') + 1).toBe(366);
    expect(validateCustomRange('2026-01-01', '2027-01-01')).toBeNull();
  });

  it('blocks inverted and over-long custom ranges before requesting them', () => {
    expect(validateCustomRange('2026-10-30', '2026-10-01')).toMatch(/lebih dulu atau sama/i);
    expect(validateCustomRange('2026-01-01', '2027-01-02')).toMatch(
      new RegExp(`${MAX_RANGE_DAYS} hari`),
    );
    expect(validateCustomRange('2026-02-30', '2026-03-01')).toMatch(/YYYY-MM-DD/);
    expect(validateCustomRange('', '2026-03-01')).toMatch(/YYYY-MM-DD/);
    expect(validateCustomRange('2026-10-01', '2026-10-01')).toBeNull();
  });
});