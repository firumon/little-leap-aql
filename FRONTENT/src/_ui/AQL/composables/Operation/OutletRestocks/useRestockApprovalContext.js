import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useActionResolver'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

/**
 * OutletRestocks › Approve + Reallocate — the injection relay for the two
 * allocation action routes (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Operation/OutletRestocks/`, the resource tier, beside `useRestockApproval`
 * (§6.2, and the worked example in §6.1's note).
 *
 * `Approve.js` and `Reallocate.js` provide the same context shape and resolve the
 * SAME four content cards — `WarehouseAndLocation`, `ItemAllocating`,
 * `ReviewAllocating`, `ReviewPending` — which live at the resource tier precisely
 * so neither page owns them. A `.vue` file has one import line per composable, so
 * a page-scoped copy of this relay would have forced a copy of all four cards
 * too. It therefore sits where `useRestockApproval`, the aggregate those same
 * four cards already share, sits.
 *
 * The ONLY `inject()` caller on these two pages: `useRestockApproval` reads its
 * `pageState`/`resourceRecord` through here rather than injecting a second time.
 *
 * `evaluateProp` is imported from `useActionResolver`, which re-exports the
 * section resolver's one implementation — the same import `FormActionReject`
 * used before, so an action component evaluates its props exactly as it did.
 */
export function useRestockApprovalContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui,
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig),
    /**
     * Core-composable relay: cards never call `useRecord` themselves (§6).
     * Invoked by the caller, so each card still opens exactly the resources it
     * opened before. Must be called from `setup()`, like `useRecord` itself.
     */
    resource: (name) => useRecord(name)
  }
}

