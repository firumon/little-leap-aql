import {
  sortByDate,
  settledAt,
  daysSince,
  ageColor,
  statusOf,
  progressColor
} from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptProgress'

const text = (value) => String(value ?? '').trim()

export function receiptLabel (row) {
  return text(row?.PurchaseOrderCode) || text(row?.Code)
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

// A GRN is history, so every view reads newest first.
function historyPreset (items, extra = {}) {
  return {
    items: sortByDate(items, settledAt, 'desc'),
    layout: ['label', 'caption'],
    label: receiptLabel,
    caption: (row) => joinParts([row.Date, row.Code, row.POReceivingCode]),
    metaLayout: ['chip'],
    chip: (row) => ageLabel(daysSince(settledAt(row))),
    chipColor: (row) => ageColor(daysSince(settledAt(row))),
    chipOutline: true,
    meta: null,
    badge: null,
    metaLabel: null,
    metaCaption: null,
    highlightColor: (row) => progressColor(statusOf(row)),
    ...extra
  }
}

export function activePreset (items) {
  return historyPreset(items)
}

export function invalidatedPreset (items) {
  return historyPreset(items)
}

export function useGoodsReceiptRowPresets () {
  return { receiptLabel, joinParts, ageLabel, activePreset, invalidatedPreset }
}
