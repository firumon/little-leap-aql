<template>
  <q-page padding class="outlet-payments-page">
    <!-- Page Branded Header -->
    <OutletHeaderPanel
      title="Outlet Payments Ledger"
      subtitle="Track, view, and record pending consumption invoice collections"
      :stats="[]"
      class="q-mb-lg payment-header-card"
    />

    <!-- Global Loading Spinner -->
    <q-card v-if="loading" flat class="flex flex-center q-pa-xl spinner-container">
      <q-spinner-dots color="primary" size="4em" />
      <q-item-label class="text-subtitle2 text-grey-7 q-mt-md">Loading payment ledger data...</q-item-label>
    </q-card>

    <template v-else>
      <!-- Section 1: Pending Invoices (TOP) -->
      <q-card flat bordered class="payment-step-card shadow-1 q-mb-lg">
        <q-card-section class="q-pa-lg">
          <q-item class="q-px-none q-mb-md">
            <q-item-section avatar>
              <q-avatar color="orange-1" text-color="orange-9" icon="pending_actions" size="40px" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-h6 text-weight-bold text-primary row items-center no-wrap">
                Pending Invoices
                <q-badge color="orange" text-color="white" class="q-ml-sm text-weight-bold" style="padding: 4px 8px; border-radius: 12px;">
                  {{ allUnpaidInvoices.length }} Open
                </q-badge>
              </q-item-label>
              <q-item-label caption class="text-grey-7">Select a pending invoice to record a payment collection</q-item-label>
            </q-item-section>
          </q-item>
          <q-separator class="q-mb-md" />

          <!-- Pending Invoices List -->
          <q-list v-if="allUnpaidInvoices.length > 0" class="q-gutter-y-sm">
            <q-item
              v-for="inv in allUnpaidInvoices"
              :key="inv.Code"
              clickable
              v-ripple
              @click="navigateToAddWithInvoice(inv.Code, inv.OutletCode)"
              class="invoice-mobile-card q-pa-md shadow-sm"
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
      <q-card flat bordered class="payment-step-card shadow-1">
        <q-card-section class="q-pa-lg">
          <q-item class="q-px-none q-mb-md">
            <q-item-section avatar>
              <q-avatar color="primary-light" text-color="primary" icon="history" size="40px" />
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
          <q-list v-if="recentPayments.length > 0" class="q-gutter-y-sm">
            <q-item
              v-for="p in recentPayments"
              :key="p.Code"
              clickable
              v-ripple
              @click="navigateToView(p.Code)"
              class="invoice-mobile-card q-pa-md shadow-sm"
            >
              <q-item-section avatar class="self-center">
                <q-avatar color="primary-light" text-color="primary" icon="payments" size="36px" class="shadow-xs" />
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

      <!-- Floating Action Button for New Payment -->
      <q-page-sticky position="bottom-right" :offset="[18, 18]">
        <q-btn fab icon="add" color="primary" @click="goToAddPage">
          <q-tooltip anchor="top middle" self="bottom middle">Record Payment</q-tooltip>
        </q-btn>
      </q-page-sticky>
    </template>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useOutletPayments } from '../../../composables/operations/outlets/useOutletPayments.js'
import { useResourceNav } from '../../../composables/resources/useResourceNav.js'
import { useCurrency } from '../../../composables/useCurrency.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'

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

onMounted(async () => {
  await reload()
})

function goToAddPage() {
  nav.goTo('add')
}

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
