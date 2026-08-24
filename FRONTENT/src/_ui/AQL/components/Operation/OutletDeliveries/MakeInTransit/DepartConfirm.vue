<template>
  <RunConfirmCard
    context-label="DEPARTING"
    :eligible="eligible"
    :blocked-message="blockedMessage"
    :outcome="outcome"
    comment-label="Comment (optional)"
    comment-field="InTransitComment"
    comment-header="ProgressInTransitComment"
  />
</template>

<script setup>
/**
 * OutletDeliveries › MakeInTransit › DepartConfirm — the action route's content.
 *
 * Marks the van as departed. A pure state stamp — no line changes, no ledger movement — but
 * it is the moment the run stops being re-plannable, which is why the outcome says so before
 * the operator commits: cancelling is a DRAFT-only action, so departing closes that door.
 *
 * Eligibility is `canMakeInTransit`, the same predicate that gates the FAB and that
 * `PageAction.js` re-checks on submit — three consumers, one rule (§8.6).
 *
 * Rendering is delegated to `RunConfirmCard`, shared with the other two confirmation routes —
 * see its docblock for why the three are one component.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import RunConfirmCard from '../RunConfirmCard.vue'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'
import {
  canMakeInTransit,
  isCancelled,
  isCompleted,
  orsisForDelivery
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

defineOptions({ name: 'OutletDeliveriesMakeInTransitDepartConfirm', inheritAttrs: false })

const { resourceRecord } = useDeliveryFormContext()

const record = computed(() => resourceRecord?.record?.value || null)
const eligible = computed(() => !!record.value && canMakeInTransit(record.value))

const blockedMessage = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCancelled(row)) return 'This delivery was cancelled and cannot depart.'
  if (isCompleted(row)) return 'This delivery is already complete.'
  return 'This delivery has already departed.'
})

const outcome = computed(() => {
  const count = orsisForDelivery(record.value).length
  return `Marks the run as on the road with ${count} item${count === 1 ? '' : 's'}. Once departed it can no longer be cancelled — finish it by delivering or removing its items.`
})
</script>
