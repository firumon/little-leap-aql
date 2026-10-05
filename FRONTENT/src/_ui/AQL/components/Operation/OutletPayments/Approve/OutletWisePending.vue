<template>
  <div v-if="step() === 1 && hasItems">
    <Frame
      title="Pending by Outlet (Top 7)"
      widget="HorizontalRankBar"
      :widget-props="{ valueFormat: money }"
      :data="{ items, loading: paymentDataLoading }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Frame from 'src/components/Frame.vue'
import { useOutletPaymentApproveContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Approve/useOutletPaymentApproveContext'

defineOptions({ name: 'OutletPaymentsApproveOutletWisePending', inheritAttrs: false })

const { step, outletWisePendingAmount, paymentDataLoading, money } = useOutletPaymentApproveContext()

const items = computed(() => outletWisePendingAmount.value || [])
const hasItems = computed(() => items.value.length > 0 && items.value.some((it) => it.value > 0))
</script>
