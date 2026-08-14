import { inject } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'

/**
 * OutletRestocks › Add + Edit — the injection relay for the two WRITE pages
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — resource tier, not `Add/` or `Edit/` (§6.2).
 *
 * `AdjustItems.vue` and `NewItems.vue` sit at the RESOURCE tier precisely because
 * `useContentResolver` hands the same two components to BOTH `Add.js` and
 * `Edit.js`. A `.vue` file has exactly one import line per composable, so a
 * page-scoped relay under `Add/` could not be reached from the Edit page without
 * copying both cards — the drift shared placement exists to prevent. Two pages
 * provide the same context shape and resolve the same components, which is
 * exactly §6.1's note: the relay is not page-scoped and moves up to the tier
 * those shared components already sit at.
 *
 * This file is the ONLY `inject()` caller for the Add and Edit pages. Everything
 * else on those two pages — `useRestockStockMatch`, `useRestockEditForm`,
 * `useRestockAddContext` — reads its context through here, so neither page ends
 * up with two composables injecting the same keys.
 *
 * The RAW injected handles are returned, not unwrapped values: `pageState` is an
 * imperative API (`useNode`, `getControlField`, `setField`) that must pass
 * through untouched, and `resourceRecord` is read by callers that already know
 * its shape. Unwrapping here would change what every existing consumer sees.
 *
 * No `evaluate` helper is exposed. Nothing on Add or Edit evaluates a
 * function-valued prop, and advertising a shared contract only one page would
 * honour is the "placed above its true tier" error §6.2 names.
 */
export function useRestockFormContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    /**
     * Core-composable relay: components never call `useRecord` themselves
     * (§6, "UI Components import ONLY UI Composables"). Invoked by the caller
     * rather than eagerly here, so each consumer still opens exactly the
     * resources it opened before — this relay adds no fetches of its own.
     * Must be called from `setup()`, like `useRecord` itself.
     */
    resource: (name) => useRecord(name)
  }
}
