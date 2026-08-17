<template>
  <AppList
    v-bind="preset"
    empty-text="No collections recorded yet."
    empty-icon="savings"
    @click="onOpen"
  />
</template>

<script setup>
/**
 * OutletPayments › Index › "Collections" — runtime list view.
 *
 * Money actually taken in: every submitted payment receipt, newest first. This is the page's
 * only backward-looking queue — the four invoice queues are work still to do, these are the
 * results.
 *
 * NO PROGRESS CHIP. The pill above the list already says these are the submitted receipts, so
 * a "SUBMITTED" badge on every row would be a caption repeating its own heading; the meta
 * column carries the amount instead, which is what a reader scans for.
 *
 * NO ACTION BUTTON either — the row itself opens the receipt. A queue starts work and needs a
 * distinct control for it; a history is read, so the whole row is the target.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useOutletPaymentIndexContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/useOutletPaymentIndexContext'
import { paymentHistoryPreset } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsListCollections', inheritAttrs: false })

const { views, openPayment } = useOutletPaymentIndexContext()

const preset = computed(() => paymentHistoryPreset(views.value.Collections || []))

const onOpen = (item) => openPayment(item?.code)
</script>
