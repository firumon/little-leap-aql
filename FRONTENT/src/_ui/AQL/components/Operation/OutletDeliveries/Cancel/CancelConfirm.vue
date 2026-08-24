<template>
  <RunConfirmCard
    context-label="CANCELLING"
    :eligible="eligible"
    :blocked-message="blockedMessage"
    :outcome="outcome"
    outcome-tone="negative"
    comment-required
    comment-label="Cancellation Reason *"
    comment-field="CancelReason"
    comment-header="CancelledComment"
  />
</template>

<script setup>
/**
 * OutletDeliveries › Cancel › CancelConfirm — the cancellation route's content.
 *
 * Abandons the run. The outcome banner is the important half of this page: cancelling a
 * manifest moves NO stock, and saying so plainly is what stops an operator hunting for a
 * ledger correction that was never needed. Bundling a line into a run never moved anything —
 * the units left the warehouse at approval and reach the outlet at delivery — so a run
 * cancelled before either has no ledger consequence at all. Its lines simply return to the
 * queue.
 *
 * Eligibility is `canCancel`, which is DRAFT-only and additionally requires that nothing has
 * been handed over. It takes the manifest's lines because the second half of that question
 * lives on them, and it FAILS CLOSED while they are still loading (§8.6).
 *
 * The reason is MANDATORY and — unlike `OutletReturns` — genuinely persists: this sheet
 * declares `CancelledAt/By/Comment`, so it shows on the View timeline afterwards.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import RunConfirmCard from '../RunConfirmCard.vue'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'
import { useDeliveryView } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryView'
import {
  canCancel,
  isDraft,
  isCancelled,
  isCompleted
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

defineOptions({ name: 'OutletDeliveriesCancelConfirm', inheritAttrs: false })

const { resourceRecord } = useDeliveryFormContext()
const { lines, ratio } = useDeliveryView()

const record = computed(() => resourceRecord?.record?.value || null)
const eligible = computed(() => !!record.value && canCancel(record.value, lines.value))

const blockedMessage = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCancelled(row)) return 'This delivery is already cancelled.'
  if (isCompleted(row)) return 'This delivery is complete and cannot be cancelled.'
  if (!isDraft(row)) {
    return 'This delivery has already departed. Remove its remaining items instead of cancelling it.'
  }
  return `${ratio.value.delivered} item${ratio.value.delivered === 1 ? ' has' : 's have'} already been handed over, so this run can no longer be cancelled.`
})

const outcome = computed(() => {
  const count = ratio.value.total
  return `No stock moves. The ${count} item${count === 1 ? '' : 's'} on this run return to the queue and can be loaded onto another delivery.`
})
</script>
