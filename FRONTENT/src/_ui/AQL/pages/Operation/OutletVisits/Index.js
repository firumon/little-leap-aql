import {
  tomorrowPreset,
  upcomingsPreset,
  settledPreset
} from 'src/_ui/AQL/composables/Operation/OutletVisits/useVisitPresentation'

/**
 * OutletVisits › Index — page contract (tier CP: resource + page specific).
 *
 * The five read-only list views are configured here as `Props<Identity>` blocks rather
 * than as standalone `List<View>.js` modifier files. A per-view override only needs its
 * own file when it brings a template (`ListToday.vue`) or a component-valued prop
 * (`ListOverdue.js` mounts `VisitActionButtons` as `btn`); a plain prop bag belongs in
 * the page contract, where the whole page's list behaviour reads in one place.
 * See UI_MODULE_DEVELOPER_GUIDE.md §8.4.
 *
 * Each block is a FUNCTION, so it is evaluated with the live props bag on every read and
 * receives the active view's already-filtered `items` — which is what lets it re-sort
 * them. A static object could not see the rows.
 *
 * Views still carrying row actions (Cancel / Postpone / Complete) are `Today` and
 * `Overdue`; both keep their own files. Everything below is browse-only, so no `btn` is
 * supplied and `contents/List.vue`'s default click handler opens the View page.
 */
export default {
  sections: ['PageHeader', 'MetricCards', 'LinearProgress', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],

  PropsListTomorrow: (props) => tomorrowPreset(props.items),
  PropsListUpcomings: (props) => upcomingsPreset(props.items),
  PropsListCompleted: (props) => settledPreset(props.items),
  PropsListPostponed: (props) => settledPreset(props.items),
  PropsListCancelled: (props) => settledPreset(props.items)
}
