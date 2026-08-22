<template>
  <AppList
    v-bind="preset"
    :gutter="gutter"
    empty-icon="receipt_long"
    empty-text="No credit is owed to any outlet."
    @click="openReturn($event?.Code)"
  />
</template>

<script setup>
/**
 * OutletReturns › Index — the "Awaiting Invoice Adjustment" list view.
 *
 * Returns whose credit has been promised and not yet issued — money the outlet is owed. Oldest first.
 *
 * ── WHY THIS VIEW IS A COMPONENT ──
 * Membership is a question about the COMMERCIAL flag pair (required, not done), not about
 * the workflow state: a return waiting on a credit usually sits in `SUBMITTED`, and one
 * with both tracks open belongs in this queue AND in the warehouse one. No single-valued
 * `Progress` filter can say either thing.
 *
 * The row shape is the module's one shared preset, so this list states a return exactly the
 * way its four siblings do and only the meta chip differs — see `useReturnRowPresets`.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useReturnIndexContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnIndexContext'
import { awaitingInvoicePreset } from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnRowPresets'

defineOptions({ name: 'OutletReturnsIndexListAwaitingInvoiceAdjustment', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'xs')

const { records, filterReturns, openReturn } = useReturnIndexContext()

const preset = computed(() => awaitingInvoicePreset(filterReturns(records.value)))
</script>
