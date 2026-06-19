<template>
  <q-page padding>
    <HeaderPanel
      :title="isEditMode ? 'Edit Warehouse Transfer' : 'New Warehouse Transfer'"
      :subtitle="isEditMode ? 'Update source stock, add or remove transfer quantities, then save or submit.' : 'Select source stock, add transfer quantities, then save or submit.'"
    />

    <StepProgressIndicator v-model="currentStep" :steps="steps" clickable @click-step="goToStep" />

    <q-card v-if="currentStep === 1">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold text-grey-9">Basic Details</div>

        <q-form class="q-gutter-md q-mt-md">
          <q-select
            v-model="form.SourceWarehouseCode"
            outlined emit-value map-options
            :options="warehouseOptions"
            label="Source Warehouse *"
          />

          <q-input v-model="form.Reference" outlined clearable label="Reference" />

          <q-select
            v-model="form.DestinationWarehouseCode"
            outlined clearable emit-value map-options
            :options="destinationWarehouseOptions"
            label="Destination Warehouse"
          />

          <q-list v-if="form.DestinationWarehouseCode" class="bg-teal-1 q-py-sm" bordered>
            <q-item>
              <q-item-section side><q-icon name="bolt" color="teal-8" size="sm" /></q-item-section>
              <q-item-section>
                <q-item-label class="text-subtitle2 text-weight-bold text-teal-10">Instant Fulfill</q-item-label>
                <q-item-label caption>Complete the destination stock movement during submit.</q-item-label>
              </q-item-section>
              <q-item-section side><q-toggle v-model="form.IsInstant" color="teal" /></q-item-section>
            </q-item>
            <template v-if="form.IsInstant">
              <q-separator inset />
              <q-item>
                <q-item-section side><q-icon name="storage" color="teal-8" size="sm" /></q-item-section>
                <q-item-section>
                  <q-item-label class="text-caption text-teal-10 text-weight-bold q-mb-xs">Destination Storage</q-item-label>
                  <q-select
                    v-model="form.InstantDestinationStorageName"
                    :options="instantStorageOptionsWithNew"
                    outlined dense emit-value map-options
                    label="Storage Location"
                    @update:model-value="onInstantStorageChange"
                  >
                    <template v-slot:option="{ itemProps, opt }">
                      <q-item v-bind="itemProps">
                        <q-item-section side v-if="opt.value === '__new__'">
                          <q-icon name="add" color="primary" />
                        </q-item-section>
                        <q-item-section>
                          <q-item-label :class="opt.value === '__new__' ? 'text-primary text-weight-bold' : ''">{{ opt.label }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                </q-item-section>
              </q-item>
            </template>
          </q-list>
        </q-form>
      </q-card-section>

      <q-card-actions align="right" class="bg-grey-2">
        <q-btn color="primary" icon-right="arrow_forward" label="Proceed to Items" :disable="!canProceedBasic" @click="currentStep = 2" />
      </q-card-actions>
    </q-card>

    <q-card v-else-if="currentStep === 2" class="bg-transparent" flat>
      <q-card-section class="q-px-xs bg-white">
        <q-list>
          <q-item>
            <q-item-section >
              <q-item-label>Source Items</q-item-label>
              <q-item-label caption>{{ sourceWarehouseTotalItems }} stock lines, {{ sourceWarehouseTotalQuantity }} available units.</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn-toggle v-model="viewMode" toggle-color="primary" :options="viewOptions" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-section class="q-px-xs">
        <AqlGroupedList
          :items="sourceStockRows"
          :group-key="groupKey"
          :group-label="groupKey"
          :item-key="item => item.TransferItemKey"
          :layout="['label', 'caption', 'caption']"
          :content="[
            itemLabel,
            itemCaption,
            (r) => `Available: ${r.QuantityValue}`
          ]"
          :loading="loading"
          empty-text="No stock found for this source warehouse."
        >
          <template #btn="{ item }">
            <q-input
              :model-value="item.TransferQuantity || ''"
              outlined min="0"
              type="number" input-class="text-center text-bold"
              @update:model-value="value => updateTransferQuantity(item, value)"
              style="width:60px"
            />
          </template>
        </AqlGroupedList>
      </q-card-section>

      <q-card-actions align="between" class="q-pa-md">
        <q-btn flat color="grey-7" icon="arrow_back" label="Basic" @click="currentStep = 1" />
        <q-btn color="primary" icon-right="arrow_forward" label="Proceed to Summary" unelevated :disable="!canProceedItems" @click="currentStep = 3" />
      </q-card-actions>
    </q-card>

    <q-card v-else flat class="bg-transparent">
      <q-card-section class="bg-white">

        <q-list bordered separator class="rounded-borders">
          <q-item>
            <q-item-section>
              <q-item-label caption>Source</q-item-label>
              <q-item-label class="text-weight-bold">{{ warehouseLabel(form.SourceWarehouseCode) }}</q-item-label>
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section>
              <q-item-label caption>Destination</q-item-label>
              <q-item-label class="text-weight-bold">{{ warehouseLabel(form.DestinationWarehouseCode) || 'Not assigned' }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip :color="form.IsInstant ? 'teal' : 'grey-4'" :text-color="form.IsInstant ? 'white' : 'grey-8'">
                {{ form.IsInstant ? 'Instant' : 'Standard' }}
              </q-chip>
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section>
              <q-item-label caption>Reference</q-item-label>
              <q-item-label class="text-weight-bold">{{ form.Reference || 'None' }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

      </q-card-section>

      <q-card-section class="q-px-none">
        <AqlList
          :items="addedItems"
          :item-key="item => item.TransferItemKey"
          label="ProductName"
          :caption="summaryCaption"
          :meta="[item => `Qty: ${item.Quantity}`]"
          :meta-layout="['chip']"
          chip-color="teal-6"
          btn="delete"
          btn-color="negative"
          empty-text="No items selected."
          @click="removeTransferItem"
        />
      </q-card-section>

      <q-card-actions align="between" class="q-px-sm">
        <q-btn flat color="grey-7" icon="arrow_back" label="Items" :disable="saving" @click="currentStep = 2" />
      </q-card-actions>
      <q-card-actions align="between" class="q-px-sm">
        <q-btn outline color="primary" label="Save Draft" :loading="saving" @click="saveTransfer('draft')" />
        <q-btn color="primary" :label="submitLabel" unelevated :loading="saving" @click="saveTransfer('submit')" />
      </q-card-actions>
    </q-card>

  <!-- New Storage dialog -->
  <q-dialog v-model="newInstantStorageDialog.open" persistent>
    <q-card style="min-width: 320px; max-width: 90vw;">
      <q-card-section class="bg-primary text-white row items-center q-py-sm q-px-md">
        <q-icon name="add" class="q-mr-sm" color="white" />
        <span class="text-subtitle1 text-weight-bold text-white">New Storage</span>
        <q-space />
        <q-btn flat round dense icon="close" v-close-popup color="white" />
      </q-card-section>
      <q-card-section class="q-pt-md q-px-md">
        <q-input v-model="newInstantStorageDialog.name" label="Storage Name *" outlined dense autofocus
          :rules="[v => !!v || 'Name is required']" @keyup.enter="confirmNewInstantStorage" />
      </q-card-section>
      <q-card-actions align="right" class="q-pb-md q-pr-md">
        <q-btn flat label="Cancel" color="grey-7" v-close-popup />
        <q-btn unelevated color="primary" label="Add & Select" :disable="!newInstantStorageDialog.name" @click="confirmNewInstantStorage" />
      </q-card-actions>
    </q-card>
  </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useWarehouseTransfers } from '../../../composables/operations/warehouseTransfers/useWarehouseTransfers.js'
import HeaderPanel from 'components/shared/HeaderPanel.vue'
import StepProgressIndicator from 'components/shared/StepProgressIndicator.vue'
import AqlGroupedList from 'components/shared/AqlGroupedList.vue'
import AqlList from 'components/shared/AqlList.vue'
import SectionDividerLabel from "components/shared/SectionDividerLabel.vue";

defineOptions({ name: 'WarehouseTransfersAddPage' })

const nav = useResourceNav()
const flow = useWarehouseTransfers()
const currentStep = ref(1)

const {
  isEditMode,
  loading, saving, viewMode, form, addedItems, warehouseOptions, sourceStockRows, sourceWarehouseTotalItems,
  sourceWarehouseTotalQuantity, canProceedBasic, canProceedItems, submitLabel, groupKey, itemLabel,
  itemCaption, updateTransferQuantity, removeTransferItem, saveTransfer, reload, getStorageOptionsForWarehouse
} = flow

const steps = [
  { name: 1, label: 'Basic', icon: 'assignment' },
  { name: 2, label: 'Items', icon: 'inventory_2' },
  { name: 3, label: 'Summary', icon: 'fact_check' }
]

const viewOptions = [
  { label: 'Storage', value: 'storage' },
  { label: 'Product', value: 'product' }
]

const destinationWarehouseOptions = computed(() =>
  warehouseOptions.value.filter((option) => option.value !== form.value.SourceWarehouseCode)
)

// Instant storage selector
const customInstantStorages = ref([])
const newInstantStorageDialog = ref({ open: false, name: '' })

const instantStorageOptions = computed(() => {
  const whCode = form.value.DestinationWarehouseCode
  const base = whCode ? getStorageOptionsForWarehouse(whCode) : [{ label: '_default', value: '_default' }]
  const existing = new Set(base.map(s => s.value))
  const extras = customInstantStorages.value.filter(s => !existing.has(s)).map(s => ({ label: s, value: s }))
  return [...base, ...extras]
})

const instantStorageOptionsWithNew = computed(() => [
  ...instantStorageOptions.value,
  { label: 'New Storage...', value: '__new__' }
])

function onInstantStorageChange(val) {
  if (val === '__new__') {
    newInstantStorageDialog.value = { open: true, name: '' }
    form.value.InstantDestinationStorageName = '_default'
    return
  }
  form.value.InstantDestinationStorageName = val
}

function confirmNewInstantStorage() {
  const name = newInstantStorageDialog.value.name.trim()
  if (!name) return
  customInstantStorages.value.push(name)
  form.value.InstantDestinationStorageName = name
  newInstantStorageDialog.value = { open: false, name: '' }
}

function goToStep(step) {
  if (step === 1 || (step === 2 && canProceedBasic.value) || (step === 3 && canProceedBasic.value && canProceedItems.value)) {
    currentStep.value = step
  }
}

function warehouseLabel(code) {
  return warehouseOptions.value.find((option) => option.value === code)?.label || code || ''
}

function summaryCaption(item) {
  const variants = (item.VariantValues || []).filter(Boolean).join(' / ')
  return [item.SKUCode, variants, item.StorageLabel].filter(Boolean).join(' - ')
}

onMounted(async () => {
  await reload()
})
</script>

<style scoped>
.wt-add-page {
  max-width: 1100px;
  margin: 0 auto;
}

.wt-card {
  border-radius: 12px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.98);
}
</style>
