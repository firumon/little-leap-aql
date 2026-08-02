/**
 * Shared date parsing/normalisation helpers.
 *
 * AQL sheets store dates in two different shapes:
 *   - Audit columns (CreatedAt/UpdatedAt) hold epoch milliseconds (see applyAuditFields in GAS/resourceApi.gs).
 *   - Business date columns (Date, DueDate, VisitDate, ...) hold ISO strings, sometimes with a time component.
 *
 * Every helper here accepts either shape so list-view tokens behave identically across both.
 * Calculations delegate to date-fns; only `parseAnyDate` is hand-rolled, because the
 * dual-storage dispatch and the literal-calendar-date rule below are AQL-specific.
 */

import {
  startOfDay as fnsStartOfDay,
  endOfDay as fnsEndOfDay,
  startOfMonth as fnsStartOfMonth,
  endOfMonth as fnsEndOfMonth,
  getDayOfYear,
  getISOWeek,
  differenceInCalendarDays,
  format,
  isValid
} from 'date-fns'

/**
 * Parses a sheet value into a local Date.
 * Accepts: Date, epoch milliseconds (number or numeric string), 'YYYY-MM-DD',
 * 'YYYY-MM-DDTHH:mm[:ss]' and 'YYYY-MM-DD HH:mm[:ss]'.
 *
 * Deliberately NOT date-fns `parseISO`: the date part is built from explicit Y/M/D components
 * so the calendar date is taken literally, matching the long-standing `.slice(0, 10)` behaviour
 * in useOutletVisits. `parseISO` would honour a trailing 'Z' and shift a late-evening UTC
 * timestamp into the next local day, silently re-bucketing existing records.
 *
 * @returns {Date|null} null when the value cannot be interpreted as a date.
 */
export function parseAnyDate(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    return isValid(value) ? value : null
  }

  if (typeof value === 'number') {
    const fromNumber = new Date(value)
    return isValid(fromNumber) ? fromNumber : null
  }

  const raw = String(value).trim()
  if (!raw) return null

  // Epoch milliseconds arriving as a string (parseISO rejects these).
  if (/^\d{11,}$/.test(raw)) {
    const fromEpoch = new Date(Number(raw))
    return isValid(fromEpoch) ? fromEpoch : null
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (match) {
    const parsed = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4] || 0),
      Number(match[5] || 0),
      Number(match[6] || 0)
    )
    return isValid(parsed) ? parsed : null
  }

  const fallback = new Date(raw)
  return isValid(fallback) ? fallback : null
}

/** Runs a date-fns helper against a parsed value, returning `fallback` when unparseable. */
function withDate(value, fn, fallback = null) {
  const date = parseAnyDate(value)
  return date ? fn(date) : fallback
}

/** Local midnight (00:00:00.000) of the given value's day. */
export function startOfDay(value) {
  return withDate(value, fnsStartOfDay)
}

/** Local 23:59:59.999 of the given value's day. */
export function endOfDay(value) {
  return withDate(value, fnsEndOfDay)
}

/** Local midnight of the first day of the given value's month. */
export function startOfMonth(value) {
  return withDate(value, fnsStartOfMonth)
}

/** Local 23:59:59.999 of the last day of the given value's month. */
export function endOfMonth(value) {
  return withDate(value, fnsEndOfMonth)
}

/** 'YYYY-MM-DD' for the given value, or '' when unparseable. */
export function toDateOnly(value) {
  return withDate(value, (date) => format(date, 'yyyy-MM-dd'), '')
}

/** Day of year, 1-366. NaN when unparseable. */
export function dayOfYear(value) {
  return withDate(value, getDayOfYear, NaN)
}

/** ISO-8601 week number, 1-53. NaN when unparseable. */
export function isoWeek(value) {
  return withDate(value, getISOWeek, NaN)
}

/**
 * Signed whole days between the given value and today, both taken as calendar days.
 * Future is positive, past is negative. NaN when unparseable.
 * e.g. tomorrow → 1, yesterday → -1, today → 0.
 */
export function daysFromToday(value) {
  return withDate(value, (date) => differenceInCalendarDays(date, new Date()), NaN)
}
