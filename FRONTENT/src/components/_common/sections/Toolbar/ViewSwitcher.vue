<template>
  <!-- Render custom template if resolved -->
  <component
    :is="resolvedComponent"
    v-slot="{ views }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @update:active-view-name="$emit('update:activeViewName', $event)"
  />

  <q-tabs
    v-else-if="finalProps.views && finalProps.views.length"
    :model-value="finalProps.activeViewName"
    :outside-arrows="finalProps.outsideArrows !== false"
    no-caps
    class="aql-view-tabs"
    @update:model-value="$emit('update:activeViewName', $event)"
    :inline-label="finalProps.stacked === false"
  >
    <q-tab
      v-for="view in finalProps.views"
      :key="view.name"
      :name="view.name"
      :icon="resolvedIcon(view)"
      :label="resolvedLabel(view)"
      :no-caps="true"
      :class="tabClasses(view)"
      :style="finalProps.iconSize ? { '--aql-tab-icon-size': finalProps.iconSize } : {}"
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

function evaluate(val, view) {
  if (typeof val === 'function') {
    return val(view, finalProps.value.items, resourceConfig)
  }
  return val
}

function resolvedLabel(view) {
  const labelVal = finalProps.value.label
  const evaluated = evaluate(labelVal, view)
  return evaluated !== null && evaluated !== undefined ? evaluated : view.name
}

function resolvedIcon(view) {
  const iconVal = finalProps.value.icon
  const evaluated = evaluate(iconVal, view)
  return evaluated !== null && evaluated !== undefined ? evaluated : (view.icon || undefined)
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
