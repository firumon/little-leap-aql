import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

/**
 * OutletConsumptions › View — the injection relay for the View page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `View/`, the page tier (§6.2). Only `View.js` provides this context and only
 * `View.js` resolves the six cards that read it, all under `components/.../View/`.
 *
 * This is the ONLY `inject()` caller on the View page: `useConsumptionView` — the read-only
 * aggregate the same six cards import for their rows — reads its record through here
 * rather than injecting a second time, so the page has one relay, not two.
 *
 * `evaluate` closes over the two HANDLES rather than snapshotting their values, which keeps
 * `evaluateProp`'s contract unchanged: still lazy, still invoked with `(record, config)`
 * unwrapped at call time (UI_MODULE_DEVELOPER_GUIDE §3.4).
 */
export function useConsumptionViewContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  return {
    resourceRecord,
    resourceConfig,
    ui,
    // Core-composable relay: a card never imports `useResourceNav` itself (§6.1).
    nav: useResourceNav(),
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig)
  }
}
