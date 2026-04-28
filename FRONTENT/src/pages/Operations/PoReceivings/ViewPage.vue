<template>
  <q-page padding>
    <div class="row items-center q-mb-md"><q-btn icon="arrow_back" flat round @click="goToList" class="q-mr-sm" /><div class="text-h6">PO Receiving {{ record?.Code }}</div><q-space /><q-chip :color="progress.color" text-color="white" :icon="progress.icon">{{ progress.label }}</q-chip></div>
    <div v-if="loading && !record" class="flex flex-center q-pa-xl"><q-spinner color="primary" size="3em" /></div>
    <div v-else-if="!record" class="text-center q-pa-xl text-grey">Receiving record not found.</div>
    <template v-else>
      <q-card class="q-mb-md"><q-card-section>
        <div class="row q-col-gutter-sm">
          <div class="col-6 col-md-3"><div class="text-caption text-grey">PO</div><div>{{ record.PurchaseOrderCode }}</div></div>
          <div class="col-6 col-md-3"><div class="text-caption text-grey">Inspection Date</div><div>{{ formatDate(record.InspectionDate) }}</div></div>
          <div class="col-6 col-md-3"><div class="text-caption text-grey">Inspected By</div><div>{{ record.InspectedUserName }}</div></div>
          <div class="col-6 col-md-3"><div class="text-caption text-grey">GRN</div><q-btn v-if="linkedGrn" dense flat color="primary" :label="linkedGrn.Code" @click="goToGrn" /><span v-else>-</span></div>
        </div>
      </q-card-section></q-card>
      <POReceivingSummaryCards :summary="summary" class="q-mb-md" />
      <q-card class="q-mb-md"><q-card-section><POReceivingItemGrid :items="items" /></q-card-section></q-card>
      <q-card class="q-mb-md"><q-card-section><div class="text-subtitle1 q-mb-sm">Report Placeholders</div><POReceivingReportLinks :reports="reportPlaceholders" /></q-card-section></q-card>
      <q-card><q-card-section><div class="text-subtitle1 q-mb-sm">Actions</div><div class="row q-gutter-sm"><q-btn v-if="canConfirm" label="Confirm" color="positive" :loading="acting" @click="confirmReceiving" /><q-btn v-if="canGenerateGRN" label="Generate GRN" color="primary" :loading="acting" @click="generateGRN" /><q-input v-model="cancelComment" dense outlined label="Cancellation Comment" /><q-btn v-if="['DRAFT','CONFIRMED','GRN_GENERATED'].includes(record.Progress)" label="Cancel Receiving" color="negative" outline :disable="isCompletedProcurement" :loading="acting" @click="cancelReceiving" /></div></q-card-section></q-card>
    </template>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { usePOReceivingView } from '../../../composables/operations/poReceivings/usePOReceivingView.js'
import POReceivingSummaryCards from '../../../components/Operations/PoReceivings/POReceivingSummaryCards.vue'
import POReceivingItemGrid from '../../../components/Operations/PoReceivings/POReceivingItemGrid.vue'
import POReceivingReportLinks from '../../../components/Operations/PoReceivings/POReceivingReportLinks.vue'

defineOptions({ name: 'PoReceivingsViewPage' })
const flow = usePOReceivingView()
const { loading, acting, record, items, summary, progress, linkedGrn, isCompletedProcurement, canConfirm, canGenerateGRN, cancelComment, reportPlaceholders, loadData, confirmReceiving, generateGRN, cancelReceiving, goToList, goToGrn, formatDate } = flow
onMounted(() => loadData())
</script>
