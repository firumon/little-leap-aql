<template>
  <q-card flat bordered class="records-card q-mt-sm">
    <q-card-section class="q-pa-sm q-pa-md">
      <div v-if="!sectionsReady" class="q-py-lg text-center">
        <q-spinner-dots color="primary" size="32px" />
      </div>
      <component v-else-if="loading" :is="sections.ListRecordsLoading" />
      <component v-else-if="!items.length" :is="sections.ListRecordsEmpty" />
      <div v-else class="card-list q-gutter-sm">
        <div v-for="row in items" :key="row.Code" class="record-card-wrap">
          <component
            :is="sections.ListRecordsRecord"
            :row="row"
            :resolve-primary-text="resolvePrimaryText"
            :resolve-secondary-text="resolveSecondaryText"
            @open-detail="$emit('navigate-to-view', $event)"
          />
          <div v-if="childCountMap[row.Code]" class="record-children">
            <q-badge
              v-for="(count, childName) in childCountMap[row.Code]"
              :key="childName"
              outline
              color="primary"
              class="q-mr-xs"
            >
              {{ count }} {{ childName }}
            </q-badge>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/useSectionResolver'
import OperationListRecordsLoading from './OperationListRecordsLoading.vue'
import OperationListRecordsEmpty from './OperationListRecordsEmpty.vue'
import OperationListRecordsRecord from './OperationListRecordsRecord.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  resolvedFields: { type: Array, default: () => [] },
  childCountMap: { type: Object, default: () => ({}) },
  resourceSlug: { type: String, required: true },
  customUIName: { type: String, required: true }
})

defineEmits(['navigate-to-view'])

const { sections, sectionsReady } = useSectionResolver({
  scope: 'operations',
  resourceSlug: computed(() => props.resourceSlug),
  customUIName: computed(() => props.customUIName),
  sectionDefs: {
    ListRecordsLoading: OperationListRecordsLoading,
    ListRecordsEmpty: OperationListRecordsEmpty,
    ListRecordsRecord: OperationListRecordsRecord,
  }
})

function resolvePrimaryText(row) {
  if (!row || typeof row !== 'object') return '-'
  if (row.Name) return row.Name
  const firstFilled = props.resolvedFields.find((field) => {
    const value = row[field.header]
    return value !== undefined && value !== null && value.toString().trim() !== '' && field.header !== 'Status'
  })
  return firstFilled ? row[firstFilled.header] : '-'
}

function resolveSecondaryText(row) {
  if (!row || typeof row !== 'object') return ''
  const field = props.resolvedFields.find((entry) => {
    if (entry.header === 'Status') return false
    if (row.Name && entry.header === 'Name') return false
    const value = row[entry.header]
    return value !== undefined && value !== null && value.toString().trim() !== ''
  })
  return field ? row[field.header] : ''
}
</script>

<style scoped>
.records-card {
  border-radius: 16px;
  border-color: var(--operation-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.92);
  animation: rise-in 280ms ease-out both;
}

.card-list {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 600px) {
  .card-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.record-card-wrap {
  display: grid;
  gap: 6px;
}

.record-children {
  margin-top: -2px;
  padding-left: 8px;
}

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
