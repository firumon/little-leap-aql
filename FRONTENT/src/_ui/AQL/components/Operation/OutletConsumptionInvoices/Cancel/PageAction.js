import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildCancellationNodes } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { canCancelInvoice } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { taxTransactionRowsOf } from 'src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload'

/**
 * OutletConsumptionInvoices › Cancel › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   comment   →   [ Cancel ] [ Cancel Invoice ]
 *
 * It assembles nothing. The rows it reads are the SOURCES the builder derives from, and the
 * builder owns every write — including walking the bundled consumptions back to invoiceable,
 * which it asks the OutletConsumptions domain for rather than writing itself (§9.1).
 */
const NODE = 'OutletConsumptionInvoices'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export default (props, { pageState, resourceRecord }) => {
  // Safe outside setup: both only reach Pinia stores and call no `inject()`.
  const { user } = useAuth()
  const dataStore = useDataStore()

  const record = () => asRow(resourceRecord?.record?.value)
  const actor = () => text(user.value?.name || user.value?.email || '')
  const comment = () => text(pageState?.getControls('CancelComment', null, NODE))

  const returnsFor = (code) => (dataStore.getRecords('OutletReturns') || [])
    .map(asRow)
    .filter((row) => text(row.ConsumptionInvoiceCode) === code)

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Invoice',
    // Destructive, so the button reads as such rather than as the page's neutral primary.
    submitColor: 'negative',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: (name, { nav }) => {
      const invoice = record()
      const code = text(invoice.Code)
      if (!code) return { valid: false, message: 'This invoice could not be loaded.' }

      // Re-checked at submit: a payment may have settled the invoice while this page was open.
      if (!canCancelInvoice(invoice)) return { valid: false, message: 'This invoice can no longer be cancelled.' }

      const result = buildCancellationNodes({
        record: invoice,
        comment: comment(),
        actorName: actor(),
        returnRows: returnsFor(code),
        taxTransactionRows: taxTransactionRowsOf(NODE, code)
      })

      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false
      return {
        successMsg: applied.successMsg,
        onSuccess: () => {
          pageState.reset()
          nav.goTo('view')
        }
      }
    }
  }
}
