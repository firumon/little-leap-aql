<template>
  <q-page padding class="q-pb-xl">
    <div class="q-mb-md">
      <div class="row items-center no-wrap q-mb-xs">
        <div class="col">
          <div class="text-h6">Consumption Invoices</div>
        </div>
        <ReloadButton />
      </div>
      <div class="text-caption text-grey-7 q-mb-sm">Generate and manage consumption invoices</div>
      <q-input v-model="searchTerm" dense outlined clearable placeholder="Search invoices..." style="max-width: 480px">
        <template #prepend><q-icon name="search" /></template>
      </q-input>
    </div>

    <q-linear-progress v-if="loading && !shouldBlockUi" color="primary" indeterminate class="q-mb-sm" />

    <div v-if="shouldBlockUi" class="text-center q-pa-xl">
      <q-spinner color="primary" size="3em" />
    </div>

    <div v-else-if="!pendingInvoiceItems.length && !pendingPaymentInvoices.length && !partiallyPaidInvoices.length && !paidInvoices.length && !cancelledInvoices.length" class="text-center q-pa-xl">
      <q-icon name="receipt" size="4em" color="grey-5" class="q-mb-sm" />
      <div class="text-h6 q-mt-md">No invoices</div>
      <div class="text-caption text-grey-7">No consumption invoices or pending consumptions found.</div>
    </div>

    <template v-else>
      <!-- Pending Invoice Generation (Highest Priority) -->
      <div v-if="pendingInvoiceItems.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="receipt" color="warning" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">Pending Invoice Generation</span>
          <q-badge class="q-ml-sm" color="warning" :label="String(pendingInvoiceItems.length)" />
        </div>
        <div class="column q-gutter-sm">
          <q-card v-for="row in pendingInvoiceItems" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateToInvoiceAdd(row.Code)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                  <div class="text-caption text-grey-7">{{ row.Username }} · {{ formatDisplayDate(row.Date) }}</div>
                </div>
                <q-space />
                <OutletProgressChip :progress="row.Progress" />
              </div>
              <q-separator class="q-my-xs" />
              <div class="text-caption text-grey-7">Qty {{ consumedTotal(row.Code) }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Active Invoices (Pending Payment / Partially Paid) -->
      <div v-if="pendingPaymentInvoices.length || partiallyPaidInvoices.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="credit_score" color="info" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">Active Invoices</span>
        </div>
        <div class="column q-gutter-sm">
          <q-card v-for="row in pendingPaymentInvoices" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateToInvoice(row.Code)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                  <div class="text-caption text-grey-7">{{ row.Username }} · {{ formatDisplayDate(row.Date) }}</div>
                </div>
                <q-space />
                <OutletProgressChip :progress="row.Progress" />
              </div>
              <q-separator class="q-my-xs" />
              <div class="text-caption text-grey-7">{{ row.Code }} · {{ row.Subtotal || 0 }}</div>
            </q-card-section>
          </q-card>
          <q-card v-for="row in partiallyPaidInvoices" :key="row.Code" flat bordered class="cursor-pointer" @click="navigateToInvoice(row.Code)">
            <q-card-section class="q-pa-sm">
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-subtitle2 text-weight-medium">{{ outletName(row.OutletCode) }}</div>
                  <div class="text-caption text-grey-7">{{ row.Username }} · {{ formatDisplayDate(row.Date) }}</div>
                </div>
                <q-space />
                <OutletProgressChip :progress="row.Progress" />
              </div>
              <q-separator class="q-my-xs" />
              <div class="text-caption text-grey-7">{{ row.Code }} · {{ row.Subtotal || 0 }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- History (Paid / Cancelled) -->
      <q-expansion-item
        v-if="paidInvoices.length || cancelledInvoices.length"
        icon="history"
        label="History"
        :caption="`${paidInvoices.length + cancelledInvoices.length} records`"
        header-class="bg-grey-2 text-weight-bold"
        class="shadow-1 rounded-borders overflow-hidden q-mb-lg"
      >
        <q-list separator>
          <q-item v-for="row in [...paidInvoices, ...cancelledInvoices]" :key="row.Code" clickable @click="navigateToInvoice(row.Code)">
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ outletName(row.OutletCode) }} · {{ formatDisplayDate(row.Date) }}</q-item-label>
              <q-item-label caption>{{ row.Code }} · {{ row.Username }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <OutletProgressChip :progress="row.Progress" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'OutletConsumptionInvoicesIndexPage' })
const flow = useOutletConsumption()
const { hasUninitiatedDependencies } = useResourceReload()
const { loading, searchTerm, pendingInvoiceItems, pendingPaymentInvoices, partiallyPaidInvoices, paidInvoices, cancelledInvoices, reload, navigateToInvoice, navigateToInvoiceAdd, outletName, formatDisplayDate, consumedTotal } = flow
const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)
onMounted(() => reload())
</script>
