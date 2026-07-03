<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <div v-else>
    <SectionDividerLabel :label="activeConfig.title" />
    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <div class="aql-detail-grid" :style="finalProps.gridStyle">
          <div v-for="field in finalProps.finalFields" :key="field.header" class="aql-detail-line items-center">
            <span class="aql-detail-key">{{ field.label }}</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end">
              <template v-if="field.type === 'file' && finalProps.record?.[field.header]">
                <AqlFilePreviewCard
                  class="full-width"
                  style="max-width: 280px"
                  :uuid="finalProps.record[field.header]"
                  :resource-name="finalProps.resourceName"
                  :column-name="field.header"
                />
              </template>
              <template v-else>
                {{ finalProps.record?.[field.header] || '-' }}
              </template>
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import AqlFilePreviewCard from 'components/shared/AqlFilePreviewCard.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { deriveActionStampHeaders, filterDetailFields } from 'src/utils/appHelpers'

defineOptions({ name: 'CommonDetails' })

const props = defineProps({
  detailsConfig: {
    type: Object,
    default: () => ({})
  },
  page: {
    type: String,
    default: 'View'
  }
})

const { additionalActions, resolvedFields, resourceName } = inject('resourceConfig')
const { record } = inject('resourceRecord')

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Details',
  page: props.page
})

const actionStampHeaders = computed(() => {
  return deriveActionStampHeaders(additionalActions.value || [])
})

const detailFields = computed(() => {
  return filterDetailFields(resolvedFields.value, actionStampHeaders.value)
})

const activeConfig = computed(() => {
  return {
    title: 'Details',
    fields: null,
    fieldLabels: {},
    columns: 1,
    ...(props.detailsConfig || {})
  }
})

const finalFields = computed(() => {
  const baseFields = detailFields.value
  let targetFields = []
  if (activeConfig.value.fields) {
    targetFields = activeConfig.value.fields.map((fieldKey) => {
      const found = resolvedFields.value.find((f) => f.header === fieldKey)
      if (found) return found
      return { header: fieldKey, label: fieldKey.replace(/([a-z])([A-Z])/g, '$1 $2'), type: 'text' }
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
      gap: '0px 24px'
    }
  }
  return {
    display: 'grid',
    gap: '0'
  }
})

const preparedProps = computed(() => ({
  detailsConfig: props.detailsConfig,
  record: record.value,
  resourceName: resourceName.value,
  finalFields: finalFields.value,
  gridStyle: gridStyle.value
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
