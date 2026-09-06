import { inject, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import {
  isActiveRow,
  findInvoiceFor,
  cancellability,
  cascadeOptionsFor
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import { restorableConsumptionLines } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'

// The route's injection relay and its read-only projections. Reads only: mounting the
// nodes is `useConsumptionCancelSeed`, which exactly one card imports.
export function useConsumptionCancelContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { code } = useRouteConfig()

  const consumptions = useRecord('OutletConsumptions')
  const invoices = useRecord('OutletConsumptionInvoices')
  const restocks = useRecord('OutletRestocks')
  const returns = useRecord('OutletReturns')
  const consumptionItems = useRecord('OutletConsumptionItems')
  const outletMovements = useRecord('OutletMovements')

  const text = (value) => (value == null ? '' : String(value).trim())
  const asRow = (value) => (value && typeof value === 'object' ? value : {})

  const record = computed(() =>
    consumptions.items.value.map(asRow).find((row) => text(row.Code) === text(code.value)) || null)

  const invoice = computed(() => findInvoiceFor(record.value, invoices.items.value))

  const linkedRestocks = computed(() => restocks.items.value
    .map(asRow)
    .filter((row) => isActiveRow(row) && text(row.OutletConsumptionCode) === text(code.value)))

  const cascade = computed(() => cascadeOptionsFor(record.value, {
    invoice: invoice.value,
    restocks: linkedRestocks.value,
    returns: returns.items.value
  }))

  const restorations = computed(() => restorableConsumptionLines(record.value, {
    items: consumptionItems.items.value,
    movements: outletMovements.items.value
  }))

  const gate = computed(() => cancellability(record.value))

  return {
    pageState,
    resourceConfig,
    ui,
    nav: useResourceNav(),
    record,
    invoice,
    linkedRestocks,
    cascade,
    gate,
    restorations,
    sources: { consumptions, invoices, restocks, returns, consumptionItems, outletMovements }
  }
}
