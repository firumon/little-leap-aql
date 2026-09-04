import { computed, inject, ref } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRestockVolume } from 'src/_resource/Operation/OutletRestocks/composables/useRestockVolume'

/**
 * OutletRestocks › Index › volume — the context surface for the volume widget
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Index/`, the page tier (§6.2). Only `Index/RestockVolume.vue` reads it, and
 * the streams it opens are read nowhere else in the module.
 *
 * The Index page resolver loads the restock headers and their declared relation (Outlets);
 * the LINES and the product names behind them are this widget's own need, so this relay
 * opens them rather than making the page carry a fetch the other widgets never use.
 *
 * The Layer 2 aggregate is memoized per app, so this file adds no arithmetic of its own —
 * it only relays what the projection already computed.
 */

const SOURCE_RESOURCES = ['OutletRestockItems', 'SKUs', 'Products', 'Outlets']

let pendingLoad = null
// Module scope, not per call: the second caller must not read "still loading" only because
// the first caller's promise has already settled and been cleared.
let streamsLoaded = false

export function useRestockVolumeContext () {
  const ui = useAQLConfig()
  const resourceRecord = inject('resourceRecord', null)
  const { topItems, topOutlets, windowDays } = useRestockVolume()

  const loaded = ref(streamsLoaded)
  if (!streamsLoaded) {
    if (!pendingLoad) {
      const sources = SOURCE_RESOURCES.map((name) => useRecord(name))
      pendingLoad = Promise.all(sources.map((resource) => resource.reload()))
        .finally(() => { streamsLoaded = true; pendingLoad = null })
    }
    pendingLoad.finally(() => { loaded.value = true })
  }

  // Sections render outside `AqlContentWrapper`, so the widget self-guards on this.
  const pending = computed(() => (resourceRecord?.loading?.value ?? false) || !loaded.value)

  return { ui, pending, topItems, topOutlets, windowDays }
}
