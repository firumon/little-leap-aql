import { computed, ref } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { restockDirectOptions } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { useRestockFormContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockFormContext'

/**
 * OutletRestocks › Add — the Add wizard's context surface
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Add/`, the page tier (§6.2). Its consumers are resolved by `Add.js` alone
 * and live under `components/.../Add/`.
 *
 * It calls no `inject()` of its own. Page context comes from `useRestockFormContext`, the
 * single relay shared with the Edit page, which keeps exactly one `inject()` caller behind
 * this page.
 *
 * It opens the wizard's resources ONCE, here, rather than in the first step card: a card
 * unmounts when the user moves on, and the later steps read the same rows. `directOptions`
 * is relayed straight from Layer 2 — the region and permission rules that decide whether a
 * direct restock is possible are domain answers, not screen conditions.
 */

const WIZARD_RESOURCES = [
  'Outlets', 'Warehouses', 'SKUs', 'Products', 'OutletStorages', 'WarehouseStorages'
]

let pendingLoad = null
// Module scope, not per call: the second card must not read "still loading" only because
// the first card's promise has already settled and been cleared.
let streamsLoaded = false

export function useRestockAddContext () {
  const { pageState, resourceRecord, resourceConfig, resource, ui } = useRestockFormContext()
  const { user } = useAuth()
  const { query } = useRouteConfig()

  // Opened here, in setup, because `useRecord` injects — never inside a computed.
  const sources = WIZARD_RESOURCES.map((name) => useRecord(name))
  const outlets = sources[0]

  const loaded = ref(streamsLoaded)
  if (!streamsLoaded) {
    if (!pendingLoad) {
      pendingLoad = Promise.all(sources.map((one) => one.reload()))
        .finally(() => { streamsLoaded = true; pendingLoad = null })
    }
    pendingLoad.finally(() => { loaded.value = true })
  }

  const pending = computed(() => !loaded.value)
  const directOptions = computed(() => restockDirectOptions())

  const outletOptions = computed(() => outlets.items.value
    .filter((row) => (row.Status || 'Active') === 'Active')
    .map((row) => ({ label: [row.Code, row.Name].filter(Boolean).join(' · '), value: row.Code })))

  return {
    pageState,
    resourceRecord,
    resourceConfig,
    resource,
    ui,
    user,
    query,
    pending,
    directOptions,
    outletOptions
  }
}
