/**
 * OutletReturns › Index — row presets for the three list views. Layer 3, presentation.
 *
 * These shape rows FOR THE LIST COMPONENT: which fields form the label and caption, what
 * the meta column shows, which direction each view sorts in. That is display assembly, not
 * a business rule, so it stays under `_ui/` and calls INTO the domain layer for every
 * derived value it renders (UI_RESOURCE_DOMAIN_LOGIC.md §4).
 *
 * Not one predicate is re-derived: `progressColor`, `reasonLabel`, `isOpen` and the state
 * constants all come from `_resource/Operation/OutletReturns/composables/useReturnProgress`,
 * so a row chip and the widget above it read the same vocabulary.
 *
 * ── WHY THE OPEN VIEW FILTERS ON `isOpen`, NOT ON `Progress === SUBMITTED` ──
 * The consumption path has been writing the legacy `AWAITING_WAREHOUSE_RECEIPT` state for
 * as long as it has existed, so live data holds unresolved returns in more than one
 * non-terminal state. A view filtering on the literal would silently hide every return a
 * consumption ever raised. `isOpen` claims all three. See `LEGACY_STATES` in the
 * vocabulary file.
 *
 * ── ORDERING ──
 * Awaiting action → OLDEST first, because the longest wait is the most urgent. Settled →
 * NEWEST first, because the most recent completion is the interesting one (§7.2).
 *
 * ── NO ROW ACTION CLUSTER ──
 * Every one of these views is read-then-open: the work a return needs is chosen on its
 * View page, where the two tracks are visible. §7.3 rule 2 is therefore not engaged — no
 * `btn` is supplied, so `abstract/List.vue` keeps whole-row tap navigation, which is the
 * larger touch target on a phone. Adding a lone View button would shrink the tap area to
 * an icon and gain nothing.
 *
 * Named PURE exports — importable from the page contract, which is evaluated outside any
 * component setup; the composable wrapper follows for setup-context callers (§2.2).
 */

import {
  COMPLETED,
  sortByDate,
  isOpen,
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

/**
 * SKU display name via the relation getter, with its variants.
 *
 * `Relations` declares `SKU -> { labelHeader: '$product.Name' }`, so the enriched row already
 * carries the product; the variants come off the SKU row beside it. Re-deriving either from
 * the SKUs store here would be a second implementation reached by the slowest route
 * (CORE_ARCHITECTURE_RULES §6, "Enrich Once, Then Project").
 */
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

/**
 * What is still owed on an open return, in the reader's own words.
 *
 * Kept as an export because the View page and the action routes phrase the same fact, but
 * it is no longer a row caption — see `ROW SHAPE` below.
 */
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

/**
 * ── ROW SHAPE ──
 *
 *   caption 1  `<date> • <username>`
 *   label      outlet name
 *   caption 2  `<qty>x <product> <variants>`
 *   meta chip  progress
 *
 * The stamp reads FIRST, above the name: it is what the eye scans a ledger by, and the
 * outlet then reads as the heading of the row rather than competing with the date beside
 * it. Every list of returns carries this same shape — only the meta column differs per
 * view, so the difference between two lists is never the shape of a row.
 *
 * Two DISTINCT caption lines, which `layout` alone cannot express: a repeated `'caption'`
 * entry resolves the single `caption` prop twice and would print the same line twice. The
 * `content` ARRAY is the mechanism — `abstract/List.vue` uses it in place of the
 * layout-derived array, so each row type still styles its own cell while the values differ.
 *
 * Every slot this preset does not want is set to an explicit `null` rather than omitted —
 * `useListStrategy` supplies chip/meta defaults and `contents/List.vue` layers explicit
 * props OVER that baseline, so an omitted key re-admits the inference instead of
 * suppressing it (§7.2).
 */
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

/**
 * ── THE FIVE VIEWS ──
 *
 * The names are the SERVER's, not this file's: `ListSwitcher` renders whatever
 * `effectiveViews` declares, and `contents/List.vue` looks for a `PropsList<PascalCase>`
 * block per view name. A preset keyed on a name no view carries is simply never reached —
 * which is exactly what happened while this file exported `openPreset` for a view called
 * "Submitted".
 *
 *   Submitted                     everything still moving — not completed, not cancelled
 *   Awaiting Invoice Adjustment   the credit is owed and has not been issued
 *   Awaiting Warehouse Receipt    the stock is owed and has not moved
 *   Completed                     settled
 *   Cancelled                     voided
 *
 * The two AWAITING views are deliberately NOT complements of each other: a return with both
 * tracks open appears in both, because it is genuinely two pieces of outstanding work owed
 * to two different people. They gate on `Progress !== COMPLETED` plus the track's own
 * required/done pair rather than on `isOpen`, so a row the consumption path stamped
 * COMPLETED at creation cannot reappear in a queue it has already left.
 *
 * ORDERING — awaiting anything sorts OLDEST first, because the longest wait is the most
 * urgent. Settled and voided sort NEWEST first, because the most recent one is the
 * interesting one (§7.2).
 */

/** Everything still moving. Oldest first: the longest wait is most urgent. */
export function submittedPreset (items) {
  return basePreset(asList(items).filter((row) => !isCompleted(row) && !isCancelled(row)), {
    direction: 'asc'
  })
}

/**
 * The credit queue. The meta chip states WHOSE money it is rather than repeating the
 * workflow state — inside a view whose whole membership rule is "the credit is owed", a
 * Progress chip says the same word on every row and reads as decoration.
 */
export function awaitingInvoicePreset (items) {
  return basePreset(
    asList(items).filter((row) =>
      progressOf(row) !== COMPLETED &&
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
      progressOf(row) !== COMPLETED &&
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

/**
 * Settled returns. Newest first, and the chip goes solid — on a closed row the state is
 * history rather than a queue position, so it stops reading as a scale (§7.2).
 */
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

/**
 * Retained under its old name for the Outlet Hub and anything else that wants "the work
 * queue" without knowing which view it is looking at.
 */
export function openPreset (items) {
  return basePreset(asList(items).filter(isOpen), { direction: 'asc' })
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
    cancelledPreset,
    openPreset
  }
}
