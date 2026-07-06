<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
  />

  <!-- Fallback template handling all page types -->
  <div v-else>
    <!-- 1. Index Page: List Subsection -->
    <List
      v-if="isIndexMode"
      :items="items"
      :resolved-fields="resolvedFields"
      :page="page"
      v-bind="listProps"
      @navigate-to-view="handleNavigateToView"
    />

    <!-- 2. View Page: Details, Parent, Children, Audit Subsections -->
    <div v-else-if="isViewMode">
      <template v-for="secName in activeSectionsOrder" :key="secName">
        <!-- Details Grid -->
        <Details
          v-if="secName === 'Details' && isViewSectionVisible('Details')"
          :details-config="finalProps.detailsConfig"
          :page="page"
        />
        <!-- Parent Link Card -->
        <Parent
          v-else-if="secName === 'Parent' && isViewSectionVisible('Parent') && hasAnyParentRecord"
          :parent-config="finalProps.parentConfig"
        />

        <!-- Child Resources Grids/Tables -->
        <Children
          v-else-if="secName === 'Children' && isViewSectionVisible('Children') && childResources.length"
        />

        <!-- Audit Trail Metadata -->
        <Audit
          v-else-if="secName === 'Audit' && isViewSectionVisible('Audit')"
          :page="page"
        />
      </template>
    </div>

    <!-- 3. Add, Edit Page: Form Subsection (Action pages are excluded by Form internals) -->
    <Form
      v-else-if="isAddMode || isEditMode || isActionMode"
      :code="code"
      :parent-form="parentForm"
      :child-groups="childGroups"
      :resource-name="resourceName"
      :page="page"
      @update:field="(h, v) => $emit('update:field', h, v)"
      @add-child="(s) => $emit('add-child', s)"
      @remove-child="(s, i) => $emit('remove-child', s, i)"
      @update-child-field="(s, i, h, v) => $emit('update-child-field', s, i, h, v)"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import List from './List.vue'
import Form from './Form.vue'
import Details from './Details.vue'
import Parent from './Parent.vue'
import Children from 'components/_common/View/Children.vue'
import Audit from './Audit.vue'

defineOptions({ name: 'CommonContent' })

const props = defineProps({
  page: {
    type: String,
    default: 'Index'
  },
  // List (Index) specific props (if overridden/passed)
  listProps: {
    type: Object,
    default: () => ({})
  },
  // Detail (View) specific props
  detailsConfig: {
    type: Object,
    default: () => ({})
  },
  parentConfig: {
    type: Object,
    default: () => ({})
  },
  // Form (Add / Edit) specific props
  parentForm: {
    type: Object,
    default: () => ({})
  },
  childGroups: {
    type: Array,
    default: () => []
  },
  formFieldRender: {
    type: Function,
    default: null
  },
  // Action specific props
  isMultiOutcome: {
    type: Boolean,
    default: false
  },
  outcomeOptions: {
    type: Array,
    default: () => []
  },
  selectedOutcome: {
    type: String,
    default: ''
  },
  resolvedActionFields: {
    type: Array,
    default: () => []
  },
  actionForm: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([
  'navigate-to-view',
  'update:selectedOutcome',
  'update:field',
  'update:actionField',
  'add-child',
  'remove-child',
  'update-child-field'
])

const nav = useResourceNav()

// Inject shared context safely
const {
  resourceSlug, scope, resolvedFields, customUIName, resourceName, additionalActions, code
} = inject('resourceConfig', {})

const {
  filteredItems: items, record, parentResource, childResources, childRecordsByResource
} = inject('resourceRecord', {})

const isIndexMode = computed(() => props.page?.toLowerCase() === 'index')
const isViewMode = computed(() => props.page?.toLowerCase() === 'view')
const isAddMode = computed(() => props.page?.toLowerCase() === 'add')
const isEditMode = computed(() => props.page?.toLowerCase() === 'edit')
const isActionMode = computed(() => props.page?.toLowerCase() === 'action')

const isMasters = computed(() => scope.value?.toLowerCase() === 'masters')
const isOperations = computed(() => scope.value?.toLowerCase() === 'operations')

const hasAnyParentRecord = computed(() => {
  const pKeys = record.value?._Parents || []
  return pKeys.some(key => !!record.value?.[key])
})

// Build prepared props dynamically for any custom logic overrides
const preparedProps = computed(() => ({
  page: props.page,
  items: items.value,
  resolvedFields: resolvedFields.value,
  record: record.value,
  parentForm: props.parentForm,
  childGroups: props.childGroups,
  detailsConfig: props.detailsConfig,
  parentConfig: props.parentConfig,
  isMultiOutcome: props.isMultiOutcome,
  outcomeOptions: props.outcomeOptions,
  selectedOutcome: props.selectedOutcome,
  resolvedActionFields: props.resolvedActionFields,
  actionForm: props.actionForm,
  order: ['Details', 'Parent', 'Children', 'Audit'],
  hide: []
}))

// Resolve own local override via useCommonSection wrapper
const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'Content',
  page: props.page,
  preparedProps
})

const activeSectionsOrder = computed(() => {
  return finalProps.value.order || ['Details', 'Parent', 'Children', 'Audit']
})

function isViewSectionVisible(secName) {
  if (finalProps.value.hide?.includes(secName)) return false

  if (secName === 'Parent') {
    return hasAnyParentRecord.value
  }
  if (secName === 'Children') {
    if (resourceName.value === 'Products') return false
    return !!childResources.value?.length
  }
  if (secName === 'Audit') {
    return isMasters.value
  }
  return true
}

function handleNavigateToView(item) {
  emit('navigate-to-view', item)
  nav.goTo('view', { code: item.Code || item })
}
</script>
