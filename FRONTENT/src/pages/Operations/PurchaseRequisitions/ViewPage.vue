<template>
  <div class="pr-view-page">
    <div v-if="loading" class="page-state column items-center justify-center">
      <q-spinner-dots color="primary" size="40px" />
      <div class="text-caption text-grey-5 q-mt-sm">Loading requisition...</div>
    </div>

    <div v-else-if="!record" class="page-state column items-center justify-center">
      <q-icon name="search_off" size="48px" color="grey-4" />
      <div class="text-subtitle2 text-grey-5 q-mt-sm">Requisition not found</div>
      <q-btn flat color="primary" label="Back to list" icon="arrow_back" class="q-mt-md" @click="nav.goTo('list')" />
    </div>

    <PurchaseRequisitionEditablePage v-else-if="viewMode === 'editable'" />

    <PurchaseRequisitionReviewPage v-else-if="viewMode === 'review'" />

    <q-page v-else class="q-pa-md">
      <div class="readonly-wrap column q-gutter-md">
        <q-card flat bordered>
          <q-card-section class="row items-start q-col-gutter-md">
            <div class="col">
              <div class="row items-center q-gutter-sm">
                <q-btn flat round dense icon="arrow_back" color="primary" @click="nav.goTo('list')" />
                <div>
                  <div class="text-overline text-primary">Purchase Requisition</div>
                  <div class="text-h5 text-weight-bold">{{ record.Code }}</div>
                </div>
              </div>
              <div class="row q-col-gutter-md q-mt-md">
                <div class="col-12 col-sm-6 col-md-3">
                  <div class="text-caption text-grey-6">PR Date</div>
                  <div class="text-subtitle2">{{ formatDate(record.PRDate) || '-' }}</div>
                </div>
                <div class="col-12 col-sm-6 col-md-3">
                  <div class="text-caption text-grey-6">Need By</div>
                  <div class="text-subtitle2">{{ formatDate(record.RequiredDate) || 'Not set' }}</div>
                </div>
                <div class="col-12 col-sm-6 col-md-3">
                  <div class="text-caption text-grey-6">Procurement</div>
                  <div class="text-subtitle2">{{ record.ProcurementCode || '-' }}</div>
                </div>
                <div class="col-12 col-sm-6 col-md-3">
                  <div class="text-caption text-grey-6">Warehouse</div>
                  <div class="text-subtitle2">{{ record.WarehouseCode || '-' }}</div>
                </div>
              </div>
            </div>

            <div class="col-auto">
              <q-chip class="status-chip text-weight-bold" :style="statusChipStyle(record.Progress)">
                {{ record.Progress }}
              </q-chip>
            </div>
          </q-card-section>
        </q-card>

        <div class="row q-col-gutter-md">
          <div class="col-12 col-lg-4">
            <q-card flat bordered class="full-height">
              <q-card-section>
                <div class="text-subtitle1 text-weight-bold">Request Details</div>
              </q-card-section>
              <q-separator />
              <q-list dense separator>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Type</q-item-label>
                    <q-item-label>{{ record.Type || '-' }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Priority</q-item-label>
                    <q-item-label>{{ record.Priority || '-' }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Reference</q-item-label>
                    <q-item-label>{{ record.TypeReferenceCode || '-' }}</q-item-label>
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    <q-item-label caption>Items</q-item-label>
                    <q-item-label>{{ childItems.length }} item(s)</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card>
          </div>

          <div class="col-12 col-lg-8 column q-gutter-md">
            <q-card v-if="record.ProgressRevisionRequiredComment" flat bordered>
              <q-card-section>
                <div class="text-subtitle1 text-weight-bold">Revision Thread</div>
                <div class="readonly-thread q-mt-sm" v-html="revisionThreadHtml" />
              </q-card-section>
            </q-card>

            <q-card v-if="record.ProgressRejectedComment" flat bordered>
              <q-card-section>
                <div class="text-subtitle1 text-weight-bold">Rejected Comment</div>
                <div class="readonly-thread q-mt-sm" v-html="rejectedCommentHtml" />
              </q-card-section>
            </q-card>

            <q-card flat bordered>
              <q-card-section class="row items-center justify-between">
                <div class="text-subtitle1 text-weight-bold">Items</div>
                <div class="text-caption text-grey-6">{{ childItems.length }} item(s)</div>
              </q-card-section>
              <q-separator />
              <q-table
                flat
                :rows="childItems"
                :columns="columns"
                row-key="Code"
                hide-pagination
                :pagination="{ rowsPerPage: 0 }"
              />
            </q-card>
          </div>
        </div>
      </div>
    </q-page>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useProcurements } from 'src/composables/operations/procurements/useProcurements'
import PurchaseRequisitionEditablePage from './PurchaseRequisitionEditablePage.vue'
import PurchaseRequisitionReviewPage from './PurchaseRequisitionReviewPage.vue'

const nav = useResourceNav()
const procurements = useProcurements()
const { resourceName, code } = useResourceConfig()
const { items, loading: recordLoading, reload: reloadParent } = useResourceData(resourceName)
const childResource = useResourceData(ref('PurchaseRequisitionItems'))

const loading = computed(() => recordLoading.value || childResource.loading.value)
const record = computed(() => items.value.find((row) => row.Code === code.value) || null)
const childItems = computed(() => childResource.items.value.filter((item) => item.PurchaseRequisitionCode === code.value))
const viewMode = computed(() => procurements.resolveViewMode(record.value?.Progress || ''))
const revisionThreadHtml = computed(() => procurements.formatWorkflowCommentHtml(record.value?.ProgressRevisionRequiredComment || ''))
const rejectedCommentHtml = computed(() => procurements.formatWorkflowCommentHtml(record.value?.ProgressRejectedComment || ''))

const columns = [
  { name: 'SKU', label: 'SKU', field: 'SKU', align: 'left' },
  { name: 'UOM', label: 'UOM', field: 'UOM', align: 'left' },
  { name: 'Quantity', label: 'Quantity', field: 'Quantity', align: 'right' },
  { name: 'EstimatedRate', label: 'Estimated Rate', field: (row) => formatCurrency(row.EstimatedRate), align: 'right' },
  { name: 'Total', label: 'Total', field: (row) => formatCurrency((Number(row.Quantity) || 0) * (Number(row.EstimatedRate) || 0)), align: 'right' }
]

function formatDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

function formatCurrency(value) {
  const amount = Number(value) || 0
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function statusChipStyle(progress) {
  const map = {
    Approved: { bg: 'rgba(22,163,74,0.12)', fg: '#166534', border: 'rgba(34,197,94,0.30)' },
    Rejected: { bg: 'rgba(220,38,38,0.10)', fg: '#B91C1C', border: 'rgba(248,113,113,0.30)' },
    'RFQ Processed': { bg: 'rgba(15,23,42,0.08)', fg: '#334155', border: 'rgba(148,163,184,0.30)' }
  }
  const style = map[progress] || map.Approved
  return `background:${style.bg};color:${style.fg};border:1px solid ${style.border}`
}

watch(() => [resourceName.value, code.value], async ([name, prCode]) => {
  if (!name || !prCode) return
  await Promise.all([
    reloadParent(),
    childResource.reload()
  ])
}, { immediate: true })
</script>

<style scoped>
.pr-view-page {
  min-height: 100%;
}

.page-state {
  min-height: 320px;
}

.readonly-wrap {
  max-width: 1120px;
  margin: 0 auto;
}

.status-chip {
  border-radius: 999px;
}

.readonly-thread {
  line-height: 1.5;
  color: #334155;
}
</style>
