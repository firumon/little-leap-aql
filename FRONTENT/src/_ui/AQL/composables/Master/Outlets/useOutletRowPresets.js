import {
  ageInDays,
  activityColor,
  activityLabel,
  ACTIVITY_STREAMS
} from 'src/_resource/Master/Outlets/composables/useOutletActivity'

const text = (value) => (value == null ? '' : String(value).trim())

export function locationLine (summary) {
  return [summary?.province, summary?.city, summary?.area]
    .map(text)
    .filter(Boolean)
    .join(' · ') || 'No location recorded'
}

export function rowAgeDays (summary, stream) {
  if (!summary) return null
  if (!stream) return summary.lastActivityDays ?? null
  return ageInDays(summary.streams?.[stream]?.lastAt)
}

export function rowActivityCaption (summary, stream) {
  if (!summary) return ''
  if (stream) {
    const matched = ACTIVITY_STREAMS.find((item) => item.key === stream)
    return matched ? matched.label : stream
  }
  return summary.lastActivityStreamLabel || (summary.lastActivityDays === null ? 'No activity' : '')
}

export function outletRowPreset (rows = [], {
  stream = null,
  keyword = '',
  emptyText = '',
  emptyIcon = 'storefront',
  emptyIconColor = '',
  metaMode = 'chip'
} = {}) {
  const searching = !!String(keyword || '').trim()
  const isLabelMode = metaMode === 'label'

  return {
    items: Array.isArray(rows) ? rows : [],
    itemKey: 'code',

    emptyText: searching
      ? `No outlet in this view matches “${String(keyword).trim()}”.`
      : emptyText,
    emptyIcon: searching ? 'search_off' : emptyIcon,
    emptyIconColor: searching ? 'grey-4' : (emptyIconColor || 'grey-4'),

    layout: ['label', 'caption'],
    content: [
      (row) => text(row.name) || text(row.code),
      (row) => locationLine(row)
    ],

    metaLayout: isLabelMode ? ['label', 'caption'] : ['chip'],
    metaLabel: isLabelMode ? (row) => activityLabel(rowAgeDays(row, stream)) : null,
    metaCaption: isLabelMode ? (row) => rowActivityCaption(row, stream) : null,
    metaColor: isLabelMode ? (row) => activityColor(rowAgeDays(row, stream)) : null,

    chip: !isLabelMode ? (row) => activityLabel(rowAgeDays(row, stream)) : null,
    chipColor: !isLabelMode ? (row) => activityColor(rowAgeDays(row, stream)) : null,
    chipOutline: !isLabelMode,

    meta: null,
    badge: null,
    icon: null,

    clickable: true
  }
}

