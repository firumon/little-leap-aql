<template>
  <!-- App-level date control wrapping the stateless abstract/Date primitive.
       Forwards every attribute + slot through unchanged, and defaults an empty
       value to today (YYYY-MM-DD) on mount so create forms start pre-filled. -->
  <AbstractDate
    v-bind="$attrs"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </AbstractDate>
</template>

<script setup>
import { onMounted } from 'vue'
import AbstractDate from 'components/abstract/Date.vue'

defineOptions({ name: 'AppDate', inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

function todayIso () {
  return new Date().toISOString().split('T')[0]
}

onMounted(() => {
  if (props.modelValue === undefined || props.modelValue === null || props.modelValue === '') {
    emit('update:modelValue', todayIso())
  }
})
</script>
