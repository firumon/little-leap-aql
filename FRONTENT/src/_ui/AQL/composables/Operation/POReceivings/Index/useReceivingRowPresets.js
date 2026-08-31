import {
  sortByDate,
  settledAt,
  stampOf,
  daysSince,
  ageColor,
  progressOf,
  progressColor,
  isOwnedBy
} from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'

const text = (value) => String(value ?? '').trim()

export function receivingLabel (row) {
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

function agedPreset (items, { direction, caption, extra = {} }) {
  return {
    items: sortByDate(items, settledAt, direction),
    layout: ['label', 'caption'],
    label: receivingLabel,
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

export function draftsPreset (items, userId = null) {
  const own = userId ? (Array.isArray(items) ? items : []).filter((row) => isOwnedBy(row, userId)) : items
  return agedPreset(own, {
    direction: 'desc',
    caption: (row) => joinParts([row.InspectionDate, row.InspectedUserName])
  })
}

export function confirmedPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => joinParts([row.InspectionDate, stampOf(row, 'ProgressConfirmed').comment])
  })
}

export function grnGeneratedPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => joinParts([row.InspectionDate, stampOf(row, 'ProgressGRNGenerated').by])
  })
}

export function cancelledPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => stampOf(row, 'ProgressCancelled').comment
  })
}

export function useReceivingRowPresets () {
  return { receivingLabel, joinParts, ageLabel, draftsPreset, confirmedPreset, grnGeneratedPreset, cancelledPreset }
}
