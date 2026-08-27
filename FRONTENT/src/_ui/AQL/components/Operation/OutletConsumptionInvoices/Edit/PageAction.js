import {
  buildInvoiceUpdateNodes,
  editableInvoiceItems,
  makeStoredPriceResolver
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { makeLineTaxResolver } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { canEditInvoice } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { taxTransactionRowsOf } from 'src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload'

const NODE = 'InvoiceEdit'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // The sticky bar mounts against the page's node and renders nothing without one.
  pageState.useNode('OutletConsumptionInvoices')

  const record = () => resourceRecord?.record?.value || {}

  // Same EditFor guard as the context: stale answers must not reach another invoice.
  const field = (header) => {
    if (text(pageState.getControlField(NODE, 'EditFor')) !== text(record().Code)) return undefined
    return pageState.getControlField(NODE, header)
  }

  const overrides = () => {
    const value = field('PriceOverrides')
    return value && typeof value === 'object' ? value : {}
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Save Invoice',

    // false stops the built-in goBack() popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This invoice could not be loaded.' }

      if (!canEditInvoice(row)) {
        return { valid: false, message: 'This invoice can no longer be edited — it has taken a payment or come to rest.' }
      }

      const items = editableInvoiceItems(row)
      const priceOverrides = overrides()
      const issuedPriceListCode = text(row.PriceListCode)
      const priceListCode = text(field('PriceListCode')) || issuedPriceListCode

      const result = buildInvoiceUpdateNodes({
        record: row,
        items,
        dueDate: field('DueDate'),
        discountType: field('DiscountType'),
        discountValue: field('DiscountValue'),
        priceListCode,
        priceOverrides,
        // Current ledger rows, so Layer 2 can retire them in the same batch.
        taxTransactionRows: taxTransactionRowsOf('OutletConsumptionInvoices', text(row.Code)),
        calculateLineTax: makeLineTaxResolver({
          priceListCode,
          resolvePrice: makeStoredPriceResolver(items, priceOverrides, {
            priceListCode,
            issuedPriceListCode
          })
        })
      })

      if (!result.valid) return { valid: false, message: result.message }
      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to change this invoice.' }
      }

      pageState.applyNodes(result.nodes)

      return { successMsg: result.successMsg }
    },

    // Never return an `onSuccess` with the requests: that would replace PageAction.vue's
    // default, which owns both the form reset and this navigation.
    successRoute: 'view'
  }
}
