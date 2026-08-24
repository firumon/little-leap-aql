<template>
  <!-- Renders nothing at all when there is nothing to choose between. See the docblock. -->
  <div v-if="options.length > 1" :class="spacingClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section class="row items-center no-wrap q-col-gutter-sm">
        <div class="col-auto">
          <q-icon name="warehouse" size="20px" color="grey-7" />
        </div>
        <div class="col">
          <q-select
            :model-value="current"
            :options="allOptions"
            label="Source warehouse"
            dense
            outlined
            emit-value
            map-options
            @update:model-value="setWarehouseFilter"
          />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletDeliveries › Add/Edit › WarehouseFilter — a section, not a form field.
 *
 * Narrows the selection grid to one source warehouse. It writes NOTHING to the manifest:
 * a delivery has no warehouse column, and which bin a line came out of was decided at
 * approval time. This is a lens over the queue, which is why it is a control card rather
 * than a `_fields` control (§13.0's "every input is a `_fields` control" governs inputs
 * that write a header; this writes a view filter held in a control field).
 *
 * ── WHY IT DISAPPEARS WITH ONE WAREHOUSE ──
 * A select offering a single option is a decision the user cannot make, taking up a card's
 * worth of screen on a phone to say so. Most tenants run one warehouse, so for them this
 * card simply never exists — the same posture `OutletSelection.vue` takes with the direct-
 * restock toggle: a control that cannot be honoured is not shown disabled, it is not shown
 * (§13.0). With several, the filter earns its place.
 *
 * PLACEMENT — resource tier, resolved by both `Add.js` and `Edit.js`, because both pages
 * present the same queue and must filter it the same way (§13.4).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import { useDeliverySelection } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliverySelection'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'

defineOptions({ name: 'OutletDeliveriesWarehouseFilter', inheritAttrs: false })

const props = defineProps({
  padding: { type: String, default: 'sm' },
  /** Supplied by the Edit contract so the filter reads that manifest's selectable set. */
  record: { type: Object, default: null }
})

const { ui, resourceRecord } = useDeliveryFormContext()

// On Edit the manifest comes from the loaded record; on Add there is none and the queue is
// the free set. One composable serves both — see `useDeliverySelection`.
const { warehouseOptions, warehouseFilter, setWarehouseFilter } = useDeliverySelection({
  record: () => props.record || resourceRecord?.record?.value || null
})

const spacingClass = computed(() => `q-px-${props.padding}`)
const options = computed(() => warehouseOptions.value)
const current = computed(() => warehouseFilter.value)

// "All" is the absence of a filter, expressed as an empty value rather than as a sentinel
// the composable would have to know about.
const allOptions = computed(() => [{ label: 'All warehouses', value: '' }, ...options.value])
</script>
