import {
  recentPreset,
  completedPreset,
  cancelledPreset
} from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Index/useConsumptionRowPresets'

/**
 * OutletConsumptions › Index — page contract (tier CP: resource + page specific).
 *
 * The page answers four questions in descending order of urgency, and the section stack IS
 * that order (UI_MODULE_DEVELOPER_GUIDE §9.1):
 *
 *   1. Immediate action   `MetricCards`    — audits done today, overdue outlets, the
 *                                            invoice backlog and how many outlets it spans
 *   2. Pipeline health    `Gauge`          — how much of TODAY's plan is closed
 *   3. Backlog risk       `AgeingBuckets`  — how far past cadence the neglected outlets are
 *   4. Work execution     `FilterInput`, `ListSwitcher`, `List`
 *
 * Every one of those widgets hides itself when it has nothing to say, so a tenant with no
 * consumptions yet sees a bare list rather than a wall of zeroes.
 *
 * `Gauge` is a NEW generic section base (`src/components/sections/Gauge.vue`), added
 * because no existing base states a bounded same-day target — `LinearProgress` reads as
 * accumulation over a backlog. It is generic and reusable by any resource, never a bespoke
 * component private to this module (§9.2).
 *
 * ── THE FOUR VIEWS ────────────────────────────────────────────────────────────
 *
 * `Recent` (DEFAULT) opens the page — the latest 50 live audits, newest first, so a
 * returning officer sees what moved without having to pick a queue first.
 *
 * `InvoiceableOutlets` is a PROJECTION and needs a template, so it is a `.vue` override
 * rather than a props block: one row per OUTLET carrying uninvoiced consumptions, heaviest
 * backlog first, so a bundling trip is planned from one row.
 *
 * The last two are ordinary state filters over this resource's own rows, so they are
 * `Props<Identity>` blocks here — where the whole page's list behaviour reads in one place
 * — rather than two files that would carry nothing but a prop bag (§5.3):
 *
 *   Completed           invoiced and finished, newest first, no urgency chip
 *   Cancelled           newest first, captioned with the cancellation reason
 *
 * Each block is a FUNCTION, so it is evaluated with the live props bag on every read and
 * receives the active view's already-filtered `items` — which is what lets it re-sort
 * them. A static object could not see the rows, and a JS modifier (resolved once, then
 * cached) would freeze them at whatever the store held on first render (§5.2).
 *
 * No row action clusters anywhere on this page. Every row here has exactly one thing to
 * do — open the audit, or start one — and `abstract/List.vue` turns off whole-row tap the
 * moment a row carries a `btn`, which would cost phone width to hand back a View button
 * that duplicates the tap it just disabled (§7.3).
 */
export default {
  sections: [
    'PageHeader',
    'MetricCards',
    'Gauge',
    'AgeingBuckets',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Consumptions',
    subtitle: 'Stock consumptions · count, invoice, restock'
  },

  PropsListRecent: (props) => recentPreset(props.items),
  PropsListCompleted: (props) => completedPreset(props.items),
  PropsListCancelled: (props) => cancelledPreset(props.items)
}
