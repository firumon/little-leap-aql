<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" color="primary" @click="goBack" />
      <h1 class="text-h5 q-mt-none q-mb-none q-ml-sm">Draft Purchase Requisition: {{ prCode }}</h1>
      <q-space />
      <q-chip :color="progressColor(prForm.Progress)" text-color="white" class="text-weight-bold">
        {{ prForm.Progress }}
      </q-chip>
    </div>

    <!-- Review Comments prominently displayed if in Review state -->
    <q-card v-if="prForm.Progress === 'Review'" class="bg-warning text-white q-mb-md">
      <q-card-section>
        <div class="text-h6">Review Required</div>
        <div class="text-body2 whitespace-pre-wrap q-mt-sm">{{ prForm.ProgressReviewComment || 'No comments provided.' }}</div>

        <q-input
          v-model="responseComment"
          type="textarea"
          outlined
          dense
          bg-color="white"
          label="Your Response (Appended to comments)"
          class="q-mt-md"
        />
      </q-card-section>
    </q-card>

    <q-card bordered flat class="q-mb-md">
      <q-card-section>
        <div class="text-h6 q-mb-sm">Header Details</div>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-3">
            <q-input v-model="prForm.PRDate" label="PR Date" outlined dense readonly bg-color="grey-2" />
          </div>
          <div class="col-12 col-md-3">
            <q-select
              v-model="prForm.Type"
              :options="['STOCK', 'PROJECT', 'SALES', 'ASSET']"
              label="Type"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-3">
            <q-select
              v-model="prForm.Priority"
              :options="['Low', 'Medium', 'High', 'Urgent']"
              label="Priority"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-3">
            <q-select
              v-model="prForm.WarehouseCode"
              :options="warehouseOptions"
              label="Warehouse"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-3">
            <q-input
              v-model="prForm.RequiredDate"
              label="Required Date"
              type="date"
              outlined
              dense
            />
          </div>
          <div class="col-12 col-md-3" v-if="['PROJECT', 'SALES'].includes(prForm.Type)">
            <q-input
              v-model="prForm.TypeReferenceCode"
              label="Reference Code"
              outlined
              dense
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card bordered flat>
      <q-card-section class="row items-center justify-between">
        <div class="text-h6">Items</div>
        <q-btn color="primary" icon="add" label="Add Item" @click="showAddItemDialog = true" outline />
      </q-card-section>

      <q-table
        :rows="items"
        :columns="itemColumns"
        row-key="SKU"
        flat
        bordered
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
      >
        <template v-slot:body-cell-Quantity="props">
          <q-td :props="props">
            <q-input
              v-model.number="props.row.Quantity"
              type="number"
              dense
              outlined
              min="1"
            />
          </q-td>
        </template>
        <template v-slot:body-cell-EstimatedRate="props">
          <q-td :props="props">
            <q-input
              v-model.number="props.row.EstimatedRate"
              type="number"
              dense
              outlined
              min="0"
              step="0.01"
            />
          </q-td>
        </template>
        <template v-slot:body-cell-Actions="props">
          <q-td :props="props" class="text-right">
            <q-btn flat icon="delete" color="negative" @click="removeItem(props.rowIndex)" dense />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <div class="row justify-end q-mt-lg q-gutter-sm">
      <q-btn outline color="primary" label="Save Draft" @click="saveDraft" :loading="saving" />
      <q-btn color="primary" label="Confirm & Submit" @click="submitPR" :loading="submitting" />
    </div>

    <!-- Add Item Dialog -->
    <q-dialog v-model="showAddItemDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add Item</div>
        </q-card-section>
        <q-card-section>
          <q-select
            v-model="newItem.SKU"
            :options="skuOptions"
            label="Select SKU"
            outlined
            dense
            use-input
            @filter="filterSkus"
            class="q-mb-md"
          >
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>UOM: {{ scope.opt.UOM || 'N/A' }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <q-input v-model.number="newItem.Quantity" type="number" label="Quantity" outlined dense min="1" class="q-mb-md" />
          <q-input v-model.number="newItem.EstimatedRate" type="number" label="Estimated Rate" outlined dense min="0" step="0.01" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Add" color="primary" @click="confirmAddItem" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { usePurchaseRequisitionDraftFlow } from 'src/composables/operations/purchaseRequisitions/usePurchaseRequisitionDraftFlow'

const {
  prCode,
  prForm,
  items,
  saving,
  submitting,
  responseComment,
  warehouseOptions,
  skuOptions,
  showAddItemDialog,
  newItem,
  itemColumns,
  progressColor,
  goBack,
  filterSkus,
  confirmAddItem,
  removeItem,
  saveDraft,
  submitPR
} = usePurchaseRequisitionDraftFlow()
</script>
