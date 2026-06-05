<template>
  <q-page padding class="q-pb-xl">
    <!-- Page Branded Header with Reload Button -->
    <div class="row items-center justify-between no-wrap q-mb-md">
      <div class="col">
        <OutletHeaderPanel
          title="Consumption Invoices"
          subtitle="Generate and manage consumption invoices"
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
        placeholder="Search invoices..."
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
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
        <AqlList :items="pendingInvoiceItems" item-key="Code" :layout="['label', 'caption', 'caption']"
          :highlight-color="item => getProgressMeta(item.Progress).color"
          :content="[
            item => outletName(item.OutletCode),
            item => `${item.Username} · ${formatDisplayDate(item.Date)}`,
            item => `Qty ${consumedTotal(item.Code)}`
          ]"
          :meta="[item => getProgressMeta(item.Progress).label]" :meta-layout="['chip']" :chip-color="item => getProgressMeta(item.Progress).color"
          @click="row => navigateToInvoiceAdd(row.Code)"
        />
      </div>

      <!-- Active Invoices (Pending Payment / Partially Paid) -->
      <div v-if="pendingPaymentInvoices.length || partiallyPaidInvoices.length" class="q-mb-lg">
        <div class="row items-center q-mb-sm">
          <q-icon name="credit_score" color="info" size="sm" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-medium">Active Invoices</span>
        </div>
        <AqlList :items="[...pendingPaymentInvoices, ...partiallyPaidInvoices]" item-key="Code" :layout="['label', 'caption', 'caption']"
          :highlight-color="item => getProgressMeta(item.Progress).color"
          :content="[
            item => outletName(item.OutletCode),
            item => `${item.Username} · ${formatDisplayDate(item.Date)}`,
            item => `${item.Code} · ${_C(item.Subtotal, true)}`
          ]"
          :meta="[item => getProgressMeta(item.Progress).label]" :meta-layout="['chip']" :chip-color="item => getProgressMeta(item.Progress).color"
          @click="row => navigateToInvoice(row.Code)"
        />
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
        <AqlList :items="[...paidInvoices, ...cancelledInvoices]" item-key="Code" :layout="['label', 'caption']"
          :highlight-color="item => getProgressMeta(item.Progress).color"
          :content="[
            item => `${outletName(item.OutletCode)} · ${formatDisplayDate(item.Date)}`,
            item => `${item.Code} · ${item.Username}`
          ]"
          :meta="[item => getProgressMeta(item.Progress).label]" :meta-layout="['chip']" :chip-color="item => getProgressMeta(item.Progress).color"
          @click="row => navigateToInvoice(row.Code)"
        />
      </q-expansion-item>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import { useCurrency } from '../../../composables/useCurrency.js'
import AqlList from '../../../components/shared/AqlList.vue'
import OutletHeaderPanel from '../../../components/shared/OutletHeaderPanel.vue'
import ReloadButton from '../../../components/shared/ReloadButton.vue'
import { useResourceReload } from '../../../composables/resources/useResourceReload.js'

defineOptions({ name: 'OutletConsumptionInvoicesIndexPage' })
const flow = useOutletConsumption()
const { _C } = useCurrency()
const { hasUninitiatedDependencies } = useResourceReload()
const { loading, searchTerm, pendingInvoiceItems, pendingPaymentInvoices, partiallyPaidInvoices, paidInvoices, cancelledInvoices, reload, navigateToInvoice, navigateToInvoiceAdd, outletName, formatDisplayDate, consumedTotal, getProgressMeta } = flow
const shouldBlockUi = computed(() => loading.value && hasUninitiatedDependencies.value)
onMounted(() => reload())
</script>
