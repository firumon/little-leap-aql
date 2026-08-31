import {
  sortByDate,
  settledAt,
  stampOf,
  daysSince,
  ageColor,
  progressOf,
  progressColor,
  responseLabel,
  daysToExpiry
} from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

const text = (value) => String(value ?? '').trim()

export function quotationLabel (row) {
  return row?.$supplier?.Name || text(row?.SupplierCode) || text(row?.Code)
}

export function joinParts (parts) {
  return (parts || []).filter((part) => text(part)).join(' • ')
}

export function ageLabel (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

export function validityLabel (row) {
  const days = daysToExpiry(row)
  if (!Number.isFinite(days)) return ''
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  return `${days} days valid`
}

function agedPreset (items, { direction, caption, extra = {} }) {
  return {
    items: sortByDate(items, settledAt, direction),
    layout: ['label', 'caption'],
    label: quotationLabel,
    caption,
    metaLayout: ['chip'],
    chip: (row) => ageLabel(daysSince(settledAt(row))),
    chipColor: (row) => ageColor(daysSince(settledAt(row))),
    chipOutline: true,
    meta: null,
    badge: null,
    metaLabel: null,
    metaCaption: null,
    highlightColor: (row) => progressColor(progressOf(row)),
    ...extra
  }
}

export function receivedPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => joinParts([responseLabel(row.ResponseType), validityLabel(row), row.RFQCode])
  })
}

export function acceptedPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => joinParts([row.ResponseDate, row.SupplierQuotationReference])
  })
}

export function rejectedPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => stampOf(row, 'ProgressRejected').comment
  })
}

export function useQuotationRowPresets () {
  return { quotationLabel, joinParts, ageLabel, validityLabel, receivedPreset, acceptedPreset, rejectedPreset }
}
