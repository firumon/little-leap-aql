/**
 * Dynamic token registry for list-view filter conditions.
 *
 * A condition value may be a token string (e.g. "$startOfMonth", "$daysIn:30") instead of a
 * literal. Tokens resolve at evaluation time against the clock and the logged-in user, so a
 * single sheet-authored view stays correct as the date rolls over or a different user signs in.
 *
 * Two-sided coercion
 * ------------------
 * Comparing a token against a sheet column only works when both sides sit in the same space.
 * Each token therefore declares:
 *   - `coerce`      — pipeline applied to the COLUMN value.
 *   - `coerceToken` — pipeline applied to the RESOLVED TOKEN value; defaults to `coerce`.
 *
 * Most tokens are symmetric (both sides get the same treatment). The relative-day tokens are
 * deliberately not: the column is converted into "signed days from today" while the token is
 * just a number, so `{ column: 'DueDate', operator: 'lte', value: '$daysIn:7' }` compares
 * day-offset against day-offset.
 *
 * Pipelines are arrays of `COERCES` key names rather than functions so they stay serialisable —
 * a future revision can author them directly in the sheet.
 */

import {
  parseAnyDate,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  toDateOnly,
  dayOfYear,
  isoWeek,
  daysFromToday
} from 'src/utils/dateHelpers'

/**
 * Named coercion primitives. Composable — a pipeline applies them left to right.
 */
export const COERCES = {
  text: (v) => String(v ?? ''),
  trim: (v) => String(v ?? '').trim(),
  lowercase: (v) => String(v ?? '').toLowerCase(),
  slug: (v) => String(v ?? '').trim().toLowerCase(),
  number: (v) => Number(v),
  /** Any supported date shape → epoch milliseconds. NaN when unparseable. */
  epoch: (v) => {
    const date = parseAnyDate(v)
    return date ? date.getTime() : NaN
  },
  /** Any supported date shape → 'YYYY-MM-DD'. */
  dateOnly: (v) => toDateOnly(v),
  /** Any supported date shape → day of year, 1-366. */
  dayOfYear: (v) => dayOfYear(v),
  /** Any supported date shape → zero-padded month, '01'-'12'. */
  month2: (v) => {
    const date = parseAnyDate(v)
    return date ? String(date.getMonth() + 1).padStart(2, '0') : ''
  },
  /** Any supported date shape → four-digit year as a number. */
  year: (v) => {
    const date = parseAnyDate(v)
    return date ? date.getFullYear() : NaN
  },
  /** Any supported date shape → ISO week number, 1-53. */
  week: (v) => isoWeek(v),
  /** Any supported date shape → signed whole days from today (future positive). */
  dayNum: (v) => daysFromToday(v)
}

const nowMs = () => Date.now()

/**
 * Token registry.
 *
 * `value(params, ctx)` receives the colon-separated params after the token name (always an
 * array of strings) and the evaluation context `{ user }`. It returns the raw value; the
 * `coerceToken` pipeline converts it — resolvers stay dumb extractors.
 *
 * Tokens returning an array are intended for the `in` / `not_in` operators.
 */
