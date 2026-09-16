import { inject, computed } from 'vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
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

  const consumptions = usePageRecord('OutletConsumptions')
  const invoices = usePageRecord('OutletConsumptionInvoices')
  const restocks = usePageRecord('OutletRestocks')
  const returns = usePageRecord('OutletReturns')
  const consumptionItems = usePageRecord('OutletConsumptionItems')
  const outletMovements = usePageRecord('OutletMovements')

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
