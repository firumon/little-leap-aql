import { ref, computed, inject } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useOutletIndex } from 'src/_resource/Master/Outlets/composables/useOutletIndex'
import {
  ACTIVITY_WINDOW_DAYS,
  activityColor,
  activityLabel
} from 'src/_resource/Master/Outlets/composables/useOutletActivity'

/**
 * Outlets › the injection relay for every estate-wide outlet surface
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * ONE `inject()` for the Operation Hub's widgets AND for the six shared list views, and the
 * one place their imports of `useResourceNav`, `useRecord` and the Layer 2 aggregate legally
 * live.
 *
 * ── PLACEMENT: the RESOURCE tier, not a page folder (§6.2) ──
 * The test is not "does this inject" — it is WHICH PAGES PROVIDE the context it injects. Two
 * do: the Outlets Index (the plain directory) and `operation-hub` (the intelligence page).
 * Both provide the same `resourceRecord`/`resourceConfig` shape and both resolve the same six
 * `List<View>.vue` components, which therefore sit at the resource tier too. A page-scoped
 * copy of this composable would have forced a page-scoped copy of all six lists — the exact
 * drift "share by placement, not by copying" exists to prevent (§3.1).
 *
 * ── WHY THIS PRELOADS SIX OTHER RESOURCES ──
 * Every figure the hub exists to show — the three pending queues, the two visit queues, the
 * activity ratio, and five of the six list views — lives in resources neither route asks for.
 * Without the preload below the page renders a correct outlet list surrounded by widgets that
 * are all legitimately, permanently empty.
 *
 * `Outlets` itself is in that list, and only because of the sub-route: `usePageResolver`
 * reloads the route's own record set for `index`/`view`/`edit` and for nothing else, so a
 * `resource` sub-route like `operation-hub` — reached by deep link or a menu click — would
 * otherwise open on an empty store and show an outlet estate of zero. On the Index the fetch
 * is already in flight and this one dedupes against it.
 */

const text = (value) => (value == null ? '' : String(value).trim())

/**
 * Everything these surfaces read, and the in-flight load shared by every widget and list that
 * calls the relay during one page visit.
 *
 * `OutletOperatingRules` rides along because `useOutletResource` joins it into every enriched
 * outlet — without it an outlet's price list and visit cadence read as defaults everywhere.
 */
const SOURCE_RESOURCES = [
  // The page's OWN resource. Needed because `operation-hub` is a `resource` sub-route, which
  // `usePageResolver` does not auto-load (see the docblock above).
  'Outlets',
  'OutletOperatingRules',
  'OutletVisits',
  'OutletRestocks',
  'OutletConsumptions',
  'OutletConsumptionInvoices',
  'OutletPayments'
]

let pendingLoad = null
/**
 * Whether the streams have landed at least once in this session.
 *
 * Kept at module scope, not per call: the second card to call the relay must not report
 * "still loading" simply because the first card's promise has already settled and been
 * cleared. Without it, a card mounted after the load reads a `pending` that never flips.
 */
let streamsLoaded = false

export function useOutletOverviewContext () {
  const ui = useAQLConfig()
  const nav = useResourceNav()

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)

  const index = useOutletIndex()

  const loaded = ref(streamsLoaded)
  if (!streamsLoaded) {
    if (!pendingLoad) {
      const sources = SOURCE_RESOURCES.map((name) => useRecord(name))
      pendingLoad = Promise.all(sources.map((resource) => resource.reload()))
        .finally(() => { streamsLoaded = true; pendingLoad = null })
    }
    pendingLoad.finally(() => { loaded.value = true })
  }

  /**
   * Whether the page is still waiting on data.
   *
   * Sections render OUTSIDE `AqlContentWrapper` (UI_MODULE_DEVELOPER_GUIDE.md §9.1), so each
   * widget self-guards on this. It is deliberately NOT used to blank a widget that has
   * genuinely nothing to report — that case is the widget's own `[]`, which hides it.
   */
  const pending = computed(() => (resourceRecord?.loading?.value ?? false) || !loaded.value)

  /**
   * The live keyword from `FilterInput`, relayed off the injected record state.
   *
   * `FilterInput` writes straight into `resourceRecord.filterTerm`, and `useRecord` applies
   * it to `filteredRecords`. Every list view on this page renders Layer 2 SUMMARIES instead
   * of those records — that is what lets a row state when its outlet was last paid — so the
   * framework's own search never reaches them and each view has to apply the same term
   * itself. Relaying it here rather than injecting it in six components is the whole point
   * of the relay (§6.1).
   */
  const filterTerm = computed(() => String(resourceRecord?.filterTerm?.value ?? '').trim().toLowerCase())

  return {
    ui,
    pending,
    activityWindowDays: ACTIVITY_WINDOW_DAYS,

    // Metrics — read straight off the aggregate, never re-derived here.
    totals: index.totalsMetrics,
    geography: index.geography,
    pendings: index.pendingMetrics,
    visits: index.visitMetrics,
    activity: index.activityMetrics,
    views: index.views,

    filterTerm,

    /**
     * Narrow one view's rows by the live keyword. Called by each list view on the rows it
     * was about to render, so only the ACTIVE view pays for a keystroke — the other five
     * are not mounted.
     *
     * The match is a single `includes` against the haystack Layer 2 already built per
     * summary, so typing costs one string test per row rather than a rebuild of eight
     * fields per row per character.
     */
    filterOutlets: (rows) => {
      const keyword = filterTerm.value
      const list = Array.isArray(rows) ? rows : []
      if (!keyword) return list
      return list.filter((row) => (row?.search || '').includes(keyword))
    },

    /** Presentation wording and colour for an activity age — the domain owns both. */
    activityColor,
    activityLabel,

    /** Whether the signed-in user may read a resource this page links out to. */
    allowed: (map) => !!resourceConfig?.allowed?.(map),

    /** Open one outlet's View page. The only navigation any list row on this page performs. */
    openOutlet: (code) => {
      const target = text(code)
      if (target) nav.goTo('view', { code: target })
    }
  }
}
