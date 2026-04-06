<template>
  <tr :class="{ 'stock-row--zero': modelValue === 0 }">
    <td class="text-caption text-grey-8">
      <div class="text-weight-medium">{{ sku }}</div>
      <div v-if="productName" class="text-grey-6" style="font-size:0.7rem">{{ productName }}</div>
    </td>
    <td>
      <q-select
        dense
        use-input
        clearable
        new-value-mode="add-unique"
        :model-value="storageName"
        :options="storageOptions"
        style="min-width: 120px; max-width: 180px"
        @update:model-value="$emit('update:storageName', $event || '')"
      />
    </td>
    <td class="text-right text-caption text-grey-7" style="white-space:nowrap">{{ currentQty }}</td>
    <td>
      <q-input
        dense
        type="number"
        :model-value="modelValue"
        input-class="text-right"
        style="width: 80px"
        @update:model-value="onDeltaChange"
      />
    </td>
    <td>
      <q-input
        dense
        type="number"
        :model-value="newQty"
        input-class="text-right"
        style="width: 80px"
        @update:model-value="onNewQtyChange"
      />
    </td>
    <td>
      <q-btn flat dense round icon="delete" size="sm" color="grey-6" @click="$emit('remove')" />
    </td>
  </tr>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sku:         { type: String,  default: '' },
  productName: { type: String,  default: '' },
  storageName: { type: String,  default: '' },
  storageOptions: { type: Array, default: () => [] },
  currentQty:  { type: Number,  default: 0 },
  modelValue:  { type: Number,  default: 0 }  // delta (QtyChange)
})

const emit = defineEmits(['update:modelValue', 'update:storageName', 'remove'])

// New Qty is always derived — never stored independently
const newQty = computed(() => props.currentQty + (props.modelValue || 0))

function onDeltaChange(val) {
  emit('update:modelValue', val === '' || val === null ? 0 : Number(val))
}

function onNewQtyChange(val) {
  const parsed = val === '' || val === null ? props.currentQty : Number(val)
  emit('update:modelValue', parsed - props.currentQty)
}
</script>

<style scoped>
.stock-row--zero td {
  opacity: 0.45;
}
</style>
