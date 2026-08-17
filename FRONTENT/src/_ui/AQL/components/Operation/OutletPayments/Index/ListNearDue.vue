<template>
  <div :class="gutterClass">
    <SectionDividerLabel v-if="overdue.length" label="Overdue" />
    <AppList v-if="overdue.length" v-bind="overduePreset">
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

    <SectionDividerLabel v-if="upcoming.length" label="Due In" />
    <AppList v-if="upcoming.length" v-bind="upcomingPreset">
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

    <!-- ONE empty state for the whole view, not one per group: two "nothing here" cards
         stacked read as two failures instead of one clear queue. -->
    <AppList
      v-if="!overdue.length && !upcoming.length"
      :items="[]"
      empty-text="Nothing due. The book is clear."
      empty-icon="task_alt"
    />
  </div>
</template>

<script setup>
/**
 * OutletPayments › Index › "Near Due" — runtime list view (the page's default).
 *
 * The collections queue, split into the two groups a collector actually works in a different
 * order: what is ALREADY LATE, then what is COMING UP. One flat list sorted by due date blurs
 * the boundary between them — the most overdue invoice and the one due tomorrow sit adjacent
 * with nothing but a date to tell them apart — so the divider does the work a sort order
 * cannot.
 *
 * Both groups come from `useOutletPaymentIndex().dueSplit`, so this view and the Overdue pill
 * beside it are counting the same set rather than two filters that can drift.
 *
 * Rows use the shared invoice-queue preset, so an invoice reads identically here and in every
 * other queue on the page.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletPaymentIndexContext } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/useOutletPaymentIndexContext'
import { invoiceQueuePreset } from 'src/_ui/AQL/composables/Operation/OutletPayments/Index/usePaymentRowPresets'

defineOptions({ name: 'OutletPaymentsListNearDue', inheritAttrs: false })

const attrs = useAttrs()
// The page's own vertical rhythm, handed down through `$attrs` — never a hardcoded gutter.
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { dueSplit, canCreate, startPayment } = useOutletPaymentIndexContext()

const overdue = computed(() => dueSplit.value.overdue)
const upcoming = computed(() => dueSplit.value.upcoming)

const overduePreset = computed(() => invoiceQueuePreset(overdue.value))
const upcomingPreset = computed(() => invoiceQueuePreset(upcoming.value))

const onStart = (item) => startPayment(item)
</script>
