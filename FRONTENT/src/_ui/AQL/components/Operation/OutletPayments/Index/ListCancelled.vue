<template>
  <AppList
    v-bind="preset"
    empty-text="No receipts have been cancelled."
    empty-icon="task_alt"
    @click="onOpen"
  />
</template>

<script setup>
/**
 * OutletPayments › Index › "Cancelled" — runtime list view.
 *
 * Reversed payment receipts, newest first. They are kept visible rather than filtered away
 * because a cancellation moves an invoice's balance back up: someone reconciling a figure that
 * changed overnight needs the receipt that changed it, and its reason, to be findable.
 *
 * Rows read exactly as the Collections rows do — same preset, no strikethrough, no badge. The
 * pill states which list this is; restating it per row would be noise, and a struck-out amount
 * is harder to read for no gain.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useOutletPaymentIndexContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/useOutletPaymentIndexContext'
import { paymentHistoryPreset } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsListCancelled', inheritAttrs: false })

const { views, openPayment } = useOutletPaymentIndexContext()

const preset = computed(() => paymentHistoryPreset(views.value.Cancelled || []))

const onOpen = (item) => openPayment(item?.code)
</script>
