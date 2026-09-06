import { onMounted, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useConsumptionCancelContext } from './useConsumptionCancelContext'
import {
  CONSUMPTION_CANCEL_CONTROL,
  buildConsumptionCancelInitNodes,
  consumptionCancelDerivations
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionCancel'

const NODE = 'OutletConsumptions'

const text = (value) => (value == null ? '' : String(value).trim())

// The route's ONE hydration point (§13.7). Imported by a single card, because a composable
// three cards call would mount the cascade three times.
export function useConsumptionCancelSeed () {
  const context = useConsumptionCancelContext()
  const { pageState, record, invoice, linkedRestocks, sources } = context
  const { user } = useAuth()

  onMounted(() => {
    Object.values(sources).forEach((resource) => resource.reload())
  })

  // The rows land in stages, so the cascade is rebuilt as they arrive. The typed reason and
  // any toggle the operator already moved are carried across each rebuild.
  watch(
    [record, sources.returns.items, sources.consumptionItems.items, sources.outletMovements.items],
    () => {
      const row = record.value
      if (!pageState || !row || !text(row.Code)) return

      const inputs = {
        record: row,
        invoice: invoice.value,
        restocks: linkedRestocks.value,
        returns: sources.returns.items.value,
        consumptionItems: sources.consumptionItems.items.value,
        outletMovements: sources.outletMovements.items.value,
        actorName: user.value?.name || user.value?.email || ''
      }

      // A rebuild must not undo a toggle the operator just moved, so an answered one wins
      // over the stance its leg would open with.
      const answered = Object.values(CONSUMPTION_CANCEL_CONTROL).reduce((kept, control) => {
        const value = pageState.getControls(control, null, NODE)
        if (value !== null) kept[control] = value === true
        return kept
      }, {})
      const keptReason = text(pageState.getRecord('ProgressCancelledComment', NODE))

      pageState.resetForResource(NODE)
      pageState.applyNodes(buildConsumptionCancelInitNodes({ ...inputs, ...answered, reason: keptReason }))
      pageState.derive(consumptionCancelDerivations(inputs))
    },
    { immediate: true }
  )

  return context
}
