import {
  sortByDate,
  settledAt,
  stampOf,
  daysSince,
  ageColor,
  progressOf,
  progressColor,
  typeMeta,
  priorityMeta,
  isOwnedBy
} from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionProgress'

const text = (value) => String(value ?? '').trim()

export function requisitionLabel (row) {
  const type = typeMeta(row?.Type).label
  const warehouse = row?.$warehouse?.Name || text(row?.WarehouseCode)
  return [type, warehouse].filter(Boolean).join(' • ') || text(row?.Code)
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
    label: requisitionLabel,
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

// "My Drafts" claims a person, which the sheet filter cannot check under an
// owner-and-upline policy — so the rows are scoped here.
export function draftsPreset (items, userId = null) {
  const own = userId ? (Array.isArray(items) ? items : []).filter((row) => isOwnedBy(row, userId)) : items
  return agedPreset(own, {
    direction: 'desc',
    caption: (row) => joinParts([row.PRDate, priorityMeta(row.Priority).label])
  })
}

export function pendingApprovalPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => joinParts([priorityMeta(row.Priority).label, row.RequiredDate ? `needed ${row.RequiredDate}` : ''])
  })
}

export function needsRevisionPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => stampOf(row, 'ProgressRevisionRequired').comment
  })
}

export function approvedPreset (items) {
  return agedPreset(items, {
    direction: 'asc',
    caption: (row) => joinParts([row.RequiredDate, stampOf(row, 'ProgressApproved').comment])
  })
}

export function rfqProcessedPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => joinParts([row.PRDate, text(row.ProcurementCode)])
  })
}

export function rejectedPreset (items) {
  return agedPreset(items, {
    direction: 'desc',
    caption: (row) => stampOf(row, 'ProgressRejected').comment
  })
}

export function usePurchaseRequisitionRowPresets () {
  return {
    requisitionLabel,
    joinParts,
    ageLabel,
    draftsPreset,
    pendingApprovalPreset,
    needsRevisionPreset,
    approvedPreset,
    rfqProcessedPreset,
    rejectedPreset
  }
}
