<template>
  <div>
    <SectionDividerLabel :label="title" />
    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <div v-if="!childRecords || !childRecords.length" class="text-grey-7 q-pa-md text-center">
          No records found.
        </div>
        <q-markup-table v-else flat dense class="child-table aql-child-table">
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
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
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