export const TOKENS = {
  // ---- Date / time ----------------------------------------------------------
  $now: {
    label: 'Now (timestamp)',
    group: 'Date & Time',
    value: () => nowMs(),
    coerce: ['epoch'],
    coerceToken: ['number']
  },
  $date: {
    label: "Today's date (YYYY-MM-DD)",
    group: 'Date & Time',
    value: () => toDateOnly(new Date()),
    coerce: ['dateOnly'],
    coerceToken: ['text']
  },
  $day: {
    label: 'Day of year (1-366)',
    group: 'Date & Time',
    value: () => dayOfYear(new Date()),
    coerce: ['dayOfYear'],
    coerceToken: ['number']
  },
  $month: {
    label: 'Current month (01-12)',
    group: 'Date & Time',
    value: () => String(new Date().getMonth() + 1).padStart(2, '0'),
    coerce: ['month2'],
    coerceToken: ['text']
  },
  $year: {
    label: 'Current year (YYYY)',
    group: 'Date & Time',
    value: () => new Date().getFullYear(),
    coerce: ['year'],
    coerceToken: ['number']
  },
  $week: {
    label: 'Current ISO week (1-53)',
    group: 'Date & Time',
    value: () => isoWeek(new Date()),
    coerce: ['week'],
    coerceToken: ['number']
  },
  $startOfDay: {
    label: 'Start of today (timestamp)',
    group: 'Date & Time',
    value: () => startOfDay(new Date())?.getTime(),
    coerce: ['epoch'],
    coerceToken: ['number']
  },
  $endOfDay: {
    label: 'End of today (timestamp)',
    group: 'Date & Time',
    value: () => endOfDay(new Date())?.getTime(),
    coerce: ['epoch'],
    coerceToken: ['number']
  },
  $startOfMonth: {
    label: 'Start of this month (timestamp)',
    group: 'Date & Time',
    value: () => startOfMonth(new Date())?.getTime(),
    coerce: ['epoch'],
    coerceToken: ['number']
  },
  $endOfMonth: {
    label: 'End of this month (timestamp)',
    group: 'Date & Time',
    value: () => endOfMonth(new Date())?.getTime(),
    coerce: ['epoch'],
    coerceToken: ['number']
  },

  // ---- Relative days (parameterised) ----------------------------------------
  // Column is converted to signed days from today, so these compare offset-to-offset.
  $daysAgo: {
    label: 'N days ago',
    group: 'Relative Days',
    param: 'N',
    paramDefault: '7',
    value: (params) => -Math.abs(Number(params[0])),
    coerce: ['dayNum'],
    coerceToken: ['number']
  },
  $daysIn: {
    label: 'In N days',
    group: 'Relative Days',
    param: 'N',
    paramDefault: '30',
    value: (params) => Math.abs(Number(params[0])),
    coerce: ['dayNum'],
    coerceToken: ['number']
  },

  // ---- Logged-in user -------------------------------------------------------
  $userCode: {
    label: 'My user code',
    group: 'Current User',
    // buildAuthUserPayload (GAS/auth.gs) maps UserID → `id`; `code` is tolerated if ever added.
    value: (params, ctx) => ctx.user?.code ?? ctx.user?.id,
    coerce: ['slug']
  },
  $userEmail: {
    label: 'My email',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.email,
    coerce: ['slug']
  },
  $userName: {
    label: 'My name',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.name,
    coerce: ['slug']
  },
  $userDesignation: {
    label: 'My designation',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.designation?.name,
    coerce: ['slug']
  },
  $userRole: {
    label: 'My primary role',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.role,
    coerce: ['slug']
  },
  $userRoles: {
    label: 'My roles (list — use with "is one of")',
    group: 'Current User',
    array: true,
    value: (params, ctx) => {
      const roles = ctx.user?.roles
      if (!Array.isArray(roles)) return []
      return roles.map((entry) => (typeof entry === 'string' ? entry : entry?.name)).filter(Boolean)
    },
    coerce: ['slug']
  },
  $userRegion: {
    label: 'My region code',
    group: 'Current User',
    value: (params, ctx) => ctx.user?.accessRegion?.code,
    coerce: ['slug']
  },
  $userRegions: {
    label: 'My accessible regions (list — use with "is one of")',
    group: 'Current User',
    array: true,
    value: (params, ctx) => {
      const codes = ctx.user?.accessRegion?.accessibleCodes
      return Array.isArray(codes) ? codes.filter(Boolean) : []
    },
    coerce: ['slug']
  }
}

/** Case-insensitive lookup, so sheet authors can write `$startofmonth`. */
const TOKEN_INDEX = Object.keys(TOKENS).reduce((acc, key) => {
  acc[key.slice(1).toLowerCase()] = TOKENS[key]
  return acc
}, {})

// Fail loudly in dev if a pipeline references a primitive that does not exist — a typo'd
// pipeline name would otherwise surface only as a silently empty tab.
Object.entries(TOKENS).forEach(([name, spec]) => {
  const pipelines = [spec.coerce, spec.coerceToken].filter(Boolean)
  pipelines.forEach((pipeline) => {
    pipeline.forEach((step) => {
      if (!COERCES[step]) {
        throw new Error(`[listViewTokens] Token "${name}" references unknown coerce "${step}".`)
      }
    })
  })
})

/** Runs a pipeline of COERCES names over a value, left to right. */
export function applyCoerces(value, pipeline) {
  return (pipeline || []).reduce((acc, step) => COERCES[step](acc), value)
}

/**
 * Parses a token string into its spec and params.
 * Accepts `$name` and `$name:p1:p2` (params may be negative or decimal).
 *
 * @returns {{ spec: Object, params: String[] }|null} null when `value` is not a known token.
 */
export function parseToken(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^\$([A-Za-z][A-Za-z0-9]*)((?::-?[\w.-]+)*)$/)
  if (!match) return null
  const spec = TOKEN_INDEX[match[1].toLowerCase()]
  if (!spec) return null
  const params = match[2] ? match[2].slice(1).split(':') : []
  return { spec, params }
}

/** True when the value looks like a registered token string. */
export function isToken(value) {
  return parseToken(value) !== null
}
