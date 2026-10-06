import { domainStore } from '../modules/domainStore.js';

/**
 * PADUPOS read-only date-range contract
 * ====================================
 *
 * Convention (reuses the previously declared-but-unwired `dateRangeFilterSchema`
 * in @padupos/validation, so no new naming convention is introduced):
 *
 *   ?startDate=...&endDate=...
 *
 * Accepted `startDate` / `endDate` input forms
 * ---------------------------------------------
 *   1. Bare calendar date          `2026-10-05`
 *      -> interpreted as that calendar date in the SCOPE TIMEZONE.
 *   2. Full ISO-8601 instant       `2026-10-05T00:00:00Z` / `...+07:00`
 *      -> interpreted as an absolute instant. Offset is honoured exactly.
 *
 * Server-local time is NEVER used to interpret input. There is no implicit
 * "midnight wherever the API happens to run" behaviour.
 *
 * Boundaries
 * ----------
 *   startDate is INCLUSIVE.
 *   endDate   is INCLUSIVE as a calendar day. It is converted to an exclusive
 *             instant bound at the start of the following calendar day, so
 *             `endDate=2026-10-05` includes every instant up to (but not
 *             including) `2026-10-06T00:00` in the scope timezone.
 *
 *   Internally the resolved range is a half-open interval
 *   `[startInclusive, endExclusive)`.
 *
 * Scope timezone resolution
 * -------------------------
 *   branch.timezone  ->  business.timezone  ->  'UTC'
 * A branch-scoped request therefore reports days in the branch's own timezone.
 *
 * Granularity
 * -----------
 *   Day. Weekly/monthly bucketing is not exposed; callers aggregate from days.
 */

export const MAX_RANGE_DAYS = 366;

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidDateRangeError extends Error {
  readonly code = 'INVALID_DATE_RANGE';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDateRangeError';
  }
}

export interface ResolvedDateRange {
  /** Absolute inclusive lower bound. */
  startInclusive: Date;
  /** Absolute exclusive upper bound. */
  endExclusive: Date;
  /** IANA timezone used for interpretation. */
  timeZone: string;
  /** Scope-local first calendar day, `YYYY-MM-DD`. */
  startDate: string;
  /** Scope-local last calendar day (inclusive), `YYYY-MM-DD`. */
  endDate: string;
  /** Inclusive number of calendar days covered. */
  dayCount: number;
}

export function resolveScopeTimeZone(
  businessId: string,
  branchId?: string | null,
): string {
  if (branchId) {
    const branch = domainStore.branches.get(branchId);
    if (branch?.timezone) return branch.timezone;
  }
  const business = domainStore.businesses.get(businessId);
  if (business?.timezone) return business.timezone;
  return 'UTC';
}

function assertValidTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new InvalidDateRangeError(`Unknown IANA timezone '${timeZone}'`);
  }
  return timeZone;
}

/** Offset in minutes (east of UTC) that `timeZone` was observing at `instant`. */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const lookup: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    lookup.year,
    lookup.month - 1,
    lookup.day,
    // Intl emits hour "24" for midnight under hour12:false in some ICU versions.
    lookup.hour === 24 ? 0 : lookup.hour,
    lookup.minute,
    lookup.second,
  );

  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Wall-clock time in `timeZone` -> absolute instant. DST-safe (two-pass). */
export function zonedWallTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = zoneOffsetMinutes(new Date(wallClock), timeZone);
  let instant = new Date(wallClock - firstOffset * 60000);
  const secondOffset = zoneOffsetMinutes(instant, timeZone);
  if (secondOffset !== firstOffset) {
    instant = new Date(wallClock - secondOffset * 60000);
  }
  return instant;
}

/** Current calendar day in `timeZone` as `YYYY-MM-DD`. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  }
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

/** Start-of-day instant for a `YYYY-MM-DD` in `timeZone`. */
export function startOfZonedDay(day: string, timeZone: string): Date {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return zonedWallTimeToInstant(year, month, dayOfMonth, 0, 0, 0, timeZone);
}

