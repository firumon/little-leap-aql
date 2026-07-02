<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Fallback card layout -->
  <q-card
    v-else
    :flat="finalProps.flat !== false"
    :bordered="finalProps.bordered !== false"
    :class="['records-card q-mt-sm', finalProps.class]"
  >
    <q-card-section class="q-pa-none">
      <div v-if="loading && !items.length" class="q-py-lg text-center">
        <q-spinner-dots color="primary" size="32px" />
      </div>
      <div v-else-if="!items.length" class="q-py-lg text-center text-grey-6">
        {{ finalProps.emptyMessage || 'No records found' }}
      </div>
      <AqlList
        v-else
        :items="finalProps.items"
        :bordered="false"
        :item-bordered="false"
        :clickable="false"
        item-class="q-pa-none"
        :class="['card-list', { 'q-gutter-sm': finalProps.layout !== 'grid' }]"
        :style="finalProps.listStyle"
      >
        <template #item="{ item: row }">
          <div class="record-card-wrap full-width">
            <component
              :is="resolvedRecord.component"
              :row="row"
              :resolve-primary-text="finalProps.resolvePrimaryText"
              :resolve-secondary-text="finalProps.resolveSecondaryText"
              :record-config="resolvedRecord.config"
              @open-detail="$emit('navigate-to-view', $event)"
            />
            <div v-if="childCountMap[row.Code] && !finalProps.noChildCounts" class="record-children">
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
        </template>
      </AqlList>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

import Loading from 'components/_common/sections/Content/Loading.vue'
import Empty from 'components/_common/sections/Content/Empty.vue'
import RecordComponent from 'components/_common/sections/Content/RecordsRecord.vue'
import AqlList from 'components/shared/AqlList.vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  resolvedFields: { type: Array, default: () => [] },
  childCountMap: { type: Object, default: () => ({}) },
  resourceSlug: { type: String, required: true },
  customUIName: { type: String, required: true },
  recordsConfig: { type: Object, default: () => ({}) },
  page: { type: String, default: 'List' }
})

defineEmits(['navigate-to-view'])

const { scope } = inject('resourceConfig')

const defaultConfig = {
  layout: 'list',
  gridCols: 2,
  bordered: true,
  flat: true,
  class: '',
  noChildCounts: false,
  emptyMessage: undefined
}

const activeConfig = computed(() => ({
  ...defaultConfig,
  ...(props.recordsConfig || {})
}))

const listStyle = computed(() => {
  if (activeConfig.value.layout === 'grid') {
    const cols = activeConfig.value.gridCols || 2
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap: '8px'
    }
  }
  return {}
})

// Check for local overrides using new useSectionResolver
const { resolvedComponent, propModifier, sectionsReady } = useSectionResolver({ sectionName: 'Records', page: props.page })

const resolvedRecord = computed(() => {
  // For record-level overrides we still default to RecordComponent
  return { component: RecordComponent, config: activeConfig.value.record || {} }
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

const preparedProps = computed(() => ({
  items: props.items,
  loading: props.loading,
  resolvedFields: props.resolvedFields,
  childCountMap: props.childCountMap,
  resourceSlug: props.resourceSlug,
  customUIName: props.customUIName,
  recordsConfig: props.recordsConfig,
  flat: activeConfig.value.flat,
  bordered: activeConfig.value.bordered,
  class: activeConfig.value.class,
  emptyMessage: activeConfig.value.emptyMessage,
  layout: activeConfig.value.layout,
  listStyle: listStyle.value,
  noChildCounts: activeConfig.value.noChildCounts,
  resolvePrimaryText,
  resolveSecondaryText
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>

<style scoped>
/* existing styles retained */
.records-card {
  border-radius: 16px;
  border-color: var(--aql-border);
  background: transparent;
  box-shadow: none;
  animation: rise-in 280ms ease-out both;
}

.card-list {
  display: grid;
  grid-template-columns: 1fr;
}

@media (min-width: 600px) {
  .card-list:not([style*="display: grid"]) {
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
