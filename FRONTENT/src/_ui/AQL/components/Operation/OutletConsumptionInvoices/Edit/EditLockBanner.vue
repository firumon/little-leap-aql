<template>
  <div v-if="locked" :class="spacingClass">
    <q-banner dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ message }}
    </q-banner>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useInvoiceEditContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Edit/useInvoiceEditContext'

defineOptions({ name: 'OutletConsumptionInvoicesEditLockBanner', inheritAttrs: false })

const props = defineProps({
  padding: { type: String, default: 'sm' }
})

const { locked, isPaid, isCancelled, progressMeta } = useInvoiceEditContext()

const spacingClass = computed(() => `q-px-${props.padding}`)

const message = computed(() => {
  if (isPaid.value) {
    return 'This invoice has been settled in full, so its prices and terms can no longer be changed.'
  }
  if (isCancelled.value) {
    return 'This invoice was cancelled. The consumptions it billed are invoiceable again, so raise a new invoice instead.'
  }
  return `Money has already been collected against this invoice (${progressMeta.value.label}), so its prices and terms can no longer be changed.`
})
</script>
