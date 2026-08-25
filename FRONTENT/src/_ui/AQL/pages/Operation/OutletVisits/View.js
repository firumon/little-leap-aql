/**
 * OutletVisits › View — page JS modifier (tier CP: resource + page specific).
 *
 * A JS modifier, NOT a `View.vue` full-page override: the three blocks below are
 * ordinary Section placeholders, so each stays independently overridable at all 10
 * `_ui/` tiers and the page keeps `ResourceBreadcrumb`, the entrance transition and
 * the `PageAction` FAB cluster that a full-page override would bypass.
 *
 * `PageHeader` is re-declared because `sections` REPLACES the base contract's array
 * (src/pages/Operation/view.js) rather than extending it — omitting it would drop the
 * page title and back arrow.
 *
 * `contents: []` skips `AqlContentWrapper` entirely: the generic `View` content is
 * replaced wholesale here, and the three sections each carry their own
 * loading / record-missing guard (a Section renders outside the wrapper, so it never
 * inherits the wrapper's gating).
 */
export default {
  sections: ['PageHeader', 'OutletDetails', 'VisitDetails', 'RecentVisits'],
  contents: [],

  // Declarative gating (useSectionResolver). A section that renders ANOTHER resource's
  // rows is hidden from a role that cannot read that resource; the rest render as before.
  permissions: {
    OutletDetails: ['Outlets:read:$OutletCode'],
    RecentVisits: ['OutletVisits:read']
  },

  // Spread FLAT onto their target section by useSectionResolver — a section reads
  // `props.title`, never `props.PropsVisitDetails.title`.
  // See UI_PAGE_AND_SECTION_SYSTEM.md §1.4.1.
  PropsOutletDetails: {
    title: 'Outlet',
    icon: 'storefront',
    color: 'primary',
    linkLabel: 'Open outlet'
  },

  PropsVisitDetails: {
    title: 'Visit Details'
  },

  PropsRecentVisits: {
    title: 'Recent Visits',
    limit: 4
  }
}
