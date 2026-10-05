<template>
  <div v-if="step() >= 2 && selectedUser" :class="gutterClass">
    <SectionDividerLabel label="OUTLETS HAVING COLLECTION" />
    <q-card flat bordered :class="ui.cardClass">
      <AppList
        v-model="selectedOutlet"
        :items="pendingByOutlet"
        itemKey="outlet"
        val="outlet"
        :itemBordered="false"
        :separator="true"
        selectable="left"
        itemClass="bg-transparent"
        label="outletName"
        :caption="row => `${row.openInvoiceCount || 0} Invoices · ${row.count} Payments`"
        :chip="(row) => money(row.amount)"
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

defineOptions({ name: 'OutletPaymentsApproveOutletPendingList', inheritAttrs: false })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const {
  ui, money, step, selectedUser, selectedOutlet, pendingByOutlet
} = useOutletPaymentApproveContext()
</script>
