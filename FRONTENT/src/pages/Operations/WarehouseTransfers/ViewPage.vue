<template>
  <q-page padding class="q-pb-xl">
    <q-linear-progress v-if="loading" color="primary" indeterminate rounded class="q-mb-sm" />

    <div v-if="!loading && !record" class="text-center q-pa-xl">
      <q-icon name="search_off" size="4em" color="grey-5" />
      <div class="text-h6 q-mt-md text-grey-7">Transfer not found</div>
      <q-btn flat color="primary" label="Back to List" icon="arrow_back" class="q-mt-md" @click="nav.goTo('index')" />
    </div>

    <template v-else-if="record">
      <GenericHeaderPanel
        back
        :label="record.Code"
        caption="Warehouse Transfer"
        :chip="record.Progress"
        :chip-color="progressChipColor"
        class="q-mb-md"
        @click="nav.goTo('index')"
      />



      <q-card flat class="q-mb-md overflow-hidden bg-white shadow-1" style="border-radius: 12px; border: 1px solid rgba(0,0,0,0.05)">
        <!-- Header status bar -->

        <q-card-section class="q-pa-lg">
          <q-list>
            <q-item class="text-weight-bold text-subtitle1">
              <q-item-section side>{{ getWarehouseName(record.SourceWarehouseCode) }}</q-item-section>
              <q-item-section class="items-center"><q-icon name="arrow_forward" size="sm" class="text-blue-grey-3" /></q-item-section>
              <q-item-section side>{{ getWarehouseName(record.DestinationWarehouseCode) }}</q-item-section>
            </q-item>
            <q-item>
              <q-item-section side>
                <q-avatar size="sm" color="grey-2" text-color="grey-7" ><q-icon name="person" size="16px" /></q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ record.Username }}</q-item-label>
                <q-item-label caption>Initiated By</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-avatar size="sm" color="grey-2" text-color="grey-7" class="q-mr-md"><q-icon name="calendar_today" size="16px" /></q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ record.Date }}</q-item-label>
                <q-item-label caption>Initiated Date</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <div class="q-mb-md" v-if="progressSteps.length">
        <StepProgressIndicator
          :model-value="currentProgressStep"
          :steps="progressSteps"
          active-color="primary"
          inactive-color="grey-3"
          inactive-text-color="grey-6"
        />
      </div>

      <template v-if="hasActivity">
        <SectionDividerLabel label="Activity" />
        <div class="q-mb-md q-gutter-y-sm">
          <q-card v-if="record.ProgressPendingApprovalComment" flat class="bg-orange-1">
            <q-card-section class="q-py-sm q-px-md">
              <div class="row items-center q-mb-xs">
                <q-icon name="info" color="warning" size="18px" class="q-mr-xs" />
                <span class="text-caption text-weight-bold text-warning text-uppercase">Pending Approval Note</span>
              </div>
              <div class="text-body2 text-grey-9">{{ record.ProgressPendingApprovalComment }}</div>
            </q-card-section>
          </q-card>
          <q-card v-if="record.ProgressApprovedComment" flat class="bg-green-1">
            <q-card-section class="q-py-sm q-px-md">
              <div class="row items-center q-mb-xs">
                <q-icon name="check_circle" color="positive" size="18px" class="q-mr-xs" />
                <span class="text-caption text-weight-bold text-positive text-uppercase">Approval Note</span>
              </div>
              <div class="text-body2 text-grey-9">{{ record.ProgressApprovedComment }}</div>
            </q-card-section>
          </q-card>
          <q-card v-if="record.ProgressCompletedComment" flat class="bg-teal-1">
            <q-card-section class="q-py-sm q-px-md">
              <div class="row items-center q-mb-xs">
                <q-icon name="task_alt" color="teal" size="18px" class="q-mr-xs" />
                <span class="text-caption text-weight-bold text-teal text-uppercase">Completion Note</span>
              </div>
              <div class="text-body2 text-grey-9">{{ record.ProgressCompletedComment }}</div>
            </q-card-section>
          </q-card>
          <q-card v-if="record.ProgressRejectedComment" flat class="bg-red-1">
            <q-card-section class="q-py-sm q-px-md">
              <div class="row items-center q-mb-xs">
                <q-icon name="cancel" color="negative" size="18px" class="q-mr-xs" />
                <span class="text-caption text-weight-bold text-negative text-uppercase">Rejection Reason</span>
              </div>
              <div class="text-body2 text-grey-9">{{ record.ProgressRejectedComment }}</div>
            </q-card-section>
          </q-card>
        </div>
      </template>

      <div v-if="availableActions.length" class="q-mb-md">
        <SectionDividerLabel label="Actions" />
        <div class="row q-gutter-sm justify-center q-mt-sm">
          <ResourceActionButton v-if="availableActions.includes('Approve')" color="positive" label="Approve" icon="check" unelevated @click="openActionDialog('Approve')"/>
          <q-btn v-if="availableActions.includes('Edit')" color="primary" label="Edit" icon="edit" unelevated @click="nav.goTo('edit')"/>
                    <ResourceActionButton v-if="availableActions.includes('Complete')" color="primary" label="Complete Transfer" icon="check_circle" unelevated @click="nav.goTo('action', { action: 'complete' })"/>
          <ResourceActionButton v-if="availableActions.includes('ClaimAndComplete')" color="primary" label="Claim & Complete" icon="local_shipping" unelevated @click="nav.goTo('action', { action: 'complete' })"/>
          <q-btn v-if="availableActions.includes('Reject')" color="negative" label="Reject" icon="block" flat @click="openActionDialog('Reject')"/>
        </div>
      </div>

      <SectionDividerLabel label="Transfer Items" />

      <q-card>
        <q-card-section class="q-py-xs">
          <q-list>
            <q-item>
              <q-item-section side><q-icon name="inventory_2" color="primary" size="20px" class="q-mr-sm" /></q-item-section>
              <q-item-section><q-item-label class="text-weight-bold text-grey-8">Items</q-item-label></q-item-section>
              <q-item-section side><q-badge color="primary" text-color="white" class="q-px-sm q-py-xs" rounded>{{ childItems.length }} item</q-badge></q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <AqlList
            dense
            :items="childItems"
            item-key="Code"
            empty-text="No items in this transfer."
            :layout="['label', 'caption', 'caption']"
            :content="[
              (item) => getProductName(item.SKUCode),
              (item) => getSkuAndVariants(item.SKUCode),
              (item) => `${item.SourceStorageName} - Qty: ${item.Quantity}`
            ]"
            :chip="(item) => item.Progress || 'PENDING'"
            :chip-color="(item) => itemProgressColor(item.Progress)"
          />
        </q-card-section>
      </q-card>
    </template>

    <q-dialog v-model="actionDialog.open" persistent>
      <q-card class="q-mb-md" style="min-width: 380px; max-width: 95vw;">
        <q-card-section class="row items-center q-py-md q-px-lg" :class="actionDialog.bgClass">
          <q-icon :name="actionDialog.icon" size="24px" class="q-mr-sm" color="white" />
          <span class="text-subtitle1 text-weight-bold text-white">{{ actionDialog.title }}</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup color="white" />
        </q-card-section>
        <q-card-section class="q-gutter-y-md q-pt-md q-px-lg">
          <div v-if="actionDialog.message" class="text-body2 text-grey-7">{{ actionDialog.message }}</div>
          <q-select
            v-if="actionDialog.actionName === 'ClaimAndComplete'"
            v-model="actionDialog.fields.DestinationWarehouseCode"
            :options="warehouseOptions"
            label="Destination Warehouse *"
            outlined dense emit-value map-options
          />
          <q-input
            v-if="actionDialog.actionName === 'Complete' || actionDialog.actionName === 'ClaimAndComplete'"
            v-model="actionDialog.fields.ProgressCompletedComment"
            type="textarea" label="Completion Note (optional)" outlined dense
          />
          <q-input
            v-if="actionDialog.actionName === 'Reject'"
            v-model="actionDialog.fields.ProgressRejectedComment"
            type="textarea" label="Rejection Reason *" outlined dense
          />
        </q-card-section>
        <q-card-actions align="right" class="q-pb-md q-pr-lg">
          <q-btn flat label="Cancel" color="grey-7" v-close-popup :disable="saving" />
          <q-btn unelevated :color="actionDialog.confirmColor" label="Confirm" :loading="saving" @click="submitWorkflowAction" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="itemDialog.open" persistent>
      <q-card class="q-mb-md" style="min-width: 360px; max-width: 95vw;">
        <q-card-section class="bg-primary text-white row items-center q-py-md q-px-lg">
          <q-icon name="local_shipping" size="24px" class="q-mr-sm" />
          <span class="text-subtitle1 text-weight-bold">Fulfill Item</span>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup color="white" />
        </q-card-section>
        <q-card-section class="q-gutter-y-sm q-pt-md q-px-lg">
          <div class="row items-center q-mb-sm">
            <q-avatar rounded color="grey-2" text-color="primary" size="40px" class="q-mr-md">
              <q-icon name="inventory_2" size="22px" />
            </q-avatar>
            <div>
              <div class="text-subtitle1 text-weight-bold text-grey-9">{{ itemDialog.item?.SKUCode }}</div>
              <div class="text-caption text-grey-6">{{ skuName(itemDialog.item?.SKUCode) }}</div>
            </div>
          </div>
          <q-separator />
          <div class="row q-col-gutter-md q-py-sm">
            <div class="col-6">
              <div class="text-caption text-grey-6">Quantity</div>
              <div class="text-weight-bold text-grey-9">{{ itemDialog.item?.Quantity }}</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-6">From</div>
              <div class="text-weight-bold text-grey-9">{{ itemDialog.item?.SourceStorageName }}</div>
            </div>
          </div>
          <q-select
            v-model="itemDialog.DestinationStorageName"
            :options="itemDestStorages"
            label="Destination Storage *"
            outlined dense emit-value map-options
          />
        </q-card-section>
        <q-card-actions align="right" class="q-pb-md q-pr-lg">
          <q-btn flat label="Cancel" color="grey-7" v-close-popup :disable="saving" />
          <q-btn unelevated glossy color="primary" label="Fulfill & Stock" :loading="saving" @click="submitItemFulfillment" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useWarehouseTransfers } from '../../../composables/operation/warehouseTransfers/useWarehouseTransfers.js'
