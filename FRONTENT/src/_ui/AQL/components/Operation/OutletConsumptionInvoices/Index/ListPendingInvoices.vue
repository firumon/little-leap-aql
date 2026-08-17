<template>
  <AppList
    v-bind="preset"
    empty-text="Nothing outstanding. The book is clear."
    empty-icon="task_alt"
    @click="onOpen"
  />
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Index › "Pending Invoices" — runtime list view.
 *
 * Every open invoice still carrying a real balance, OLDEST FIRST. Order is a work order, not
 * a preference (UI_MODULE_DEVELOPER_GUIDE §7.2): the longest-unpaid debt is the one most
 * likely to go bad, so it leads.
 *
 * ── WHY THIS IS A `.vue` OVERRIDE ──
 * The view is defined by Balance Due — grand total minus active payments — which is derived
 * and is not a column, so no GAS `ListViews` filter tree can express it. The rows come from
 * `useInvoiceIndex`'s aggregate rather than from the resolver's `items`, which for this view
 * carries only the registered superset filter's output.
 *
 * Micro balances are EXCLUDED and shown in the Waive-off view instead, so no invoice appears
 * in both queues — a residue smaller than the smallest coin is not a collection job.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useInvoiceIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceIndexContext'
import { invoiceRowPreset } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceRowPresets'

defineOptions({ name: 'OutletConsumptionInvoicesListPendingInvoices', inheritAttrs: false })

const { runtimeViews, openInvoice } = useInvoiceIndexContext()

const preset = computed(() => invoiceRowPreset(runtimeViews.value.PendingInvoices))

const onOpen = (item) => openInvoice(item?.code)
</script>
