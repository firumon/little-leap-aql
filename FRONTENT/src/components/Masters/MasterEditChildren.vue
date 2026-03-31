<template>
  <ChildRecordsTable
    v-for="group in childGroups"
    :key="group.resource.name"
    :title="group.resource.ui?.pageTitle || group.resource.name"
    :records="group.records"
    :fields="group.resolvedFields"
    :status-options="statusOptions"
    class="q-mt-sm"
    @add="$emit('add-child', group.resource.name)"
    @remove="(idx) => $emit('remove-child', group.resource.name, idx)"
    @update-field="(idx, header, val) => $emit('update-child-field', group.resource.name, idx, header, val)"
  />
</template>

<script setup>
import ChildRecordsTable from 'src/components/Masters/ChildRecordsTable.vue'

defineProps({
  childGroups: { type: Array, default: () => [] },
  statusOptions: { type: Array, default: () => [] }
})

defineEmits(['add-child', 'remove-child', 'update-child-field'])
</script>
