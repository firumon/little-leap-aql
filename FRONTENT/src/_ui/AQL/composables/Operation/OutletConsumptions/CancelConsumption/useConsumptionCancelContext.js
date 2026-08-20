import { inject, computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import {
  isActiveRow,
  progressOf,
  findInvoiceFor,
  cancellability,
  rejectableRestocks,
  relatedLabel,
  relatedColor
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import { restorableConsumptionLines } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionWorkflow'

/**
 * OutletConsumptions › CancelConsumption — the action route's context and hydration.
 *
 * PLACEMENT — page tier (§6.2): only `CancelConsumption.js` provides this context and only
 * its single card reads it.
 *
 * AN ACTION ROUTE LOADS NO RECORD (§5.5). `usePageResolver` does not fetch one for an
 * `_action/:action` route, and this page has no `Create`/`Update` content to seed
 * `pageState` — so this composable owns both the fetch and the derivation, and the card
 * that calls it is the hydration point.
 *
 * The cancellation GATE and the list of what will cascade are Layer 2's answers, read here
 * rather than re-derived: the same `cancellability` predicate that hides the FAB decides
 * whether this page's submit is allowed, so the two cannot drift.
 */
export function useConsumptionCancelContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)
  const ui = useAQLConfig()
  const { code } = useRouteConfig()

  const consumptions = useRecord('OutletConsumptions')
  const invoices = useRecord('OutletConsumptionInvoices')
  const restocks = useRecord('OutletRestocks')
  const restockItems = useRecord('OutletRestockItems')
  const outlets = useRecord('Outlets')
  // The two sources the stock restoration is derived from: the audit's own lines, and the
  // ledger rows it posted. The ledger is preferred because it knows WHICH storage each unit
  // came off; the lines are the fallback when the ledger has not loaded.
  const consumptionItems = useRecord('OutletConsumptionItems')
  const outletMovements = useRecord('OutletMovements')

  onMounted(() => {
    // Every resource the gate and the cascade preview need, loaded once here rather than
    // per card. `reload()` renders from the warm cache and syncs the delta in background.
    ;[consumptions, invoices, restocks, restockItems, outlets, consumptionItems, outletMovements].forEach((resource) => resource.reload())
  })

  const text = (value) => (value == null ? '' : String(value).trim())
  const asRow = (value) => (value && typeof value === 'object' ? value : {})

  const record = computed(() =>
    consumptions.items.value.map(asRow).find((row) => text(row.Code) === text(code.value)) || null)

  const invoice = computed(() => findInvoiceFor(record.value, invoices.items.value))

  const linkedRestocks = computed(() => restocks.items.value
    .map(asRow)
    .filter((row) => isActiveRow(row) && text(row.OutletConsumptionCode) === text(code.value)))

  /** Exactly what this cancellation will reject — shown before the user commits. */
  const cascade = computed(() => {
    const entries = []
    const invoiceRow = invoice.value
    if (invoiceRow && progressOf(invoiceRow) !== 'PAID' && progressOf(invoiceRow) !== 'CANCELLED') {
      entries.push({
        key: text(invoiceRow.Code),
        label: `Invoice ${text(invoiceRow.Code)}`,
        caption: 'will be cancelled',
        color: relatedColor(invoiceRow.Progress),
        state: relatedLabel(invoiceRow.Progress)
      })
    }
    rejectableRestocks(linkedRestocks.value).forEach((restock) => {
      entries.push({
        key: text(restock.Code),
        label: `Restock ${text(restock.Code)}`,
        caption: 'will be rejected',
        color: relatedColor(restock.Progress),
        state: relatedLabel(restock.Progress)
      })
    })
    return entries
  })

  /**
   * Exactly what goes back on the outlet's shelf — the SAME pure derivation the cancellation
   * batch writes its compensating movements from, so the preview cannot promise a
   * restoration the submit does not perform.
   */
  const restorations = computed(() => restorableConsumptionLines(record.value, {
    items: consumptionItems.items.value,
    movements: outletMovements.items.value
  }))

  const gate = computed(() => cancellability(record.value, {
    invoice: invoice.value,
    restocks: linkedRestocks.value
  }))

  return { pageState, resourceConfig, ui, record, invoice, linkedRestocks, cascade, gate, restorations, consumptionItems, outletMovements }
}
