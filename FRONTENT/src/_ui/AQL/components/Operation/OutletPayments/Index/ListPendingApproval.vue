<template>
  <AppList
    v-bind="preset"
    empty-text="No payments waiting for approval."
    empty-icon="schedule"
    @click="onOpen"
    @action-click="onApprove"
  />
</template>

<script setup>
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useOutletPaymentIndexContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/useOutletPaymentIndexContext'
import { pendingPaymentPreset } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsListPendingApproval', inheritAttrs: false })

const { views, filterPayments, nav, openPayment } = useOutletPaymentIndexContext()
const payments = computed(() => filterPayments(views.value.PendingApproval || []))
const onApprove = (row) => nav.goTo('action', { code: row.code, action: 'approve' })
const onOpen = (item) => openPayment(item?.code)
const preset = computed(() => pendingPaymentPreset(payments.value, { onApprove }))
</script>