import { useProductSkuResolver } from 'src/composables/master/products/useProductSkuResolver'
import GenericHeaderPanel from 'components/shared/GenericHeaderPanel.vue'
import AqlList from 'components/shared/AqlList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import StepProgressIndicator from 'components/shared/StepProgressIndicator.vue'
import ResourceActionButton from 'components/shared/ResourceActionButton.vue'

defineOptions({ name: 'WarehouseTransfersViewPage' })

const route = useRoute()
const nav = useResourceNav()
const flow = useWarehouseTransfers()
const { loading, saving, transfers, transferItems, warehouses, warehouseOptions, skuName, reload, getStorageOptionsForWarehouse, executeAction, completeItem } = flow

function getWarehouseName(warehouseCode) {
  if (!warehouseCode) return 'Unassigned'
  const wh = warehouses.items.value.find(w => w.Code === warehouseCode)
  return wh?.Name || warehouseCode
}

const { skuInfo } = useProductSkuResolver()

function getProductName(skuCode) {
  const info = skuInfo(skuCode)
  return info?.productName || skuCode || 'Item'
}

function getSkuAndVariants(skuCode) {
  const info = skuInfo(skuCode)
  if (!info) return skuCode
  const variantsStr = (info.variantValues || []).filter(Boolean).join(' / ')
  return variantsStr ? `${skuCode} - ${variantsStr}` : skuCode
}

