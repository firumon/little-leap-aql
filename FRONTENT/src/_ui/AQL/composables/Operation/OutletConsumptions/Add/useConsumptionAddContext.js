import { inject } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

/**
 * OutletConsumptions › Add — the injection relay for the wizard
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Add/`, the page tier (§6.2). Only `Add.js` provides this context and only
 * `Add.js` resolves the six step cards that read it, all of which live under
 * `components/.../Add/`. There is no Edit page for this resource (a consumption is an
 * immutable stock audit), so unlike the restock module's form relay there is no second
 * write page to share a tier with.
 *
 * This is the ONLY `inject()` caller behind the Add page. `useConsumptionWizard`, the
 * working-state aggregate every step card imports, reads its context through here rather
 * than injecting a second time.
 *
 * The RAW injected handles are returned, not unwrapped values: `pageState` is an
 * imperative API (`useNode`, `setControlField`, `build`) that must pass through untouched.
 */
export function useConsumptionAddContext () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { user, hasRegionAccess } = useAuth()
  const { query } = useRouteConfig()

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    ui,
    user,
    // Gates the Direct Restock control: the option is only offered when the user's access
    // region actually contains a warehouse to draw from.
    hasRegionAccess,
    // `?outletCode=` / `?visitCode=` deep links, which the Index page's scheduled queue
    // uses to hand the wizard both context answers at once.
    query,
    /**
     * Core-composable relay: step cards never call `useRecord` themselves (§6.1).
     * Invoked BY THE CALLER rather than eagerly here, so each step still opens exactly the
     * resources it needs and this relay adds no fetches of its own. Must be called from
     * `setup()`, like `useRecord` itself.
     */
    resource: (name) => useRecord(name)
  }
}
