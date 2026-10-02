import { inject, computed } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import { paymentModes } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentProgress'
import { buildOutletPaymentAllocationNodes } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'

export { buildOutletPaymentInitNodes } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'
export { canCollectInvoicePayment } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentProgress'

export function useOutletPaymentAddContext () {
  const pageState = inject('pageState', null)
  const ui = useAQLConfig()
  const { user } = useAuth()
  const { outletOptions } = useOutletResource()
  const index = useOutletPaymentIndex()
  const modes = computed(() => paymentModes())

  const outletCode = computed(() => String(pageState?.getRecord('OutletCode', 'OutletPayments') || '').trim())

  const outletInvoices = computed(() => {
    if (!outletCode.value) return []
    return (index.openInvoices.value || [])
      .filter((row) => String(row.outletCode) === outletCode.value)
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return (a.date || '').localeCompare(b.date || '')
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
  })

  function syncAllocations (allocations = {}) {
    if (!pageState) return
    const record = pageState.getRecord(null, 'OutletPayments') || {}
    const invoices = outletInvoices.value
    const autoApprove = pageState.getControls('AutoApprove', false) === true

    for (const inv of invoices) {
      const code = String(inv.code || inv.Code)
      pageState.removeNode('OutletConsumptionInvoices', code)
      pageState.excludeAdditionalAction('SettleInvoice', {
        resource: 'OutletConsumptionInvoices',
        role: code
      })
    }

    const nodes = buildOutletPaymentAllocationNodes(allocations, record, {
      actorName: user.value?.name,
      invoices,
      autoApprove
    })

    pageState.setControls('Allocations', { ...allocations }, 'OutletPayments')

    if (nodes.length) {
      pageState.applyNodes(nodes)
    }
  }

  function getSuggestedOutlets () {
    const outlets = index.views.value.Outlets || []
    return outlets.map((o) => ({
      outletCode: o.code,
      outletName: o.name,
      invoices: o.invoiceCount || 0,
      total: o.totalBalance || 0
    }))
  }

  return {
    pageState,
    ui,
    outletOptions,
    getSuggestedOutlets,
    modes,
    outletInvoices,
    syncAllocations
  }
}
