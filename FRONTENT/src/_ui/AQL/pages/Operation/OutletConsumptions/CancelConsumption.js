import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildConsumptionCancellationNodes } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionWorkflow'
import { findInvoiceFor } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

const NODE = 'OutletConsumptions'
// A control, not a queued action field: `CancelConsumption` is registered `kind: navigate`,
// and `setActions` silently drops a write to an action that has no request envelope.
const REASON = 'CancelReason'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

/**
 * OutletConsumptions › CancelConsumption — action route contract.
 *
 * Reached from the View page's `CancelConsumption` FAB, which GAS publishes as a
 * `navigate` AdditionalAction rather than a `mutate` one — a plain mutate would flip this
 * record's Progress column and leave its invoice and its restocks pointing at a cancelled
 * audit.
 *
 * TITLED BY THE VERB IT PERFORMS (§5.5). A custom sub-route has no canonical page name to
 * humanize, and the user arrived from a record page needing to know what they walked into.
 *
 * `reload: false` — the page's state is the reason the user is typing, and reloading would
 * discard it.
 *
 * AN ACTION ROUTE HAS NO RECORD LOADER, so its first content is the hydration point: the
 * single `CancelReason` card calls the page's composable, which loads the dependent invoice
 * and restocks and seeds `pageState`. That is also why the confirmation of WHAT ELSE will
 * be cancelled can be shown before the user commits — the whole point of preferring a
 * route over a one-field dialog on the View page.
 */
export default {
  sections: ['PageHeader'],
  contents: ['CancelReason'],

  PropsPageHeader: {
    title: 'Cancel Consumption',
    reload: false
  },

  // The cascade is assembled as soon as a reason is typed, so `PageAction.submit` only
  // validates (UI_PAGE_STATE.md §5B). Keyed off the reason, never off the nodes the
  // rebuild writes.
  ready ({ pageState, resourceRecord }) {
    const { user } = useAuth()
    // The route's own loaded row, never `pageState.meta` — meta carries no code, so the
    // lookup that read it always missed and the batch was never cut.
    const code = () => text(resourceRecord?.record?.value?.Code)
    const rows = (name) => (useDataStore().getRecords(name) || []).map(asRow)
    const consumption = () => rows(NODE).find((row) => text(row.Code) === code()) ||
      (code() ? asRow(resourceRecord.record.value) : null)

    watch(() => [code(), pageState.getControls(REASON, '', NODE)], () => {
      const record = consumption()
      if (!record) return
      // Seeded as soon as the record resolves, so the sticky bar can address the node
      // before a reason has been typed.
      if (!pageState.hasNode(NODE)) {
        pageState.initResource(NODE, { isPrimaryKey: true, code: text(record.Code) })
      }
      const why = text(pageState.getControls(REASON, '', NODE))
      if (!why) return
      pageState.applyLive(buildConsumptionCancellationNodes(record, why, {
        invoice: findInvoiceFor(record, rows('OutletConsumptionInvoices')),
        restocks: rows('OutletRestocks').filter((row) =>
          text(row.Status || 'Active') === 'Active' && text(row.OutletConsumptionCode) === text(record.Code)),
        consumptionItems: rows('OutletConsumptionItems'),
        outletMovements: rows('OutletMovements'),
        actorName: text(user.value?.name || user.value?.email)
      }))
    }, { immediate: true, deep: true })
  }
}
