<template>
  <!-- Render custom template if resolved -->
  <component
    :is="activeResolvedComponent"
    v-slot="{ views }"
    v-if="activeResolvedComponent"
    v-bind="activeProps"
    @update:active-view-name="$emit('update:activeViewName', $event)"
  />

  <q-tabs
    v-else-if="activeProps.views && activeProps.views.length"
    :model-value="activeProps.activeViewName"
    :outside-arrows="activeProps.outsideArrows !== false"
    no-caps
    class="aql-view-tabs"
    @update:model-value="$emit('update:activeViewName', $event)"
    :inline-label="activeProps.stacked === false"
  >
    <q-tab
      v-for="view in activeProps.views"
      :key="view.name"
      :name="view.name"
      :icon="resolvedIcon(view)"
      :label="resolvedLabel(view)"
      :no-caps="true"
      :class="tabClasses(view)"
      :style="activeProps.iconSize ? { '--aql-tab-icon-size': activeProps.iconSize } : {}"
    />
  </q-tabs>
</template>

<script setup>
import { computed } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'

defineOptions({ name: 'ViewSwitcher' })

const props = defineProps({
  page: { type: String, default: 'Index' },
  views: { type: Array, default: () => [] },
  activeViewName: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  stacked: { type: Boolean, default: true },
  outsideArrows: { type: Boolean, default: true },
  iconSize: { type: String, default: '' },
  label: { type: [String, Function], default: null },
  icon: { type: [String, Function], default: null }
})

defineEmits(['update:activeViewName'])

// Prepare default data/props
const preparedProps = computed(() => ({
  views: props.views,
  activeViewName: props.activeViewName,
  items: props.items,
  stacked: props.stacked,
  outsideArrows: props.outsideArrows,
  iconSize: props.iconSize,
  label: props.label,
  icon: props.icon
}))

const { resolvedComponent, finalProps, resourceConfig } = useCommonSection({
  sectionName: 'ViewSwitcher',
  page: props.page,
  preparedProps
})

// Overriding criteria: Only allow custom UI modifiers/overrides if listViews is empty (undefined/null/empty string)
const isOverrideAllowed = computed(() => {
  const ui = resourceConfig?.config?.value?.ui
  return !Array.isArray(ui?.listViews)
})

const activeResolvedComponent = computed(() => {
  return isOverrideAllowed.value ? resolvedComponent.value : null
})

const activeProps = computed(() => {
  return isOverrideAllowed.value ? finalProps.value : preparedProps.value
})

function evaluate(val, view) {
  if (typeof val === 'function') {
    return val(view, activeProps.value.items, resourceConfig)
  }
  return val
}

function resolvedLabel(view) {
  const labelVal = activeProps.value.label
  const evaluated = evaluate(labelVal, view)
  return evaluated !== null && evaluated !== undefined ? evaluated : view.name
}

function resolvedIcon(view) {
  const iconVal = activeProps.value.icon
  const evaluated = evaluate(iconVal, view)
  return evaluated !== null && evaluated !== undefined ? evaluated : (view.icon || undefined)
}

function tabClasses(view) {
  const activeColor = view.color || 'primary'
  const isActive = activeProps.value.activeViewName === view.name
  return {
    [`aql-tab--active-${activeColor}`]: isActive,
    'aql-tab--inactive': !isActive
  }
}
</script>
