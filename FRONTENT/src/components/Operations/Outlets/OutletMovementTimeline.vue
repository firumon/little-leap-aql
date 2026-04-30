<template><q-timeline color="primary"><q-timeline-entry v-for="row in movements" :key="row.Code" :title="`${row.ReferenceType} · ${row.QtyChange}`" :subtitle="row.MovementDate || row.CreatedAt"><div class="text-caption">{{ row.Code }} · {{ row.SKU }} · {{ row.StorageName || '_default' }} · {{ row.ReferenceCode }}</div></q-timeline-entry></q-timeline></template>
<script setup>
defineOptions({ name: 'OutletMovementTimeline' })
defineProps({ movements: { type: Array, default: () => [] } })
</script>
