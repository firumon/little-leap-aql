<template>
  <q-page padding>
    <div class="row items-center q-mb-md"><q-btn icon="arrow_back" flat round @click="goToList" class="q-mr-sm" /><div class="text-h6">Goods Receipt {{ record?.Code }}</div><q-space /><q-chip :color="record?.Status === 'Active' ? 'positive' : 'grey'" text-color="white">{{ record?.Status }}</q-chip></div>
    <div v-if="loading && !record" class="flex flex-center q-pa-xl"><q-spinner color="primary" size="3em" /></div>
    <div v-else-if="!record" class="text-center q-pa-xl text-grey">Goods Receipt not found.</div>
    <template v-else>
      <q-card class="q-mb-md"><q-card-section><div class="row q-col-gutter-sm"><div class="col-6 col-md-3"><div class="text-caption text-grey">Date</div><div>{{ formatDate(record.Date) }}</div></div><div class="col-6 col-md-3"><div class="text-caption text-grey">Purchase Order</div><div>{{ record.PurchaseOrderCode }}</div></div><div class="col-6 col-md-3"><div class="text-caption text-grey">PO Receiving</div><q-btn dense flat color="primary" :label="record.POReceivingCode" @click="goToReceiving" /></div><div class="col-6 col-md-3"><div class="text-caption text-grey">Accepted Qty</div><div class="text-weight-bold">{{ totalQty }}</div></div></div></q-card-section></q-card>
      <q-card class="q-mb-md"><q-card-section><div class="text-subtitle1 q-mb-sm">Accepted Items</div><GoodsReceiptItemsTable :items="items" /></q-card-section></q-card>
      <q-card><q-card-section><div class="text-subtitle1 q-mb-sm">Invalidation</div><q-banner v-if="isCompletedProcurement" class="bg-orange-1 text-orange-10 q-mb-sm">Completed procurement blocks invalidation.</q-banner><q-btn label="Invalidate GRN" color="negative" outline :disable="!canInvalidate" :loading="acting" @click="invalidateGoodsReceipt" /></q-card-section></q-card>
    </template>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { useGoodsReceiptView } from '../../../composables/operations/goodsReceipts/useGoodsReceiptView.js'
import GoodsReceiptItemsTable from '../../../components/Operations/GoodsReceipts/GoodsReceiptItemsTable.vue'

defineOptions({ name: 'GoodsReceiptsViewPage' })
const flow = useGoodsReceiptView()
const { loading, acting, record, items, isCompletedProcurement, totalQty, canInvalidate, loadData, invalidateGoodsReceipt, goToList, goToReceiving, formatDate } = flow
onMounted(() => loadData())
</script>
