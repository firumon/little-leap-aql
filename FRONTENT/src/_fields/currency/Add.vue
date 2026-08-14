<template>
  <q-input
    v-model.number="model"
    outlined
    v-bind="config"
    type="number"
    inputmode="decimal"
    :prefix="prefix"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

defineOptions({ name: 'FieldCurrencyAdd', inheritAttrs: false })

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

const { defaultCurrency } = useCurrencyResource()

// Never hardcode a symbol (ARCHITECTURE RULES §4) — it comes from the Config
// sheet's currency via the Currencies master record.
const prefix = computed(() => props.config?.prefix ?? (defaultCurrency.value?.symbol || defaultCurrency.value?.Symbol || ''))
</script>
