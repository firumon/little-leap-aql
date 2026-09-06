import { watch } from 'vue'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'
import { applyConsumptionOutlet } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionDraft'
import { NODE } from './nodes'

// Layer 2's outlet derive builds the count sheet, but a deep link can choose an outlet
// before the shelf rows load. This waits for them, then calls that same Layer 2 function.
export function useConsumptionCountSeed (pageState) {
  const { stockRowsOf } = useOutletStorageResource()

  const outletCode = pageState.useRecord('OutletCode', NODE.CONSUMPTION)

  // Only while the wizard holds NOTHING for this outlet. A returns-only or restock-only
  // count leaves the sheet empty too, and re-seeding then would throw that answer away.
  const untouched = () =>
    !(pageState.getChildRows(NODE.ITEMS, NODE.CONSUMPTION) || []).length &&
    !pageState.hasNode(NODE.RETURNS) &&
    !pageState.hasNode(NODE.RESTOCKS)

  watch(
    () => stockRowsOf(outletCode.value).length,
    (count) => {
      if (!outletCode.value || !count || !untouched()) return
      applyConsumptionOutlet(outletCode.value, pageState)
    },
    { immediate: true }
  )
}
