<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="row items-center q-mb-sm">
        <div class="text-subtitle2">Allocated Items</div>
        <q-space />
        <q-btn flat dense label="All" @click="$emit('select-all')" />
        <q-btn flat dense label="Clear" @click="$emit('clear')" />
      </div>
      <q-list bordered separator>
        <q-item v-for="row in rows" :key="row.Code" clickable @click="$emit('toggle', row.Code)">
          <q-item-section avatar>
            <q-checkbox :model-value="selectedCodes.includes(row.Code)" @update:model-value="$emit('toggle', row.Code)" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-caption text-weight-medium">{{ row.SKUName }}</q-item-label>
            <q-item-label caption>{{ row.OutletName }} - {{ row.WarehouseCode }} / {{ row.StorageName }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-badge color="primary" :label="String(row.Quantity)" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<script setup>
defineOptions({ name: 'AvailableOrsiPanel' })
defineProps({
  rows: { type: Array, default: () => [] },
  selectedCodes: { type: Array, default: () => [] }
})
defineEmits(['toggle', 'select-all', 'clear'])
</script>
