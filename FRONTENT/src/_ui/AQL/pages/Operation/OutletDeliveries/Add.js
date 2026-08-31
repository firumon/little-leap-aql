import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { buildDeliveryCreateNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'

const NODE = 'OutletDeliveries'
const CODES = 'OutletRestockItemCodes'

// Two steps: pick the allocated lines, then check the warehouse pick list.
// Reload is off because the ticks live in `pageState` and a reload would drop them.
export default {
  sections: ['PageHeader'],
  contents: ['SelectAllocations', 'PickSummary'],

  PropsPageHeader: {
    title: 'New Delivery Run',
    reload: false
  },

  PropsSelectAllocations: { step: 1 },
  PropsPickSummary: { step: 2 },

  // The run is built as the lines are ticked, so step 2 reviews the actual batch and
  // `PageAction.submit` only validates (UI_PAGE_STATE.md §5B). Keyed off the CSV column
  // the ticks write, which the builder puts back unchanged — so this cannot feed itself.
  ready ({ pageState }) {
    const { user } = useAuth()
    watch(() => String(pageState.getRecord(CODES, NODE) ?? ''), (csv) => {
      const codes = csv.split(',').map((code) => code.trim()).filter(Boolean)
      if (!codes.length) {
        pageState.setResource(NODE, { record: { [CODES]: '' } })
        return
      }
      pageState.applyLive(buildDeliveryCreateNodes({
        userName: user.value?.name || user.value?.email || '',
        selectedOrsiCodes: codes
      }))
    }, { immediate: true })
  }
}
