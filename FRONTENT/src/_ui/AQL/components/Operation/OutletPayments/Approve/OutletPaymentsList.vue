<template>
  <div v-if="step() >= 2 && selectedOutlet && outletPayments.length" :class="gutterClass">
    <SectionDividerLabel label="PAYMENTS" />
    <q-card flat bordered :class="ui.cardClass">
      <AppList
        v-model="selectedCode"
        :items="outletPayments"
        itemKey="Code"
        :itemBordered="false"
        :separator="true"
        selectable="left"
        itemClass="bg-transparent"
        label="Code"
        :caption="row => `${row.Date || ''} · ${row.Mode || ''}`"
        :chip="(row) => money(row.Amount)"
        :chip-outline="true"
      />
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentApproveContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Approve/useOutletPaymentApproveContext'

defineOptions({ name: 'OutletPaymentsApproveOutletPaymentsList', inheritAttrs: false })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const {
  ui, money, step, selectedOutlet, selectedCode, outletPayments
} = useOutletPaymentApproveContext()
</script>
