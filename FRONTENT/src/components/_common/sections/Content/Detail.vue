<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Fallback card layout -->
  <q-card v-else flat bordered class="detail-card q-mt-sm">
    <q-card-section class="q-pa-md">
      <div class="section-title">{{ activeConfig.title }}</div>
      <div class="detail-grid" :style="finalProps.gridStyle">
        <div
          v-for="field in finalProps.finalFields"
          :key="field.header"
          class="detail-item"
        >
          <div class="detail-key-wrapper">
            <span class="detail-key">{{ field.label }}</span>
          </div>
          <div class="detail-val-wrapper">
            <component
              v-if="detailItemRender && typeof detailItemRender === 'function'"
              :is="detailItemRender(field, record)"
              :field="field"
              :record="record"
              :resource-name="resourceName"
            >
              <template v-if="field.type === 'file' && record?.[field.header]">
                <AqlFilePreviewCard
                  class="full-width"
                  style="max-width: 280px"
                  :uuid="record[field.header]"
                  :resource-name="resourceName"
                  :column-name="field.header"
                />
              </template>
              <template v-else>
                {{ record?.[field.header] || '-' }}
              </template>
            </component>
            <template v-else>
              <template v-if="field.type === 'file' && record?.[field.header]">
                <AqlFilePreviewCard
                  class="full-width"
                  style="max-width: 280px"
                  :uuid="record[field.header]"
                  :resource-name="resourceName"
                  :column-name="field.header"
                />
              </template>
              <template v-else>
                <span class="detail-val">{{ record?.[field.header] || '-' }}</span>
              </template>
            </template>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import AqlFilePreviewCard from 'components/shared/AqlFilePreviewCard.vue'
import { deriveActionStampHeaders, filterDetailFields } from 'src/utils/appHelpers'

defineOptions({ name: 'CommonDetail' })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  resolvedFields: { type: Array, default: () => [] },
  resourceName: { type: String, default: '' },
  detailsConfig: { type: Object, default: () => ({}) },
  detailItemRender: { type: Function, default: null },
  page: { type: String, default: 'View' }
})

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Detail',
  page: props.page
})

const actionStampHeaders = computed(() => {
  const config = inject('resourceConfig', {})
  return deriveActionStampHeaders(config.additionalActions?.value || [])
})

const detailFields = computed(() => {
  return filterDetailFields(props.resolvedFields, actionStampHeaders.value)
})

const activeConfig = computed(() => ({
  title: 'Details',
  fields: null,
  fieldLabels: {},
  columns: 1,
  ...(props.detailsConfig || {})
}))

const finalFields = computed(() => {
  const baseFields = detailFields.value
  let targetFields = []

  if (activeConfig.value.fields) {
    targetFields = activeConfig.value.fields.map((fieldKey) => {
      const found = props.resolvedFields.find((f) => f.header === fieldKey)
      if (found) return found
      return {
        header: fieldKey,
        label: fieldKey.replace(/([a-z])([A-Z])/g, '$1 $2'),
        type: 'text'
      }
    })
  } else {
    targetFields = baseFields
  }

  return targetFields.map((f) => {
    const customLabel = activeConfig.value.fieldLabels[f.header]
    return {
      ...f,
      label: customLabel !== undefined ? customLabel : f.label
    }
  })
})

const gridStyle = computed(() => {
  const cols = activeConfig.value.columns || 1
  if (cols > 1) {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap: '16px 24px'
    }
  }
  return {
    display: 'grid',
    gap: '0'
  }
})

const preparedProps = computed(() => ({
  detailsConfig: props.detailsConfig,
  record: props.record,
  resourceName: props.resourceName,
  finalFields: finalFields.value,
  gridStyle: gridStyle.value
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>

<style scoped>
.detail-card {
  border-radius: 8px;
  border-color: var(--aql-border);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%);
  animation: rise-in 280ms ease-out both;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: '';
  width: 3px;
  height: 16px;
  background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%);
  border-radius: 2px;
}

.detail-grid {
  display: grid;
  gap: 0;
}

.detail-item {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 16px;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px dashed #e2e8f0;
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-key-wrapper {
  display: flex;
  align-items: center;
}

.detail-key {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.detail-val-wrapper {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
}

.detail-val {
  color: #1f2937;
  font-size: 13px;
  font-weight: 500;
  text-align: right;
  word-break: break-word;
  max-width: 100%;
  line-height: 1.4;
}

@keyframes rise-in {
  0% { transform: translateY(10px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
