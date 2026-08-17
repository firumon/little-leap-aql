<template>
  <AppList
    v-bind="preset"
    empty-text="No cancelled invoices."
    empty-icon="block"
    @click="onOpen"
  />
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Index › "Cancelled" — cancelled history, newest first.
 *
 * The sibling of `ListCompleted.vue`, and the same shape for the same reason: an archive is
 * scanned rather than worked, so the most recent leads. The chip greys out because a
 * cancelled invoice's value was never collected and never will be — showing it in the same
 * positive colour as a settled one would make the two indistinguishable at a glance.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useInvoiceIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceIndexContext'
import { settledRowPreset } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceRowPresets'

defineOptions({ name: 'OutletConsumptionInvoicesListCancelled', inheritAttrs: false })

const { storedViews, openInvoice } = useInvoiceIndexContext()

const preset = computed(() => settledRowPreset(storedViews.value.Cancelled))

const onOpen = (item) => openInvoice(item?.code)
</script>
