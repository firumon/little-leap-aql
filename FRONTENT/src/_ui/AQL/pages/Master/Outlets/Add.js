/**
 * Outlets › Add — page contract (tier CP: resource + page specific).
 *
 * ONE page, TWO records: the outlet itself, then — below a divider — the operating rules it
 * trades on. `Outlets` → `OutletOperatingRules` is a declared 1:1 parent/child relation, so
 * the framework's generated `Create` content already renders both and `pageState`'s composite
 * save already writes them in one atomic batch with the child's `OutletCode` filled in from
 * the parent the same request created.
 *
 * ── WHY A GENERATED FORM (§13.0) ──
 * The form's primary input is the resource's OWN COLUMNS — a name, an address, five numeric
 * limits. There is no derived tree, no allocation, no selection across child rows. That is
 * the generated shape's whole test, so the page narrows `_fields` rather than hand-assembling
 * controls, and a column added to the sheet appears here with no code change.
 *
 * ── WHY NO CUSTOM PAYLOAD BUILDER ──
 * A composite create of a parent and its 1:1 child is exactly what `pageState.build()`
 * already emits, `$ref`-linked, in one round trip. A resource-specific builder here would
 * restate that generic mechanism in a second place and would be the first thing to fall out
 * of step when the composite-save contract changes. Layer 2 payload builders exist for
 * CROSS-resource chains that the framework cannot know about
 * (UI_RESOURCE_DOMAIN_LOGIC.md §9); this is not one.
 *
 * `childMode: 'multi'` renders the rules as an always-open card of fields rather than an
 * "Add" button over an empty list — a 1:1 relation is a second section of one form, not a
 * collection someone chooses to start. `maxRecords: 1` is enforced beside it, at the resource
 * tier, so Add and Edit cannot disagree about it.
 *
 * `reload: false` on the header (§5.5): this page's data is owned by `pageState`, and
 * reloading mid-form discards what the user typed.
 */
export default {
  sections: ['PageHeader'],
  contents: ['Create'],

  PropsPageHeader: {
    title: 'New Outlet',
    subtitle: 'Outlet details, then the rules it operates under',
    reload: false
  },

  PropsCreate: {
    // The primary record's own section heading. The child's heading is derived from the
    // child resource, and `sectionTitles` names it in words a user recognises.
    title: 'Outlet Details',
    sectionTitles: { OutletOperatingRules: 'Operating Rules' },
    childMode: 'multi'
  }
}
