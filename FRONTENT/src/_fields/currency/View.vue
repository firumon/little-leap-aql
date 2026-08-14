<template>
  <span>{{ display }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

defineOptions({ name: 'FieldCurrencyView', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' },
  emptyText: { type: String, default: '-' },
  showSymbol: { type: Boolean, default: true },
  // Optional explicit currency codes for _C(value, showSymbol, target, source).
  targetCurrency: { type: String, default: undefined },
  sourceCurrency: { type: String, default: undefined }
})

const { _C } = useCurrencyResource()

const display = computed(() => {
  const modifier = props.config?.displayValue
  const raw = model.value

  const hasModifierValue =
    modifier != null && String(modifier).trim() !== '' && String(modifier).trim() !== '-'
  if (hasModifierValue && modifier !== raw) return modifier

  if (raw == null || String(raw).trim() === '' || String(raw).trim() === '-') return props.emptyText

  const numeric = Number(raw)
  if (Number.isNaN(numeric)) return String(raw)

  return _C(
    numeric,
    props.showSymbol,
    props.targetCurrency ?? props.config?.targetCurrency,
    props.sourceCurrency ?? props.config?.sourceCurrency
  )
})
</script>
