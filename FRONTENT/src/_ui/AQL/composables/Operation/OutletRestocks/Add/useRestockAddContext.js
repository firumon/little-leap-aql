import { computed, ref } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { restockDirectOptions } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { useRestockFormContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockFormContext'

const WIZARD_RESOURCES = [
  'Outlets', 'Warehouses', 'SKUs', 'Products', 'OutletStorages', 'WarehouseStorages'
]

let pendingLoad = null
let streamsLoaded = false

export function useRestockAddContext () {
  const { pageState, resourceRecord, resourceConfig, resource, ui } = useRestockFormContext()
  const { user } = useAuth()
  const { query } = useRouteConfig()
  const { outletOptions } = useOutletResource()

  const sources = WIZARD_RESOURCES.map((name) => usePageRecord(name))

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
