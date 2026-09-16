import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { parseAnyDate, startOfDay, startOfMonth, addDays, addMonths } from 'src/utils/dateHelpers'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const ms = (value) => parseAnyDate(value)?.getTime() ?? null

// Ranges reuse the token words from utils/tokenEvaluator.js so a dashboard item
// and a list view filter never mean two different things by "$last30Days".
const RANGES = {
  $today: () => [startOfDay(new Date()).getTime(), Date.now()],
  $thisMonth: () => [startOfMonth(new Date()).getTime(), Date.now()],
  $lastMonth: () => [
    startOfMonth(addMonths(new Date(), -1)).getTime(),
    startOfMonth(new Date()).getTime()
  ],
  $last7Days: () => [startOfDay(addDays(new Date(), -7)).getTime(), Date.now()],
  $last30Days: () => [startOfDay(addDays(new Date(), -30)).getTime(), Date.now()],
  $last90Days: () => [startOfDay(addDays(new Date(), -90)).getTime(), Date.now()]
}

export function resolveRange (range) {
  if (Array.isArray(range)) {
    return [ms(range[0]) ?? -Infinity, ms(range[1]) ?? Infinity]
  }
  const make = RANGES[range]
  return make ? make() : [-Infinity, Infinity]
}

const RANGE_LABELS = {
  $today: 'today',
  $thisMonth: 'this month',
  $lastMonth: 'last month',
  $last7Days: 'last 7 days',
  $last30Days: 'last 30 days',
  $last90Days: 'last 90 days'
}

export function buildDashboardContext (controls = {}) {
  const auth = useAuthStore()
  const dataStore = useDataStore()
  const now = Date.now()

  const rows = (resource) => dataStore.getRecords(resource) || []

  const nameOf = (resource, code) => {
    if (!code) return ''
    const row = (rows(resource) || []).find((r) => r.Code === code)
    return row?.Name || code
  }

  const countBy = (list, field) => {
    const map = new Map()
    for (const r of list) {
      const key = r[field] || '(none)'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }

  const sumBy = (list, field, valueField) => {
    const map = new Map()
    for (const r of list) {
      const key = r[field] || '(none)'
      map.set(key, (map.get(key) || 0) + (Number(r[valueField]) || 0))
    }
    return map
  }

  const topN = (map, n, label) => [...map.entries()]
    .map(([key, value]) => ({ label: label ? label(key) : key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n)

  const mean = (numbers) => numbers.length
    ? numbers.reduce((a, b) => a + b, 0) / numbers.length
    : null

  const daysSince = (value) => {
    const t = ms(value)
    return t === null ? null : (now - t) / DAY
  }

  const hoursBetween = (from, to) => {
    const a = ms(from)
    const b = ms(to)
    return a === null || b === null ? null : (b - a) / HOUR
  }

  const inRange = (value, range) => {
    const t = ms(value)
    if (t === null) return false
    const [from, to] = resolveRange(range)
    return t >= from && t <= to
  }

  const countAt = (resource, range, predicate) =>
    rows(resource).filter((r) => inRange(r.Date, range) && (!predicate || predicate(r))).length

  const progressOptions = (resource) =>
    [...new Set(rows(resource).map((r) => r.Progress).filter(Boolean))]
      .map((value) => ({ label: value, value }))

  return {
    rows,
    controls,
    user: auth.user,
    userName: auth.user?.name || '',
    now,
    daysAgo: (n) => startOfDay(addDays(new Date(), -Math.abs(n))).getTime(),
    daysSince,
    hoursBetween,
    inRange,
    rangeLabel: (range) => RANGE_LABELS[range] || '',
    countBy,
    sumBy,
    topN,
    mean,
    countAt,
    nameOf,
    progressOptions
  }
}
