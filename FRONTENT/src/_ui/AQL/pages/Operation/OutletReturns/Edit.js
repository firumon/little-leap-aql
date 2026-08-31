import { watch } from 'vue'
import { buildReturnUpdateNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

const NODE = 'OutletReturns'

// The columns the OFFICER edits — see Add.js for why the whole record is not watched.
const INPUTS = [
    'OutletCode', 'SKU', 'Qty', 'Date', 'Username', 'Reason', 'ReasonComment',
    'SourceInvoiceCode', 'WarehouseCode', 'StorageName', 'Price',
    'InvoiceAdjustmentRequired', 'WarehouseActionRequired'
  ]

export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: [
    'FormReturnedItem',
    'FormBilledOn',
    'FormQuantityValue',
    'FormCommercialCredit',
    'FormReason',
    'FormPhysicalStock'
  ],

  PropsPageHeader: {
    title: 'Edit Return',
    reload: false
  },

  PropsFormReturnedItem: {
    mode: 'edit'
  },

  // Every card spaces itself on the PAGE's own gutter rather than its own fallback (§10.2).
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),
  PropsSection: (pageProps) => ({ gutter: pageProps.gutter }),

  // The batch is re-cut on every edit, so `PageAction.submit` only validates
  // (UI_PAGE_STATE.md §5B).
  ready ({ pageState, resourceRecord }) {
    const rebuild = (ps) => {
      const form = ps.getRecord(null, NODE) || {}
      ps.applyLive(buildReturnUpdateNodes({
        record: resourceRecord?.record?.value || {},
        form,
        resolvedPrice: Number(form.Price) || 0
      }), { keep: [NODE] })
    }

    // One derivation per ANSWER — see Add.js. Re-registered whenever the node is replaced,
    // which is what the edit seed does once the server row lands.
    const bound = pageState.useNode(NODE)
    watch(bound.identifier, (id) => {
      if (!id) return
      pageState.derive(INPUTS.map((field) => ({
        on: { resource: NODE, field },
        immediate: false,
        handler: (value, ps) => rebuild(ps)
      })))
    }, { immediate: true })
  }
}
