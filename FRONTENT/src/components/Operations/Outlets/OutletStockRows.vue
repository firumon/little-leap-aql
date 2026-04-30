<template><q-list bordered separator><q-item v-for="row in rows" :key="row.Code || `${row.OutletCode}-${row.StorageName}-${row.SKU}`" clickable @click="$emit('select', row)"><q-item-section><q-item-label>{{ skuLabel(row.SKU) }}</q-item-label><q-item-label caption>{{ outletLabel(row.OutletCode) }} · {{ row.StorageName || '_default' }}</q-item-label></q-item-section><q-item-section side><q-badge color="primary">{{ row.Quantity }}</q-badge></q-item-section></q-item><q-item v-if="!rows.length"><q-item-section class="text-grey text-center">No outlet stock rows.</q-item-section></q-item></q-list></template>
<script setup>
defineOptions({ name: 'OutletStockRows' })
defineProps({ rows: { type: Array, default: () => [] }, skuLabel: { type: Function, default: v => v }, outletLabel: { type: Function, default: v => v } })
defineEmits(['select'])
</script>
