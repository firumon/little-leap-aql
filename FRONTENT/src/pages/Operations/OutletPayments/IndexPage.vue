<template>
  <q-page padding class="aql-page-container">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Outlet Payments Ledger"
          subtitle="Track, view, and record pending consumption invoice collections"
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
          <AqlList
            :items="filteredUnpaidInvoices"
            item-key="Code"
            icon="receipt_long"
            icon-color="orange-9"
            label="outletName"
            :caption="(inv) => `${inv.Code} • ${formatDisplayDate(inv.Date)}`"
            :meta="[() => 'Outstanding', (inv) => formatMoney(inv.balance)]"
            :meta-layout="['caption','label']"
            meta-color="negative"
            clickable
            @click="(inv) => navigateToAddWithInvoice(inv.Code, inv.OutletCode)"
          >
            <!-- Custom Empty State slot -->
            <template #empty>
              <q-item class="empty-state-container q-py-xl text-center">
                <q-item-section>
                  <q-icon name="check_circle" size="64px" color="positive" class="q-mb-md block mx-auto" />
                  <q-item-label class="text-h6 text-weight-bold text-grey-8">All Settled!</q-item-label>
                  <q-item-label class="text-body2 text-grey-6">There are currently no unpaid consumption invoices.</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </AqlList>

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
          <AqlList
            :items="filteredRecentPayments"
            item-key="Code"
            icon="payments"
            icon-color="teal-9"
            label="outletName"
            :caption="(p) => `Ref: ${p.Code} • By ${p.Username} • ${p.Mode}`"
            :meta="[(p) => formatDisplayDate(p.Date), (p) => formatMoney(p.Amount)]"
            :meta-layout="['caption','label']"
            meta-color="positive"
            clickable
            @click="(p) => navigateToView(p.Code)"
          >
            <!-- Custom Empty State slot -->
            <template #empty>
              <q-item class="empty-state-container q-py-xl text-center">
                <q-item-section>
                  <q-icon name="history" size="64px" color="grey-4" class="q-mb-md block q-mx-auto" />
                  <q-item-label class="text-subtitle1 text-weight-bold text-grey-6">No Recent Payments</q-item-label>
                  <q-item-label class="text-body2 text-grey-5">No payments have been recorded in the last 7 days.</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </AqlList>
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
import AqlList from "components/shared/AqlList.vue";

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

