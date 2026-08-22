
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
        chip: () => 'Credit Owed',
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
        chip: () => 'Stock Owed',
        chipColor: () => 'purple',
        chipOutline: false
      }
    }
  )
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
    submittedPreset,
    awaitingInvoicePreset,
    awaitingWarehousePreset,
    completedPreset,
    cancelledPreset
  }
}
