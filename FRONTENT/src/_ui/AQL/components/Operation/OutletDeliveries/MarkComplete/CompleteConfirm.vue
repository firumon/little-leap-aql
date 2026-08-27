<template>
  <RunConfirmCard
    context-label="COMPLETING"
    :eligible="eligible"
    :blocked-message="blockedMessage"
    :outcome="outcome"
    comment-label="Comment (optional)"
    comment-field="CompleteComment"
    comment-header="ProgressCompletedComment"
  />
</template>

<script setup>
/**
 * OutletDeliveries › MarkComplete › CompleteConfirm — the action route's content.
 *
 * A SAFETY NET, not the normal path. `buildDeliveryMarkDeliveredNodes` closes a run itself
 * the moment its last line lands, so this route exists for the manifest that did NOT close —
 * a line delivered through the standalone restock route, or a batch that partially failed —
 * and would otherwise sit in the active queue forever.
 *
 * That is why this action appearing on the FAB is itself the signal that something needs a
 * human: on a healthy run it never shows.
 *
 * Eligibility is `canComplete` measured against the manifest's own lines, the same predicate
 * `PageAction.js` re-checks on submit (§8.6). The blocked message names the outstanding
 * count, because "cannot complete" without a number tells the operator nothing about what to
 * go and do.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import RunConfirmCard from '../RunConfirmCard.vue'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'
import { useDeliveryView } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryView'
import {
  canComplete,
  isInTransit,
  isCancelled,
  isCompleted
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

defineOptions({ name: 'OutletDeliveriesMarkCompleteCompleteConfirm', inheritAttrs: false })

const { resourceRecord } = useDeliveryFormContext()
const { lines, ratio } = useDeliveryView()

const record = computed(() => resourceRecord?.record?.value || null)

const eligible = computed(() =>
  !!record.value && isInTransit(record.value) && canComplete(record.value, lines.value))

const blockedMessage = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCancelled(row)) return 'This delivery was cancelled.'
  if (isCompleted(row)) return 'This delivery is already complete.'
  if (!isInTransit(row)) return 'Only a delivery that has departed can be completed.'
  const outstanding = ratio.value.total - ratio.value.delivered
  return `${outstanding} item${outstanding === 1 ? ' is' : 's are'} still undelivered. Deliver or remove them first.`
})

const outcome = computed(() =>
  `All ${ratio.value.total} items are recorded as delivered. Closing the run removes it from the active queue.`)
</script>
