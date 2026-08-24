/**
 * OutletDeliveries › Index — row presets for the manifest list views. Layer 3.
 *
 * These shape rows FOR THE LIST COMPONENT: which fields form the label and caption, what
 * the meta column shows, which direction each view sorts in. Display assembly, not a
 * business rule, so it stays under `_ui/` and calls INTO the domain layer for every derived
 * value it renders (§4).
 *
 * ── ORDERING IS A WORK ORDER ──
 * Awaiting action → OLDEST first, because the longest wait is the most urgent. Settled →
 * NEWEST first, because the most recent completion is the interesting one (§7.2).
 *
 * ── THE AGE CHIP ──
 * An open run carries an OUTLINED age chip, so a screen of them reads as a scale rather
 * than a wall of solid colour. A settled run drops the urgency chip entirely and shows its
 * state instead: on a completed manifest the same age is history, not a queue position
 * (§7.2).
 *
 * Every slot a preset does not want is set to an explicit `null` rather than omitted —
 * `useListStrategy` supplies chip/meta defaults and `contents/List.vue` layers explicit
 * props OVER that baseline, so an omitted key re-admits the inference instead of
 * suppressing it.
 *
 * Named PURE exports — importable from the page contract, which is evaluated outside any
 * component setup; the composable wrapper follows for setup-context callers (§2.2).
 */

import {
  sortByDate,
  settledAt,
  daysSince,
  ageColor,
  isActiveRow,
  isDraft,
  isInTransit,
  isCompleted,
  isCancelled,
  progressOf,
  progressLabel,
  orsisForDelivery
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

const text = (value) => (value == null ? '' : String(value).trim())
const asList = (value) => (Array.isArray(value) ? value : [])

/** Human age label — "Today", "Yesterday", "6 days". Blank when unknown. */
export function ageLabel (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

/** Joins with a bullet, dropping blanks so no separator is ever left dangling. */
export function joinParts (parts) {
  return asList(parts).filter((part) => text(part)).join(' • ')
}

/**
 * How many lines a manifest carries, from its own CSV.
 *
 * Deliberately NOT the delivered ratio: computing that per row would need the whole
 * `OutletRestockItems` sheet indexed inside a list projection, and a preset is invoked per
 * row on every render. The ratio belongs on the View page, where the rows are already
 * loaded for the item card. A count is the honest thing a row CAN say cheaply.
 */
export function itemCount (row) {
  return orsisForDelivery(row).length
}

/** The driver, falling back to nothing rather than to a placeholder. */
export function driverName (row) {
  return text(row?.UserName)
}

/**
 * The shared skeleton: driver over a caption, line count in the meta column.
 */
function basePreset (items, { direction, caption, extra = {} }) {
  return {
    items: sortByDate(asList(items).filter(isActiveRow), 'Date', direction),
    layout: ['label', 'caption'],
    label: (row) => driverName(row) || text(row?.Code),
    caption,
    metaLayout: ['chip'],
    chip: (row) => ageLabel(daysSince(settledAt(row))),
    chipColor: (row) => ageColor(daysSince(settledAt(row))),
    chipOutline: true,
    badge: null,
    meta: null,
    metaLabel: null,
    metaCaption: null,
    ...extra
  }
}

/** Loaded but not departed. Oldest first — a draft sitting since Monday is the problem. */
export function pendingPreset (items) {
  return basePreset(asList(items).filter(isDraft), {
    direction: 'asc',
    caption: (row) => joinParts([`${itemCount(row)} items`, text(row?.Date)])
  })
}

/** On the road. Oldest first, for the same reason. */
export function inTransitPreset (items) {
  return basePreset(asList(items).filter(isInTransit), {
    direction: 'asc',
    caption: (row) => joinParts([`${itemCount(row)} items`, text(row?.ProgressInTransitBy) && `departed with ${text(row.ProgressInTransitBy)}`])
  })
}

export function completedPreset (items) {
  return basePreset(asList(items).filter(isCompleted), {
    direction: 'desc',
    caption: (row) => joinParts([`${itemCount(row)} items`, text(row?.Date)]),
    extra: {
      chip: (row) => progressLabel(progressOf(row)),
      chipColor: 'positive',
      chipOutline: false
    }
  })
}

export function cancelledPreset (items) {
  return basePreset(asList(items).filter(isCancelled), {
    direction: 'desc',
    // The reason a run was abandoned is the fact worth carrying here — unlike
    // `OutletReturns`, this sheet HAS a `CancelledComment` column, so it persists.
    caption: (row) => joinParts([`${itemCount(row)} items`, text(row?.CancelledComment)]),
    extra: {
      chip: (row) => progressLabel(progressOf(row)),
      chipColor: 'negative',
      chipOutline: false
    }
  })
}

// Composable shape for setup-context callers. Same functions, one import (§2.2).
export function useDeliveryRowPresets () {
  return {
    ageLabel,
    joinParts,
    itemCount,
    driverName,
    pendingPreset,
    inTransitPreset,
    completedPreset,
    cancelledPreset
  }
}
