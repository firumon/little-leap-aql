<template>
  <div v-if="locked">
    <q-banner rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ message }}
    </q-banner>
  </div>
</template>

<script setup>
// The Edit URL is directly reachable, so a locked manifest says why above the grid, not at
// the sticky bar after twenty lines have been re-ticked.
import { computed } from 'vue'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'
import {
  isEditable,
  isCompleted,
  isCancelled,
  isInTransit
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

defineOptions({ name: 'OutletDeliveriesEditLockBanner', inheritAttrs: false })

const { resourceRecord } = useDeliveryFormContext()

const record = computed(() => resourceRecord?.record?.value || null)

// Fails CLOSED on a record that has not loaded: showing the grid as editable and
// discovering otherwise at the sticky bar is the failure this banner exists to prevent.
const locked = computed(() => !!record.value && !isEditable(record.value))

const message = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCompleted(row)) {
    return 'This delivery is complete — every item on it has been handed over, so its line-up can no longer be changed.'
  }
  if (isCancelled(row)) {
    return 'This delivery was cancelled. Its items have been released back to the queue and are available for another run.'
  }
  if (isInTransit(row)) {
    return 'This delivery has departed. Its line-up is fixed once the van is on the road — record what was handed over instead.'
  }
  return 'This delivery can no longer be edited.'
})
</script>