const recordCode = computed(() => route.params.code)
const record = computed(() => transfers.items.value.find(t => t.Code === recordCode.value) || null)

const childItems = computed(() =>
  transferItems.items.value.filter(
    item => item.WarehouseTransferCode === recordCode.value && (item.Status || 'Active') === 'Active'
  )
)

const progressSteps = computed(() => {
  const steps = [
    { name: 0, label: 'Draft' },
    { name: 1, label: 'Pending Approval' },
    { name: 2, label: 'Approved' },
    { name: 3, label: 'Completed' }
  ]
  if (record.value?.Progress === 'REJECTED') {
    return [
      { name: 0, label: 'Draft' },
      { name: 1, label: 'Pending Approval' },
      { name: -1, label: 'Rejected', icon: 'block' }
    ]
  }
  return steps
})

const currentProgressStep = computed(() => {
  if (!record.value) return 0
  const map = { DRAFT: 0, PENDING_APPROVAL: 1, APPROVED: 2, COMPLETED: 3, REJECTED: -1 }
  return map[record.value.Progress] ?? 0
})

const hasActivity = computed(() => {
  if (!record.value) return false
  return !!(record.value.ProgressPendingApprovalComment || record.value.ProgressApprovedComment ||
    record.value.ProgressCompletedComment || record.value.ProgressRejectedComment)
})

