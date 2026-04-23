<template>
  <q-page class="q-pa-md">
    <div class="review-wrap">
      <div v-if="loading" class="page-state column items-center justify-center">
        <q-spinner-dots color="primary" size="40px" />
        <div class="text-caption text-grey-6 q-mt-sm">Loading requisition...</div>
      </div>

      <div v-else-if="!prForm.Code" class="page-state column items-center justify-center">
        <q-icon name="search_off" size="48px" color="grey-4" />
        <div class="text-subtitle2 text-grey-5 q-mt-sm">Requisition not found</div>
        <q-btn flat color="primary" icon="arrow_back" label="Back to list" class="q-mt-md" @click="nav.goTo('list')" />
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
                <div class="col-12 col-md-3">
                  <div class="text-caption text-grey-6">PR Date</div>
                  <div class="text-subtitle2">{{ formatDate(prForm.PRDate) || '-' }}</div>
                </div>
                <div class="col-12 col-md-3">
                  <div class="text-caption text-grey-6">Warehouse</div>
                  <div class="text-subtitle2">{{ selectedWarehouse?.Name || prForm.WarehouseCode || 'Any Warehouse' }}</div>
                </div>
                <div class="col-12 col-md-3">
                  <div class="text-caption text-grey-6">Need By</div>
                  <div class="text-subtitle2">{{ formatDate(prForm.RequiredDate) || 'Not set' }}</div>
                </div>
                <div class="col-12 col-md-3">
                  <div class="text-caption text-grey-6">Procurement</div>
                  <div class="text-subtitle2">{{ prForm.ProcurementCode || '-' }}</div>
                </div>
              </div>
            </div>

            <div class="col-auto column items-end q-gutter-sm">
              <q-chip class="text-weight-bold" :style="statusChipStyle(prForm.Progress)">
                {{ prForm.Progress }}
              </q-chip>
              <q-btn
                color="positive"
                icon="check_circle"
                label="Approve"
                :loading="acting === 'approve'"
                @click="approve"
              />
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
            <div class="text-subtitle1 text-weight-bold">Request Details</div>
            <div class="row q-col-gutter-md q-mt-sm">
              <div class="col-12 col-md-3">
                <div class="text-caption text-grey-6">Type</div>
                <div class="text-subtitle2">{{ prForm.Type || '-' }}</div>
              </div>
              <div class="col-12 col-md-3">
                <div class="text-caption text-grey-6">Priority</div>
                <div class="text-subtitle2">{{ prForm.Priority || '-' }}</div>
              </div>
              <div class="col-12 col-md-3">
                <div class="text-caption text-grey-6">Reference</div>
                <div class="text-subtitle2">{{ prForm.TypeReferenceCode || '-' }}</div>
              </div>
              <div class="col-12 col-md-3">
                <div class="text-caption text-grey-6">Procurement</div>
                <div class="text-subtitle2">{{ prForm.ProcurementCode || '-' }}</div>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card v-if="prForm.ProgressRevisionRequiredComment" flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">Revision Thread</div>
            <div class="workflow-thread q-mt-sm" v-html="revisionThreadHtml" />
          </q-card-section>
        </q-card>

        <q-card v-if="prForm.ProgressRejectedComment" flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">Rejected Comment</div>
            <div class="workflow-thread q-mt-sm" v-html="rejectedCommentHtml" />
          </q-card-section>
        </q-card>

        <q-card flat bordered class="q-mt-md">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">Items</div>
          </q-card-section>
          <q-separator />
          <q-table
            flat
            :rows="items"
            :columns="columns"
            row-key="Code"
            hide-pagination
            :pagination="{ rowsPerPage: 0 }"
          />
        </q-card>

        <q-card flat bordered class="q-mt-md q-mb-xl">
          <q-card-section>
            <div class="text-subtitle1 text-weight-bold">Review Comment</div>
            <div class="text-caption text-grey-6 q-mt-xs">
              Comment is required for Send Back and Reject.
            </div>
            <q-input
              v-model="actionComment"
              type="textarea"
              outlined
              autogrow
              class="q-mt-md"
              placeholder="Add review comment"
            />
          </q-card-section>
          <q-card-actions align="right" class="q-pa-md row q-gutter-sm">
            <q-btn
              outline
              color="warning"
              icon="reply"
              label="Send Back"
              :loading="acting === 'send-back'"
              @click="sendBack"
            />
            <q-btn
              outline
              color="negative"
              icon="close"
              label="Reject"
              :loading="acting === 'reject'"
              @click="reject"
            />
          </q-card-actions>
        </q-card>
      </template>
    </div>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { usePurchaseRequisitionApprovalFlow } from 'src/composables/operations/purchaseRequisitions/usePurchaseRequisitionApprovalFlow'

const {
  nav,
  loading,
  acting,
  prForm,
  items,
  selectedWarehouse,
  actionComment,
  totalQty,
  grandTotal,
  revisionThreadHtml,
  rejectedCommentHtml,
  formatDate,
  formatCurrency,
  statusChipStyle,
  approve,
  reject,
  sendBack
} = usePurchaseRequisitionApprovalFlow()

const columns = computed(() => ([
  { name: 'SKU', label: 'SKU', field: 'SKU', align: 'left' },
  { name: 'UOM', label: 'UOM', field: 'UOM', align: 'left' },
  { name: 'Quantity', label: 'Quantity', field: 'Quantity', align: 'right' },
  { name: 'EstimatedRate', label: 'Estimated Rate', field: (row) => formatCurrency(row.EstimatedRate), align: 'right' },
  { name: 'Total', label: 'Total', field: (row) => formatCurrency((Number(row.Quantity) || 0) * (Number(row.EstimatedRate) || 0)), align: 'right' }
]))
</script>

<style scoped>
.review-wrap {
  max-width: 1120px;
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
