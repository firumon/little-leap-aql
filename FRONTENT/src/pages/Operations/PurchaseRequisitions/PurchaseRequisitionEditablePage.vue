<template>
  <q-page class="q-pa-md">
    <div class="editable-wrap">
      <div v-if="loading" class="page-state column items-center justify-center">
        <q-spinner-dots color="primary" size="40px" />
        <div class="text-caption text-grey-6 q-mt-sm">Loading requisition...</div>
      </div>

      <div v-else-if="!prForm.Code" class="page-state column items-center justify-center">
        <q-icon name="search_off" size="48px" color="grey-4" />
        <div class="text-subtitle2 text-grey-5 q-mt-sm">Requisition not found</div>
        <q-btn flat color="primary" label="Back to list" icon="arrow_back" class="q-mt-md" @click="nav.goTo('list')" />
      </div>

      <template v-else>
        <q-card flat bordered>
          <q-card-section class="row items-start q-col-gutter-md">
            <div class="col">
              <div class="row items-center q-gutter-sm">
                <q-btn flat round dense icon="arrow_back" color="primary" @click="nav.goTo('list')" />
                <div>
                  <div class="text-overline text-primary">Purchase Requisition</div>
                  <div class="text-h5 text-weight-bold">{{ prForm.Code }}</div>
                </div>
              </div>
              <div class="row q-col-gutter-md q-mt-md">
                <div class="col-12 col-md-4">
                  <div class="text-caption text-grey-6">PR Date</div>
                  <div class="text-subtitle2">{{ formatDate(prForm.PRDate) || '-' }}</div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="text-caption text-grey-6">Warehouse</div>
                  <div class="text-subtitle2">{{ selectedWarehouse?.Name || prForm.WarehouseCode || 'Any Warehouse' }}</div>
                </div>
                <div class="col-12 col-md-4">
                  <div class="text-caption text-grey-6">Procurement</div>
                  <div class="text-subtitle2">{{ prForm.ProcurementCode || 'Not linked yet' }}</div>
                </div>
              </div>
            </div>

            <div class="col-auto">
              <q-chip class="text-weight-bold" :style="statusChipStyle(prForm.Progress)">
                {{ prForm.Progress || 'Draft' }}
              </q-chip>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section class="row q-col-gutter-md">
            <div class="col-12 col-md-4">
              <q-card flat bordered>
                <q-card-section class="q-pa-sm">
                  <div class="text-caption text-grey-6">Items</div>
                  <div class="text-h6 text-weight-bold">{{ items.length }}</div>
                </q-card-section>
              </q-card>
            </div>
            <div class="col-12 col-md-4">
              <q-card flat bordered>
                <q-card-section class="q-pa-sm">
                  <div class="text-caption text-grey-6">Total Qty</div>
                  <div class="text-h6 text-weight-bold">{{ totalQty }}</div>
                </q-card-section>
              </q-card>
            </div>
            <div class="col-12 col-md-4">
              <q-card flat bordered>
                <q-card-section class="q-pa-sm">
                  <div class="text-caption text-grey-6">Estimated Value</div>
                  <div class="text-h6 text-weight-bold">{{ formatCurrency(grandTotal) }}</div>
                </q-card-section>
              </q-card>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mt-md">
          <q-card-section>
            <div class="row items-center justify-between">
              <div class="text-subtitle1 text-weight-bold">Request Details</div>
              <q-chip dense :color="hasUnsavedChanges ? 'warning' : 'positive'" text-color="white">
                {{ hasUnsavedChanges ? 'Unsaved changes' : 'Up to date' }}
              </q-chip>
            </div>
            <div class="row q-col-gutter-md q-mt-sm">
              <div class="col-12 col-md-4">
                <q-select
                  v-model="prForm.Type"
                  :options="types"
                  option-label="label"
                  option-value="value"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Type"
                />
              </div>
              <div class="col-12 col-md-4">
                <q-select
                  v-model="prForm.Priority"
                  :options="priorities"
                  option-label="label"
                  option-value="value"
                  emit-value
                  map-options
                  outlined
                  dense
                  label="Priority"
                />
              </div>
              <div class="col-12 col-md-4">
                <q-select
                  v-model="prForm.WarehouseCode"
                  :options="warehouses.map((warehouse) => ({ label: warehouse.Name, value: warehouse.Code }))"
                  emit-value
                  map-options
                  outlined
                  dense
                  clearable
                  :loading="loadingWarehouses"
                  label="Warehouse"
                />
              </div>
              <div class="col-12 col-md-4">
                <q-input v-model="prForm.RequiredDate" outlined dense label="Required Date">
                  <template #append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="prForm.RequiredDate" mask="YYYY-MM-DD">
                          <div class="row items-center justify-end q-pa-sm">
                            <q-btn v-close-popup flat dense label="Close" color="primary" />
                          </div>
                        </q-date>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div v-if="needsRefCode" class="col-12 col-md-4">
                <q-input v-model="prForm.TypeReferenceCode" outlined dense label="Reference Code" />
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mt-md">
          <q-card-section class="row items-center q-col-gutter-md">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">Items</div>
            </div>
            <div class="col-12 col-md-4">
              <q-input
                v-model="itemSearch"
                outlined
                dense
                clearable
                label="Search items"
              >
                <template #prepend>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-auto">
              <q-btn color="primary" icon="add" label="Add Item" @click="openAddItemDialog" />
            </div>
          </q-card-section>
          <q-separator />
          <q-table
            flat
            :rows="filteredItems"
            :columns="itemColumns"
            row-key="_key"
            hide-pagination
            :pagination="{ rowsPerPage: 0 }"
          >
            <template #body-cell-Description="props">
              <q-td :props="props">
                <div class="text-weight-medium">{{ skuInfoByCode[props.row.SKU]?.productName || props.row.SKU }}</div>
                <div v-if="skuInfoByCode[props.row.SKU]?.variantsCsv" class="text-caption text-grey-6">
                  {{ skuInfoByCode[props.row.SKU].variantsCsv }}
                </div>
              </q-td>
            </template>

            <template #body-cell-Quantity="props">
              <q-td :props="props" class="text-right">
                <q-input
                  :model-value="props.row.Quantity"
                  type="number"
                  dense
                  outlined
                  min="1"
                  input-class="text-right"
                  @update:model-value="(value) => updateItemQuantity(props.row, value)"
                />
              </q-td>
            </template>

            <template #body-cell-EstimatedRate="props">
              <q-td :props="props" class="text-right">
                <q-input
                  :model-value="props.row.EstimatedRate"
                  type="number"
                  dense
                  outlined
                  min="0"
                  step="0.01"
                  input-class="text-right"
                  @update:model-value="(value) => updateItemEstimatedRate(props.row, value)"
                />
              </q-td>
            </template>

            <template #body-cell-Actions="props">
              <q-td :props="props" class="text-right">
                <q-btn flat round dense icon="delete" color="negative" @click="removeItem(props.row)" />
              </q-td>
            </template>
          </q-table>
        </q-card>

        <q-card v-if="revisionThread" flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">Revision Thread</div>
            <div class="workflow-thread q-mt-sm" v-html="revisionThreadHtml" />
          </q-card-section>
        </q-card>

        <q-card v-if="rejectedComment" flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">Rejected Comment</div>
            <div class="workflow-thread q-mt-sm" v-html="rejectedCommentHtml" />
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mt-md q-mb-xl">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">Actions</div>
            <div class="text-caption text-grey-6 q-mt-xs">
              {{ hasUnsavedChanges ? 'Update the requisition first. Submit becomes available after the page is up to date.' : 'This requisition is up to date and ready for submission.' }}
            </div>
          </q-card-section>

          <q-separator v-if="hasUnsavedChanges" />

          <q-card-section v-if="hasUnsavedChanges">
            <q-input
              v-model="responseComment"
              type="textarea"
              outlined
              autogrow
              :label="isRevision ? 'Update Comment *' : 'Update Comment'"
              :hint="isRevision ? 'Required before updating a revised requisition' : 'Optional note for this update'"
              :rules="updateCommentRequired ? [value => !!String(value || '').trim() || 'Comment is required'] : []"
            />
          </q-card-section>

          <q-card-actions align="right" class="q-pa-md row q-gutter-sm">
            <q-btn
              v-if="hasUnsavedChanges"
              color="primary"
              icon="save"
              label="Update PR"
              :disable="!canUpdate"
              :loading="saving"
              @click="updatePr"
            />
            <q-btn
              v-else
              color="primary"
              icon="send"
              label="Submit PR"
              :disable="!canSubmit"
              :loading="submitting"
              @click="submit"
            />
          </q-card-actions>
        </q-card>
      </template>
    </div>

    <PurchaseRequisitionAddItemDialog
      v-model="addDialog"
      :new-item="newItem"
      :sku-options="skuOptions"
      :format-currency="formatCurrency"
      @filter-skus="filterSkus"
      @confirm-add-item="confirmAddItem"
    />
  </q-page>
