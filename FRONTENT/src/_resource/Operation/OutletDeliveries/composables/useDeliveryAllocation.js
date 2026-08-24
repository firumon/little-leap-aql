/**
 * OutletDeliveries › the unassigned allocation queue — Layer 2.
 *
 * "Which allocated restock lines are not yet on a delivery run?" is the question the whole
 * module is organised around: it is the Index's outstanding-work metric, the Add page's
 * selection set, and the Edit page's add-more list.
 *
 * ── WHY IT LIVES HERE AND NOT IN OutletRestocks ──
 * §10.6's rule is that a domain helper belongs to the resource that OWNS the rows the
 * question is really about. This one looks like a question about `OutletRestockItems`, but
 * the predicate that does the work is "…not claimed by an ACTIVE manifest" — and what
 * counts as an active manifest is `OutletDeliveries`' own vocabulary. Putting it on the
 * restock side would force that resource to import this one's state machine, inverting the
 * cascade (§10.1).
 *
 * ── WHY IT IS ITS OWN FILE ──
 * `useDeliveryProgress.js` is the manifest's vocabulary and `useDeliveryPayload.js` builds
 * mutations. This is neither: it is a read-side projection across two resources, and it is
 * the one place in the module that indexes a large sheet. Keeping it separate holds both
 * neighbours under the file-size rule (CORE_ARCHITECTURE_RULES §9) and makes the indexing
 * cost obvious to anyone reading it.
 *
 * PURE throughout: every row it needs is an argument. No refs, no injects, no stores.
 */

import { ITEM_ALLOCATED, isCancelled, orsisForDelivery } from './useDeliveryProgress'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])

/** A blank Status is Active — the sheet only writes the column when it is set. */
const isActiveRow = (row) => text(asRow(row).Status || 'Active') === 'Active'

/**
 * Every `OutletRestockItems` code already claimed by a manifest that still counts.
 *
 * CANCELLED manifests are EXCLUDED, and that exclusion is the whole point: cancelling a run
 * is what releases its lines back to the queue, so a cancelled manifest must stop claiming
 * them the moment it is cancelled. Inactive (soft-deleted) manifests are excluded for the
 * same reason.
 *
 * COMPLETED manifests DO still claim their lines. Those lines are delivered and will not
 * pass the `ALLOCATED` filter anyway, but a completed run keeps its claim so that a line
 * somehow left un-delivered on a closed manifest is not silently re-offered to another van
 * while still recorded as belonging to the first.
 *
 * ONE `Set`, built in ONE pass over the manifests. Every caller below does `O(1)` reads into
 * it rather than scanning manifests per line (ARCHITECTURE RULES §6).
 */
export function claimedItemCodes (deliveryRows = []) {
  const claimed = new Set()
  for (const raw of asList(deliveryRows)) {
    const row = asRow(raw)
    if (!isActiveRow(row)) continue
    if (isCancelled(row)) continue
    for (const code of orsisForDelivery(row)) claimed.add(code)
  }
  return claimed
}

/**
 * The allocated lines that are free to be bundled onto a new run.
 *
 * Three conditions, and each excludes a genuinely different thing:
 *   - `Status` Active            — not soft-deleted;
 *   - `Progress === ALLOCATED`   — stock is committed to it and it has not yet been
 *                                  delivered or cancelled. A PENDING line has no stock
 *                                  behind it and cannot be loaded onto a van;
 *   - not in `claimedItemCodes`  — no live manifest is already carrying it.
 *
 * Returns the rows themselves, spread-safe and un-narrowed, so a caller can group and
 * display them without re-reading the store for attributes this filter happened not to need
 * (CORE_ARCHITECTURE_RULES §6, "Non-Destructive Entity Travel").
 */
export function availableAllocatedItems (orsiRows = [], deliveryRows = []) {
  const claimed = claimedItemCodes(deliveryRows)
  return asList(orsiRows)
    .map(asRow)
    .filter((row) => text(row.Code))
    .filter(isActiveRow)
    .filter((row) => text(row.Progress) === ITEM_ALLOCATED)
    .filter((row) => !claimed.has(text(row.Code)))
}

/**
 * The same set, plus the lines a GIVEN manifest already carries.
 *
 * What the Edit page's "add more items" list needs: a manifest's own lines are claimed — by
 * itself — so the plain available set would exclude exactly the rows the editor must be
 * able to see and keep. Excluding this manifest from the claim pass is what makes its
 * current line-up visible alongside what it could add.
 */
export function itemsSelectableFor (record = {}, orsiRows = [], deliveryRows = []) {
  const selfCode = text(asRow(record).Code)
  const others = asList(deliveryRows).filter((row) => text(asRow(row).Code) !== selfCode)
  const claimed = claimedItemCodes(others)
  const mine = new Set(orsisForDelivery(record))

  return asList(orsiRows)
    .map(asRow)
    .filter((row) => text(row.Code))
    .filter(isActiveRow)
    // A line already on this manifest is kept whatever its progress, so a delivered one
    // still renders (locked) instead of vanishing from the editor mid-run.
    .filter((row) => mine.has(text(row.Code)) || text(row.Progress) === ITEM_ALLOCATED)
    .filter((row) => mine.has(text(row.Code)) || !claimed.has(text(row.Code)))
}

/**
 * How many distinct outlets the unassigned queue spans.
 *
 * Takes a resolver rather than reading the parent restocks itself: an `OutletRestockItems`
 * row carries no `OutletCode` — the outlet lives on its parent request — and this module
 * does not get to decide how a caller resolves that link. The Index widget passes an
 * `O(1)` map lookup built once from the restock rows.
 */
export function outletsInQueue (items = [], outletCodeOf = () => '') {
  const outlets = new Set()
  for (const row of asList(items)) {
    const code = text(outletCodeOf(row))
    if (code) outlets.add(code)
  }
  return outlets
}

/** Total units waiting to go out — the queue's size in stock, not in rows. */
export function unitsInQueue (items = []) {
  let total = 0
  for (const row of asList(items)) total += Math.abs(Number(asRow(row).Quantity) || 0)
  return total
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useDeliveryAllocation () {
  return {
    claimedItemCodes,
    availableAllocatedItems,
    itemsSelectableFor,
    outletsInQueue,
    unitsInQueue
  }
}
