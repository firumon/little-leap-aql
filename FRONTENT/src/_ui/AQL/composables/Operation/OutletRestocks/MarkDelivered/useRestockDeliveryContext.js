import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

/**
 * OutletRestocks › Mark As Delivered — the injection relay for the delivery
 * action route (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `MarkDelivered/`, the page tier (§6.2). Only `MarkDelivered.js`
 * provides this context, and only it resolves the two cards that read it
 * (`SelectDeliveryItems`, `ReviewDelivery`), both of which live under
 * `components/.../MarkDelivered/`.
 *
 * The ONLY `inject()` caller on this page: `useRestockDelivery` — the selection
 * aggregate both cards import — takes its `pageState` and `resourceRecord`
 * from here rather than injecting them a second time.
 *
 * `evaluate` closes over the two injected HANDLES so `evaluateProp` keeps its
 * exact contract: lazy, and invoked with `(record, config)` unwrapped at call
 * time (UI_MODULE_DEVELOPER_GUIDE.md §3.4).
 */
export function useRestockDeliveryContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui,
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig)
  }
}

