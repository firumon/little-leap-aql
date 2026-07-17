<template>
  <button
    class="aql-list-switcher-item"
    :class="itemClasses"
    :style="itemStyle"
    v-bind="$attrs"
  >
    <q-icon
      v-if="resolvedIcon"
      :name="resolvedIcon"
      class="aql-list-switcher-item__icon"
    />
    <span v-if="resolvedLabel" class="aql-list-switcher-item__label">
      {{ resolvedLabel }}
    </span>

    <!-- Active glow indicator -->
    <span
      v-if="active"
      class="aql-list-switcher-item__dot"
      :style="activeDotStyle"
    />
  </button>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'SectionsListSwitcherItem', inheritAttrs: false })

const props = defineProps({
  item:   { type: Object,           required: true },
  active: { type: Boolean,          default: false },
  label:  { type: [String, Function], default: '' },
  icon:   { type: [String, Function], default: '' },
  color:  { type: [String, Function], default: 'primary' },
})

// ── Contexts ──
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const resolvedLabel = computed(() => {
  return evaluateProp(props.label, resourceRecord, resourceConfig) || props.item?.label || props.item?.name
})

const resolvedIcon = computed(() => {
  return evaluateProp(props.icon, resourceRecord, resourceConfig) || props.item?.icon || null
})

const resolvedColor = computed(() => {
  return evaluateProp(props.color, resourceRecord, resourceConfig) || props.item?.color || 'primary'
})

const itemClasses = computed(() => {
  const color = resolvedColor.value
  return {
    'aql-list-switcher-item--active':             props.active,
    [`aql-list-switcher-item--active-${color}`]:  props.active,
    'aql-list-switcher-item--inactive':           !props.active,
  }
})

const itemStyle = computed(() => {
  if (!props.active) return {}
  const color = resolvedColor.value
  if (!color || color === 'primary') return {}
  return { '--aql-switcher-active-color': `var(--q-${color}, currentColor)` }
})

const activeDotStyle = computed(() => {
  const color = resolvedColor.value
  return { background: `var(--q-${color}, var(--q-primary))` }
})
</script>
