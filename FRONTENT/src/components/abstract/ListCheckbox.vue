<template>
  <q-checkbox
    v-if="Array.isArray(model)"
    :model-value="model"
    :val="effectiveVal"
    :color="resolveColor"
    :dense="dense"
    @update:model-value="onUpdateArray"
    @click.stop
  />
  <q-checkbox
    v-else
    :model-value="isChecked"
    :color="resolveColor"
    :dense="dense"
    @update:model-value="onUpdateSingle"
    @click.stop
  />
</template>

<script>
export function resolveItemKeyVal(item, valProp, itemKeyProp = 'Code') {
  if (valProp !== null && valProp !== undefined && valProp !== '') {
    if (typeof valProp === 'function') {
      const v = valProp(item)
      if (v !== undefined && v !== null && v !== '') return v
    } else if (item && typeof item === 'object' && valProp in item) {
      const v = item[valProp]
      if (v !== undefined && v !== null && v !== '') return v
    }
  }
  if (itemKeyProp !== null && itemKeyProp !== undefined && itemKeyProp !== '') {
    if (typeof itemKeyProp === 'function') {
      const k = itemKeyProp(item)
      if (k !== undefined && k !== null && k !== '') return k
    } else if (item && typeof item === 'object' && itemKeyProp in item) {
      const k = item[itemKeyProp]
      if (k !== undefined && k !== null && k !== '') return k
    }
  }
  if (item !== null && item !== undefined && typeof item !== 'object') {
    return item
  }
  return null
}

export function getItemVal(item, valProp, itemKeyProp = 'Code') {
  const v = resolveItemKeyVal(item, valProp, itemKeyProp)
  return v !== null ? v : item
}

export function getEffectiveTrueValue(item, valProp, itemKeyProp = 'Code', trueValue = true) {
  if (trueValue !== true) return trueValue
  const v = resolveItemKeyVal(item, valProp, itemKeyProp)
  return v !== null ? v : true
}

export function getEffectiveFalseValue(item, valProp, itemKeyProp = 'Code', falseValue = false) {
  if (falseValue !== false) return falseValue
  const v = resolveItemKeyVal(item, valProp, itemKeyProp)
  return v !== null ? '' : false
}

export function isListItemChecked(item, modelValue, valProp, itemKeyProp = 'Code', trueValue = true) {
  const itemVal = getItemVal(item, valProp, itemKeyProp)
  if (Array.isArray(modelValue)) {
    return modelValue.includes(itemVal)
  }
  if (modelValue === null || modelValue === undefined || modelValue === '') {
    return false
  }
  return modelValue === getEffectiveTrueValue(item, valProp, itemKeyProp, trueValue)
}

export function toggleListItem(item, modelValue, valProp, itemKeyProp = 'Code', trueValue = true, falseValue = false) {
  const itemVal = getItemVal(item, valProp, itemKeyProp)
  if (Array.isArray(modelValue)) {
    return modelValue.includes(itemVal)
      ? modelValue.filter(v => v !== itemVal)
      : [...modelValue, itemVal]
  }
  if (modelValue !== undefined) {
    const trueVal = getEffectiveTrueValue(item, valProp, itemKeyProp, trueValue)
    const falseVal = getEffectiveFalseValue(item, valProp, itemKeyProp, falseValue)
    const checked = isListItemChecked(item, modelValue, valProp, itemKeyProp, trueValue)
    return checked ? falseVal : trueVal
  }
  return [itemVal]
}
</script>

<script setup>
import { computed } from 'vue'
import { QCheckbox } from 'quasar'

defineOptions({ name: 'ListCheckbox', inheritAttrs: false })

const model = defineModel({ default: undefined })

const props = defineProps({
  item: { type: [Object, String, Number, Boolean], required: true },
  val: { type: [String, Function], default: null },
  itemKey: { type: [String, Function], default: 'Code' },
  trueValue: { default: true },
  falseValue: { default: false },
  color: { type: [String, Function], default: 'primary' },
  dense: { type: Boolean, default: false }
})

const effectiveTrueValue = computed(() => getEffectiveTrueValue(props.item, props.val, props.itemKey, props.trueValue))
const effectiveFalseValue = computed(() => getEffectiveFalseValue(props.item, props.val, props.itemKey, props.falseValue))
const effectiveVal = computed(() => Array.isArray(model.value) ? getItemVal(props.item, props.val, props.itemKey) : undefined)
const isChecked = computed(() => isListItemChecked(props.item, model.value, props.val, props.itemKey, props.trueValue))

const resolveColor = computed(() => {
  if (typeof props.color === 'function') return props.color(props.item)
  return props.color || 'primary'
})

function onUpdateArray(newVal) {
  model.value = newVal
}

function onUpdateSingle(checked) {
  model.value = checked ? effectiveTrueValue.value : effectiveFalseValue.value
}
</script>
