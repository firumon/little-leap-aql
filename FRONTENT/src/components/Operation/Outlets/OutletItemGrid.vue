<template>
  <q-markup-table flat bordered dense>
    <thead>
      <tr>
        <th>SKU</th>
        <th v-if="showStorage">Storage</th>
        <th v-for="col in quantityColumns" :key="col.name">{{ col.label }}</th>
        <th v-if="showRemarks">Remarks</th>
        <th v-if="editable">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, index) in items" :key="row.Code || index">
        <td>
          <q-select
            v-if="skuOptions.length"
            :model-value="row.SKU"
            :options="filteredSkuOptions"
            dense
            borderless
            emit-value
            map-options
            use-input
            input-debounce="0"
            :readonly="!editable"
            @filter="filterSkuOptions"
            @update:model-value="value => update(index, { SKU: value })"
          />
          <q-input
            v-else
            :model-value="row.SKU"
            dense
            borderless
            :readonly="!editable"
            @update:model-value="value => update(index, { SKU: value })"
          />
        </td>
        <td v-if="showStorage">
          <q-input
            :model-value="row.StorageName || '_default'"
            dense
            borderless
            :readonly="!editable"
            @update:model-value="value => update(index, { StorageName: value })"
          />
        </td>
        <td v-for="col in quantityColumns" :key="col.name">
          <q-input
            :model-value="row[col.name]"
            type="number"
            dense
            borderless
            :readonly="!editable || col.readonly"
            @update:model-value="value => update(index, { [col.name]: Number(value) })"
          />
        </td>
        <td v-if="showRemarks">
          <q-input
            :model-value="row.Remarks"
            dense
            borderless
            :readonly="!editable"
            @update:model-value="value => update(index, { Remarks: value })"
          />
        </td>
        <td v-if="editable">
          <q-btn dense flat round icon="delete" color="negative" @click="$emit('remove:item', index)" />
        </td>
      </tr>
    </tbody>
  </q-markup-table>
</template>

<script setup>
import { ref, watch } from 'vue'

defineOptions({ name: 'OutletItemGrid' })

const props = defineProps({
  items: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
  showStorage: { type: Boolean, default: false },
  showRemarks: { type: Boolean, default: false },
  skuOptions: { type: Array, default: () => [] },
  quantityColumns: { type: Array, default: () => [{ name: 'Quantity', label: 'Quantity' }] }
})

const emit = defineEmits(['update:item', 'remove:item'])
const filteredSkuOptions = ref(props.skuOptions)

watch(() => props.skuOptions, (value) => { filteredSkuOptions.value = value }, { immediate: true })

function filterSkuOptions(value, updateFilter) {
  updateFilter(() => {
    const needle = String(value || '').toLowerCase()
    filteredSkuOptions.value = !needle
      ? props.skuOptions
      : props.skuOptions.filter(option => String(option.label || '').toLowerCase().includes(needle))
  })
}

function update(index, patch) { emit('update:item', index, patch) }
</script>
