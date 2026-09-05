<template>
  <TrackStatusCard
    :title="finalTitle"
    :track="warehouseTrack"
    :caption="caption"
    :lines="lines"
    :note="warehouseTrack?.disposalReason || ''"
    note-label="Disposal Reason"
    :pending="pending"
  />
</template>

<script setup>
/**
 * OutletReturns › View › WarehouseStatus — Section (tier 1: resource + page).
 *
 * Track two of two: did stock physically leave the outlet, where was it headed, and what
 * became of it. Reads the projection `useReturnView` already built rather than re-deriving
 * the flag columns or picking between the two stamp pairs itself (§7.4).
 *
 * The disposal reason is passed as the card's `note` rather than as a detail row: it is
 * prose of unknown length, and a label/value row would ellipsize exactly the part that
 * explains the write-off.
 *
 * Rendering is delegated to `TrackStatusCard`, shared with `CommercialStatus`.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, onMounted } from 'vue'
import TrackStatusCard from './TrackStatusCard.vue'
import { useReturnView } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnView'
import { useReturnViewContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnViewContext'

defineOptions({ name: 'OutletReturnsViewWarehouseStatus', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Physical Stock' }
})

const { evaluate } = useReturnViewContext()
const { pending, warehouseTrack, warehouseResources } = useReturnView()

const finalTitle = computed(() => evaluate(props.title))

const caption = computed(() => {
  const track = warehouseTrack.value
  if (!track) return ''
  if (!track.required) return 'The units stayed on the outlet shelf.'
  if (!track.done) return 'The units have left the shelf and are awaiting a warehouse decision.'
  return track.disposition === 'Disposed'
    ? 'The units were written off and did not re-enter stock.'
    : 'The units were received back into warehouse stock.'
})

// The card names the warehouse, so its master rows have to be open before it renders.
onMounted(() => { warehouseResources.forEach((res) => res.reload()) })

const lines = computed(() => {
  const track = warehouseTrack.value
  if (!track || !track.required) return []
  return [
    { label: 'Target Warehouse', value: track.warehouseName },
    { label: 'Disposition', value: track.disposition },
    { label: 'Actioned At', value: track.at },
    { label: 'Actioned By', value: track.by }
  ].filter((line) => String(line.value ?? '').trim())
})
</script>
