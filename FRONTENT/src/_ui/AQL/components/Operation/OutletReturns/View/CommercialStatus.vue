<template>
  <TrackStatusCard
    :title="finalTitle"
    :track="commercialTrack"
    :caption="caption"
    :lines="lines"
    :pending="pending"
    :padding="padding"
  />
</template>

<script setup>
/**
 * OutletReturns › View › CommercialStatus — Section (tier 1: resource + page).
 *
 * Track one of two: is the outlet owed a credit, and have they had it. Reads the projection
 * `useReturnView` already built rather than re-deriving the two flag columns, so this card
 * and the progress badge above it can never disagree about whether the return is settled
 * (§7.4).
 *
 * Rendering is delegated to `TrackStatusCard`, shared with `WarehouseStatus` — see its
 * docblock for why the two are one component.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import TrackStatusCard from './TrackStatusCard.vue'
import { useReturnView } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnView'
import { useReturnViewContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnViewContext'

defineOptions({ name: 'OutletReturnsViewCommercialStatus', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Commercial Credit' },
  padding: { type: String, default: 'sm' }
})

const { evaluate } = useReturnViewContext()
const { pending, commercialTrack } = useReturnView()

const finalTitle = computed(() => evaluate(props.title))

const caption = computed(() => {
  const track = commercialTrack.value
  if (!track) return ''
  if (!track.required) return 'This return carries no credit to the outlet.'
  return track.done
    ? 'The outlet has been credited for this return.'
    : "Credit is owed and will be deducted on the outlet's next invoice."
})

// Only the invoice link, and only once there is one. A "Pending credit" row followed by an
// empty `Invoice: —` says less than the headline already did.
const lines = computed(() => {
  const track = commercialTrack.value
  if (!track || !track.detail) return []
  return [{ label: track.invoiceCode ? 'Credited On' : 'Settlement', value: track.detail }]
})
</script>
