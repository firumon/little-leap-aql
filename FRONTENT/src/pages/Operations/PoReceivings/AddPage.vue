<template>
  <q-page padding>
    <div class="row items-center q-mb-md"><q-btn icon="arrow_back" flat round @click="cancel" class="q-mr-sm" /><div class="text-h6">PO Receiving Draft</div></div>
    <q-card class="q-mb-md"><q-card-section>
      <div class="text-subtitle1 q-mb-sm">Select Purchase Order</div>
      <q-select v-model="selectedPurchaseOrderCode" :options="purchaseOrderOptions" label="Purchase Order" outlined dense emit-value map-options clearable @update:model-value="selectPurchaseOrder" />
    </q-card-section></q-card>
    <template v-if="selectedPurchaseOrderCode">
      <q-card class="q-mb-md"><q-card-section>
        <div class="row q-col-gutter-sm">
          <div class="col-12 col-md-4"><q-input v-model="form.InspectionDate" type="date" label="Inspection Date" outlined dense :readonly="!isDraft" /></div>
          <div class="col-12 col-md-4"><q-input v-model="form.InspectedUserName" label="Inspected By" outlined dense :readonly="!isDraft" /></div>
          <div class="col-12 col-md-4"><q-input v-model="form.Remarks" label="Remarks" outlined dense :readonly="!isDraft" /></div>
        </div>
      </q-card-section></q-card>
      <POReceivingSummaryCards :summary="summary" class="q-mb-md" />
      <q-card class="q-mb-md"><q-card-section>
        <POReceivingBulkToolbar v-if="isDraft" class="q-mb-sm" @receive-all="setAllReceivedToExpected" @clear="clearQuantities" />
        <POReceivingItemGrid :items="items" :editable="isDraft" @update:item="updateItem" />
      </q-card-section></q-card>
      <div class="row justify-end q-gutter-sm">
        <q-btn label="Cancel" flat color="grey-7" @click="cancel" />
        <q-btn v-if="currentReceiving && !isDraft" label="Start Replacement" outline color="warning" :disable="isCompletedProcurement" @click="startReplacement" />
        <q-btn v-if="canSaveDraft" label="Save Draft" color="primary" :loading="saving" @click="saveDraft" />
        <q-btn v-if="canConfirm" label="Confirm" color="positive" :loading="saving" @click="confirmReceiving" />
        <q-btn v-if="canGenerateGRN" label="Generate GRN" color="primary" :loading="saving" @click="generateGRN" />
      </div>
    </template>
  </q-page>
</template>

<script setup>
import { onMounted } from 'vue'
import { usePOReceivingAddFlow } from '../../../composables/operations/poReceivings/usePOReceivingAddFlow.js'
import POReceivingSummaryCards from '../../../components/Operations/PoReceivings/POReceivingSummaryCards.vue'
import POReceivingItemGrid from '../../../components/Operations/PoReceivings/POReceivingItemGrid.vue'
import POReceivingBulkToolbar from '../../../components/Operations/PoReceivings/POReceivingBulkToolbar.vue'

defineOptions({ name: 'PoReceivingsAddPage' })
const flow = usePOReceivingAddFlow()
const { saving, selectedPurchaseOrderCode, purchaseOrderOptions, currentReceiving, form, items, summary, isDraft, isCompletedProcurement, canSaveDraft, canConfirm, canGenerateGRN, loadData, selectPurchaseOrder, updateItem, setAllReceivedToExpected, clearQuantities, saveDraft, confirmReceiving, generateGRN, startReplacement, cancel } = flow
onMounted(() => loadData())
</script>
