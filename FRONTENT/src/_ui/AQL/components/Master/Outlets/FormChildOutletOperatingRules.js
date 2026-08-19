/**
 * Outlets › FormChildOutletOperatingRules — JS modifier (tier C: resource-wide).
 *
 * `Outlets` → `OutletOperatingRules` is a ONE-TO-ONE relation: the sheet enforces it with a
 * `UniqueCompositeHeaders: 'OutletCode'` constraint, and a second rules row for one outlet
 * would be rejected by the backend after the user had already filled it in. `maxRecords: 1`
 * moves that refusal to the point where it is useful — the Add Row button simply never
 * appears once the one row exists.
 *
 * `OutletCode` stays hidden (`hideParentLink`, on by default): the composite save fills it
 * from the parent created in the same batch, and offering it as an input would let a user
 * point one outlet's rules at another.
 *
 * ── WHY THE RESOURCE TIER, NOT THE PAGE TIER ──
 * The rule is a property of the RELATION, not of a page. Filing it under `Add/` would leave
 * Edit free to add a second rules row, and the two pages would disagree about a constraint
 * the sheet holds absolutely (§3.1 — share by placement, not by copying).
 *
 * A JS modifier rather than a `PropsFormChild…` block on each contract, because it must apply
 * to both pages of the resource — which is exactly the case §5.3's table says earns a file.
 */
export default function () {
  return {
    maxRecords: 1,
    // An always-open card of fields, not a list with an Add button: a 1:1 relation is a
    // second section of one form, not a collection the user chooses to start.
    childMode: 'multi',
    title: 'Operating Rules'
  }
}
