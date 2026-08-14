import { useAuth } from 'src/composables/core/useAuth'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useRestockFormContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockFormContext'

/**
 * OutletRestocks › Add — the Add wizard's context surface
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Add/`, the page tier (§6.2). Its three consumers —
 * `Add/OutletSelection.vue`, `Add/Review.vue`, `Add/SubmitOptions.vue` — are
 * resolved by `Add.js` alone and live under `components/.../Add/`. The identity
 * and route reads below are the WIZARD's: the region gate on the restock-mode
 * toggle and the `?outletCode=` deep link exist nowhere else in the module, so
 * relaying them from the resource tier would advertise a contract only one page
 * honours — the "placed above its true tier" error §6.2 names.
 *
 * It calls no `inject()` of its own. Page context comes from
 * `useRestockFormContext`, the single relay shared with the Edit page, because
 * `AdjustItems`/`NewItems` sit at the resource tier and are resolved by both
 * pages. That keeps exactly one `inject()` caller behind the Add page.
 */
export function useRestockAddContext () {
  const { pageState, resourceRecord, resourceConfig, resource } = useRestockFormContext()
  const { user, hasRegionAccess } = useAuth()
  const { query } = useRouteConfig()

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    resource,
    user,
    hasRegionAccess,
    query
  }
}
