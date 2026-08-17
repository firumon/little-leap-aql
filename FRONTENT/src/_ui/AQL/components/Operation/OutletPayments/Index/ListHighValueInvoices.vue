<template>
  <AppList
    v-bind="preset"
    empty-text="Nothing outstanding to rank."
    empty-icon="task_alt"
  >
    <template #btn="{ item }">
      <q-btn
        v-if="canCreate"
        flat round dense
        icon="add"
        color="primary"
        :aria-label="`Record payment for ${item.outletName}`"
        @click.stop="onStart(item)"
      />
    </template>
  </AppList>
</template>

<script setup>
/**
 * OutletPayments › Index › "High Value" — runtime list view.
 *
 * The same open invoices as the Pending queue, ordered by BALANCE DUE rather than by date.
 *
 * It answers a different question from every other queue on the page: not "what is late" but
 * "where is the money". A day spent collecting the top three balances can recover more than a
 * week spent working the overdue list in date order, and no sort by date can surface that.
 *
 * The pill hides itself when there is at most one open invoice — a ranking of one is not a
 * ranking (see `Index/ListSwitcher.js`).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useOutletPaymentIndexContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/useOutletPaymentIndexContext'
import { invoiceQueuePreset } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsListHighValueInvoices', inheritAttrs: false })

const { views, canCreate, startPayment } = useOutletPaymentIndexContext()

const preset = computed(() => invoiceQueuePreset(views.value.HighValueInvoices || []))

const onStart = (item) => startPayment(item)
</script>
