
import { hoursFromNow, daysFromToday } from 'src/utils/dateHelpers'
import {
  sortByDate,
  isCompleted,
  isCancelled,
  isActiveRow,
  progressOf,
  progressColor,
  progressLabel,
  invoiceAdjustmentRequired,
  invoiceAdjustmentDone,
  warehouseActionRequired,
  warehouseActionCompleted
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

const text = (value) => (value == null ? '' : String(value).trim())
const asList = (value) => (Array.isArray(value) ? value : [])

/** Outlet display name, through the relation getter, falling back to the raw code. */
export function outletName (row) {
  return row?.$outlet?.Name || text(row?.OutletCode) || text(row?.Code) || ''
}

export function skuName (row) {
  const sku = row?.$sku
  const product = sku?.$product?.Name || sku?.Name || text(row?.SKU)
  const variants = [sku?.Variant1, sku?.Variant2, sku?.Variant3, sku?.Variant4, sku?.Variant5]
    .map(text).filter(Boolean).join(' / ')
  return variants ? `${product} ${variants}` : text(product)
}

/** Joins with a bullet, dropping blanks so no separator is ever left dangling. */
export function joinParts (parts) {
  return asList(parts).filter((part) => text(part)).join(' • ')
}

export function outstandingCaption (row) {
  const owed = []
  if (invoiceAdjustmentRequired(row) && !invoiceAdjustmentDone(row)) owed.push('invoice credit')
  if (warehouseActionRequired(row) && !warehouseActionCompleted(row)) owed.push('warehouse receipt')
  if (!owed.length) return 'Nothing outstanding'
  return `Awaiting ${owed.join(' + ')}`
}

/** `3x Blue Widget 500ml` — what came back, at a glance. */
export function quantityAndItem (row) {
  const qty = Math.abs(Number(row?.Qty) || 0)
  return `${qty}x ${skuName(row)}`
}

/** `2026-08-14 • asha` — when, and who logged it. */
export function dateAndUser (row) {
  return joinParts([text(row?.Date), text(row?.Username)])
}

// Two DISTINCT caption lines need `content`; a repeated 'caption' in `layout` prints one twice.
function basePreset (items, { direction, extra = {} }) {
  return {
    items: sortByDate(asList(items).filter(isActiveRow), 'Date', direction),
    layout: ['caption', 'label', 'caption'],
    content: [dateAndUser, outletName, quantityAndItem],
    label: outletName,
    metaLayout: ['chip'],
    chip: (row) => progressLabel(progressOf(row)),
    chipColor: (row) => progressColor(progressOf(row)),
    chipOutline: true,
    badge: null,
    meta: null,
    metaLabel: null,
    metaCaption: null,
    ...extra
  }
}

/** Everything still moving. Oldest first: the longest wait is most urgent. */
export function submittedPreset (items) {
  return basePreset(asList(items).filter((row) => !isCompleted(row) && !isCancelled(row)), {
    direction: 'asc'
  })
}

export function awaitingInvoicePreset (items) {
  return basePreset(
    asList(items).filter((row) =>
      !isCompleted(row) && !isCancelled(row) &&
      invoiceAdjustmentRequired(row) &&
      !invoiceAdjustmentDone(row)),
    {
      direction: 'asc',
      extra: {
        chip: () => 'Awaiting Credit',
        chipColor: () => 'info',
        chipOutline: false
      }
    }
  )
}

/** The warehouse queue, on the same reasoning as the credit one. */
export function awaitingWarehousePreset (items) {
  return basePreset(
    asList(items).filter((row) =>
      !isCompleted(row) && !isCancelled(row) &&
      warehouseActionRequired(row) &&
      !warehouseActionCompleted(row)),
    {
      direction: 'asc',
      extra: {
        chip: () => 'Awaiting Stock',
        chipColor: () => 'purple',
        chipOutline: false
      }
    }
  )
}

/** Human age label — "Today", "Yesterday", "6 days". Blank when unknown. */
export function ageLabel (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

/** The stamp that answers "when did this return last move?". No `settledAt` on this sheet. */
export function lastMovedAt (row) {
  return text(row?.UpdatedAt) || text(row?.CreatedAt) || text(row?.Date)
}

// `ageLabel` alone reads badly at both ends: "Today" hides a return logged a minute ago,
// and "400 days" is a number nobody converts in their head.
export function recentAgeLabel (row) {
  const stamp = lastMovedAt(row)
  const hours = hoursFromNow(stamp)
  if (!Number.isNaN(hours)) {
    const past = Math.max(0, -hours)
    if (past < 1) return 'Just now'
    if (past < 24) return past === 1 ? '1 hour ago' : `${past} hours ago`
  }
  const days = -daysFromToday(stamp)
  if (days === null || days === undefined || Number.isNaN(days)) return ''
  if (days > 99) return `${Math.floor(days / 30)} months`
  return ageLabel(days)
}

/**
 * "Recent" — the latest 50 live returns, newest first, whatever state they are in.
 *
 * Cancelled returns are left out: an abandoned return never settled anything, so it is not
 * part of "what moved lately?". The cap is a hard 50 for the same reason.
 */
export function recentPreset (items) {
  const live = asList(items).filter(isActiveRow).filter((row) => !isCancelled(row))

  return basePreset(live, {
    direction: 'desc',
    extra: {
      items: sortByDate(live, lastMovedAt, 'desc').slice(0, 50),
      metaLayout: ['chip', 'badge'],
      chip: recentAgeLabel,
      chipColor: 'grey-7',
      chipOutline: true,
      badge: (row) => progressLabel(progressOf(row)),
      badgeColor: (row) => progressColor(progressOf(row))
    }
  })
}

export function completedPreset (items) {
  return basePreset(asList(items).filter(isCompleted), {
    direction: 'desc',
    extra: { chipOutline: false }
  })
}

export function cancelledPreset (items) {
  return basePreset(asList(items).filter(isCancelled), {
    direction: 'desc',
    extra: { chipOutline: false }
  })
}

// Composable shape for setup-context callers. Same functions, one import (§2.2).
export function useReturnRowPresets () {
  return {
    outletName,
    skuName,
    joinParts,
    outstandingCaption,
    quantityAndItem,
    dateAndUser,
    ageLabel,
    lastMovedAt,
    recentAgeLabel,
    recentPreset,
    submittedPreset,
    awaitingInvoicePreset,
    awaitingWarehousePreset,
    completedPreset,
    cancelledPreset
  }
}
