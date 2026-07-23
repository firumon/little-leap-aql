<template>
  <div v-if="!childRecords?.length" class="text-grey-7 text-center q-py-md">No records</div>
  <q-card v-else flat bordered class="page-card aql-premium-gradient-card">
    <q-card-section>
      <q-markup-table flat dense class="child-table aql-child-table">
        <thead>
          <tr>
            <th class="text-left">Code</th>
            <th v-for="field in fields" :key="field.header" class="text-left">{{ field.label }}</th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="compact-row">
          <tr
            v-for="record in childRecords"
            :key="record.Code"
            class="cursor-pointer"
            @click="$emit('view-child', childResource, record.Code)"
          >
            <td class="text-left">{{ record.Code }}</td>
            <td v-for="field in fields" :key="field.header" class="text-left">
              {{ cellValue(record, field) }}
            </td>
          </tr>
        </TransitionGroup>
      </q-markup-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
/**
 * INVARIANT: leaf child-grid renderer only. Never renders an audit trail
 * (ViewAudit / ViewRecordWithAudit); audit is emitted exclusively by the
 * top-level 'Audit' ordered section in View.vue.
 */
defineOptions({ name: 'ContentsViewChildCompact', inheritAttrs: false })

defineProps({
  childResource: { type: Object, required: true },
  childRecords: { type: Array, default: () => [] },
  fields: { type: Array, default: () => [] }
})

defineEmits(['view-child'])

function cellValue(record, field) {
  const val = record?.[field.header]
  if (field.type === 'file') return val ? '[File]' : '-'
  if (val && typeof val === 'object') {
    if (val.Name != null) return `${val.Name} (${val.Code})`
    if (val.Code != null) return `${val.Code}`
    return '-'
  }
  return val ?? '-'
}
</script>

<style scoped>
.compact-row-enter-active,
.compact-row-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.compact-row-enter-from,
.compact-row-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
