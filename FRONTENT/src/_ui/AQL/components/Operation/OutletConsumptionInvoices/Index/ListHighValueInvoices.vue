<template>
  <AppList
    v-bind="preset"
    empty-text="Nothing outstanding."
    empty-icon="task_alt"
    @click="onOpen"
  />
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Index › "High Value Invoices" — runtime list view.
 *
 * The same open book as the Pending view, sorted by EXPOSURE instead of by age. Two orderings
 * of one set, because they answer different questions: Pending asks "what has waited
 * longest", this asks "where is the money". Clearing one large invoice often beats chasing
 * ten small ones, and the age-sorted list actively hides that.
 *
 * Rows use the shared invoice preset — the amount chip is the ranking key here, so it is
 * doing double duty as both the sort order made visible and the figure being compared.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useInvoiceIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceIndexContext'
import { invoiceRowPreset } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceRowPresets'

defineOptions({ name: 'OutletConsumptionInvoicesListHighValueInvoices', inheritAttrs: false })

const { runtimeViews, openInvoice } = useInvoiceIndexContext()

const preset = computed(() => invoiceRowPreset(runtimeViews.value.HighValueInvoices))

const onOpen = (item) => openInvoice(item?.code)
</script>
