<template>
  <AppList
    v-bind="preset"
    empty-text="All settled. Nothing is outstanding."
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
 * OutletPayments › Index › "Pending" — runtime list view.
 *
 * EVERY open invoice — unpaid and partially paid alike — oldest first. The other three invoice
 * queues are narrowings of this one; it exists so a collector can see the whole book rather
 * than only the slice that is late or large.
 *
 * A partially-paid invoice belongs here on the same terms as an untouched one: what makes a
 * row actionable is its remaining BALANCE, which Layer 2 already resolved, not how much of the
 * document has been settled.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useOutletPaymentIndexContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/useOutletPaymentIndexContext'
import { invoiceQueuePreset } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsListPendingInvoices', inheritAttrs: false })

const { views, canCreate, startPayment } = useOutletPaymentIndexContext()

const preset = computed(() => invoiceQueuePreset(views.value.PendingInvoices || []))

const onStart = (item) => startPayment(item)
</script>
