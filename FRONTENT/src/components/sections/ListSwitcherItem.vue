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
    <span v-if="active" class="aql-list-switcher-item__dot" />
  </button>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { resolveCssColor } from 'src/utils/colorHelpers'

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

const itemClasses = computed(() => ({
  'aql-list-switcher-item--active':   props.active,
  'aql-list-switcher-item--inactive': !props.active,
}))

// Active items expose their resolved color as a CSS custom property; custom.scss derives
// the gradient, text/icon color, shadow, and indicator dot from it via color-mix().
const itemStyle = computed(() => {
  if (!props.active) return {}
  return { '--aql-switcher-color': resolveCssColor(resolvedColor.value) }
})
</script>
