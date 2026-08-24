<template>
  <div class="row items-center no-wrap q-col-gutter-sm">
    <div class="col">
      <div class="text-subtitle2 text-weight-medium">{{ title }}</div>
      <div v-if="description" class="text-caption text-grey-7">{{ description }}</div>
    </div>
    <div class="col-auto">
      <q-toggle
        v-model="model"
        :color="color"
        :disable="disable"
        v-bind="toggleAttrs"
      />
    </div>
  </div>
</template>

<script setup>
// A titled toggle ROW. Renders the row only — no card, no padding — so it drops into any
// card, dialog or section the caller already has.
import { computed } from 'vue'

defineOptions({ name: 'FieldToggleitemAdd', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

const title = computed(() => props.config?.label ?? props.config?.title ?? props.header ?? '')
const description = computed(() => props.config?.caption ?? props.config?.description ?? '')
const color = computed(() => props.config?.color || 'primary')
const disable = computed(() => props.config?.disable === true)

// The row owns label, caption, colour and disable — passing them on would print the label
// a second time beside the switch.
const toggleAttrs = computed(() => {
  const { label, title: _t, caption, description: _d, color: _c, disable: _x, ...rest } = props.config || {}
  return rest
})
</script>
