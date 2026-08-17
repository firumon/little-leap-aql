<template>
  <AppList
    v-bind="preset"
    empty-text="Nothing overdue. Every invoice is inside its terms."
    empty-icon="task_alt"
  >
    <!-- THE PRIMARY ACTION OF THIS VIEW. Icon only — the row already names the outlet and the
         button sits in the list's own action slot, so a "Pay" caption beside it would repeat
         what the column is for. -->
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
 * OutletPayments › Index › "Overdue" — runtime list view.
 *
 * Open invoices whose due date has passed, oldest deadline first: the order a collector works
 * a debt book in, because the longest-outstanding balance is the one most likely to go bad.
 *
 * The set is `useOutletPaymentIndex().views.Overdue` — the same rows the Near Due view puts
 * under its "Overdue" divider and the same rows the metric card counts.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useOutletPaymentIndexContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/useOutletPaymentIndexContext'
import { invoiceQueuePreset } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsListOverdue', inheritAttrs: false })

const { views, canCreate, startPayment } = useOutletPaymentIndexContext()

const preset = computed(() => invoiceQueuePreset(views.value.Overdue || []))

const onStart = (item) => startPayment(item)
</script>
