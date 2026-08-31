import {
  sortByDate,
  settledAt,
  stampOf,
  daysSince,
  ageColor,
  progressOf,
  progressColor,
  daysToDeadline,
  isOwnedBy
} from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

const text = (value) => String(value ?? '').trim()

export function rfqLabel (row) {
  return text(row?.Code) || text(row?.PurchaseRequisitionCode) || ''
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

export function deadlineLabel (row) {
  const days = daysToDeadline(row)
  if (!Number.isFinite(days)) return ''
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return 'Due today'
  return `${days} days left`
}

function agedPreset (items, { direction, caption, extra = {} }) {
  return {
    items: sortByDate(items, settledAt, direction),
    layout: ['label', 'caption'],
    label: rfqLabel,
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
    caption: (row) => joinParts([row.RFQDate, row.PurchaseRequisitionCode])
  })
}

export function sentPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => joinParts([row.RFQDate, deadlineLabel(row)])
  })
}

export function closedPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => joinParts([row.RFQDate, stampOf(row, 'ProgressClosed').comment])
  })
}

export function cancelledPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => joinParts([row.RFQDate, row.ProcurementCode])
  })
}

export function useRFQRowPresets () {
  return { rfqLabel, joinParts, ageLabel, deadlineLabel, draftsPreset, sentPreset, closedPreset, cancelledPreset }
}