const availableActions = computed(() => {
  if (!record.value) return []
  const list = []
  const { Progress, DestinationWarehouseCode } = record.value
  if (Progress === 'DRAFT') list.push('Edit')
  else if (Progress === 'PENDING_APPROVAL') list.push('Approve', 'Reject')
  else if (Progress === 'APPROVED') {
    list.push('Reject')
    list.push(DestinationWarehouseCode ? 'Complete' : 'ClaimAndComplete')
  }
  return list
})

const progressChipColor = computed(() => {
  const map = { DRAFT: 'grey-6', PENDING_APPROVAL: 'orange-7', APPROVED: 'primary', COMPLETED: 'positive', REJECTED: 'negative' }
  return map[record.value?.Progress] || 'grey-6'
})

function itemProgressColor(progress) {
  const map = { PENDING: 'orange-7', TRANSFERRED: 'positive', CANCELLED: 'negative' }
  return map[progress] || 'grey-7'
}

function canCompleteItem(item) {
  return record.value?.Progress === 'APPROVED'// && !!record.value?.DestinationWarehouseCode && item.Progress === 'PENDING'
}

const actionMeta = {
  Approve: { title: 'Approve Transfer', icon: 'check', message: 'Confirm approval of this warehouse transfer?', bgClass: 'bg-positive', confirmColor: 'positive' },
  Reject: { title: 'Reject Transfer', icon: 'block', message: 'Provide a rejection reason.', bgClass: 'bg-negative', confirmColor: 'negative' },
  Complete: { title: 'Complete Transfer', icon: 'check_circle', message: 'Complete this transfer and post all items to destination.', bgClass: 'bg-primary', confirmColor: 'primary' },
  ClaimAndComplete: { title: 'Claim & Complete', icon: 'local_shipping', message: 'Select the destination warehouse to claim and complete this transfer.', bgClass: 'bg-primary', confirmColor: 'primary' }
}

const actionDialog = ref({ open: false, actionName: '', title: '', icon: '', message: '', bgClass: '', confirmColor: '', fields: { DestinationWarehouseCode: '', ProgressCompletedComment: '', ProgressRejectedComment: '' } })

function openActionDialog(actionName) {
  const meta = actionMeta[actionName] || {}
  actionDialog.value = { open: true, actionName, ...meta, fields: { DestinationWarehouseCode: '', ProgressCompletedComment: '', ProgressRejectedComment: '' } }
}

async function submitWorkflowAction() {
  const { actionName, fields } = actionDialog.value
  if (actionName === 'Reject' && !fields.ProgressRejectedComment) return
  if (actionName === 'ClaimAndComplete' && !fields.DestinationWarehouseCode) return
  const success = await executeAction(recordCode.value, actionName, fields)
  if (success) actionDialog.value.open = false
}

const itemDialog = ref({ open: false, item: null, DestinationStorageName: '_default' })
const itemDestStorages = computed(() => getStorageOptionsForWarehouse(record.value?.DestinationWarehouseCode))

function openItemCompletionDialog(item) {
  itemDialog.value = { open: true, item, DestinationStorageName: '_default' }
}

async function submitItemFulfillment() {
  const { item, DestinationStorageName } = itemDialog.value
  if (!item) return
  const success = await completeItem(item.Code, DestinationStorageName)
  if (success) itemDialog.value.open = false
}

onMounted(() => reload())
</script>

