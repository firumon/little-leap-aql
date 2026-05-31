<template>
  <q-page padding class="aql-page-container">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Outlet Payments Ledger"
          subtitle="Track, view, and record pending consumption invoice collections"
          :stats="[]"
          class="brand-header-card"
        />
      </div>
      <div class="q-ml-sm self-center">
        <ReloadButton />
      </div>
    </div>

    <!-- Search Input -->
    <div class="q-mb-md">
      <q-input
        v-model="searchTerm"
        dense
        outlined
        clearable
        placeholder="Search by outlet or invoice code..."
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <!-- Non-blocking load indicator -->
    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />

    <!-- Global Loading Spinner (Blocking only if first-time load) -->
    <q-card v-if="shouldBlockUi" flat class="flex flex-center q-pa-xl spinner-container">
      <q-spinner-dots color="primary" size="4em" />
      <q-item-label class="text-subtitle2 text-grey-7 q-mt-md">Loading payment ledger data...</q-item-label>
    </q-card>

    <template v-else>
      <!-- Section 1: Pending Invoices (TOP) -->
      <q-card flat bordered class="aql-premium-card shadow-1 q-mb-lg">
        <q-card-section class="q-pa-lg">
          <q-item class="q-px-none q-mb-md">
            <q-item-section avatar>
              <q-avatar color="orange-1" text-color="orange-9" icon="pending_actions" size="40px" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-h6 text-weight-bold text-primary row items-center no-wrap">
                Pending Invoices
                <q-badge color="orange" text-color="white" class="q-ml-sm text-weight-bold" style="padding: 4px 8px; border-radius: 12px;">
                  {{ filteredUnpaidInvoices.length }} Open
                </q-badge>
              </q-item-label>
              <q-item-label caption class="text-grey-7">Select a pending invoice to record a payment collection</q-item-label>
            </q-item-section>
          </q-item>
          <q-separator class="q-mb-md" />

          <!-- Pending Invoices List -->
          <q-list v-if="filteredUnpaidInvoices.length > 0" class="q-gutter-y-sm">
            <q-item
              v-for="inv in filteredUnpaidInvoices"
              :key="inv.Code"
              clickable
              v-ripple
              @click="navigateToAddWithInvoice(inv.Code, inv.OutletCode)"
              class="interactive-list-card q-pa-md shadow-sm"
            >
              <q-item-section avatar class="self-center">
                <q-avatar color="orange-1" text-color="orange-9" icon="receipt_long" size="36px" class="shadow-xs" />
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-weight-bold text-subtitle2 text-grey-9">
                  {{ inv.outletName }}
                </q-item-label>
                <q-item-label caption class="text-grey-6" style="font-size: 0.75rem;">
                  {{ inv.Code }} • {{ formatDisplayDate(inv.Date) }}
                </q-item-label>
              </q-item-section>

              <q-item-section side class="self-center text-right">
                <q-item-label caption class="text-weight-medium text-grey-6">Outstanding</q-item-label>
                <q-item-label class="text-subtitle2 text-weight-bold text-negative">
                  {{ formatMoney(inv.balance) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Empty State for Pending Invoices -->
          <q-item v-else class="empty-state-container q-py-xl text-center">
            <q-item-section>
              <q-icon name="check_circle" size="64px" color="positive" class="q-mb-md block mx-auto" />
              <q-item-label class="text-h6 text-weight-bold text-grey-8">All Settled!</q-item-label>
              <q-item-label class="text-body2 text-grey-6">There are currently no unpaid consumption invoices.</q-item-label>
            </q-item-section>
          </q-item>
        </q-card-section>
      </q-card>

      <!-- Section 2: Recent Payments (Last 7 Days) -->
      <q-card flat bordered class="aql-premium-card shadow-1">
        <q-card-section class="q-pa-lg">
          <q-item class="q-px-none q-mb-md">
            <q-item-section avatar>
              <q-avatar color="teal-1" text-color="teal-9" icon="history" size="40px" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-h6 text-weight-bold text-primary row items-center no-wrap">
                Recent Collections
                <q-badge color="primary" text-color="white" class="q-ml-sm text-weight-bold" style="padding: 4px 8px; border-radius: 12px;">
                  7 Days
                </q-badge>
              </q-item-label>
              <q-item-label caption class="text-grey-7">Active payment collections submitted during the last week</q-item-label>
            </q-item-section>
          </q-item>
          <q-separator class="q-mb-md" />

          <!-- Recent Payments List -->
          <q-list v-if="filteredRecentPayments.length > 0" class="q-gutter-y-sm">
            <q-item
              v-for="p in filteredRecentPayments"
              :key="p.Code"
              clickable
              v-ripple
              @click="navigateToView(p.Code)"
              class="interactive-list-card q-pa-md shadow-sm"
            >
              <q-item-section avatar class="self-center">
                <q-avatar color="teal-1" text-color="teal-9" icon="payments" size="36px" class="shadow-xs" />
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-weight-bold text-subtitle2 text-grey-9">
                  {{ p.outletName }}
                </q-item-label>
                <q-item-label caption class="text-grey-6" style="font-size: 0.75rem;">
                  Ref: {{ p.Code }} • By {{ p.Username }} • {{ p.Mode }}
                </q-item-label>
              </q-item-section>

              <q-item-section side class="self-center text-right">
                <q-item-label caption class="text-weight-medium text-grey-6">{{ formatDisplayDate(p.Date) }}</q-item-label>
                <q-item-label class="text-subtitle2 text-weight-bold text-positive">
                  {{ formatMoney(p.Amount) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Empty State for Recent Payments -->
          <q-item v-else class="empty-state-container q-py-xl text-center">
            <q-item-section>
              <q-icon name="history" size="64px" color="grey-4" class="q-mb-md block q-mx-auto" />
              <q-item-label class="text-subtitle1 text-weight-bold text-grey-6">No Recent Payments</q-item-label>
              <q-item-label class="text-body2 text-grey-5">No payments have been recorded in the last 7 days.</q-item-label>
            </q-item-section>
          </q-item>
        </q-card-section>
      </q-card>
    </template>

    <!-- Unified shadow FAB for record creations -->
    <DataAddFAB tooltip="Record Payment" />
  </q-page>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useOutletPayments } from '../../../composables/operations/outlets/useOutletPayments.js'
import { useResourceNav } from '../../../composables/resources/useResourceNav.js'
import { useCurrency } from '../../../composables/useCurrency.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import DataAddFAB from '../../../components/shared/DataAddFAB.vue'

defineOptions({ name: 'OutletPaymentsIndexPage' })

const nav = useResourceNav()
const flow = useOutletPayments()
const { _C } = useCurrency()

const {
  loading,
  allUnpaidInvoices,
  recentPayments,
  reload,
  text
} = flow

const searchTerm = ref('')

const shouldBlockUi = computed(() => {
  return loading.value && !allUnpaidInvoices.value.length && !recentPayments.value.length
})

const filteredUnpaidInvoices = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return allUnpaidInvoices.value
  return allUnpaidInvoices.value.filter(inv =>
    (inv.outletName || '').toLowerCase().includes(term) ||
    (inv.Code || '').toLowerCase().includes(term) ||
    (inv.OutletCode || '').toLowerCase().includes(term)
  )
})

const filteredRecentPayments = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return recentPayments.value
  return recentPayments.value.filter(p =>
    (p.outletName || '').toLowerCase().includes(term) ||
    (p.Code || '').toLowerCase().includes(term) ||
    (p.OutletCode || '').toLowerCase().includes(term) ||
    (p.Username || '').toLowerCase().includes(term) ||
    (p.Mode || '').toLowerCase().includes(term)
  )
})

onMounted(async () => {
  await reload()
})

function navigateToAddWithInvoice(invoiceCode, outletCode) {
  nav.goTo('add', { query: { outletCode, invoiceCode } })
}

function navigateToView(code) {
  nav.goTo('view', { code })
}

function formatMoney(val) {
  return _C(val, true)
}

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
</script>

