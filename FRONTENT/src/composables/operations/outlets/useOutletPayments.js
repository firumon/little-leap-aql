import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useRecord } from '../../resources/useRecord.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useResourceConfig } from '../../resources/useResourceConfig.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { active, text, todayISO } from './outletOperationsMeta.js'
import { resourceCreateRequest, executeActionRequest, responseFailed, failureMessage } from './outletOperationsBatch.js'
import { getInvoiceTotal, getInvoiceRemaining } from './outletConsumptionPricing.js'

export function useOutletPayments() {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()
  const { allowed } = useResourceConfig()

  // Resource data bindings
  const outlets = useRecord(ref('Outlets'))
  const invoices = useRecord(ref('OutletConsumptionInvoices'))
  const payments = useRecord(ref('OutletPayments'))

  // State
  const loading = ref(false)
  const saving = ref(false)
  const selectedOutletCode = ref('')
  const selectedInvoiceCodes = ref([])
  const allocations = ref({})
  const amount = ref(0)
  const mode = ref('Cash')
  const reference = ref('')
  const currentStep = ref(1)

  // Modes options
  const modeOptions = ['Cash', 'Cheque', 'Bank Transfer', 'Card', 'Other']

  // Selectors
  const outletOptions = computed(() => {
    return outlets.items.value
      .filter(active)
      .map(o => ({ label: o.Name, value: o.Code }))
  })

  const unpaidInvoices = computed(() => {
    if (!selectedOutletCode.value) return []
    return invoices.items.value.filter(inv => {
      return text(inv.OutletCode) === text(selectedOutletCode.value) &&
        active(inv) &&
        text(inv.Progress) !== 'PAID' &&
        text(inv.Progress) !== 'CANCELLED'
    })
  })

  const allUnpaidInvoices = computed(() => {
    return invoices.items.value
      .filter(inv => active(inv) && text(inv.Progress) !== 'PAID' && text(inv.Progress) !== 'CANCELLED')
      .map(inv => {
        const o = outlets.items.value.find(row => row.Code === inv.OutletCode)
        const outletNameStr = o ? o.Name : text(inv.OutletCode)
        const balance = getInvoiceRemaining(inv, payments.items.value)

        return {
          ...inv,
          outletName: outletNameStr,
          balance: balance
        }
      })
      .filter(inv => inv.balance > 0.01)
      .sort((a, b) => new Date(b.Date || 0) - new Date(a.Date || 0))
  })

  const recentPayments = computed(() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    return payments.items.value
      .filter(p => {
        if (!active(p)) return false
        if (text(p.Progress) !== 'SUBMITTED') return false

        const payDate = new Date(p.Date)
        if (isNaN(payDate.getTime())) return false
        return payDate >= sevenDaysAgo
      })
      .map(p => {
        const o = outlets.items.value.find(row => row.Code === p.OutletCode)
        const outletNameStr = o ? o.Name : text(p.OutletCode)

        return {
          ...p,
          outletName: outletNameStr
        }
      })
      .sort((a, b) => new Date(b.Date || 0) - new Date(a.Date || 0))
  })

  const selectedInvoices = computed(() => {
    if (selectedInvoiceCodes.value.length === 0) return []
    return invoices.items.value.filter(inv =>
      selectedInvoiceCodes.value.includes(text(inv.Code)) && active(inv)
    )
  })

  // Calculations
  const totalAmount = computed(() => {
    return selectedInvoices.value.reduce((sum, inv) => sum + getInvoiceTotal(inv), 0)
  })

  const totalPaidSoFar = computed(() => {
    if (selectedInvoiceCodes.value.length === 0) return 0
    return payments.items.value
      .filter(p => selectedInvoiceCodes.value.includes(text(p.OutletConsumptionInvoiceCode)) && active(p) && text(p.Progress) !== 'CANCELLED')
      .reduce((sum, p) => sum + Number(p.Amount || 0), 0)
  })

  const remainingToPay = computed(() => {
    return selectedInvoices.value.reduce((sum, inv) => sum + getInvoiceRemaining(inv, payments.items.value), 0)
  })

  // Auto-distribute total amount sequentially to selected invoices (oldest first)
  function autoDistribute(totalVal) {
    const sortedInvoices = [...selectedInvoices.value].sort((a, b) => new Date(a.Date || 0) - new Date(b.Date || 0))
    const newAllocations = {}
    let remainingAlloc = Number(totalVal) || 0

    for (const inv of sortedInvoices) {
      const invBal = getInvoiceRemaining(inv, payments.items.value)
      if (remainingAlloc >= invBal) {
        newAllocations[inv.Code] = Number(invBal.toFixed(2))
        remainingAlloc -= invBal
      } else if (remainingAlloc > 0) {
        newAllocations[inv.Code] = Number(remainingAlloc.toFixed(2))
        remainingAlloc = 0
      } else {
        newAllocations[inv.Code] = 0
      }
    }

    // Ensure all selected invoices have a mapped value
    for (const inv of selectedInvoices.value) {
      if (!(inv.Code in newAllocations)) {
        newAllocations[inv.Code] = 0
      }
    }
    allocations.value = newAllocations
  }

  // Watch outlet code to transition to Step 2
  watch(selectedOutletCode, (newVal) => {
    if (newVal) {
      currentStep.value = 2
    } else {
      currentStep.value = 1
    }
  })

  // Watch selected invoices to recalculate default amount and allocations
  watch(selectedInvoiceCodes, (newCodes) => {
    if (newCodes && newCodes.length > 0) {
      const totalOutstanding = newCodes.reduce((sum, code) => {
        const inv = invoices.items.value.find(i => text(i.Code) === text(code))
        return sum + (inv ? getInvoiceRemaining(inv, payments.items.value) : 0)
      }, 0)
      amount.value = Number(totalOutstanding.toFixed(2))
      autoDistribute(amount.value)
    } else {
      amount.value = 0
      allocations.value = {}
    }
  }, { deep: true })

  function currentUserName() {
    const user = authStore.user || {}
    return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code || 'Unknown')
  }

  function handleQueryParameters(query) {
    if (!query) return

    const outletParam = query.outletCode || query.outletcode
    const invoiceParam = query.invoiceCode || query.invoicecode

    if (invoiceParam) {
      const inv = invoices.items.value.find(i => text(i.Code) === text(invoiceParam))
      if (inv) {
        selectedOutletCode.value = text(inv.OutletCode)
        selectedInvoiceCodes.value = [text(inv.Code)]
      } else {
        if (outletParam) {
          selectedOutletCode.value = text(outletParam)
        }
        selectedInvoiceCodes.value = [text(invoiceParam)]
      }
      currentStep.value = 3
    } else if (outletParam) {
      selectedOutletCode.value = text(outletParam)
      currentStep.value = 2
    }
  }

  async function reload(forceSync = false) {
    loading.value = true
    try {
      await resourceIoStore.fetchResources(['Outlets', 'OutletConsumptionInvoices', 'OutletPayments'], { forceSync })
    } finally {
      loading.value = false
    }
  }

  async function submitPayment() {
    if (!allowed({ outletPayment: 'create', outletConsumptionInvoice: 'update' })) {
      $q.notify({ type: 'negative', message: 'You do not have permission to submit a payment.', position: 'top' })
      return false
    }
    if (!selectedOutletCode.value) {
      $q.notify({ type: 'warning', message: 'Outlet is required.', position: 'top' })
      return false
    }
    if (selectedInvoiceCodes.value.length === 0) {
      $q.notify({ type: 'warning', message: 'At least one invoice must be selected.', position: 'top' })
      return false
    }
    if (!amount.value || amount.value <= 0) {
      $q.notify({ type: 'warning', message: 'Please enter a valid amount greater than zero.', position: 'top' })
      return false
    }
    if (!mode.value) {
      $q.notify({ type: 'warning', message: 'Payment mode is required.', position: 'top' })
      return false
    }

    const hasValidAllocation = Object.values(allocations.value).some(val => val > 0)
    if (!hasValidAllocation) {
      $q.notify({ type: 'warning', message: 'Please allocate payment amount to at least one invoice.', position: 'top' })
      return false
    }

    saving.value = true
    try {
      const requests = []

      for (const inv of selectedInvoices.value) {
        const allocatedAmount = Number(allocations.value[inv.Code] || 0)
        if (allocatedAmount <= 0) continue

        // 1. Create the Outlet Payment record for this invoice
        requests.push(resourceCreateRequest('OutletPayments', {
          Date: todayISO(),
          OutletCode: selectedOutletCode.value,
          OutletConsumptionInvoiceCode: inv.Code,
          Amount: allocatedAmount,
          Mode: mode.value,
          Reference: reference.value || '',
          Username: currentUserName(),
          Progress: 'SUBMITTED',
          Status: 'Active'
        }))

        // 2. Transition outstanding balance status
        const invBal = getInvoiceRemaining(inv, payments.items.value)
        const remaining = invBal - allocatedAmount
        const comment = `Payment of ${allocatedAmount} allocated (Total payment: ${amount.value} via ${mode.value}) by ${currentUserName()}`

        if (remaining <= 0.01) {
          if (text(inv.Progress) === 'PENDING_PAYMENT' || text(inv.Progress) === 'PARTIALLY_PAID') {
            requests.push(executeActionRequest('OutletConsumptionInvoices', inv.Code, {
              action: 'MarkPaid',
              column: 'Progress',
              columnValue: 'PAID'
            }, { Comment: comment }))
          }
        } else {
          if (text(inv.Progress) === 'PENDING_PAYMENT') {
            requests.push(executeActionRequest('OutletConsumptionInvoices', inv.Code, {
              action: 'MarkPartiallyPaid',
              column: 'Progress',
              columnValue: 'PARTIALLY_PAID'
            }, { Comment: comment }))
          }
        }
      }

      const response = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: failureMessage(response, 'Failed to submit payment.'), position: 'top' })
        return false
      }

      $q.notify({ type: 'positive', message: 'Payment submitted successfully.', position: 'top' })
      nav.goTo('list')
      return true
    } finally {
      saving.value = false
    }
  }

  async function cancelPaymentRecord(paymentCode, comment) {
    if (!allowed({ outletPayment: 'update', outletConsumptionInvoice: 'update' })) {
      $q.notify({ type: 'negative', message: 'You do not have permission to cancel this payment.', position: 'top' })
      return false
    }
    if (!paymentCode) return false
    if (!comment || !comment.trim()) {
      $q.notify({ type: 'warning', message: 'Comment is required for cancellation.', position: 'top' })
      return false
    }

    const paymentRecord = payments.items.value.find(p => p.Code === paymentCode)
    if (!paymentRecord) {
      $q.notify({ type: 'negative', message: 'Payment record not found.', position: 'top' })
      return false
    }

    saving.value = true
    try {
      const requests = []

      requests.push(executeActionRequest('OutletPayments', paymentCode, {
        action: 'Cancel',
        column: 'Progress',
        columnValue: 'CANCELLED'
      }, { ProgressCancelledComment: comment.trim() }))

      const invoiceCode = paymentRecord.OutletConsumptionInvoiceCode
      const inv = invoices.items.value.find(i => text(i.Code) === text(invoiceCode))
      if (inv) {
        const total = getInvoiceTotal(inv)
        const otherPaid = payments.items.value
          .filter(p => text(p.OutletConsumptionInvoiceCode) === text(invoiceCode) && active(p) && text(p.Progress) !== 'CANCELLED' && p.Code !== paymentCode)
          .reduce((sum, p) => sum + Number(p.Amount || 0), 0)

        const remaining = Math.max(0, total - otherPaid)

        let transitionAction = 'MarkPendingPayment'
        let nextProgress = 'PENDING_PAYMENT'

        if (otherPaid > 0.01) {
          if (remaining <= 0.01) {
            transitionAction = 'MarkPaid'
            nextProgress = 'PAID'
          } else {
            transitionAction = 'MarkPartiallyPaid'
            nextProgress = 'PARTIALLY_PAID'
          }
        }

        requests.push(executeActionRequest('OutletConsumptionInvoices', inv.Code, {
          action: transitionAction,
          column: 'Progress',
          columnValue: nextProgress
        }, { Comment: `Payment ${paymentCode} cancelled: ${comment.trim()}` }))
      }

      const response = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: failureMessage(response, 'Failed to cancel payment.'), position: 'top' })
        return false
      }

      $q.notify({ type: 'positive', message: 'Payment cancelled successfully.', position: 'top' })
      nav.goTo('list')
      return true
    } finally {
      saving.value = false
    }
  }

  function cancel() {
    nav.goTo('list')
  }

  return {
    loading,
    saving,
    selectedOutletCode,
    selectedInvoiceCodes,
    allocations,
    amount,
    mode,
    reference,
    modeOptions,
    outlets,
    invoices,
    payments,
    outletOptions,
    unpaidInvoices,
    allUnpaidInvoices,
    recentPayments,
    selectedInvoices,
    totalAmount,
    totalPaidSoFar,
    remainingToPay,
    currentStep,
    reload,
    handleQueryParameters,
    submitPayment,
    cancelPaymentRecord,
    cancel,
    text,
    todayISO,
    autoDistribute
  }
}
