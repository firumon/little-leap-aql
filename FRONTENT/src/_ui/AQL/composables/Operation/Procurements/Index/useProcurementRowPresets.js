import {
  sortByDate,
  settledAt,
  daysSince,
  ageColor,
  progressOf,
  progressColor,
  progressLabel
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'

const text = (value) => String(value ?? '').trim()

export function procurementLabel (row) {
  return text(row?.Code)
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

function agedPreset (items, direction) {
  return {
    items: sortByDate(items, settledAt, direction),
    layout: ['label', 'caption'],
    label: procurementLabel,
    caption: (row) => joinParts([progressLabel(row.Progress), row.InitiatedDate, row.CreatedUser]),
    metaLayout: ['chip'],
    chip: (row) => ageLabel(daysSince(settledAt(row))),
    chipColor: (row) => ageColor(daysSince(settledAt(row))),
    chipOutline: true,
    meta: null,
    badge: null,
    metaLabel: null,
    metaCaption: null,
    highlightColor: (row) => progressColor(progressOf(row))
  }
}

// In-flight work reads oldest first; settled history reads newest first.
export function inFlightPreset (items) {
  return agedPreset(items, 'asc')
}

export function settledPreset (items) {
  return agedPreset(items, 'desc')
}

export function useProcurementRowPresets () {
  return { procurementLabel, joinParts, ageLabel, inFlightPreset, settledPreset }
}
