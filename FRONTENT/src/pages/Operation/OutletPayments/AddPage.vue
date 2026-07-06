<template>
  <q-page padding class="aql-page-container">
    <!-- Page Branded Header -->
    <HeaderPanel
       title="Record Outlet Payment"
       subtitle="Receive and log outstanding outlet consumption payments"
       class="q-mb-lg"
     />

    <!-- Global Loading Spinner -->
    <q-card v-if="loading" flat class="flex flex-center q-pa-xl spinner-container">
      <q-spinner-dots color="primary" size="4em" />
      <q-item-label class="text-subtitle2 text-grey-7 q-mt-md">Loading payment ledger data...</q-item-label>
    </q-card>

    <template v-else>
      <!-- STEP 1: Select Outlet -->
      <transition name="fade-slide" mode="out-in">
        <q-card v-if="currentStep === 1" flat bordered class="aql-premium-card shadow-1 animate-fade-slide">
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
              <div class="scroll" style="max-height: 220px;">
                <AqlList :items="allUnpaidInvoices"
                  :caption="inv => formatDisplayDate(inv.Date)"
                  :meta="[inv => formatMoney(inv.balance)]"
                  :meta-layout="['label']"
                  item-key="Code" icon="receipt_long" icon-color="orange-9" label="outletName"
                  meta-color="negative" clickable
                  @click="inv => selectGlobalInvoice(inv.Code, inv.OutletCode)"
                />
              </div>
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
        <q-card v-if="currentStep === 2" flat bordered class="aql-premium-card shadow-1 animate-fade-slide">
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
                <q-item-label caption class="text-grey-7">Select one or more unpaid invoices to apply payment</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator class="q-mb-md" />

            <div v-if="unpaidInvoices.length > 0" class="row justify-between items-center q-mb-sm">
              <q-item-label caption class="text-grey-6 text-weight-medium">Check invoices to pay</q-item-label>
              <q-btn
                flat
                dense
                size="sm"
                color="primary"
                :label="isAllSelected ? 'Deselect All' : 'Select All'"
                @click="toggleSelectAll"
                class="text-weight-bold"
              />
            </div>

            <AqlList :items="unpaidInvoices" item-key="Code" :clickable="false">
              <template #item="{ item: inv }">
                <q-item-section side>
                  <q-checkbox
                    :model-value="selectedInvoiceCodes.includes(inv.Code)"
                    @update:model-value="toggleInvoiceSelection(inv.Code)"
                  />
                </q-item-section>
                <q-item-section class="cursor-pointer" @click="toggleInvoiceSelection(inv.Code)">
                  <q-item-label class="text-weight-bold text-subtitle2 text-grey-9">
                    {{ invoiceLabel(inv.Code) }}
                  </q-item-label>
                  <q-item-label caption class="text-grey-6">
                    {{ inv.PriceListCode ? `Price List: ${inv.PriceListCode}` : 'No Price List' }}
                  </q-item-label>
                  <q-item-label caption class="q-mt-xs">
                    <q-chip
                      dense
                      :color="progressMeta(inv.Progress).color"
                      text-color="white"
                      class="text-weight-bold"
                      style="font-size: 0.65rem; margin: 0; padding: 2px 6px;"
                    >
                      {{ progressMeta(inv.Progress).label }}
                    </q-chip>
                  </q-item-label>
                </q-item-section>
                <q-item-section side class="cursor-pointer text-right" @click="toggleInvoiceSelection(inv.Code)">
                  <q-item-label caption class="text-grey-6">
                    Total: {{ formatMoney(getInvoiceTotal(inv)) }}
                  </q-item-label>
                  <q-item-label class="text-subtitle2 text-weight-bold text-negative">
                    Bal: {{ formatMoney(getInvoiceBalance(inv)) }}
                  </q-item-label>
                </q-item-section>
              </template>
              <template #empty>
                <q-item class="empty-state-container q-py-xl text-center">
                  <q-item-section>
                    <q-icon name="check_circle" size="64px" color="positive" class="q-mb-md block mx-auto" />
                    <q-item-label class="text-h6 text-weight-bold text-grey-8">All Settled!</q-item-label>
                    <q-item-label class="text-body2 text-grey-6 q-mb-md">No unpaid or partially paid invoices found for this outlet.</q-item-label>
                    <div class="row justify-center q-mt-md">
                      <q-btn outline color="primary" label="Back to Outlets" icon="arrow_back" @click="resetOutlet" />
                    </div>
                  </q-item-section>
                </q-item>
              </template>
            </AqlList>

            <!-- Step 2 Navigation Action -->
            <div v-if="selectedInvoiceCodes.length > 0" class="row justify-end q-mt-lg">
              <q-btn
                unelevated
                color="primary"
                label="Next: Enter Payment"
                icon-right="arrow_forward"
                @click="currentStep = 3"
                class="premium-btn text-weight-bold"
              />
            </div>
          </q-card-section>
        </q-card>
      </transition>

      <!-- STEP 3: Payment Entry -->
      <transition name="fade-slide" mode="out-in">
        <div v-if="currentStep === 3" class="animate-fade-slide">
          <div class="row q-col-gutter-lg">
            <!-- Left Column: Summary Card -->
            <div class="col-12 col-md-5">
              <q-card flat bordered class="aql-premium-card shadow-1 q-mb-md">
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

                    <!-- Selected Invoices Row -->
                    <q-item>
                      <q-item-section avatar>
                        <q-avatar color="white" text-color="grey-8" icon="receipt_long" size="32px" class="q-mr-sm shadow-xs" style="flex-shrink: 0;" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label caption>Selected Invoices ({{ selectedInvoiceCodes.length }})</q-item-label>
                        <div class="row q-gutter-xs q-mt-xs">
                          <q-badge
                            v-for="code in selectedInvoiceCodes"
                            :key="code"
                            color="grey-3"
                            text-color="grey-9"
                            class="text-weight-bold"
                            style="border: 1px solid #cbd5e1; font-size: 0.7rem; border-radius: 6px;"
                          >
                            {{ code }}
                          </q-badge>
                        </div>
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
                          <q-tooltip>Change Invoices</q-tooltip>
                        </q-btn>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-card-section>

                <!-- Calculations Summary Box -->
                <q-card-section class="q-pa-lg">
                  <q-item-label class="text-subtitle2 text-weight-bold text-grey-7 q-mb-md uppercase tracking-wider">Invoices Balance Ledger</q-item-label>
                  <q-list class="q-gutter-y-sm">
                    <q-item dense class="q-px-none">
                      <q-item-section>
                        <q-item-label class="text-grey-7">Total Invoices Amount</q-item-label>
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
                        <q-item-label class="text-weight-bold text-negative">Total Outstanding</q-item-label>
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
              <q-card flat bordered class="aql-premium-card shadow-1">
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
                        :model-value="amount"
                        @update:model-value="onTotalAmountInput"
                        outlined
                        dense
                        type="number"
                        :prefix="defaultCurrency.Symbol"
                        step="0.01"
                        :rules="[
                          val => !!val || 'Amount is required',
                          val => val > 0 || 'Amount must be greater than zero',
                          val => val <= remainingToPay + 0.01 || `Amount exceeds outstanding balance of ${formatMoney(remainingToPay)}`,
                          val => allocationDiff === 0 || 'Total amount must match sum of allocations'
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

                    <!-- Interactive Allocation List -->
                    <div class="q-mt-lg">
                      <div class="text-subtitle2 text-weight-bold text-grey-8 q-mb-sm row items-center justify-between">
                        <span>Invoice Payment Allocation</span>
                        <q-btn
                          flat
                          dense
                          size="xs"
                          color="primary"
                          label="Auto-Distribute"
                          @click="autoDistribute(amount)"
                          icon="auto_awesome"
                        />
                      </div>
                      <q-card flat bordered class="bg-grey-1" style="border-radius: 8px;">
                        <q-list separator dens>
                          <q-item v-for="inv in selectedInvoices" :key="inv.Code" class="q-py-md">
                            <q-item-section>
                              <q-item-label class="text-weight-bold text-grey-9">{{ inv.Code }}</q-item-label>
                              <q-item-label caption class="text-grey-6">Date: {{ formatDisplayDate(inv.Date) }}</q-item-label>
                              <q-item-label caption class="text-negative text-weight-bold">
                                Outstanding: {{ formatMoney(getInvoiceBalance(inv)) }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side>
                              <q-input
                                :model-value="allocations[inv.Code]"
                                @update:model-value="val => onAllocationInput(inv.Code, val)"
                                outlined
                                hide-bottom-space
                                dense
                                type="number"
                                :prefix="defaultCurrency.Symbol"
                                step="0.01"
                                class="bg-white"
                                style="width: 140px;"
                                :rules="[
                                  val => val >= 0 || 'Cannot be negative',
                                  val => val <= getInvoiceBalance(inv) + 0.01 || 'Exceeds balance'
                                ]"
                              />
                            </q-item-section>
                          </q-item>
                        </q-list>
                      </q-card>

                      <!-- Warning alert for allocation differences -->
                      <div v-if="allocationDiff !== 0" class="q-mt-sm text-caption text-weight-bold text-orange-9 row items-center">
                        <q-icon name="warning" class="q-mr-xs" size="16px" />
                        Allocated ({{ formatMoney(totalAllocated) }}) does not match collected ({{ formatMoney(amount) }}).
                        <span class="q-ml-xs text-primary cursor-pointer underline text-weight-bold" @click="syncTotalToAllocations">
                          Reconcile total
                        </span>
                      </div>
                    </div>

                    <!-- Payment Mode -->
                    <div class="q-mt-md">
                      <q-item-label class="text-subtitle2 text-weight-bold text-grey-8 q-mb-xs">Payment Mode *</q-item-label>
                      <div class="row q-col-gutter-xs">
                        <div v-for="opt in modeOptions" :key="opt" class="col-4">
                          <q-card
                            flat
                            bordered
                            class="q-pa-xs text-center clickable transition-all shadow-none clickable-scale"
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
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useOutletPayments } from '../../../composables/operation/outlets/useOutletPayments.js'
import { progressMeta } from '../../../composables/operation/outlets/outletOperationsMeta.js'
import AqlList from '../../../components/shared/AqlList.vue'
import HeaderPanel from '../../../components/shared/HeaderPanel.vue'
import { useCurrency } from '../../../composables/useCurrency.js'
import { getInvoiceTotal, getInvoiceRemaining } from '../../../composables/operation/outlets/outletConsumptionPricing.js'

