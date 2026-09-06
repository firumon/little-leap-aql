import { inject, onMounted } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useConsumptionIndex } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionIndex'

/**
 * OutletConsumptions › Index — the injection relay for the Index page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Index/`, the page tier (§6.2). Only `Index.js` provides this context, and
 * only `Index.js` resolves the projection list override that reads it
 * (`ListInvoiceableOutlets`), which lives under `components/.../Index/`.
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
// The aggregate answers questions about outlets, visits and invoices, but the page's own
// resolver fetches OutletConsumptions and nothing else. Without this the projection views
// and the metric widgets read an empty store and show "nothing here" over real backlog.
const INDEX_RESOURCES = [
  'Outlets',
  'OutletVisits',
  'OutletConsumptionInvoices',
  'OutletOperatingRules',
  // The Invoiceable row shows "3 Items X 21 Qty", so the child lines must be on the page.
  'OutletConsumptionItems'
]

export function useConsumptionIndexContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  const sources = INDEX_RESOURCES.map((name) => useRecord(name))
  onMounted(() => sources.forEach((resource) => resource.reload()))

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
