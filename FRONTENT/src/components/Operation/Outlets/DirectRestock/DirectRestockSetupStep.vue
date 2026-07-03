<template>
  <q-card>
    <q-card-section>
      <!-- Warehouse Select (Hidden if only one warehouse option is available) -->
      <div v-if="warehouseOptions.length > 1" class="q-mb-lg animate-fade-in">
        <div class="text-subtitle2 text-grey-8 q-mb-xs">Select Source Warehouse</div>
        <q-select
          :model-value="selectedWarehouseCode"
          :options="warehouseOptions"
          emit-value
          map-options
          outlined
          dense
          options-dense
          placeholder="Choose Warehouse..."
          class="bg-white rounded-borders"
          @update:model-value="$emit('select-warehouse', $event)"
        >
          <template #prepend>
            <q-icon name="local_shipping" color="primary" />
          </template>
        </q-select>
      </div>

      <!-- Active Warehouse Info Header -->
      <q-chip v-else-if="warehouseOptions.length === 1" square color="blue-1" text-color="blue-9" icon="local_shipping" class="full-width text-caption q-pa-lg border-blue" >
        <div class="text-caption text-weight-medium text-blue-9">
          Sourcing from Warehouse: <span class="text-bold">{{ warehouseOptions[0].label }}</span>
        </div>
      </q-chip>

    </q-card-section>
    <q-card-section class="q-pt-none">
      <!-- Outlet Selection -->
      <div class="text-subtitle2 text-grey-8">Select Target Outlet</div>
      <div class="text-caption text-grey-6 q-mb-lg">Tap an outlet to begin restocking.</div>

      <AqlList :items="outletOptions" item-key="value" label="label" icon="store" icon-color="primary" clickable dense @click="item => $emit('select-outlet', item.value)"/>
    </q-card-section>
  </q-card>
</template>

<script setup>
import AqlList from '../../../shared/AqlList.vue'

defineOptions({ name: 'DirectRestockSetupStep' })

const props = defineProps({
  warehouseOptions: { type: Array, default: () => [] },
  outletOptions: { type: Array, default: () => [] },
  selectedWarehouseCode: { type: String, default: '' },
  selectedOutletCode: { type: String, default: '' }
})

const emit = defineEmits(['select-warehouse', 'select-outlet'])
</script>

<style scoped>
.border-blue {
  border: 1px solid #90caf9;
}
.text-blue-9 {
  color: #0d47a1;
}
.animate-fade-in {
  animation: fadeIn 0.2s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
