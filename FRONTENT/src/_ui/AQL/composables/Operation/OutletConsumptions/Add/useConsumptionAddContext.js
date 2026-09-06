import { inject } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

// The one `inject()` caller behind the Add page (§6.1). Page tier: only `Add.js` provides
// this context, and only its own step cards read it.
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
    hasRegionAccess,
    query,
    // Core-composable relays. Called by the card, so this adds no fetches of its own.
    resource: (name) => useRecord(name),
    allowed: (name, action) => useResourceConfig(name).allowed(action) === true
  }
}
