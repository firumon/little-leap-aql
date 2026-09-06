import { computed, inject, ref } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useConsumptionVolume } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionVolume'

const SOURCE_RESOURCES = ['OutletConsumptionItems', 'SKUs', 'Products', 'Outlets']

let pendingLoad = null
// Module scope, not per call: a second caller must not read "still loading" after the
// first caller's promise already settled and was cleared.
let streamsLoaded = false

export function useConsumptionVolumeContext () {
  const ui = useAQLConfig()
  const resourceRecord = inject('resourceRecord', null)
  const { topItems, topOutlets, windowDays } = useConsumptionVolume()

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
