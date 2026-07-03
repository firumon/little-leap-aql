<template>
  <q-field class="aql-status-toggle" v-bind="fieldAttrs" outlined>
    <template v-slot:control>
      <div class="row no-wrap items-center justify-between full-width">
        <div class="text-subtitle2 text-grey-8">{{ label }}</div>
        <q-toggle
          :model-value="modelValue" :true-value="trueValue" :false-value="falseValue"
          :label="currentToggleLabel" :color="color"
          @update:model-value="onUpdate"
        />
      </div>
    </template>
  </q-field>
</template>

<script setup>
import { computed, useAttrs } from 'vue'

defineOptions({
  name: 'AqlStatusToggle',
  inheritAttrs: false
})

const props = defineProps({
  modelValue: {
    default: null
  },
  label: {
    type: String,
    default: ''
  },
  trueValue: {
    type: [Boolean, String],
    default: 'Active'
  },
  falseValue: {
    type: [Boolean, String],
    default: 'Inactive'
  },
  trueLabel: {
    type: String,
    default: 'Active'
  },
  falseLabel: {
    type: String,
    default: 'Inactive'
  },
  color: {
    type: String,
    default: 'primary'
  }
})

const emit = defineEmits(['update:modelValue'])

const attrs = useAttrs()

const fieldAttrs = computed(getFieldAttrs)
const currentToggleLabel = computed(getCurrentToggleLabel)

function getFieldAttrs() {
  const { class: className, style, ...rest } = attrs
  return rest
}

function getCurrentToggleLabel() {
  return props.modelValue === props.trueValue ? props.trueLabel : props.falseLabel
}

function onUpdate(value) {
  emit('update:modelValue', value)
}
</script>

<style scoped>
.aql-status-toggle :deep(.q-field__control) {
  padding: 0 12px;
}
</style>
