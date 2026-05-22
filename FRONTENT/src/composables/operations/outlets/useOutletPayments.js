import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { active, text, todayISO } from './outletOperationsMeta.js'
import { resourceCreateRequest, executeActionRequest, responseFailed, failureMessage } from './outletOperationsBatch.js'

export function useOutletPayments() {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()

  // Resource data bindings
  const outlets = useResourceData(ref('Outlets'))
  const invoices = useResourceData(ref('OutletConsumptionInvoices'))
  const payments = useResourceData(ref('OutletPayments'))

  // State
  const loading = ref(false)
  const saving = ref(false)
  const selectedOutletCode = ref('')
  const selectedInvoiceCode = ref('')
  const amount = ref(0)
  const mode = ref('Cash')
  const reference = ref('')

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

        const total = Number(inv.Subtotal || 0) - Number(inv.Discount || 0) + Number(inv.Tax || 0)
        const paid = payments.items.value
          .filter(p => text(p.OutletConsumptionInvoiceCode) === text(inv.Code) && active(p) && text(p.Progress) !== 'CANCELLED')
          .reduce((sum, p) => sum + Number(p.Amount || 0), 0)
        const balance = Math.max(0, total - paid)

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
    sevenDaysAgo.setHours(0, 0, 0, 0) // Normalize to midnight

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

  const selectedInvoice = computed(() => {
    if (!selectedInvoiceCode.value) return null
    return invoices.items.value.find(inv => text(inv.Code) === text(selectedInvoiceCode.value) && active(inv)) || null
  })

  // Calculations (Reactive computed properties)
  const totalAmount = computed(() => {
    if (!selectedInvoice.value) return 0
    return Number(selectedInvoice.value.Subtotal || 0) - Number(selectedInvoice.value.Discount || 0) + Number(selectedInvoice.value.Tax || 0)
  })

  const totalPaidSoFar = computed(() => {
    if (!selectedInvoiceCode.value) return 0
    return payments.items.value
      .filter(p => text(p.OutletConsumptionInvoiceCode) === text(selectedInvoiceCode.value) && active(p) && text(p.Progress) !== 'CANCELLED')
      .reduce((sum, p) => sum + Number(p.Amount || 0), 0)
  })

  const remainingToPay = computed(() => {
    return Math.max(0, totalAmount.value - totalPaidSoFar.value)
  })

  // Computed step to resolve the active form view state reactively
  const currentStep = computed(() => {
    if (!selectedOutletCode.value) return 1
    if (!selectedInvoiceCode.value) return 2
    return 3
  })

  // Watch selected invoice to prefill remaining amount
  watch(selectedInvoiceCode, (newCode) => {
    if (newCode) {
      amount.value = Number(remainingToPay.value.toFixed(2))
    } else {
      amount.value = 0
    }
  })

  function currentUserName() {
    const user = authStore.user || {}
    return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code || 'Unknown')
  }

  function handleQueryParameters(query) {
    if (!query) return

    const outletParam = query.outletCode || query.outletcode
    const invoiceParam = query.invoiceCode || query.invoicecode

    // If invoiceCode/invoicecode is supplied, try to look up the invoice to set the outlet automatically
    if (invoiceParam) {
      const inv = invoices.items.value.find(i => text(i.Code) === text(invoiceParam))
      if (inv) {
        selectedOutletCode.value = text(inv.OutletCode)
        selectedInvoiceCode.value = text(inv.Code)
      } else {
        // Fallback: if invoice is not found in local cache but outletCode is supplied
        if (outletParam) {
          selectedOutletCode.value = text(outletParam)
        }
        selectedInvoiceCode.value = text(invoiceParam)
      }
    } else if (outletParam) {
      selectedOutletCode.value = text(outletParam)
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
    if (!selectedOutletCode.value) {
      $q.notify({ type: 'warning', message: 'Outlet is required.', position: 'top' })
      return false
    }
    if (!selectedInvoiceCode.value) {
      $q.notify({ type: 'warning', message: 'Invoice is required.', position: 'top' })
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

    saving.value = true
    try {
      const requests = []

      // 1. Create the Outlet Payment record
      requests.push(resourceCreateRequest('OutletPayments', {
        Date: todayISO(),
        OutletCode: selectedOutletCode.value,
        OutletConsumptionInvoiceCode: selectedInvoiceCode.value,
        Amount: Number(amount.value),
        Mode: mode.value,
        Reference: reference.value || '',
        Username: currentUserName(),
        Progress: 'SUBMITTED',
        Status: 'Active'
      }))

      // 2. Determine and apply progress transition for the Consumption Invoice
      const inv = selectedInvoice.value
      if (inv) {
        const remaining = remainingToPay.value - Number(amount.value)
        const comment = `Payment of ${amount.value} submitted via ${mode.value} by ${currentUserName()}`

        if (remaining <= 0.01) {
          // Fully Paid
          if (text(inv.Progress) === 'PENDING_PAYMENT' || text(inv.Progress) === 'PARTIALLY_PAID') {
            requests.push(executeActionRequest('OutletConsumptionInvoices', inv.Code, {
              action: 'MarkPaid',
              column: 'Progress',
              columnValue: 'PAID'
            }, { Comment: comment }))
          }
        } else {
          // Partially Paid
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

      // 1. Cancel the payment record itself
      requests.push(executeActionRequest('OutletPayments', paymentCode, {
        action: 'Cancel',
        column: 'Progress',
        columnValue: 'CANCELLED'
      }, { ProgressCancelledComment: comment.trim() }))

      // 2. Resolve invoice and transition progress
      const invoiceCode = paymentRecord.OutletConsumptionInvoiceCode
      const inv = invoices.items.value.find(i => text(i.Code) === text(invoiceCode))
      if (inv) {
        const total = Number(inv.Subtotal || 0) - Number(inv.Discount || 0) + Number(inv.Tax || 0)
        // Sum up other active/submitted payments excluding this cancelled one
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
    selectedInvoiceCode,
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
    selectedInvoice,
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
    todayISO
  }
}
