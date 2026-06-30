<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @update:active-view-name="$emit('update:activeViewName', $event)"
  />

  <q-tabs
    v-else-if="finalProps.views && finalProps.views.length"
    :model-value="finalProps.activeViewName"
    :outside-arrows="resolvedConfig.outsideArrows !== false"
    no-caps
    class="aql-view-tabs"
    @update:model-value="$emit('update:activeViewName', $event)"
    :inline-label="resolvedConfig.stacked === false"
  >
    <q-tab
      v-for="view in finalProps.views"
      :key="view.name"
      :name="view.name"
      :icon="resolvedIcon(view)"
      :label="resolvedLabel(view)"
      :no-caps="true"
      :class="tabClasses(view)"
      :style="resolvedConfig.iconSize ? { '--aql-tab-icon-size': resolvedConfig.iconSize } : {}"
    />
  </q-tabs>
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'ViewSwitcher' })

const props = defineProps({
  views: {
    type: Array,
    default: () => []
  },
  activeViewName: {
    type: String,
    default: ''
  },
  items: {
    type: Array,
    default: () => []
  },
  resourceConfig: {
    type: Object,
    default: () => ({})
  },
  viewSwitcherConfig: {
    type: Object,
    default: null
  },
  page: {
    type: String,
    default: 'Index'
  }
})

defineEmits(['update:activeViewName'])

// Resolve own local override
const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'ViewSwitcher',
  page: props.page
})

// Prepare default data/props
const preparedProps = computed(() => ({
  views: props.views,
  activeViewName: props.activeViewName,
  items: props.items,
  resourceConfig: props.resourceConfig,
  viewSwitcherConfig: props.viewSwitcherConfig
}))

const finalProps = computed(() => propModifier.value(preparedProps.value))

// Default configuration options
const defaultConfig = {
  label: null,
  icon: null,
  stacked: true,
  outsideArrows: true,
  iconSize: undefined
}

const resolvedConfig = computed(() => {
  return {
    ...defaultConfig,
    ...(finalProps.value.viewSwitcherConfig || {})
  }
})

function evaluate(val, view) {
  if (typeof val === 'function') {
    return val(view, finalProps.value.items, finalProps.value.resourceConfig)
  }
  return val
}

function resolvedLabel(view) {
  const labelVal = resolvedConfig.value.label !== null ? resolvedConfig.value.label : null
  const evaluated = evaluate(labelVal, view)
  return evaluated !== null ? evaluated : view.name
}

function resolvedIcon(view) {
  const iconVal = resolvedConfig.value.icon !== null ? resolvedConfig.value.icon : null
  const evaluated = evaluate(iconVal, view)
  return evaluated !== null ? evaluated : (view.icon || undefined)
}

function tabClasses(view) {
  const activeColor = view.color || 'primary'
  const isActive = finalProps.value.activeViewName === view.name
  return {
    [`aql-tab--active-${activeColor}`]: isActive,
    'aql-tab--inactive': !isActive
  }
}
</script>
