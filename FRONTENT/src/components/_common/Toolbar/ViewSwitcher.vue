<template>
  <q-tabs
    v-if="views.length"
    :model-value="activeViewName"
    :outside-arrows="resolvedConfig.outsideArrows !== false"
    no-caps
    class="aql-view-tabs"
    @update:model-value="$emit('update:activeViewName', $event)"
    :inline-label="resolvedConfig.stacked === false"
  >
    <q-tab
      v-for="view in views"
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
  }
})

defineEmits(['update:activeViewName'])

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
    ...(props.viewSwitcherConfig || {})
  }
})

function evaluate(val, view) {
  if (typeof val === 'function') {
    return val(view, props.items, props.resourceConfig)
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
  const isActive = props.activeViewName === view.name
  return {
    [`aql-tab--active-${activeColor}`]: isActive,
    'aql-tab--inactive': !isActive
  }
}
</script>
