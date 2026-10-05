import { computed, inject, watch, nextTick, effectScope } from 'vue'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import usePaymentData from 'src/_resource/Operation/OutletPayments/Data/usePaymentData'
import { buildOutletPaymentApproveNodes } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'

const RESOURCE = 'OutletPayments'
const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function useOutletPaymentApproveContext () {
  const pageState = inject('pageState', null)
  const step = () => pageState?.meta?.currentStep || 1
  const paymentData = usePaymentData()
  const ui = useAQLConfig()
  const { query } = useRouteConfig()
  const { _C, roundToDecimals } = useCurrencyResource()
  const { getOutlet } = useOutletResource()
  const index = useOutletPaymentIndex()

  const selectedUser = pageState.useControls('selectedUser', text(query.value?.userCode))
  const selectedOutlet = pageState.useControls('selectedOutlet', text(query.value?.outletCode))
  const selectedCode = pageState.useControls('selectedCode', text(query.value?.paymentCode || query.value?.code))
  const allocations = pageState.useControls('allocations', {})

  const records = ['OutletPayments', 'OutletConsumptionInvoices', 'Outlets'].map(usePageRecord)

  const pendingPayments = computed(() => index.rawPayments.value
    .filter((row) => text(row.Progress).toUpperCase() === 'SUBMITTED'))

  const pendingByUser = computed(() => {
    const groups = new Map()
    pendingPayments.value.forEach((payment) => {
      const u = text(payment.Username) || 'Unknown'
      const entry = groups.get(u) || { user: u, amount: 0, count: 0 }
      entry.amount += num(payment.Amount)
      entry.count += 1
      groups.set(u, entry)
    })
    return [...groups.values()].sort((a, b) => b.amount - a.amount)
  })

  const userPayments = computed(() => selectedUser.value
    ? pendingPayments.value.filter((row) => (text(row.Username) || 'Unknown') === selectedUser.value)
    : [])

  const pendingByOutlet = computed(() => {
    const openMap = new Map()
    index.openInvoices.value.forEach((inv) => {
      const code = text(inv.outletCode)
      if (code) openMap.set(code, (openMap.get(code) || 0) + 1)
    })

    const groups = new Map()
    userPayments.value.forEach((payment) => {
      const outlet = text(payment.OutletCode) || 'Unknown'
      const entry = groups.get(outlet) || {
        outlet,
        outletName: getOutlet(outlet)?.name || outlet,
        amount: 0,
        count: 0,
        openInvoiceCount: openMap.get(outlet) || 0
      }
      entry.amount += num(payment.Amount)
      entry.count += 1
      groups.set(outlet, entry)
    })
    return [...groups.values()].sort((a, b) => b.amount - a.amount)
  })

  const outletPayments = computed(() => selectedUser.value && selectedOutlet.value
    ? userPayments.value.filter((row) => text(row.OutletCode) === selectedOutlet.value)
    : [])

  const selectedPayment = computed(() => pendingPayments.value.find((row) => text(row.Code) === selectedCode.value) || null)

  const outletInvoices = computed(() => selectedOutlet.value
    ? index.openInvoices.value.filter((row) => text(row.outletCode) === selectedOutlet.value)
    : [])

  const paymentAmount = computed(() => roundToDecimals(Number(selectedPayment.value?.Amount) || 0))

  const totalAllocated = computed(() => {
    const sum = Object.values(allocations.value || {}).reduce((acc, v) => acc + (Number(v) || 0), 0)
    return roundToDecimals(sum)
  })

  function resetAllocate () {
    allocations.value = {}
  }

  function autoAllocate () {
    const target = paymentAmount.value
    const invoices = outletInvoices.value || []
    const next = {}

    // 1. Exact match check: if any invoice balance matches the payment amount exactly, allocate all to it.
    const exactMatch = invoices.find(inv => Math.abs((Number(inv.balance) || 0) - target) < 0.01)
    if (exactMatch) {
      invoices.forEach(inv => {
        next[inv.code] = inv.code === exactMatch.code ? roundToDecimals(target) : 0
      })
      allocations.value = next
      return next
    }

    // 2. Otherwise distribute across open invoices sequentially
    let remaining = target
    invoices.forEach(inv => {
      const bal = Number(inv.balance) || 0
      const applied = Math.max(0, Math.min(remaining, bal))
      next[inv.code] = roundToDecimals(applied)
      remaining = Math.max(0, roundToDecimals(remaining - applied))
    })
    allocations.value = next
    return next
  }

  function handleWizardChange ([newUser, newOutlet, newCode, newStep], [oldUser, oldOutlet, oldCode, oldStep] = []) {
    pageState?.detachAll?.()
    pageState?.clearDerive?.()
    allocations.value = {}

    if (newStep === 1 && oldStep !== 1) {
      selectedUser.value = ''
      selectedOutlet.value = ''
      selectedCode.value = ''
      pageState?.resetForResource(RESOURCE)
      return
    }

    if (newUser !== oldUser) {
      selectedOutlet.value = ''
      selectedCode.value = ''
      if (pageState?.meta && newUser) {
        pageState.meta.currentStep = 2
      }
      return
    }

    if (newOutlet !== oldOutlet) {
      selectedCode.value = ''
      return
    }

    if (newCode !== oldCode) {
      if (newCode) {
        nextTick(() => {
          autoAllocate()
        })
      }
    }
  }

  function handleAllocationChange (newAllocations) {
    if (!selectedPayment.value) return
    const target = paymentAmount.value
    const currentTotal = totalAllocated.value
    if (target > 0 && Math.abs(currentTotal - target) < 0.01) {
      const nodes = buildOutletPaymentApproveNodes(newAllocations, selectedPayment.value, {
        invoices: outletInvoices.value || [],
        existingPayments: index.rawPayments.value || []
      })
      pageState.applyNodes(nodes)
    } else {
      pageState?.detachAll?.()
    }
  }

  if (pageState && !pageState._approveWatchersBound) {
    pageState._approveWatchersBound = true
    const scope = effectScope(true)
    scope.run(() => {
      watch(
        [selectedUser, selectedOutlet, selectedCode, () => pageState?.meta?.currentStep],
        handleWizardChange
      )

      watch(allocations, handleAllocationChange, { deep: true })
    })
  }

  async function loadSources () {
    await Promise.all(records.map((resource) => resource.reload()))
  }

  return {
    pageState,
    ui,
    money: (value) => _C(num(value), true),
    loadSources,
    step,
    pendingApproval: paymentData.pendingApproval,
    outletWisePendingAmount: paymentData.outletWisePendingAmount,
    collectionsPerDay7Days: paymentData.collectionsPerDay7Days,
    paymentDataLoading: paymentData.loading,
    pendingByUser,
    pendingByOutlet,
    outletPayments,
    selectedUser,
    selectedOutlet,
    selectedCode,
    selectedPayment,
    outletInvoices,
    allocations,
    roundToDecimals,
    paymentAmount,
    totalAllocated,
    autoAllocate,
    resetAllocate
  }
}
