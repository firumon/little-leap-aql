/**
 * Outlets › Edit — page contract (tier CP: resource + page specific).
 *
 * The twin of `Add.js`, and deliberately identical in shape: the same generated form, the
 * same divider, the same 1:1 rules card underneath. `Update` hydrates both records — the
 * outlet from `resourceRecord.record`, the rules row from `childRecordsByResource` — so an
 * outlet that already has rules opens with them filled in and an outlet that never had any
 * opens with one blank rules card ready to be its first.
 *
 * The two contracts stay in step because they narrow the SAME generated field set through the
 * SAME props; neither hand-assembles a field list, so a column added to either sheet appears
 * on both pages at once (§13.4 — Add and Edit share their cards).
 *
 * `Update`'s own defaults do the rest: the primary `Code` renders read-only so the user can
 * see which outlet they are editing, child `Code`s stay hidden, and `Status` becomes a normal
 * control rather than a silently-seeded default.
 *
 * `reload: false` on the header (§5.5) — reloading mid-form re-seeds the node underneath the
 * user and discards their edits.
 */
export default {
  sections: ['PageHeader'],
  contents: ['Update'],

  PropsPageHeader: {
    title: (record) => `Edit ${record?.Name || record?.name || 'Outlet'}`,
    reload: false
  },

  PropsUpdate: {
    title: 'Outlet Details',
    sectionTitles: { OutletOperatingRules: 'Operating Rules' },
    childMode: 'multi'
  }
}
