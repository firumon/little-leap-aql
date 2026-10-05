<template>
  <div v-if="step() === 1" :class="gutterClass">
    <SectionDividerLabel label="PENDING APPROVAL BY EXECUTIVE" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <AppList
          :items="pendingByUser"
          :separator="true"
          itemKey="user"
          label="user"
          :caption="(row) => `${row.count} Payment${row.count === 1 ? '' : 's'}`"
          :metaLabel="(row) => money(row.amount)"
          itemClass="bg-transparent"
          :itemBordered="false"
          :dense="true"
          clickable
          @click="(row) => selectedUser = (row?.user || row)"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentApproveContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Approve/useOutletPaymentApproveContext'
import AppList from 'components/app/AppList.vue'

defineOptions({ name: 'OutletPaymentsApproveCollectorPendingList', inheritAttrs: false })
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)
const {
  ui, money, loadSources, pendingByUser, selectedUser, step
} = useOutletPaymentApproveContext()

onMounted(loadSources)
</script>
