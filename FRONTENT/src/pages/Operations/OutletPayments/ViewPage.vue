<template>
  <q-page padding class="outlet-payments-page">
    <!-- Page Branded Header -->
    <OutletHeaderPanel
      title="Payment Collection Receipt"
      :subtitle="record ? `Receipt Code: ${record.Code}` : ''"
      :stats="[]"
      class="q-mb-lg payment-header-card"
    >
      <template #side v-if="record">
        <div class="row items-center q-gutter-xs">
          <OutletProgressChip :progress="record.Progress" />
        </div>
      </template>
    </OutletHeaderPanel>

    <!-- Global Loading Spinner -->
    <q-card v-if="loading && !record" flat class="flex flex-center q-pa-xl spinner-container">
      <q-spinner-dots color="primary" size="4em" />
      <q-item-label class="text-subtitle2 text-grey-7 q-mt-md">Loading payment details...</q-item-label>
    </q-card>

    <q-banner v-else-if="!record" rounded class="bg-grey-2 text-grey-8 q-mb-lg">
      Payment collection record not found.
    </q-banner>

    <template v-else>
      <div class="row q-col-gutter-lg">
        <!-- Left Column: Payment Details Card -->
        <div class="col-12 col-md-6">
          <q-card flat bordered class="payment-step-card shadow-1 q-mb-md">
            <q-card-section class="q-pa-lg">
              <q-item class="q-px-none q-mb-md">
                <q-item-section avatar>
                  <q-avatar color="primary-light" text-color="primary" icon="payments" size="40px" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-h6 text-weight-bold text-primary">Collection Information</q-item-label>
                  <q-item-label caption class="text-grey-7">Details of the recorded payment transaction</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator class="q-mb-md" />

              <q-list class="q-gutter-y-xs">
                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Outlet Name</q-item-label>
                    <q-item-label class="text-subtitle2 text-weight-bold text-grey-9">
                      {{ outletName(record.OutletCode) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Payment Date</q-item-label>
                    <q-item-label class="text-subtitle2 text-weight-bold text-grey-9">
                      {{ formatDisplayDate(record.Date) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Amount Collected</q-item-label>
                    <q-item-label class="text-h5 text-weight-black text-positive">
                      {{ formatMoney(record.Amount) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Payment Method Mode</q-item-label>
                    <q-item-label class="text-subtitle2 text-weight-bold text-primary">
                      {{ record.Mode }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Collected By (Username)</q-item-label>
                    <q-item-label class="text-subtitle2 text-weight-bold text-grey-9">
                      {{ record.Username }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item v-if="record.Reference" class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Transaction Reference / Memo</q-item-label>
                    <q-item-label class="text-body2 text-grey-8 bg-grey-1 q-pa-sm rounded-borders" style="white-space: pre-wrap;">
                      {{ record.Reference }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <!-- If cancelled, show cancellation reason -->
                <q-item v-if="record.Progress === 'CANCELLED'" class="bg-red-50 q-pa-md rounded-borders q-mt-md">
                  <q-item-section>
                    <q-item-label class="text-weight-bold text-negative">Cancellation Details</q-item-label>
                    <q-item-label caption class="text-grey-7 q-mt-xs">
                      Cancelled At: {{ formatDisplayDate(record.ProgressCancelledAt) }}
                    </q-item-label>
                    <q-item-label caption class="text-grey-7">
                      Cancelled By: {{ record.ProgressCancelledBy || 'System' }}
                    </q-item-label>
                    <q-item-label class="text-body2 text-negative text-weight-medium q-mt-sm" style="white-space: pre-wrap;">
                      Comment: "{{ record.ProgressCancelledComment || 'No comment provided' }}"
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <!-- Right Column: Associated Invoice Ledger Card -->
        <div class="col-12 col-md-6">
          <q-card flat bordered class="payment-step-card shadow-1 q-mb-md">
            <q-card-section class="q-pa-lg">
              <q-item class="q-px-none q-mb-md">
                <q-item-section avatar>
                  <q-avatar color="orange-1" text-color="orange-9" icon="receipt_long" size="40px" />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-h6 text-weight-bold text-orange-9">Associated Invoice Ledger</q-item-label>
                  <q-item-label caption class="text-grey-7">Status of the outstanding invoice applied to this payment</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator class="q-mb-md" />

              <div v-if="!invoice" class="text-body2 text-grey-6 q-pa-md text-center bg-grey-1 rounded-borders">
                Associated invoice record could not be found or has been removed.
              </div>

              <q-list v-else class="q-gutter-y-xs">
                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Invoice Number Code</q-item-label>
                    <q-item-label class="text-subtitle2 text-weight-bold text-grey-9">
                      {{ invoice.Code }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Invoice Generated Date</q-item-label>
                    <q-item-label class="text-subtitle2 text-weight-bold text-grey-9">
                      {{ formatDisplayDate(invoice.Date) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label caption class="text-grey-6">Invoice Status Progress</q-item-label>
                    <q-item-label class="q-mt-xs">
                      <q-chip
                        dense
                        :color="invoice.Progress === 'PARTIALLY_PAID' ? 'orange-1' : (invoice.Progress === 'PAID' ? 'green-1' : 'blue-1')"
                        :text-color="invoice.Progress === 'PARTIALLY_PAID' ? 'orange-9' : (invoice.Progress === 'PAID' ? 'green-9' : 'blue-9')"
                        :label="progressMeta(invoice.Progress).label"
                        class="text-weight-bold text-overline"
                        style="margin: 0;"
                      />
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-separator class="q-my-md" />

                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label class="text-grey-7">Total Invoice Amount</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-weight-bold text-grey-9 text-subtitle1">{{ formatMoney(invoiceTotal) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item class="q-px-none">
                  <q-item-section>
                    <q-item-label class="text-grey-7">Amount Paid So Far</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-weight-bold text-positive text-subtitle1">+ {{ formatMoney(invoicePaidSoFar) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-separator class="q-my-xs" />

                <q-item :class="invoiceBalance > 0.01 ? 'bg-red-50 text-negative' : 'bg-green-50 text-positive'" class="q-pa-md rounded-borders q-mt-sm">
                  <q-item-section>
                    <q-item-label class="text-weight-bold">Balance Outstanding to Pay</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label :class="invoiceBalance > 0.01 ? 'text-negative' : 'text-positive'" class="text-weight-black text-h6">
                      {{ formatMoney(invoiceBalance) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <!-- Link/Button to make another payment if balance remains -->
                <div v-if="invoiceBalance > 0.01" class="row justify-end q-mt-lg">
                  <q-btn
                    unelevated
                    color="primary"
                    icon="payments"
                    label="Pay Remaining Balance"
                    @click="navigateToMakePayment"
                    class="premium-btn text-weight-bold full-width"
                  />
                </div>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Action Panel Buttons -->
      <div class="row q-gutter-sm justify-end q-mt-lg">
        <q-btn
          flat
          color="primary"
          icon="arrow_back"
          label="Back to List"
          @click="cancel"
          class="premium-btn-secondary text-weight-bold"
          :disabled="saving"
        />

        <q-btn
          v-if="canCancel"
          unelevated
          color="negative"
          icon="cancel"
          label="Cancel Payment Receipt"
          :loading="saving"
          @click="openCancelDialog"
          class="premium-btn text-weight-bold"
        />
      </div>
    </template>

    <!-- Cancellation Comment Dialog -->
    <q-dialog v-model="cancelDialogOpen" persistent>
      <q-card style="min-width: 350px; border-radius: 16px;" class="text-negative">
        <q-card-section class="row items-center q-pb-none no-wrap">
          <q-icon name="warning" size="sm" class="q-mr-md" />
          <div class="text-weight-bold text-subtitle1">Cancel Payment Collection</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-md">
          <div class="text-body2 text-grey-8 q-mb-md">
            This action will mark the payment collection receipt as cancelled and recalculate the outstanding invoice balance. This action cannot be undone.
          </div>
          <q-input
            v-model="cancelComment"
            outlined
            type="textarea"
            label="Cancellation Comment (Mandatory) *"
            placeholder="Please enter a valid reason for cancellation (min 3 characters)..."
            :rules="[
              val => !!val || 'Cancellation comment is required',
              val => val.trim().length >= 3 || 'Comment must be at least 3 characters long'
            ]"
            rows="3"
            class="premium-input"
          />
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md bg-grey-1">
          <q-btn flat label="Back" color="primary" v-close-popup class="text-weight-bold" />
          <q-btn
            unelevated
            label="Confirm Cancellation"
            color="negative"
            :disable="!cancelComment || cancelComment.trim().length < 3"
            :loading="saving"
            @click="confirmCancel"
            class="text-weight-bold"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletPayments } from '../../../composables/operations/outlets/useOutletPayments.js'
import { progressMeta } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'
import { useResourceNav } from '../../../composables/resources/useResourceNav.js'

defineOptions({ name: 'OutletPaymentsViewPage' })

const route = useRoute()
const nav = useResourceNav()
const flow = useOutletPayments()

const {
  loading,
  saving,
  outlets,
  invoices,
  payments,
  reload,
  cancelPaymentRecord,
  cancel,
  text
} = flow

const record = computed(() => {
  return payments.items.value.find(p => text(p.Code) === text(route.params.code)) || null
})

const invoice = computed(() => {
  if (!record.value) return null
  return invoices.items.value.find(inv => text(inv.Code) === text(record.value.OutletConsumptionInvoiceCode)) || null
})

const invoiceTotal = computed(() => {
  if (!invoice.value) return 0
  return Number(invoice.value.Subtotal || 0) - Number(invoice.value.Discount || 0) + Number(invoice.value.Tax || 0)
})

const invoicePaidSoFar = computed(() => {
  if (!invoice.value) return 0
  return payments.items.value
    .filter(p => text(p.OutletConsumptionInvoiceCode) === text(invoice.value.Code) && p.Status === 'Active' && p.Progress !== 'CANCELLED')
    .reduce((sum, p) => sum + Number(p.Amount || 0), 0)
})

const invoiceBalance = computed(() => {
  return Math.max(0, invoiceTotal.value - invoicePaidSoFar.value)
})

const canCancel = computed(() => {
  if (!record.value) return false
  return text(record.value.Status) === 'Active' && text(record.value.Progress) !== 'CANCELLED'
})

const cancelDialogOpen = ref(false)
const cancelComment = ref('')

function openCancelDialog() {
  cancelComment.value = ''
  cancelDialogOpen.value = true
}

async function confirmCancel() {
  if (!cancelComment.value || cancelComment.value.trim().length < 3) return
  const ok = await cancelPaymentRecord(record.value.Code, cancelComment.value)
  if (ok) {
    cancelDialogOpen.value = false
  }
}

function navigateToMakePayment() {
  if (!record.value) return
  nav.goTo('add', { query: { outletCode: record.value.OutletCode, invoiceCode: record.value.OutletConsumptionInvoiceCode } })
}

// Currency Formatter Helper
function formatMoney(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Format display date
function formatDisplayDate(val) {
  if (!val) return '-'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return text(val)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return text(val)
  }
}

// Outlet display name (Human-readable, name only)
function outletName(code) {
  const o = outlets.items.value.find(row => row.Code === code)
  return o ? o.Name : text(code)
}

onMounted(async () => {
  await reload()
})
</script>

<style scoped lang="scss">
</style>
