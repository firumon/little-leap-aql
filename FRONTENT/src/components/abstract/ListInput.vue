<template>
  <q-input
    :model-value="currentValue"
    v-bind="resolvedProps"
    @update:model-value="onInputUpdate"
    @click.stop
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { QInput } from 'quasar'
import { getItemVal } from 'components/abstract/ListCheckbox.vue'

defineOptions({ name: 'ListInput', inheritAttrs: false })

const model = defineModel({ default: undefined })

const props = defineProps({
  item: { type: [Object, String, Number, Boolean], required: true },
  input: { type: [Boolean, String, Object, Function], default: true },
  inputProps: { type: [Object, Function], default: () => ({}) },
  inputLabel: { type: [String, Number, Function], default: null },
  inputKey: { type: [String, Number, Function], default: null },
  inputValue: { type: [String, Number, Function], default: null },
  val: { type: [String, Number, Function], default: null },
  itemKey: { type: [String, Function], default: 'Code' },
  dense: { type: Boolean, default: false }
})

const emit = defineEmits(['input-change'])

const internalState = ref({})

const effectiveKeyProp = computed(() => props.inputKey || props.itemKey || 'Code')

const itemKeyVal = computed(() => getItemVal(props.item, props.val, effectiveKeyProp.value))

const targetField = computed(() => {
  if (props.inputValue !== null && props.inputValue !== undefined && props.inputValue !== '') {
    return props.inputValue
  }
  if (typeof props.input === 'string' && props.input !== '') {
    return props.input
  }
  if (typeof props.val === 'string' && props.val !== '') {
    return props.val
  }
  return 'value'
})

function hasCustomModel() {
  return model.value !== undefined && model.value !== null && typeof model.value === 'object' && !Array.isArray(model.value)
}

function getItemFieldValue() {
  const target = targetField.value
  if (typeof target === 'function') {
    return target(props.item)
  }
  if (props.item && typeof props.item === 'object') {
    if (target in props.item) {
      return props.item[target]
    }
  }
  return undefined
}

const currentValue = computed(() => {
  const key = itemKeyVal.value

  if (hasCustomModel()) {
    if (key in model.value && model.value[key] !== undefined && model.value[key] !== null) {
      return model.value[key]
    }
    const fromItem = getItemFieldValue()
    return fromItem !== undefined ? fromItem : ''
  }

  if (key in internalState.value && internalState.value[key] !== undefined && internalState.value[key] !== null) {
    return internalState.value[key]
  }

  const fromItem = getItemFieldValue()
  return fromItem !== undefined ? fromItem : ''
})

function resolveProp(prop, item) {
  if (prop === null || prop === undefined || prop === '') return ''
  if (typeof prop === 'function') return prop(item)
  return (item && typeof item === 'object' && prop in item) ? item[prop] : prop
}

const resolvedProps = computed(() => {
  const fromInput = props.input ? (typeof props.input === 'object' ? props.input : typeof props.input === 'function' ? props.input(props.item) : {}) : {}
  const fromInputProps = typeof props.inputProps === 'function'
    ? props.inputProps(props.item)
    : (props.inputProps || {})

  const isDense = fromInputProps.dense !== undefined
    ? fromInputProps.dense
    : (fromInput.dense !== undefined ? fromInput.dense : props.dense)

  let label = resolveProp(props.inputLabel, props.item)
  if (label === '') {
    const rawFallback = fromInputProps.label !== undefined ? fromInputProps.label : fromInput.label
    label = String(resolveProp(rawFallback, props.item))
  }

  return {
    outlined: true,
    ...fromInput,
    ...fromInputProps,
    dense: isDense,
    ...(label !== '' ? { label } : {})
  }
})

function onInputUpdate(newVal) {
  const key = itemKeyVal.value
  const field = targetField.value

  if (hasCustomModel()) {
    model.value[key] = newVal
  } else {
    internalState.value[key] = newVal
    if (props.item && typeof props.item === 'object' && typeof field === 'string') {
      props.item[field] = newVal
    }
  }

  emit('input-change', {
    value: newVal,
    item: props.item,
    itemKey: effectiveKeyProp.value,
    itemKeyValue: key,
    field
  })
}
</script>
