<template>
  <q-page padding>
    <OutletHeaderPanel :title="invoice?.Code || 'Consumption Invoice'" :subtitle="invoice ? `${outletName(invoice.OutletCode)} · ${formatDisplayDate(invoice.Date)}` : ''" class="q-mb-md">
      <template #side><OutletProgressChip :progress="invoice?.Progress" /></template>
    </OutletHeaderPanel>

    <div v-if="loading && !invoice" class="flex flex-center q-pa-xl"><q-spinner color="primary" size="3em" /></div>
    <q-banner v-else-if="!invoice" rounded class="bg-grey-2 text-grey-8">Invoice not found.</q-banner>

    <div v-else class="column q-gutter-md">
      <q-card flat bordered>
        <q-card-section>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-4"><div class="text-caption text-grey-6">Outlet</div><div class="text-subtitle2">{{ outletName(invoice.OutletCode) }}</div></div>
            <div class="col-12 col-md-4"><div class="text-caption text-grey-6">Date</div><div class="text-subtitle2">{{ formatDisplayDate(invoice.Date) }}</div></div>
            <div class="col-12 col-md-4"><div class="text-caption text-grey-6">Username</div><div class="text-subtitle2">{{ invoice.Username }}</div></div>
            <div class="col-12 col-md-4"><div class="text-caption text-grey-6">Consumption</div><q-btn flat dense color="primary" :label="invoice.OutletConsumptionCode" @click="navigateToConsumption(invoice.OutletConsumptionCode)" /></div>
            <div class="col-12 col-md-4"><div class="text-caption text-grey-6">Price List</div><div class="text-subtitle2">{{ invoice.PriceListCode || 'Not priced' }}</div></div>
            <div class="col-12 col-md-4"><div class="text-caption text-grey-6">Progress</div><div class="text-subtitle2">{{ invoice.Progress }}</div></div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered>
        <q-card-section><div class="text-subtitle1 text-weight-medium">Amounts</div></q-card-section>
        <q-list dense separator>
          <q-item><q-item-section><q-item-label>Subtotal</q-item-label></q-item-section><q-item-section side>{{ invoice.Subtotal || 0 }}</q-item-section></q-item>
          <q-item><q-item-section><q-item-label>Discount</q-item-label></q-item-section><q-item-section side>{{ invoice.Discount || 0 }}</q-item-section></q-item>
          <q-item><q-item-section><q-item-label>Tax</q-item-label></q-item-section><q-item-section side>{{ invoice.Tax || 0 }}</q-item-section></q-item>
        </q-list>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'

defineOptions({ name: 'OutletConsumptionInvoicesViewPage' })
const route = useRoute()
const flow = useOutletConsumption()
const { loading, reload, getInvoice, outletName, formatDisplayDate, navigateToConsumption } = flow
const invoice = computed(() => getInvoice(route.params.code))
onMounted(() => reload())
</script>
