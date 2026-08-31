import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { buildReturnCreateNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

const NODE = 'OutletReturns'

// The columns the OFFICER fills. The builder writes its derived columns and its stamps
// back onto the same node, so only the answers are watched (UI_PAGE_STATE.md §5B.3).
const INPUTS = [
    'OutletCode', 'SKU', 'Qty', 'Date', 'Username', 'Reason', 'ReasonComment',
    'SourceInvoiceCode', 'WarehouseCode', 'StorageName', 'Price',
    'InvoiceAdjustmentRequired', 'WarehouseActionRequired'
  ]

export default {
  sections: ['PageHeader'],
  contents: [
    'FormReturnedItem',
    'FormBilledOn',
    'FormQuantityValue',
    'FormCommercialCredit',
    'FormReason',
    'FormPhysicalStock'
  ],

  PropsPageHeader: {
    title: 'Log Outlet Return',
    reload: false
  },

  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),

  // The batch — the return and the ledger rows it moves — is re-cut on every answer, so
  // `PageAction.submit` only validates (UI_PAGE_STATE.md §5B).
  ready ({ pageState }) {
    const { user } = useAuth()

    const rebuild = (ps) => {
      const form = ps.getRecord(null, NODE) || {}
      ps.applyLive(buildReturnCreateNodes({
        form,
        // The figure the form resolved and the officer may have overridden. The builder
        // records what it is handed; it never prices anything itself.
        resolvedPrice: Number(form.Price) || 0,
        actorName: user.value?.name || user.value?.email || ''
      }), { keep: [NODE] })
    }

    // One derivation per ANSWER, never one on the whole record: the builder writes its
    // derived columns back onto the same node, and watching those would re-enter.
    // Re-registered whenever the node is replaced — the seed's `reset: true` clears every
    // derivation with the node it drops.
    const bound = pageState.useNode(NODE)
    watch(bound.identifier, (id) => {
      if (!id) return
      pageState.derive(INPUTS.map((field) => ({
        on: { resource: NODE, field },
        // An untouched form has nothing to build; the builder would only veto.
        immediate: false,
        handler: (value, ps) => rebuild(ps)
      })))
    }, { immediate: true })
  }
}
