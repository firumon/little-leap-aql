import { computed } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useReturnFormContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormContext'
import {
  resolveReturnUnitPrice,
  effectivePriceListCode,
  priceFromList
} from 'src/_resource/Operation/OutletReturns/composables/useReturnPricing'
import { REASON_META, REASONS } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › Add — the Add page's context surface (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Add/`, the page tier (§6.2). Its only consumer is `Add/ReturnForm.vue`, and
 * the two reads below exist nowhere else in the module: the `?outletCode=` deep link from
 * the Outlet Hub, and the signed-in user's name for the `Username` column. Relaying them
 * from the resource tier would advertise a contract only one page honours.
 *
 * It calls no `inject()` of its own — page context comes from `useReturnFormContext`, the
 * single relay shared with Edit and the three action routes, so exactly one file behind
 * this page injects.
 *
 * Everything derived here is PRESENTATION assembly: option lists shaped for a `_fields`
 * select, and the invoice history a user picks from. Not one business rule — the truth
 * table, the completion rule and the price cascade are all Layer 2 calls (§4).
 */
export function useReturnAddContext () {
  const { pageState, resourceRecord, resourceConfig, resource, ui } = useReturnFormContext()
  const { user } = useAuth()
  const { query } = useRouteConfig()

  const text = (value) => (value == null ? '' : String(value).trim())
  const isActive = (row) => text(row?.Status || 'Active') === 'Active'

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    resource,
    ui,
    user,
    query,

    /** The name written to `Username` — a display name, never a user code. */
    actorName: computed(() => text(user.value?.name || user.value?.email || '')),

    /** `?outletCode=OUT-01` from the Outlet Hub. Blank when the page was opened directly. */
    presetOutletCode: computed(() => text(query.value?.outletCode)),

    /**
     * The seven reason codes as select options, projected from the ONE vocabulary — never
     * restated here, so adding a reason is a Layer 2 change (§4.5).
     */
    reasonOptions: REASONS.map((code) => ({ label: REASON_META[code].label, value: code })),

    isActive,
    text,

    /**
     * The price cascade, relayed so the card never imports a resource composable itself.
     *
     * Three entry points because the Add page prices from three directions: the outlet's own
     * list by default, an explicitly chosen list, or a figure lifted straight off an invoice
     * line. All three end at the same `getPriceOf`, so they cannot disagree.
     */
    resolveReturnUnitPrice,
    effectivePriceListCode,
    priceFromList
  }
}
