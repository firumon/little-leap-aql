<template>
  <q-page padding>
    <OutletHeaderPanel :title="record ? outletName(record.OutletCode) : 'Outlet Consumption'" :subtitle="record ? `${record.Code} · ${formatDisplayDate(record.Date)}` : ''" class="q-mb-md">
      <template #side><OutletProgressChip :progress="record?.Progress" /></template>
    </OutletHeaderPanel>

    <div v-if="loading && !record" class="flex flex-center q-pa-xl"><q-spinner color="primary" size="3em" /></div>
    <q-banner v-else-if="!record" rounded class="bg-grey-2 text-grey-8">Consumption not found.</q-banner>

    <OutletConsumptionPendingInvoiceView
      v-else-if="record.Progress === 'PENDING_INVOICE_GENERATION'"
      :record="record"
      :items="consumptionItemRows(record.Code)"
      :acting="acting"
      :outlet-name="outletName"
      :visit-label="visitLabel"
      :format-date="formatDisplayDate"
      @generate-invoice="generateInvoiceForConsumption(record)"
    />
    <OutletConsumptionInvoiceGeneratedView
      v-else-if="record.Progress === 'INVOICE_GENERATED'"
      :record="record"
      :invoice="childInvoice(record.Code)"
      :items="consumptionItemRows(record.Code)"
      :outlet-name="outletName"
      :visit-label="visitLabel"
      :format-date="formatDisplayDate"
      @open-invoice="navigateToInvoice"
    />
    <OutletConsumptionReadonlyView
      v-else
      :record="record"
      :items="consumptionItemRows(record.Code)"
      :outlet-name="outletName"
      :visit-label="visitLabel"
      :format-date="formatDisplayDate"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useOutletConsumption } from '../../../composables/operations/outlets/useOutletConsumption.js'
import OutletHeaderPanel from '../../../components/Operations/Outlets/OutletHeaderPanel.vue'
import OutletProgressChip from '../../../components/Operations/Outlets/OutletProgressChip.vue'
import OutletConsumptionPendingInvoiceView from '../../../components/Operations/Outlets/OutletConsumptionPendingInvoiceView.vue'
import OutletConsumptionInvoiceGeneratedView from '../../../components/Operations/Outlets/OutletConsumptionInvoiceGeneratedView.vue'
import OutletConsumptionReadonlyView from '../../../components/Operations/Outlets/OutletConsumptionReadonlyView.vue'

defineOptions({ name: 'OutletConsumptionViewPage' })
const route = useRoute()
const flow = useOutletConsumption()
const { loading, acting, reload, getConsumption, childInvoice, consumptionItemRows, generateInvoiceForConsumption, navigateToInvoice, outletName, visitLabel, formatDisplayDate } = flow
const record = computed(() => getConsumption(route.params.code))
onMounted(() => reload())
</script>
