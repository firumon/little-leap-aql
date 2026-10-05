<template>
  <div v-if="step() === 1 && hasPoints">
    <Frame
      title="Collections per Day"
      caption="Last 7 days"
      widget="DailySalesLine"
      :widget-props="{ valueFormat: money }"
      :data="{ points: collectionsPerDay7Days, loading: paymentDataLoading }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Frame from 'src/components/Frame.vue'
import { useOutletPaymentApproveContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Approve/useOutletPaymentApproveContext'

defineOptions({ name: 'OutletPaymentsApproveDayWiseCollection', inheritAttrs: false })

const { step, collectionsPerDay7Days, paymentDataLoading, money } = useOutletPaymentApproveContext()

const hasPoints = computed(() => (collectionsPerDay7Days.value || []).some((p) => p.y > 0))
</script>
