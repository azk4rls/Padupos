import { toBN } from '@padupos/shared';

/**
 * Client-side date-range state that mirrors the backend contract in
 * `apps/api/src/lib/dateRange.ts`.
 *
 * The browser only ever produces bare `YYYY-MM-DD` values, which is exactly the
 * documented form: the backend interprets them in the branch timezone, then the
 * business timezone, then UTC. The client never converts them into timestamps and
 * never compares them against its own local midnight, because that would shift the
 * window by the viewer's offset. All boundary maths is therefore plain calendar-day
 * string arithmetic.
 *
 * The backend remains the validation authority: an over-long or inverted range is
 * rejected there, and its error is surfaced verbatim.
 */

export const MAX_RANGE_DAYS = 366;

export type DateRangePreset = 'today' | 'last7' | 'last30' | 'custom';

export interface DateRangeQuery {
  /** Inclusive first day, `YYYY-MM-DD`. */
  startDate: string;
  /** Inclusive last day, `YYYY-MM-DD`. */
  endDate: string;
}

export interface DateRangeState {
  preset: DateRangePreset;
  /** Present only when `preset` is `custom`. */
  startDate: string;
  endDate: string;
}

export function toCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(calendarDate: string, days: number): string {
  const [year, month, day] = calendarDate.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + days);
  return toCalendarDate(shifted);
}

export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

/** The window a preset resolves to, relative to the viewer's today. */
export function resolvePreset(preset: Exclude<DateRangePreset, 'custom'>, today = new Date()): DateRangeQuery {
  const endDate = toCalendarDate(today);
  if (preset === 'today') {
    return { startDate: endDate, endDate };
  }
  return {
    startDate: addDays(endDate, preset === 'last7' ? -6 : -29),
    endDate,
  };
}

/** Default view: the last 30 days, which is the longest preset worth charting by default. */
export function defaultDateRangeState(today = new Date()): DateRangeState {
  return { preset: 'last30', startDate: '', endDate: '' };
}

/** Query parameters for the backend. Never emits empty values. */
export function toQuery(state: DateRangeState, today = new Date()): DateRangeQuery {
  if (state.preset === 'custom') {
    return { startDate: state.startDate, endDate: state.endDate };
  }
  return resolvePreset(state.preset, today);
}

/** Human label for the active window, e.g. "1 – 30 Nov 2026" or "Hari ini". */
export function describeRange(state: DateRangeState, today = new Date()): string {
  const { startDate, endDate } = toQuery(state, today);
  if (startDate === endDate) return formatReadableDate(startDate);
  return `${formatReadableDate(startDate)} – ${formatReadableDate(endDate)}`;
}

const MONTHS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

export function formatReadableDate(calendarDate: string): string {
  const [year, month, day] = calendarDate.split('-').map(Number);
  return `${day} ${MONTHS_ID[month - 1]} ${year}`;
}

/**
 * Client-side guard so obviously invalid input never triggers a pointless request.
 * This is a usability affordance, not the security boundary: the backend validates
 * independently and its message wins when the two disagree.
 */
export function validateCustomRange(startDate: string, endDate: string): string | null {
  if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
    return 'Isi tanggal lengkap dengan format YYYY-MM-DD.';
  }
  if (diffDays(startDate, endDate) < 0) {
    return 'Tanggal mulai harus lebih dulu atau sama dengan tanggal akhir.';
  }
  if (diffDays(startDate, endDate) + 1 > MAX_RANGE_DAYS) {
    return `Rentang maksimal ${MAX_RANGE_DAYS} hari.`;
  }
  return null;
}

/** True when the window contains at least one non-zero point, using exact decimals. */
export function seriesHasActivity(points: Array<{ sales: string }>): boolean {
  return points.some((point) => !toBN(point.sales).isZero());
}