/** Adds `amount` calendar days to a `YYYY-MM-DD`, staying calendar-correct. */
export function addCalendarDays(day: string, amount: number): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, dayOfMonth + amount));
  return shifted.toISOString().slice(0, 10);
}

function parseBoundary(
  value: string,
  timeZone: string,
  field: string,
): { instant: Date; day: string } {
  const raw = value.trim();

  if (BARE_DATE.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    // Reject impossible civil dates (e.g. 2026-02-30) by round-tripping.
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (
      probe.getUTCFullYear() !== year ||
      probe.getUTCMonth() !== month - 1 ||
      probe.getUTCDate() !== day
    ) {
      throw new InvalidDateRangeError(`${field} '${raw}' is not a real calendar date`);
    }
    return { instant: startOfZonedDay(raw, timeZone), day: raw };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidDateRangeError(
      `${field} '${raw}' is not a valid ISO-8601 date or date-time`,
    );
  }
  // Require an explicit offset when a time component is supplied, otherwise the
  // value would be interpreted in server-local time (ambiguous by definition).
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    throw new InvalidDateRangeError(
      `${field} '${raw}' includes a time but no UTC offset; send a bare 'YYYY-MM-DD' or an offset-qualified ISO-8601 value`,
    );
  }
  return { instant: parsed, day: todayInTimeZone(timeZone, parsed) };
}

/** Number of calendar days between two `YYYY-MM-DD` strings, inclusive. */
export function countCalendarDays(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const diff = Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd);
  return Math.floor(diff / 86400000) + 1;
}

export interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
}

/**
 * Resolves a caller-supplied date range against a tenant/branch scope.
 *
 * When neither bound is supplied the range collapses to the current scope-local
 * calendar day, which is what the dashboard's default view means by "today".
 */
export function resolveDateRange(
  query: DateRangeQuery,
  businessId: string,
  branchId?: string | null,
  now: Date = new Date(),
): ResolvedDateRange {
  const timeZone = assertValidTimeZone(resolveScopeTimeZone(businessId, branchId ?? null));

  const today = todayInTimeZone(timeZone, now);
  const startRaw = query.startDate?.trim() || today;
  const endRaw = query.endDate?.trim() || today;

  const start = parseBoundary(startRaw, timeZone, 'startDate');
  const end = parseBoundary(endRaw, timeZone, 'endDate');

  if (start.instant.getTime() > end.instant.getTime()) {
    throw new InvalidDateRangeError(
      `startDate '${startRaw}' must not be after endDate '${endRaw}'`,
    );
  }

  const dayCount = countCalendarDays(start.day, end.day);
  if (dayCount > MAX_RANGE_DAYS) {
    throw new InvalidDateRangeError(
      `Requested range covers ${dayCount} days which exceeds the maximum of ${MAX_RANGE_DAYS}`,
    );
  }

  return {
    startInclusive: start.instant,
    endExclusive: startOfZonedDay(addCalendarDays(end.day, 1), timeZone),
    timeZone,
    startDate: start.day,
    endDate: end.day,
    dayCount,
  };
}

/** Half-open containment test. */
export function isWithinRange(range: ResolvedDateRange, instant: Date): boolean {
  const time = instant.getTime();
  return time >= range.startInclusive.getTime() && time < range.endExclusive.getTime();
}

/** Half-open containment test for an ISO string timestamp. */
export function isWithinRangeIso(range: ResolvedDateRange, isoTimestamp: string): boolean {
  const instant = new Date(isoTimestamp);
  if (Number.isNaN(instant.getTime())) return false;
  return isWithinRange(range, instant);
}

/** Inclusive list of `YYYY-MM-DD` scope-local days covered by the range. */
export function enumerateDays(range: ResolvedDateRange): string[] {
  const days: string[] = [];
  for (let index = 0; index < range.dayCount; index += 1) {
    days.push(addCalendarDays(range.startDate, index));
  }
  return days;
}

/** Monday-based start of week for a `YYYY-MM-DD`. */
export function startOfWeek(day: string): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay() || 7;
  return addCalendarDays(day, 1 - weekday);
}

/** First day of the month for a `YYYY-MM-DD`. */
export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}