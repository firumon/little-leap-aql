<template>
  <div v-if="locked" :class="spacingClass">
    <q-banner dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ message }}
    </q-banner>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Edit › EditLockBanner — Section (tier CP: resource + page).
 *
 * The Edit URL is directly reachable, so an invoice that has taken money or come to rest
 * since the link was opened must say why nothing here will save — ABOVE the form, rather
 * than failing at the sticky bar after the user has retyped a dozen prices.
 *
 * Eligibility is the domain's `canEditInvoice`, the same predicate that gates the Edit FAB
 * and the submit veto. Three consumers, one rule — a banner that decided for itself would
 * eventually disagree with the button that got the user here (§8.6).
 *
 * Renders nothing on an editable invoice, so it costs the top of the page nothing in the
 * ordinary case (§10.4).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
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
  // The remaining case is PARTIALLY_PAID: money has been collected against these figures.
  return `Money has already been collected against this invoice (${progressMeta.value.label}), so its prices and terms can no longer be changed.`
})
</script>
