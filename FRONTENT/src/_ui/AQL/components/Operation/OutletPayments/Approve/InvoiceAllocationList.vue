<template>
  <div v-if="step() >= 2 && selectedOutlet && selectedPayment" :class="gutterClass">
    <SectionDividerLabel label="OPEN INVOICES" />
    <q-card flat bordered :class="ui.cardClass">
      <div class="row items-center justify-between q-px-md q-py-sm">
        <div class="text-caption text-grey-7">
          Balance: <span class="text-weight-bold" :class="unallocatedBalance === 0 ? 'text-positive' : 'text-primary'">{{ money(unallocatedBalance) }}</span>
        </div>
        <div class="row items-center q-gutter-xs">
          Allocate:
          <q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Auto"
            @click="autoAllocate"
            class="q-mb-xs"
          /> /
          <q-btn
            flat
            dense
            no-caps
            color="grey-7"
            label="Reset"
            @click="resetAllocate"
            class="q-mb-xs"
          />
        </div>
      </div>
      <q-separator />
      <AppList
        v-model="allocations"
        :items="outletInvoices"
        itemKey="code"
        itemClass="bg-transparent"
        :layout="['caption', 'label', 'caption']"
        :content="[
          (row) => `${row.username || 'System'} · ${row.date || ''}`,
          (row) => row.code,
          (row) => `Balance: ${money(row.balance)} · ${formatDueText(row)}`
        ]"
        :input="(row) => ({ max:row.balance,style:'width: 100px',type:'number' })"
      />
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentApproveContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Approve/useOutletPaymentApproveContext'

defineOptions({ name: 'OutletPaymentsApproveInvoiceAllocation', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const {
  ui,
  money,
  step,
  selectedOutlet,
  selectedPayment,
  outletInvoices,
  allocations,
  paymentAmount,
  totalAllocated,
  autoAllocate,
  resetAllocate
} = useOutletPaymentApproveContext()

const unallocatedBalance = computed(() => {
  const diff = (paymentAmount.value || 0) - (totalAllocated.value || 0)
  return Math.abs(diff) < 0.005 ? 0 : Number(diff.toFixed(2))
})

function formatDueText (row) {
  const days = row?.dueInDays
  if (days === null || days === undefined) return 'No due date'
  if (days < 0) return `Due ${Math.abs(days)} days ago`
  if (days === 0) return 'Due today'
  return `Due in ${days} days`
}
</script>
