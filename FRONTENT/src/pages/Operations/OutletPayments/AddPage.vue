<template>
  <q-page padding class="outlet-payments-page">
    <!-- Page Branded Header -->
    <OutletHeaderPanel
      title="Record Outlet Payment"
      subtitle="Receive and log outstanding outlet consumption payments"
      :stats="[]"
      class="q-mb-lg payment-header-card"
    />

    <!-- Global Loading Spinner -->
    <q-card v-if="loading" flat class="flex flex-center q-pa-xl spinner-container">
      <q-spinner-dots color="primary" size="4em" />
      <q-item-label class="text-subtitle2 text-grey-7 q-mt-md">Loading payment ledger data...</q-item-label>
    </q-card>

    <template v-else>
      <!-- STEP 1: Select Outlet -->
      <transition name="fade-slide" mode="out-in">
        <q-card v-if="currentStep === 1" flat bordered class="payment-step-card shadow-1 animate-fade-slide">
          <q-card-section class="q-pa-lg">
            <q-item class="q-px-none q-mb-md">
              <q-item-section avatar>
                <q-avatar color="primary-light" text-color="primary" icon="storefront" size="40px" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-h6 text-weight-bold text-primary">Step 1: Select Outlet</q-item-label>
                <q-item-label caption class="text-grey-7">Choose the outlet making the payment</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator class="q-mb-md" />

            <!-- Mobile-Friendly Stats Box -->
            <div class="row q-col-gutter-sm q-mb-lg">
              <div class="col-6">
                <q-card flat bordered class="q-pa-sm text-center bg-grey-1 shadow-none" style="border-radius: 8px; border-color: #f1f5f9;">
                  <q-item-label class="text-caption text-grey-6 text-weight-bold text-overline">Total Outlets</q-item-label>
                  <q-item-label class="text-subtitle2 text-weight-black text-primary">{{ outlets.items.value.filter(o => o.Status === 'Active').length }}</q-item-label>
                </q-card>
              </div>
              <div class="col-6">
                <q-card flat bordered class="q-pa-sm text-center bg-grey-1 shadow-none" style="border-radius: 8px; border-color: #f1f5f9;">
                  <q-item-label class="text-caption text-grey-6 text-weight-bold text-overline">Pending Invoices</q-item-label>
                  <q-item-label class="text-subtitle2 text-weight-black text-orange-9">{{ invoices.items.value.filter(i => i.Status === 'Active' && i.Progress !== 'PAID' && i.Progress !== 'CANCELLED').length }}</q-item-label>
                </q-card>
              </div>
            </div>

            <!-- Quick-Select Pending Invoices List -->
            <div v-if="allUnpaidInvoices.length > 0" class="q-mb-m">
              <q-item-label class="text-subtitle2 text-weight-bold text-grey-7 q-mb-sm">
                Direct Select Pending Invoice (Tap to Pay)
              </q-item-label>
              <q-list bordered class="rounded-borders scroll" style="max-height: 220px; border-color: #f1f5f9; background-color: #fafafa;">
                <q-item
                  v-for="inv in allUnpaidInvoices"
                  :key="inv.Code"
                  clickable
                  v-ripple
                  @click="selectGlobalInvoice(inv.Code, inv.OutletCode)"
                  class="invoice-mobile-card q-py-sm"
                >
                  <q-item-section side>
                    <q-avatar color="orange-1" text-color="orange-9" icon="receipt_long" size="sm" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-subtitle2 text-weight-bold text-grey-9">
                      {{ inv.outletName }}
                    </q-item-label>
                    <q-item-label caption class="text-grey-6" style="font-size: 0.7rem;">
                      {{ formatDisplayDate(inv.Date) }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side class="self-center">
                    <q-item-label class="text-subtitle2 text-weight-bold text-negative">
                      {{ formatMoney(inv.balance) }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>

            <div class="q-gutter-y-md">
              <q-select
                v-model="selectedOutletCode"
                :options="outletOptionsList"
                outlined
                dense
                emit-value
                map-options
                label="Search or Select Outlet *"
                use-input
                input-debounce="300"
                @filter="filterOutlets"
                class="premium-select"
              >
                <template #no-option>
                  <q-item>
                    <q-item-section class="text-grey">No active outlets found</q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
          </q-card-section>
        </q-card>
      </transition>

      <!-- STEP 2: Select Invoice -->
      <transition name="fade-slide" mode="out-in">
        <q-card v-if="currentStep === 2" flat bordered class="payment-step-card shadow-1 animate-fade-slide">
          <!-- Active Selection Summary Block (Mobile-First Compact) -->
          <q-card-section class="bg-primary-light q-px-none border-bottom-dashed">
            <q-list dense>
              <q-item>
                <q-item-section avatar><q-avatar color="white" text-color="primary" icon="storefront" size="36px" class="q-mr-sm shadow-xs" style="flex-shrink: 0;" /></q-item-section>
                <q-item-section>
                  <q-item-label caption>Selected Outlet</q-item-label>
                  <q-item-label class="text-subtitle2 text-weight-bold text-primary">{{ outletName(selectedOutletCode) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    round
                    dense
                    color="primary"
                    icon="sync"
                    @click="resetOutlet"
                    class="bg-white shadow-xs"
                    style="border: 1px solid #cbd5e1; width: 36px; height: 36px;"
                  ><q-tooltip>Change Outlet</q-tooltip></q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <q-card-section class="q-pa-lg">
            <q-item class="q-px-none q-mb-md">
              <q-item-section avatar>
                <q-avatar color="primary-light" text-color="primary" icon="receipt_long" size="40px" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-h6 text-weight-bold text-primary row items-center no-wrap">
                  Step 2: Select Invoice
                  <q-badge color="orange" text-color="white" class="q-ml-sm text-weight-bold" style="padding: 4px 8px; border-radius: 12px;">
                    {{ unpaidInvoices.length }} Pending
                  </q-badge>
                </q-item-label>
                <q-item-label caption class="text-grey-7">Select an unpaid invoice to apply payment</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator class="q-mb-lg" />

            <!-- Invoice List (Mobile-First Cards using q-list / q-item) -->
            <q-list v-if="unpaidInvoices.length > 0" class="q-gutter-y-sm" style="background: transparent;">
              <q-item
                v-for="inv in unpaidInvoices"
                :key="inv.Code"
                clickable
                v-ripple
                @click="selectInvoice(inv.Code)"
                class="invoice-mobile-card q-pa-md q-mb-sm shadow-sm relative-position"
              >
                <!-- Left: Avatar / Icon representing an Invoice -->
                <q-item-section avatar class="self-center">
                  <q-avatar color="primary-light" text-color="primary" icon="receipt_long" size="36px" class="shadow-xs" style="flex-shrink: 0;" />
                </q-item-section>

                <!-- Center: Invoice code, date, and price list -->
                <q-item-section>
                  <q-item-label class="text-weight-bold text-subtitle2 text-primary">
                    {{ invoiceLabel(inv.Code) }}
                  </q-item-label>
                  <q-item-label caption class="text-grey-6" style="font-size: 0.75rem;">
                    {{ inv.PriceListCode ? `Price List: ${inv.PriceListCode}` : 'No Price List' }}
                  </q-item-label>
                  <q-item-label>
                    <q-chip
                      dense
                      :color="inv.Progress === 'PARTIALLY_PAID' ? 'orange-1' : (inv.Progress === 'PAID' ? 'green-1' : 'blue-1')"
                      :text-color="inv.Progress === 'PARTIALLY_PAID' ? 'orange-9' : (inv.Progress === 'PAID' ? 'green-9' : 'blue-9')"
                      :label="progressMeta(inv.Progress).label"
                      class="text-weight-bold text-overline"
                      style="margin: 0; font-size: 0.65rem;"
                    />
                  </q-item-label>
                </q-item-section>

                <!-- Right: Status badge and money details -->
                <q-item-section side>
                  <q-item-label caption class="text-weight-medium text-grey-9">Total: {{ formatMoney(getInvoiceTotal(inv)) }}</q-item-label>
                  <q-item-label class="text-subtitle2 text-weight-bold text-negative">Bal: {{ formatMoney(getInvoiceBalance(inv)) }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>

            <!-- Empty State -->
            <q-item v-else class="empty-state-container q-py-xl text-center">
              <q-item-section>
                <q-icon name="check_circle" size="64px" color="positive" class="q-mb-md block mx-auto" />
                <q-item-label class="text-h6 text-weight-bold text-grey-8">All Settled!</q-item-label>
                <q-item-label class="text-body2 text-grey-6 q-mb-md">No unpaid or partially paid invoices found for this outlet.</q-item-label>
                <div class="row justify-center q-mt-md">
                  <q-btn outline color="primary" label="Back to Outlets" icon="arrow_back" @click="resetOutlet" />
                </div>
              </q-item-section>
            </q-item>
          </q-card-section>
        </q-card>
      </transition>

      <!-- STEP 3: Payment Entry -->
      <transition name="fade-slide" mode="out-in">
        <div v-if="currentStep === 3" class="animate-fade-slide">
          <div class="row q-col-gutter-lg">
            <!-- Left Column: Summary Card -->
            <div class="col-12 col-md-5">
              <q-card flat bordered class="payment-step-card shadow-1 q-mb-md">
                <!-- Step 3 Active Selection Summary Block (Mobile-First Compact) -->
                <q-card-section class="bg-primary-light q-px-none border-bottom-dashed">
                  <q-list dense>
                    <!-- Selected Outlet Row -->
                    <q-item>
                      <q-item-section avatar>
                        <q-avatar color="white" text-color="primary" icon="storefront" size="32px" class="q-mr-sm shadow-xs" style="flex-shrink: 0;" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label caption>Selected Outlet</q-item-label>
                        <q-item-label class="text-subtitle2 text-weight-bold text-primary">{{ outletName(selectedOutletCode) }}</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-btn
                          flat
                          round
                          dense
                          color="primary"
                          icon="sync"
                          @click="resetOutlet"
                          class="bg-white shadow-xs"
                          style="border: 1px solid #cbd5e1; width: 32px; height: 32px;"
                        >
                          <q-tooltip>Change Outlet</q-tooltip>
                        </q-btn>
                      </q-item-section>
                    </q-item>

                    <q-separator style="opacity: 0.15;" class="q-my-xs" />

                    <!-- Selected Invoice Row -->
                    <q-item>
                      <q-item-section avatar>
                        <q-avatar color="white" text-color="grey-8" icon="receipt_long" size="32px" class="q-mr-sm shadow-xs" style="flex-shrink: 0;" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label caption>Selected Invoice</q-item-label>
                        <q-item-label class="text-subtitle2 text-weight-bold text-grey-9">{{ invoiceLabel(selectedInvoiceCode) }}</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-btn
                          flat
                          round
                          dense
                          color="primary"
                          icon="sync"
                          @click="resetInvoice"
                          class="bg-white shadow-xs"
                          style="border: 1px solid #cbd5e1; width: 32px; height: 32px;"
                        >
                          <q-tooltip>Change Invoice</q-tooltip>
                        </q-btn>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>

                <!-- Calculations Summary Box -->
                <q-card-section class="q-pa-lg">
                  <q-item-label class="text-subtitle2 text-weight-bold text-grey-7 q-mb-md uppercase tracking-wider">Invoice Balance Ledger</q-item-label>
                  <q-list class="q-gutter-y-sm">
                    <q-item dense class="q-px-none">
                      <q-item-section>
                        <q-item-label class="text-grey-7">Total Invoice Amount</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-item-label class="text-weight-bold text-grey-9 text-subtitle2">{{ formatMoney(totalAmount) }}</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item dense class="q-px-none">
                      <q-item-section>
                        <q-item-label class="text-grey-7">Total Paid So Far</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-item-label class="text-weight-bold text-positive text-subtitle2">+ {{ formatMoney(totalPaidSoFar) }}</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-separator class="q-my-xs" />
                    <q-item class="bg-red-50 q-pa-md rounded-borders">
                      <q-item-section>
                        <q-item-label class="text-weight-bold text-negative">Remaining Outstanding</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-item-label class="text-weight-black text-negative text-h6">{{ formatMoney(remainingToPay) }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>
              </q-card>
            </div>

            <!-- Right Column: Amount & Mode Entry Form -->
            <div class="col-12 col-md-7">
              <q-card flat bordered class="payment-step-card shadow-1">
                <q-card-section class="q-pa-lg">
                  <q-item class="q-px-none q-mb-md">
                    <q-item-section avatar>
                      <q-avatar color="primary-light" text-color="primary" icon="payments" size="40px" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label class="text-h6 text-weight-bold text-primary">Step 3: Collect Payment</q-item-label>
                      <q-item-label caption class="text-grey-7">Specify the amount collected and payment method</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-separator class="q-mb-lg" />

                  <!-- Payment form fields -->
                  <div class="q-gutter-y-md">
                    <!-- Amount Input -->
                    <div>
                      <q-item-label class="text-subtitle2 text-weight-bold text-grey-8 q-mb-xs">Payment Amount Collected *</q-item-label>
                      <q-input
                        v-model.number="amount"
                        outlined
                        dense
                        type="number"
                        :prefix="defaultCurrency.Symbol"
                        step="0.01"
                        :rules="[
                          val => !!val || 'Amount is required',
                          val => val > 0 || 'Amount must be greater than zero',
                          val => val <= remainingToPay + 0.01 || `Amount exceeds outstanding balance of ${formatMoney(remainingToPay)}`
                        ]"
                        class="premium-input text-h6 text-weight-bold q-mb-sm"
                      />

                      <!-- Mobile-First "Tap Tap" Shortcuts Bar -->
                      <div class="row q-col-gutter-xs q-mb-sm">
                        <div class="col-4">
                          <q-btn outline color="primary" dense size="sm" :label="`+ ${defaultCurrency.Symbol}100`" @click="adjustAmount(100)" class="full-width text-weight-bold" style="border-radius: 8px;" />
                        </div>
                        <div class="col-4">
                          <q-btn outline color="primary" dense size="sm" :label="`+ ${defaultCurrency.Symbol}500`" @click="adjustAmount(500)" class="full-width text-weight-bold" style="border-radius: 8px;" />
                        </div>
                        <div class="col-4">
                          <q-btn outline color="primary" dense size="sm" :label="`+ ${defaultCurrency.Symbol}1000`" @click="adjustAmount(1000)" class="full-width text-weight-bold" style="border-radius: 8px;" />
                        </div>
                        <div class="col-4">
                          <q-btn outline color="primary" dense size="sm" label="50%" @click="applyPercentage(0.5)" class="full-width text-weight-bold" style="border-radius: 8px;" />
                        </div>
                        <div class="col-4">
                          <q-btn unelevated color="positive" dense size="sm" label="Full" @click="applyFullBalance" class="full-width text-weight-bold" style="border-radius: 8px;" />
                        </div>
                        <div class="col-4">
                          <q-btn outline color="grey-7" dense size="sm" label="Clear" @click="clearAmount" class="full-width text-weight-bold" style="border-radius: 8px;" />
                        </div>
                      </div>
                    </div>

                    <!-- Payment Mode (Mobile-First Tap Cards instead of Dropdowns) -->
                    <div class="q-mt-md">
                      <q-item-label class="text-subtitle2 text-weight-bold text-grey-8 q-mb-xs">Payment Mode *</q-item-label>
                      <div class="row q-col-gutter-xs">
                        <div v-for="opt in modeOptions" :key="opt" class="col-4">
                          <q-card
                            flat
                            bordered
                            class="q-pa-xs text-center clickable transition-all shadow-none mode-card"
                            :style="mode === opt ? 'border-color: var(--q-primary, #0284c7); background-color: #f0f9ff; border-width: 1.5px;' : 'border-color: #e2e8f0;'"
                            style="border-radius: 8px;"
                            @click="mode = opt"
                          >
                            <q-icon :name="getModeIcon(opt)" :color="mode === opt ? 'primary' : 'grey-7'" size="20px" class="q-my-xs block mx-auto" />
                            <q-item-label class="text-caption text-weight-bold text-overline" :class="mode === opt ? 'text-primary' : 'text-grey-7'" style="font-size: 0.65rem; line-height: 1;">
                              {{ opt }}
                            </q-item-label>
                          </q-card>
                        </div>
                      </div>
                    </div>

                    <!-- Transaction Reference -->
                    <div>
                      <q-item-label class="text-subtitle2 text-weight-bold text-grey-8 q-mb-xs">Transaction Reference / Notes (Optional)</q-item-label>
                      <q-input
                        v-model="reference"
                        outlined
                        dense
                        placeholder="e.g. Bank ref#, Cheque#, transaction notes"
                        class="premium-input"
                        type="textarea"
                        rows="3"
                      />
                    </div>
                  </div>

                  <!-- Actions -->
                  <q-separator class="q-my-xl" />
                  <div class="row q-col-gutter-sm justify-end">
                    <div class="col-6 col-sm-auto">
                      <q-btn
                        flat
                        label="Cancel"
                        color="primary"
                        @click="cancel"
                        class="full-width premium-btn-secondary"
                        :disabled="saving"
                      />
                    </div>
                    <div class="col-6 col-sm-auto">
                      <q-btn
                        unelevated
                        color="primary"
                        icon="check_circle"
                        label="Submit Payment"
                        :loading="saving"
                        @click="submitPayment"
                        class="full-width premium-btn text-weight-bold"
                      />
                    </div>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>
      </transition>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletPayments } from '../../../composables/operations/outlets/useOutletPayments.js'
import { progressMeta } from '../../../composables/operations/outlets/outletOperationsMeta.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import { useCurrency } from '../../../composables/useCurrency.js'
import { getInvoiceTotal, getInvoiceRemaining } from '../../../composables/operations/outlets/outletConsumptionPricing.js'

defineOptions({ name: 'OutletPaymentsAddPage' })

const route = useRoute()
const flow = useOutletPayments()
const { _C, defaultCurrency } = useCurrency()

const {
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
  selectedInvoice,
  totalAmount,
  totalPaidSoFar,
  remainingToPay,
  currentStep,
  reload,
  handleQueryParameters,
  submitPayment,
  cancel,
  text
} = flow

// Search filter for Outlets
const searchFilter = ref('')
const filteredOutletOptions = ref([])

function filterOutlets(val, update) {
  searchFilter.value = val
  update(() => {
    const needle = val.toLowerCase()
    filteredOutletOptions.value = outletOptions.value.filter(
      opt => opt.label.toLowerCase().includes(needle)
    )
  })
}

// Override computed outlet options to support filtering
const outletOptionsList = computed(() => {
  if (!searchFilter.value) return outletOptions.value
  return filteredOutletOptions.value
})

// Currency Formatter Helper
function formatMoney(val) {
  return _C(val, true)
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

// Get invoice remaining balance using financial helper
const getInvoiceBalance = (inv) => getInvoiceRemaining(inv, payments.items.value)

// Interactive Selection State Modifiers
function selectGlobalInvoice(invoiceCode, outletCode) {
  selectedOutletCode.value = outletCode
  selectedInvoiceCode.value = invoiceCode
}

function selectInvoice(code) {
  selectedInvoiceCode.value = code
}

function resetInvoice() {
  selectedInvoiceCode.value = ''
}

function resetOutlet() {
  selectedOutletCode.value = ''
  selectedInvoiceCode.value = ''
}

function applyFullBalance() {
  amount.value = Number(remainingToPay.value.toFixed(2))
}

function adjustAmount(val) {
  const nextVal = Number((Number(amount.value || 0) + val).toFixed(2))
  amount.value = Math.min(nextVal, Number(remainingToPay.value.toFixed(2)))
}

function applyPercentage(pct) {
  amount.value = Number((remainingToPay.value * pct).toFixed(2))
}

function clearAmount() {
  amount.value = 0
}

// Get Icon based on Mode choice
function getModeIcon(payMode) {
  switch (payMode) {
    case 'Cash': return 'payments'
    case 'Cheque': return 'history_edu'
    case 'Bank Transfer': return 'account_balance'
    case 'Card': return 'credit_card'
    default: return 'help_outline'
  }
}

// progressMeta and formatting helpers resolved locally

// Outlet display name (Human-readable, name only)
function outletName(code) {
  const o = outlets.items.value.find(row => row.Code === code)
  return o ? o.Name : text(code)
}

// Invoice display name (Human-readable with Date & Code)
function invoiceLabel(code) {
  if (!code) return '-'
  const inv = invoices.items.value.find(row => row.Code === code)
  if (!inv) return text(code)
  const dateStr = formatDisplayDate(inv.Date)
  return `${inv.Code} (${dateStr})`
}

onMounted(async () => {
  await reload()
  handleQueryParameters(route.query)
})
</script>
