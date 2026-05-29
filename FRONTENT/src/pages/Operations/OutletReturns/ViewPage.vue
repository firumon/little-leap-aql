<template>
  <q-page padding class="q-gutter-y-md">
    <!-- Header panel using standard Quasar elements -->
    <q-card flat bordered class="bg-white">
      <q-card-section class="q-pa-md row items-center q-gutter-x-sm">
        <q-btn flat round dense icon="arrow_back" color="dark" @click="cancel" />
        <q-item-section>
          <q-item-label class="text-h6 text-weight-bold text-primary">{{ code }}</q-item-label>
          <q-item-label caption>Logged by {{ record?.CreatedBy || 'system' }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-badge
            v-if="record"
            :color="getProgressMeta(record.Progress).color"
            text-color="white"
            class="q-py-xs q-px-sm text-weight-bold"
          >
            {{ getProgressMeta(record.Progress).label }}
          </q-badge>
        </q-item-section>
      </q-card-section>
    </q-card>

    <!-- Main Content -->
    <div v-if="loading && !record" class="row justify-center q-my-xl">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <div v-else-if="!record" class="column items-center justify-center q-my-xl text-grey-6 q-gutter-y-sm">
      <q-icon name="error_outline" size="64px" color="negative" />
      <div class="text-weight-bold text-subtitle1">Return Record Not Found</div>
      <q-btn label="Back to List" color="primary" @click="cancel" />
    </div>

    <div v-else class="q-gutter-y-md">
      <!-- 1. Core Summary Card -->
      <q-card flat bordered class="bg-white">
        <q-card-section>
          <q-list>
            <q-item header>
              <q-item-section side><q-icon name="storefront" color="primary" size="20px" /></q-item-section>
              <q-item-section><q-item-label>Outlet Details & Date</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Sales Outlet</q-item-label>
                <q-item-label class="text-body1 text-weight-bold text-primary">{{ outletName(record.OutletCode) }}</q-item-label>
              </q-item-section>
              <q-item-section side top>
                <q-item-label caption>Date of Return</q-item-label>
                <q-item-label class="text-body1 text-weight-medium text-dark">{{ formatDisplayDate(record.Date) }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <!-- 2. SKU and Quantity Card -->
      <q-card flat bordered class="bg-white">
        <q-card-section>
          <q-list>
            <q-item header>
              <q-item-section side><q-icon name="inventory_2" color="primary" size="20px" /></q-item-section>
              <q-item-section><q-item-label>Returned Item Details</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label caption>Product SKU</q-item-label>
                <q-item-label class="text-body1 text-weight-bold text-primary">{{ skuName(record.SKU) }}</q-item-label>
              </q-item-section>
              <q-item-section side top>
                <q-item-label caption>Quantity</q-item-label>
                <q-item-label class="text-h6 text-weight-bold text-dark">{{ record.Qty }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                <q-item-label class="text-body1 text-weight-bold text-primary">REASON: {{ record.Reason  }}</q-item-label>
                <q-item-label caption v-if="record.ReasonComment">{{ record.ReasonComment }}</q-item-label></q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <!-- 3. Operations Status Card (Flags using q-list and q-item) -->
      <q-card flat bordered class="bg-white">
        <q-card-section>
          <q-list>
            <q-item header>
              <q-item-section side><q-icon name="toggle_on" color="primary" size="20px" /></q-item-section>
              <q-item-section><q-item-label>Commercial & Warehouse Status</q-item-label></q-item-section>
            </q-item>
            <!-- Invoicing adjustment status -->
            <q-item>
              <q-item-section>
                <q-item-label>Invoicing Adjustment</q-item-label>
                <q-item-label class="text-body1 text-weight-bold text-primary">
                  {{ isTrue(record.InvoiceAdjustmentRequired) ? 'Required' : 'Not Required' }}
                </q-item-label>
                <q-item-label caption v-if="isTrue(record.InvoiceAdjustmentRequired) && record.ConsumptionInvoiceCode">
                  Invoice Code: {{ record.ConsumptionInvoiceCode }}
                </q-item-label>
                <q-item-label caption v-else-if="isTrue(record.InvoiceAdjustmentRequired)">
                  Credit next invoice
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-x-sm">
                  <q-icon
                    v-if="isTrue(record.InvoiceAdjustmentRequired)"
                    :name="isTrue(record.InvoiceAdjustmentDone) ? 'check_circle' : 'pending'"
                    :color="isTrue(record.InvoiceAdjustmentDone) ? 'positive' : 'warning'"
                    size="24px"
                  />
                  <q-icon v-else name="cancel" color="grey-4" size="24px" />
                  <q-badge :color="isTrue(record.InvoiceAdjustmentDone) ? 'positive' : (isTrue(record.InvoiceAdjustmentRequired) ? 'warning' : 'grey-4')">
                    {{ isTrue(record.InvoiceAdjustmentDone) ? 'Completed' : (isTrue(record.InvoiceAdjustmentRequired) ? 'Pending' : 'N/A') }}
                  </q-badge>
                </div>
              </q-item-section>
            </q-item>

            <!-- Warehouse stock receipt status -->
            <q-item>
              <q-item-section>
                <q-item-label>Warehouse Stock Receipt</q-item-label>
                <q-item-label class="text-body1 text-weight-bold text-primary">
                  {{ isTrue(record.WarehouseActionRequired) ? 'Required' : 'Not Required' }}
                </q-item-label>
                <q-item-label caption v-if="isTrue(record.WarehouseActionRequired) && isTrue(record.WarehouseActionCompleted)">
                  Action: {{ record.WarehouseAction }}
                  <span v-if="record.WarehouseAction === 'Disposed' && record.WarehouseActionDisposedReason"> (Reason: {{ record.WarehouseActionDisposedReason }})</span>
                </q-item-label>
                <q-item-label caption v-else-if="isTrue(record.WarehouseActionRequired)">
                  Return to {{ warehouseName(record.WarehouseCode) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-x-sm">
                  <q-icon
                    v-if="isTrue(record.WarehouseActionRequired)"
                    :name="isTrue(record.WarehouseActionCompleted) ? 'check_circle' : 'pending'"
                    :color="isTrue(record.WarehouseActionCompleted) ? 'positive' : 'warning'"
                    size="24px"
                  />
                  <q-icon v-else name="cancel" color="grey-4" size="24px" />
                  <q-badge :color="isTrue(record.WarehouseActionCompleted) ? 'positive' : (isTrue(record.WarehouseActionRequired) ? 'warning' : 'grey-4')">
                    {{ isTrue(record.WarehouseActionCompleted) ? 'Received' : (isTrue(record.WarehouseActionRequired) ? 'Pending' : 'N/A') }}
                  </q-badge>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <!-- 4. Interactive Action Board -->
      <q-card v-if="hasPendingActions" flat bordered class="bg-orange-1">
        <q-card-section class="q-pa-md">
          <div class="text-subtitle1 text-weight-bold text-orange-9 q-mb-md row items-center q-gutter-x-xs">
            <q-icon name="pending_actions" size="20px" />
            <span>Pending Workflow Actions</span>
          </div>

          <div class="row q-col-gutter-sm">
            <!-- Warehouse Action Button -->
            <div v-if="isTrue(record.WarehouseActionRequired) && !isTrue(record.WarehouseActionCompleted)" class="col-12">
              <q-btn
                unelevated
                color="purple"
                icon="done_all"
                label="Confirm Warehouse Action"
                class="full-width"
                :loading="acting"
                @click="onMarkWarehouse"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Cancel Return Action -->
      <div v-if="canCancel" class="row justify-center q-mt-md">
        <q-btn
          flat
          color="negative"
          icon="cancel"
          label="Cancel Return Record"
          :loading="acting"
          @click="onCancelReturn"
        />
      </div>
    </div>

    <!-- Warehouse Action Dialog -->
    <q-dialog v-model="warehouseDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6 text-weight-bold text-primary">Warehouse Stock Action</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-md q-gutter-y-md">
          <!-- Action Type Select -->
          <q-select
            outlined
            v-model="warehouseActionType"
            :options="['Stocked', 'Disposed']"
            label="Action Type *"
            emit-value
            map-options
          />

          <!-- Storage Name Select (visible only when 'Stocked' is selected) -->
          <q-select
            v-if="warehouseActionType === 'Stocked'"
            outlined
            v-model="warehouseStorageName"
            :options="storageOptions"
            label="Warehouse Storage Name *"
            hint="Select target storage for stocking"
          />

          <!-- Custom Storage Name Input (visible only when 'New Storage Name' is selected) -->
          <q-input
            v-if="warehouseActionType === 'Stocked' && warehouseStorageName === 'New Storage Name'"
            outlined
            v-model="customStorageName"
            label="New Storage Name *"
            placeholder="e.g. Bin A-12, Shelf 3"
            :rules="[val => !!val && val.trim().length > 0 || 'Storage name is required']"
          />

          <!-- Disposal Reason/Comment (visible only when 'Disposed' is selected) -->
          <q-input
            v-if="warehouseActionType === 'Disposed'"
            outlined
            type="textarea"
            v-model="disposalReason"
            label="Disposal Reason *"
            placeholder="e.g. Damaged during transit, Expired"
            :rules="[val => !!val && val.trim().length > 3 || 'Reason is required and must be longer than 3 characters']"
          />
        </q-card-section>

        <q-card-actions align="right" class="text-primary q-pb-md q-px-md">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            unelevated
            color="primary"
            label="Submit"
            :loading="acting"
            :disabled="!isWarehouseFormValid"
            @click="submitWarehouseAction"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useOutletReturns } from '../../../composables/operations/outlets/useOutletReturns.js'

defineOptions({ name: 'OutletReturnsViewPage' })

const route = useRoute()
const $q = useQuasar()
const code = computed(() => route.params.code)

const flow = useOutletReturns()
const {
  loading,
  acting,
  reload,
  getReturnRecord,
  getProgressMeta,
  formatDisplayDate,
  outletName,
  skuName,
  warehouseName,
  warehouseStorages,
  markWarehouseActionCompleted,
  cancelReturn,
  cancel,
  text,
  isTrue
} = flow

const record = computed(() => getReturnRecord(code.value))

const hasPendingActions = computed(() => {
  if (!record.value) return false
  if (text(record.value.Progress) === 'CANCELLED') return false
  return isTrue(record.value.WarehouseActionRequired) && !isTrue(record.value.WarehouseActionCompleted)
})

const canCancel = computed(() => {
  if (!record.value) return false
  return text(record.value.Progress) !== 'CANCELLED' && text(record.value.Progress) !== 'COMPLETED'
})

const warehouseDialog = ref(false)
const warehouseActionType = ref('Stocked')
const warehouseStorageName = ref('_default')
const customStorageName = ref('')
const disposalReason = ref('')

const storageOptions = computed(() => {
  const list = ['_default']
  if (!record.value || !warehouseStorages?.items?.value) {
    list.push('New Storage Name')
    return list
  }

  const whCode = record.value.WarehouseCode
  warehouseStorages.items.value
    .filter(row => text(row.WarehouseCode) === whCode && text(row.StorageName))
    .forEach(row => {
      const name = text(row.StorageName)
      if (!list.includes(name) && name !== 'New Storage Name') list.push(name)
    })
  list.push('New Storage Name')
  return list
})

const isWarehouseFormValid = computed(() => {
  if (!warehouseActionType.value) return false
  if (warehouseActionType.value === 'Disposed') {
    return disposalReason.value && disposalReason.value.trim().length > 3
  }
  if (warehouseActionType.value === 'Stocked') {
    if (warehouseStorageName.value === 'New Storage Name') {
      return customStorageName.value && customStorageName.value.trim().length > 0
    }
    return !!warehouseStorageName.value
  }
  return true
})

function onMarkWarehouse() {
  warehouseActionType.value = 'Stocked'
  warehouseStorageName.value = '_default'
  customStorageName.value = ''
  disposalReason.value = ''
  warehouseDialog.value = true
}

async function submitWarehouseAction() {
  if (!isWarehouseFormValid.value) return
  const finalStorage = warehouseStorageName.value === 'New Storage Name'
    ? customStorageName.value.trim()
    : warehouseStorageName.value

  const ok = await markWarehouseActionCompleted(
    record.value,
    warehouseActionType.value,
    finalStorage,
    warehouseActionType.value === 'Disposed' ? disposalReason.value : ''
  )
  if (ok) {
    warehouseDialog.value = false
  }
}

function onCancelReturn() {
  $q.dialog({
    title: 'Cancel Return Record',
    message: 'Please provide a cancellation reason:',
    prompt: {
      model: '',
      type: 'text',
      isValid: val => val.trim().length > 3
    },
    cancel: true,
    persistent: true
  }).onOk(async (reason) => {
    await cancelReturn(record.value, reason)
  })
}

onMounted(() => {
  reload()
})
</script>