defineOptions({ name: 'OutletPaymentsAddPage' })

const { query } = useRouteConfig()
const flow = useOutletPayments()
const { _C, defaultCurrency } = useCurrency()

const {
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
  selectedInvoices,
  totalAmount,
  totalPaidSoFar,
  remainingToPay,
  currentStep,
  reload,
  handleQueryParameters,
  submitPayment,
  cancel,
  text,
  autoDistribute
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
function getInvoiceBalance(inv) {
  return getInvoiceRemaining(inv, payments.items.value)
}

// Selection helpers
function toggleInvoiceSelection(code) {
  const idx = selectedInvoiceCodes.value.indexOf(code)
  if (idx > -1) {
    selectedInvoiceCodes.value.splice(idx, 1)
  } else {
    selectedInvoiceCodes.value.push(code)
  }
}

const isAllSelected = computed(() => {
  return unpaidInvoices.value.length > 0 && selectedInvoiceCodes.value.length === unpaidInvoices.value.length
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedInvoiceCodes.value = []
  } else {
    selectedInvoiceCodes.value = unpaidInvoices.value.map(inv => inv.Code)
  }
}

function selectGlobalInvoice(invoiceCode, outletCode) {
  selectedOutletCode.value = outletCode
  selectedInvoiceCodes.value = [invoiceCode]
  currentStep.value = 3
}

function resetInvoice() {
  selectedInvoiceCodes.value = []
  allocations.value = {}
  currentStep.value = 2
}

function resetOutlet() {
  selectedOutletCode.value = ''
  selectedInvoiceCodes.value = []
  allocations.value = {}
  currentStep.value = 1
}

function applyFullBalance() {
  amount.value = Number(remainingToPay.value.toFixed(2))
  autoDistribute(amount.value)
}

function adjustAmount(val) {
  const nextVal = Number((Number(amount.value || 0) + val).toFixed(2))
  amount.value = Math.min(nextVal, Number(remainingToPay.value.toFixed(2)))
  autoDistribute(amount.value)
}

function applyPercentage(pct) {
  amount.value = Number((remainingToPay.value * pct).toFixed(2))
  autoDistribute(amount.value)
}

function clearAmount() {
  amount.value = 0
  autoDistribute(0)
}

// Allocation input handlers
const totalAllocated = computed(() => {
  return Object.values(allocations.value).reduce((sum, val) => sum + (Number(val) || 0), 0)
})

const allocationDiff = computed(() => {
  return Number((amount.value - totalAllocated.value).toFixed(2))
})

function syncTotalToAllocations() {
  amount.value = Number(totalAllocated.value.toFixed(2))
  autoDistribute(amount.value)
}

function onTotalAmountInput(val) {
  amount.value = Number(val) || 0
  autoDistribute(amount.value)
}

function onAllocationInput(code, val) {
  allocations.value[code] = Number(val) || 0
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
  handleQueryParameters(query.value)
})
</script>

