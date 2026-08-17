<template>
  <AppList
    v-bind="preset"
    empty-text="Nothing overdue."
    empty-icon="task_alt"
    @click="onOpen"
  />
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Index › "Overdue" — runtime list view.
 *
 * Every invoice past its due date, longest overdue first — including the ones the Near Due
 * view also shows in its top group. The overlap is deliberate: Near Due answers "what is
 * happening this week", this answers "everything that is late", and a collector working the
 * second question should not have to remember that some of it was filed under the first.
 *
 * Reads `dueSplit.overdue` from Layer 2, the same set the Overdue metric card counts and the
 * Near Due view's first group renders — one derivation, three consumers.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useInvoiceIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceIndexContext'
import { invoiceRowPreset } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceRowPresets'

defineOptions({ name: 'OutletConsumptionInvoicesListOverdue', inheritAttrs: false })

const { dueSplit, openInvoice } = useInvoiceIndexContext()

const preset = computed(() => invoiceRowPreset(dueSplit.value.overdue))

const onOpen = (item) => openInvoice(item?.code)
</script>
