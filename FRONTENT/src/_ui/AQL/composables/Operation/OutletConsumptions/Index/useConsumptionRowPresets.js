import {
  progressOf,
  progressLabel,
  progressColor,
  settledAt,
  daysSince,
  isActiveRow,
  isCancelled
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import { useConsumptionIndex } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionIndex'
import { parseAnyDate } from 'src/utils/dateHelpers'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

function outletLabel (row) {
  const entry = asRow(row)
  return text(entry.$outlet?.Name) || text(entry.OutletCode) || 'Unknown outlet'
}

function formatDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function elapsedLabel (row) {
  const days = daysSince(settledAt(row))
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function newestFirst (rows = []) {
  // `slice()` first: `items` is the store's own array and sorting in place would mutate it.
  return (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
    const left = text(settledAt(a))
    const right = text(settledAt(b))
    return left < right ? 1 : left > right ? -1 : 0
  })
}

// Null slots must stay explicit. If a key is missing, `useListStrategy` adds its own guess.
function baseRow (rows) {
  return {
    items: rows,
    label: (row) => outletLabel(row),
    caption: (row) => formatDate(asRow(row).Date),
    chip: (row) => progressLabel(progressOf(row)),
    chipColor: (row) => progressColor(progressOf(row)),
    meta: null,
    badge: null,
    metaLabel: null,
    metaCaption: null
  }
}

export function recentPreset (rows = []) {
  const live = (Array.isArray(rows) ? rows : []).filter(isActiveRow).filter((row) => !isCancelled(row))
  const sorted = newestFirst(live).slice(0, 50)
  return {
    ...baseRow(sorted),
    caption: (row) => [formatDate(asRow(row).Date), elapsedLabel(row)].filter(Boolean).join(' · '),
    metaLayout: ['chip']
  }
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

// How long a row has waited, in the biggest unit that still reads well.
export function formatRelativeAge (value) {
  const parsed = parseAnyDate(value)
  if (!parsed) return ''
  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 0) return 'Just Now'
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'Just Now'
  if (hours < 24) return `${plural(hours, 'hour')} ago`
  const days = Math.floor(hours / 24)
  if (days <= 99) return `${plural(days, 'day')} ago`
  return `${plural(Math.floor(days / 30), 'month')} ago`
}

// Blank, never "0 Items", when the child lines are not loaded yet — see `consumptionLinesOf`.
function itemsSummaryLabel (row) {
  const lines = useConsumptionIndex().consumptionLinesOf(asRow(row).Code)
  if (!lines) return ''
  return `${plural(lines.items, 'Item')} X ${lines.qty} Qty`
}

// Oldest first: this is a work queue, so the longest wait is the one to clear next.
export function invoiceablePreset (rows = []) {
  const live = (Array.isArray(rows) ? rows : [])
    .filter(isActiveRow)
    .filter((row) => progressOf(row) === 'PENDING_INVOICE_GENERATION')
  const sorted = live.slice().sort((a, b) => {
    const left = text(asRow(a).ProgressPendingInvoiceGenerationAt || asRow(a).Date)
    const right = text(asRow(b).ProgressPendingInvoiceGenerationAt || asRow(b).Date)
    return left < right ? -1 : left > right ? 1 : 0
  })
  return {
    ...baseRow(sorted),
    layout: ['caption', 'label', 'caption'],
    content: [
      (row) => [formatDate(asRow(row).Date), text(asRow(row).Username)].filter(Boolean).join(' · '),
      (row) => outletLabel(row),
      (row) => itemsSummaryLabel(row)
    ],
    chip: (row) => formatRelativeAge(asRow(row).ProgressPendingInvoiceGenerationAt || asRow(row).Date),
    chipColor: 'warning',
    metaLayout: ['chip']
  }
}

export function completedPreset (rows = []) {
  const sorted = newestFirst((Array.isArray(rows) ? rows : []).filter(isActiveRow))
  return {
    ...baseRow(sorted),
    caption: (row) => [formatDate(asRow(row).Date), elapsedLabel(row)].filter(Boolean).join(' · ')
  }
}

export function cancelledPreset (rows = []) {
  const sorted = newestFirst((Array.isArray(rows) ? rows : []).filter(isActiveRow))
  return {
    ...baseRow(sorted),
    caption: (row) => {
      const reason = text(asRow(row).ProgressCancelledComment)
      const when = formatDate(asRow(row).Date)
      return reason ? `${when} · ${reason}` : when
    }
  }
}

export { outletLabel, formatDate, elapsedLabel }

export function useConsumptionRowPresets () {
  return {
    recentPreset,
    invoiceablePreset,
    completedPreset,
    cancelledPreset,
    outletLabel,
    formatDate,
    elapsedLabel,
    formatRelativeAge
  }
}
