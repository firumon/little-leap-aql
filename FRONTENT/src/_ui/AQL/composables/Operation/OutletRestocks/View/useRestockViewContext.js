import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

/**
 * OutletRestocks › View — the injection relay for the View page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `View/`, the page tier (§6.2). Only `View.js` provides this
 * context, and only `View.js` resolves the five cards that read it
 * (`RestockHeader`, `Items`, `AllocationDetails`, `Workflow`,
 * `RevisionRequiredBanner`), all of which live under `components/.../View/`.
 *
 * This is the ONLY `inject()` caller on the View page: `useRestockView` — the
 * presentation aggregate the same five cards import for their rows and totals —
 * reads its record through here rather than injecting a second time, so the page
 * has one relay, not two.
 *
 * Every one of those five cards injected `resourceRecord` + `resourceConfig` for
 * exactly one reason: to feed `evaluateProp` for its `title`/`color` props.
 * `evaluate` closes over the two HANDLES, so it keeps `evaluateProp`'s contract
 * unchanged — still lazy, still invoked with `(record, config)` unwrapped at
 * call time rather than over values snapshotted here
 * (UI_MODULE_DEVELOPER_GUIDE.md §3.4).
 */
export function useRestockViewContext () {
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

