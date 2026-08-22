import { inject } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

/**
 * OutletReturns — the injection relay shared by every WRITE surface of this module
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — resource tier, not a page folder (§6.2, §6.3).
 *
 * Five pages provide the same context shape and need the same three handles: `Add`,
 * `Edit`, and the three action routes (`WarehouseAction`, `MarkInvoiceAdjusted`,
 * `Cancel`). A `.vue` file has exactly one import line per composable, so a page-scoped
 * relay under `Add/` could not be reached from the action routes without copying it four
 * times — the drift shared placement exists to prevent. The ladder in §6.3 puts a
 * composable at the tier of the most general component that imports it; here that is the
 * resource.
 *
 * This is the ONLY `inject()` caller behind those five pages. Anything else they need —
 * pricing, the domain vocabulary, the payload builders — is a plain import of Layer 2, not
 * a second injection.
 *
 * The RAW injected handles are returned, not unwrapped values: `pageState` is an
 * imperative API (`useNode`, `getControlField`, `setField`) that must pass through
 * untouched, and `resourceRecord` is read by callers that already know its shape.
 */
export function useReturnFormContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui,
    /**
     * Core-composable relay: components never call `useRecord` themselves (§6, "UI
     * Components import ONLY UI Composables"). Invoked by the caller rather than eagerly
     * here, so each consumer opens exactly the resources it needs — this relay adds no
     * fetches of its own. Must be called from `setup()`, like `useRecord` itself.
     */
    resource: (name) => useRecord(name)
  }
}
