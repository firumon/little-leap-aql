import { watch } from 'vue'
import {
  buildInvoiceUpdateNodes,
  editableInvoiceItems
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { taxTransactionRowsOf } from 'src/_resource/Accounts/TaxTransactions/composables/useTaxTransactionPayload'
import { NODE } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Edit/useInvoiceEditContext'

const RESOURCE = 'OutletConsumptionInvoices'
const text = (value) => (value == null ? '' : String(value).trim())

export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: [
    'InvoiceTerms',
    'InvoiceItems',
    'BillingSummary'
  ],

  PropsPageHeader: {
    title: 'Edit Invoice',
    // pageState owns the typed prices; a reload would throw them away.
    reload: false
  },

  // The revised invoice is assembled as the answers are given, so `PageAction.submit` only
  // validates (UI_PAGE_STATE.md §5B).
  ready ({ pageState, resourceRecord }) {
    const loaded = () => resourceRecord?.record?.value || {}
    const control = (header, fallback) => {
      const value = pageState.getControls(header, undefined, NODE)
      return value === undefined || value === null ? fallback : value
    }

    watch(() => [
      text(loaded().Code),
      pageState.getControls('DueDate', '', NODE),
      pageState.getControls('DiscountType', '', NODE),
      pageState.getControls('DiscountValue', undefined, NODE),
      pageState.getControls('PriceListCode', '', NODE),
      pageState.getControls('PriceOverrides', null, NODE)
    ], () => {
      const record = loaded()
      const codeValue = text(record.Code)
      if (!codeValue) return
      if (!pageState.hasNode(NODE)) pageState.initResource(NODE, { isPrimaryKey: true, code: codeValue })

      const items = editableInvoiceItems(record)
      if (!items.length) return

      const overrides = control('PriceOverrides', {})
      const priceOverrides = overrides && typeof overrides === 'object' ? overrides : {}
      const priceListCode = text(control('PriceListCode', ''))

      pageState.applyLive(buildInvoiceUpdateNodes({
        record,
        items,
        dueDate: control('DueDate', undefined),
        discountType: control('DiscountType', undefined),
        discountValue: control('DiscountValue', undefined),
        priceListCode,
        priceOverrides,
        taxTransactionRows: taxTransactionRowsOf(RESOURCE, codeValue)
      }), { keep: [NODE] })
    }, { immediate: true, deep: true })
  }
}