</template>

<script setup>
import PurchaseRequisitionAddItemDialog from 'src/components/Operations/PurchaseRequisitions/PurchaseRequisitionAddItemDialog.vue'
import { usePurchaseRequisitionEditableFlow } from 'src/composables/operations/purchaseRequisitions/usePurchaseRequisitionEditableFlow'

const {
  nav,
  loading,
  saving,
  submitting,
  prForm,
  items,
  responseComment,
  warehouses,
  loadingWarehouses,
  skuInfoByCode,
  skuOptions,
  itemSearch,
  addDialog,
  newItem,
  types,
  priorities,
  isRevision,
  revisionThread,
  rejectedComment,
  revisionThreadHtml,
  rejectedCommentHtml,
  filteredItems,
  totalQty,
  grandTotal,
  selectedWarehouse,
  needsRefCode,
  hasUnsavedChanges,
  updateCommentRequired,
  canUpdate,
  canSubmit,
  itemColumns,
  statusChipStyle,
  formatDate,
  formatCurrency,
  openAddItemDialog,
  filterSkus,
  confirmAddItem,
  updateItemQuantity,
  updateItemEstimatedRate,
  removeItem,
  updatePr,
  submit
} = usePurchaseRequisitionEditableFlow()
</script>

<style scoped>
.editable-wrap {
  max-width: 1200px;
  margin: 0 auto;
}

.page-state {
  min-height: 320px;
}

.workflow-thread {
  line-height: 1.6;
  color: #334155;
}
</style>
