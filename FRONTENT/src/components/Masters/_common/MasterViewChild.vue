<template>
  <q-card flat bordered class="page-card q-mt-sm">
    <q-card-section>
      <div class="section-title">{{ title }}</div>
      <div v-if="!childRecords || !childRecords.length" class="text-grey-7 q-pa-md text-center">
        No records found.
      </div>
      <q-markup-table v-else flat dense class="child-table">
        <thead>
          <tr>
            <th>Code</th>
            <th v-for="field in fields" :key="field.header">{{ field.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in childRecords" :key="record.Code" @click="$emit('view-child', childResource, record.Code)" class="cursor-pointer">
            <td>{{ record.Code }}</td>
            <td v-for="field in fields" :key="field.header">{{ record[field.header] }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { resolveChildFields, resolveChildTitle } from 'src/utils/appHelpers'

const props = defineProps({
  childResource: { type: Object, required: true },
  childRecords: { type: Array, default: () => [] },
  additionalActions: { type: Array, default: () => [] }
})

defineEmits(['view-child'])

const title = computed(() => resolveChildTitle(props.childResource))
const fields = computed(() => resolveChildFields(props.childResource))
</script>

<style scoped>
.page-card {
  border-radius: 16px;
  border-color: var(--master-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.95);
  animation: rise-in 280ms ease-out both;
}
.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 12px;
}
.child-table th {
  text-align: left;
  font-weight: 600;
  color: #475569;
}
.child-table tbody tr:hover {
  background-color: #f1f5f9;
}
@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
