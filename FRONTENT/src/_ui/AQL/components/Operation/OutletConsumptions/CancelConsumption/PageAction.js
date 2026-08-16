import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildCancellationRequests } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionWorkflow'
import {
  cancellability,
  findInvoiceFor,
  isActiveRow,
  progressOf,
  RESTOCK_IRREVERSIBLE
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

/**
 * OutletConsumptions › CancelConsumption › PageAction — JS modifier (tier 2).
 *
 *   single step  reason + cascade preview  →  [ Cancel ] [ Cancel Audit ]
 *
 * A single-step route, so `actions` is a plain array rather than a getter — there is no
 * `currentStep` for it to track (§11 rule 4).
 *
 * THE SUBMIT VETOES FOR ALL THREE SANCTIONED REASONS (§13.6):
 *
 *   1. INVALIDITY   — no reason typed. The reason is the whole point of the route; a blank
 *                     one produces a cancelled record nobody can account for later.
 *   2. STALENESS    — the same `cancellability` predicate that gated the FAB, re-checked
 *                     here because time has passed: the invoice may have been paid or a
 *                     restock approved while this page was open. Not duplication — the FAB
 *                     gate stops most users from ever opening the route; this protects the
 *                     minority for whom something changed mid-flow.
 *   3. IRREVERSIBILITY — folded into the same predicate, which is what makes it one check
 *                     rather than two that could disagree: a PAID invoice or an APPROVED
 *                     restock means stock and money have already moved, and nothing this
 *                     handler can write undoes either.
 *
 * The cascade itself is Layer 2's (`buildCancellationRequests`), including its deliberate
 * refusal to write reversing stock movements.
 */
export default (props, { pageState, resourceConfig }) => {
  // Safe outside setup: both only reach Pinia stores and call no `inject()`.
  const { user } = useAuth()
  const dataStore = useDataStore()

  const text = (value) => (value == null ? '' : String(value).trim())
  const asRow = (value) => (value && typeof value === 'object' ? value : {})
  const rows = (name) => (dataStore.getRecords(name) || []).map(asRow)

  const NODE = 'OutletConsumptions'
  const reason = () => text(pageState.getControlField(NODE, 'CancelReason'))
  const actor = () => user.value?.name || user.value?.email || ''

  const record = () => rows(NODE).find((row) => text(row.Code) === text(pageState.meta?.code)) || null

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Consumption',
    // Destructive, so the button reads as such rather than as the page's neutral primary.
    submitColor: 'negative',

    // Abandoning goes back to the record, not `goBack()` — the user may have arrived from
    // the index. Returning `false` stops the built-in `goBack()` popping a second entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: (name, { nav }) => {
      const consumption = record()
      if (!consumption) return { valid: false, message: 'This consumption could not be loaded.' }

      const why = reason()
      if (!why) return { valid: false, message: 'A cancellation reason is required.' }

      const invoice = findInvoiceFor(consumption, rows('OutletConsumptionInvoices'))
      const restocks = rows('OutletRestocks')
        .filter((row) => isActiveRow(row) && text(row.OutletConsumptionCode) === text(consumption.Code))

      // Re-checked at submit, not merely at entry — see the docblock's reasons 2 and 3.
      const gate = cancellability(consumption, { invoice, restocks })
      if (!gate.allowed) return { valid: false, message: gate.reason }

      /**
       * Name every resource the cascade writes, keyed off what it will ACTUALLY touch — a
       * cancellation with no invoice must not demand invoice-cancel permission. Action
       * names are lower-camel: `allowed()` upper-cases only the first character, so an
       * all-caps name resolves to a key that never matches and fails closed (§8.4).
       */
      const permissions = { OutletConsumptions: 'cancelConsumption' }
      if (invoice && progressOf(invoice) !== 'PAID' && progressOf(invoice) !== 'CANCELLED') {
        permissions.OutletConsumptionInvoices = 'cancel'
      }
      const rejectable = restocks.filter((row) =>
        ![...RESTOCK_IRREVERSIBLE, 'REJECTED'].includes(progressOf(row)))
      if (rejectable.length) {
        permissions.OutletRestocks = 'rejectRestock'
        permissions.OutletRestockItems = 'update'
      }
      if (resourceConfig?.allowed(permissions) !== true) {
        return { valid: false, message: 'You do not have permission to cancel this workflow.' }
      }

      return {
        requests: buildCancellationRequests(consumption, why, { invoice, restocks, actorName: actor() }),
        successMsg: 'Consumption cancelled.',
        // The route's outcome lands back on the record so the user sees the cancelled
        // state and its cascade, rather than being returned to a list. `pageState.reset()`
        // first, or the typed reason survives the navigation and re-seeds the next visit.
        onSuccess: () => {
          pageState.reset()
          nav.goTo('view')
        }
      }
    }
  }
}
