<template>
  <div v-if="step() === 1 && !empty">
    <SectionDividerLabel label="PENDING APPROVAL OVERVIEW" />
    <MetricCardsWidget :items="metrics" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import MetricCardsWidget from 'components/_dashboard_widgets/MetricCards.vue'
import { useOutletPaymentApproveContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Approve/useOutletPaymentApproveContext'

defineOptions({ name: 'OutletPaymentsApprovePendingMetrics', inheritAttrs: false })

const { step, pendingApproval, money } = useOutletPaymentApproveContext()

const empty = computed(() => !pendingApproval.value || (pendingApproval.value.count === 0 && pendingApproval.value.amount === 0))

const metrics = computed(() => [
  {
    label: 'Pending Count',
    number: pendingApproval.value?.count ?? 0,
    color: 'warning'
  },
  {
    label: 'Pending Amount',
    number: money(pendingApproval.value?.amount ?? 0),
    color: 'primary'
  }
])
</script>
