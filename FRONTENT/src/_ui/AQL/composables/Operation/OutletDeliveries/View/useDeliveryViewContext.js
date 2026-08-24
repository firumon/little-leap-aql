import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

/**
 * OutletDeliveries › View — the injection relay for the View page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `View/`, the page tier (§6.2). Only `View.js` provides this context, and only
 * `View.js` resolves the three cards that read it (`ManifestSummary`, `DeliveryTimeline`,
 * `OutletItems`), all of which live under `components/.../View/`.
 *
 * This is the ONLY `inject()` caller on the View page: `useDeliveryView` — the presentation
 * aggregate those cards import for their rows and totals — reads its record through here
 * rather than injecting a second time, so the page has one relay, not two.
 *
 * `evaluate` closes over the two HANDLES, keeping `evaluateProp`'s contract unchanged —
 * still lazy, still invoked with `(record, config)` unwrapped at call time rather than over
 * values snapshotted here (UI_MODULE_DEVELOPER_GUIDE.md §3.4).
 */
export function useDeliveryViewContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  return {
    resourceRecord,
    resourceConfig,
    ui,
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig)
  }
}
