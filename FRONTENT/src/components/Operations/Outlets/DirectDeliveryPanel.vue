<template>
  <div class="q-mb-md animate-fade-in">
    <q-card flat bordered class="delivery-panel border-green shadow-1 bg-green-0">
      <q-card-section class="q-pa-md">
        <!-- Panel Header -->
        <div class="row items-center q-mb-sm">
          <q-avatar color="green-2" text-color="green-9" size="32px" class="q-mr-sm">
            <q-icon name="local_shipping" size="18px" />
          </q-avatar>
          <div>
            <div class="text-subtitle2 text-bold text-green-9">Direct Delivery Action</div>
            <div class="text-caption text-grey-7">Deliver allocated items to this outlet now.</div>
          </div>
        </div>

        <q-separator class="q-my-sm" />

        <!-- Checkbox list of items -->
        <div class="text-caption text-weight-bold text-grey-8 q-mb-xs">Select Items to Deliver</div>
        <q-list dense class="q-py-none bg-white rounded-borders border-grey q-mb-sm">
          <q-item v-for="item in allocatedItems" :key="item.Code" tag="label" v-ripple class="q-py-xs">
            <q-item-section avatar class="min-width-auto">
              <q-checkbox
                :model-value="selectedItemCodes.includes(item.Code)"
                color="green"
                dense
                @update:model-value="toggleSelection(item.Code)"
              />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-caption text-weight-medium text-grey-9">
                {{ item.SKUName || item.SKU }}
              </q-item-label>
              <q-item-label caption class="text-grey-5">
                Qty: {{ item.Quantity }} | Source: {{ item.WarehouseCode }} ({{ item.StorageName }})
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Comments -->
        <q-input
          v-model="comment"
          type="textarea"
          outlined
          label="Delivery Comment (Optional)"
          class="bg-white rounded-borders q-mb-sm"
        />

        <!-- Action buttons -->
        <div class="row q-gutter-x-sm justify-between no-wrap">
          <div class="row q-gutter-x-xs">
            <q-btn
              outline
              dense
              no-caps
              color="green"
              label="Select All"
              class="q-px-sm text-caption"
              @click="selectAll"
            />
            <q-btn
              outline
              dense
              no-caps
              color="grey-7"
              label="Clear"
              class="q-px-sm text-caption"
              @click="clearAll"
            />
          </div>
          <q-btn
            color="green"
            icon="check"
            label="Mark as Delivered"
            :loading="saving"
            :disable="!selectedItemCodes.length"
            class="shadow-1 font-bold"
            no-caps
            @click="handleSubmit"
          />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

defineOptions({ name: 'DirectDeliveryPanel' })

const props = defineProps({
  allocatedItems: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false }
})

const emit = defineEmits(['deliver'])

const selectedItemCodes = ref([])
const comment = ref('')

function initSelection() {
  selectedItemCodes.value = props.allocatedItems.map(item => item.Code)
}

watch(() => props.allocatedItems, () => {
  initSelection()
}, { deep: true })

onMounted(() => {
  initSelection()
})

function toggleSelection(code) {
  if (selectedItemCodes.value.includes(code)) {
    selectedItemCodes.value = selectedItemCodes.value.filter(c => c !== code)
  } else {
    selectedItemCodes.value.push(code)
  }
}

function selectAll() {
  selectedItemCodes.value = props.allocatedItems.map(item => item.Code)
}

function clearAll() {
  selectedItemCodes.value = []
}

function handleSubmit() {
  const itemsToDeliver = props.allocatedItems.filter(item => selectedItemCodes.value.includes(item.Code))
  emit('deliver', itemsToDeliver, comment.value)
}
</script>

<style scoped>
.delivery-panel {
  border-radius: 12px;
}
.border-green {
  border: 1.5px solid #a5d6a7;
}
.bg-green-0 {
  background-color: #f1fcf2;
}
.text-green-9 {
  color: #1b5e20;
}
.border-grey {
  border: 1px solid #e2e8f0;
}
.min-width-auto {
  min-width: auto;
}
.animate-fade-in {
  animation: fadeIn 0.25s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
