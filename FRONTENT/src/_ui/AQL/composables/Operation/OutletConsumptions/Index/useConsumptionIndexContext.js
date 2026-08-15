import { inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useConsumptionIndex } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionIndex'

/**
 * OutletConsumptions › Index — the injection relay for the Index page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Index/`, the page tier (§6.2). Only `Index.js` provides this context, and
 * only `Index.js` resolves the two projection list overrides that read it
 * (`ListScheduledOutlets`, `ListInvoiceableOutlets`), both of which live under
 * `components/.../Index/`.
 *
 * This is the ONLY `inject()` caller behind the Index page. The four widget modifiers do
 * not go through it — a JS modifier already RECEIVES `{ pageState, resourceRecord,
 * resourceConfig }` as parameters from the resolver and never called `inject()` to begin
 * with (§6.1's exemption), so routing them through a relay would add an indirection that
 * buys nothing.
 *
 * `index` is the Layer 2 aggregate every widget and both projection views read, relayed
 * here so a `.vue` under this page has one import rather than reaching into
 * `src/_resource/` alongside its context.
 */
export function useConsumptionIndexContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  return {
    resourceRecord,
    resourceConfig,
    ui,
    index: useConsumptionIndex(),
    // Core-composable relay: a `.vue` under this page never imports `useResourceNav`
    // itself (§6.1), even though navigation carries no resource content of its own.
    nav: useResourceNav(),
    evaluate: (val) => evaluateProp(val, resourceRecord, resourceConfig)
  }
}
