import {
  sortByDate,
  settledAt,
  stampOf,
  daysSince,
  ageColor,
  progressOf,
  progressColor
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'

const text = (value) => String(value ?? '').trim()

export function orderLabel (row) {
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

function agedPreset (items, { direction, caption, extra = {} }) {
  return {
    items: sortByDate(items, settledAt, direction),
    layout: ['label', 'caption'],
    label: orderLabel,
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

export function openPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => joinParts([row.PODate, row.Code, row.ShipToWarehouseCode])
  })
}

export function receivingPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => joinParts([row.PODate, row.ShipToWarehouseCode])
  })
}

export function completedPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => joinParts([row.PODate, row.Code])
  })
}

export function cancelledPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => stampOf(row, 'ProgressCancelled').comment
  })
}

export function usePurchaseOrderRowPresets () {
  return { orderLabel, joinParts, ageLabel, openPreset, receivingPreset, completedPreset, cancelledPreset }
}
