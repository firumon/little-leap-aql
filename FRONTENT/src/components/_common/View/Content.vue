<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Fallback template -->
  <div v-else class="view-content q-gutter-y-md">
    <template v-for="secName in activeSectionsOrder" :key="secName">
      <!-- 1. Record Details Grid -->
      <Details
        v-if="secName === 'Details' && isSectionVisible('Details')"
        :details-config="finalProps.detailsConfig"
        :page="page"
      />

      <!-- 2. Parent Link Card (if in Operations scope or if parent exists) -->
      <Parent
        v-else-if="secName === 'Parent' && isSectionVisible('Parent') && parentRecord"
        :parent-config="finalProps.parentConfig"
        :page="page"
      />

      <!-- 3. Child Resources Grids/Tables -->
      <Children
        v-else-if="secName === 'Children' && isSectionVisible('Children') && childResources.length"
        :child-resources="childResources"
        :child-records-by-resource="childRecordsByResource"
        :additional-actions="additionalActions"
        :page="page"
      />

      <!-- 4. Audit Trail Metadata (if in Masters scope) -->
      <Audit
        v-else-if="secName === 'Audit' && isSectionVisible('Audit')"
        :page="page"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'
import Details from 'components/_common/sections/Content/Details.vue'
import Parent from 'components/_common/sections/Content/Parent.vue'
import Children from 'components/_common/View/Children.vue'
import Audit from 'components/_common/sections/Content/Audit.vue'

defineOptions({ name: 'ViewContent' })

const props = defineProps({
  page: { type: String, default: 'View' }
})

const { resourceSlug, scope, customUIName, config, additionalActions } = inject('resourceConfig')
const {
  record, parentResource, childResources, childRecordsByResource
} = inject('resourceRecord')

const isMasters = computed(() => scope.value?.toLowerCase() === 'masters')
const isOperations = computed(() => scope.value?.toLowerCase() === 'operations')

const parentRecord = computed(() => {
  const pKeys = record.value?._Parents || []
  if (pKeys.length) return record.value?.[pKeys[0]] || null
  return null
})

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'Content',
  page: props.page
})

const preparedProps = computed(() => ({
  detailsConfig: {},
  parentConfig: {},
  childrenConfig: {},
  auditConfig: {},
  order: ['Details', 'Parent', 'Children', 'Audit'],
  hide: []
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))

const activeSectionsOrder = computed(() => {
  return finalProps.value.order || ['Details', 'Parent', 'Children', 'Audit']
})

function isSectionVisible(secName) {
  if (finalProps.value.hide?.includes(secName)) return false

  if (secName === 'Parent') {
    return isOperations.value && !!parentRecord.value
  }
  if (secName === 'Children') {
    return !!childResources.value?.length
  }
  if (secName === 'Audit') {
    return isMasters.value
  }
  return true
}
</script>
