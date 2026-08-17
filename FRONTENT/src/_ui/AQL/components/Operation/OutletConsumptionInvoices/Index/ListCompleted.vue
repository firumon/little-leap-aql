<template>
  <AppList
    v-bind="preset"
    empty-text="No settled invoices yet."
    empty-icon="task_alt"
    @click="onOpen"
  />
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Index › "Completed" — settled history, newest first.
 *
 * An archive is SCANNED rather than worked through, so it leads with the most recent rather
 * than the oldest — the opposite of every collections view on this page.
 *
 * Reads the aggregate rather than the resolver's raw records, for the same reason every
 * other invoice list here does: the raw row carries an outlet CODE and no derived total, so
 * a row built from it would read `OUT00001` and show a figure that disagrees with the one
 * the same invoice shows one pill away.
 *
 * The chip shows what the invoice was WORTH, not its balance — a settled invoice has no
 * balance, and rendering a column of zeroes would waste the one figure on the row.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useInvoiceIndexContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceIndexContext'
import { settledRowPreset } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Index/useInvoiceRowPresets'

defineOptions({ name: 'OutletConsumptionInvoicesListCompleted', inheritAttrs: false })

const { storedViews, openInvoice } = useInvoiceIndexContext()

const preset = computed(() => settledRowPreset(storedViews.value.Completed))

const onOpen = (item) => openInvoice(item?.code)
</script>
