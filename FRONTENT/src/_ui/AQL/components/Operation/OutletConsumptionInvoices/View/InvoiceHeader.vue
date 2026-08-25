<template>
  <div>
    <q-card :class="ui.cardClass">
      <q-card-section class="q-pb-none">
        <div class="row items-start justify-between no-wrap q-gutter-x-sm">
          <div class="col">
            <div class="text-h6 text-weight-bold ellipsis">{{ outletName }}</div>
            <div class="text-caption text-grey-7">
              {{ record?.Code }} &bull; {{ record?.Date }}
            </div>
            <div v-if="record?.Username" class="text-caption text-grey-7">
              Logged by {{ record.Username }}
            </div>
          </div>

          <q-chip
            dense square
            :color="progressMeta.color"
            :icon="progressMeta.icon"
            text-color="white"
            class="q-my-none"
          >
            {{ progressMeta.label }}
          </q-chip>
        </div>
      </q-card-section>

      <!-- THE ONE NUMBER THIS PAGE EXISTS FOR. Centred and oversized on purpose: every
           other figure on the page is an input to it, and a collector reading this on a
           phone in an outlet needs it legible at arm's length. -->
      <q-card-section class="text-center q-py-md">
        <div class="text-caption text-grey-7 text-uppercase">{{ balanceLabel }}</div>
        <div class="text-h4 text-weight-bolder" :class="`text-${balanceColor}`">
          {{ money(balance) }}
        </div>
        <div v-if="collected > 0" class="text-caption text-grey-7 q-mt-xs">
          {{ money(collected) }} received of {{ payableText }}
        </div>
      </q-card-section>

      <q-card-section v-if="record?.DueDate" class="q-pt-none">
        <div class="row justify-center">
          <q-chip
            dense square outline
            :color="dueChip.color"
            :icon="dueChip.icon"
            class="q-my-none"
          >
            {{ dueChip.label }}
          </q-chip>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › View › InvoiceHeader — Section (tier CP: resource + page).
 *
 * Who is being billed, for what document, in what state, and — above everything — what is
 * still owed. The balance is the page's headline because it is the only figure anyone acts
 * on; the breakdown that produces it is a card further down for whoever queries it.
 *
 * Every value is read from the page context, which reads Layer 2. Nothing here sums a
 * payment or parses a date into a status — a card that re-derived the balance would be the
 * second implementation the whole index exists to prevent (ARCHITECTURE RULES §6).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import { useInvoiceViewContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/View/useInvoiceViewContext'

defineOptions({ name: 'OutletConsumptionInvoicesViewInvoiceHeader', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Invoice' }
})

const {
  ui, record, row, outletName, progressMeta,
  balance, collected, payableText, money, isCancelled, isPaid
} = useInvoiceViewContext()

const balanceLabel = computed(() => {
  if (isCancelled.value) return 'Cancelled — nothing to pay'
  if (isPaid.value) return 'Settled in full'
  return 'Balance to pay'
})

const balanceColor = computed(() => {
  if (isCancelled.value) return 'grey-6'
  if (isPaid.value || balance.value <= 0) return 'positive'
  return row.value?.isOverdue ? 'negative' : 'primary'
})

/**
 * The due date, stated as a HUMAN INTERVAL rather than a bare date.
 *
 * "11 days overdue" is actionable where "2026-08-05" needs the reader to do the subtraction.
 * `dueInDays` is already resolved on the aggregate row, so no date maths happens here.
 */
const dueChip = computed(() => {
  const days = row.value?.dueInDays
  if (days === null || days === undefined) return { label: `Due ${record.value?.DueDate}`, color: 'grey-7', icon: 'event' }
  if (isPaid.value || isCancelled.value) return { label: `Due ${record.value?.DueDate}`, color: 'grey-7', icon: 'event' }
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`, color: 'negative', icon: 'running_with_errors' }
  if (days === 0) return { label: 'Due today', color: 'warning', icon: 'today' }
  return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, color: 'primary', icon: 'event' }
})
</script>

