<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <q-card-section v-else-if="!record" class="text-center q-py-lg">
        <q-icon name="local_shipping" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No delivery</div>
      </q-card-section>

      <template v-else>
        <q-card-section class="q-pb-none">
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-caption text-grey-7 text-uppercase">Delivered</div>
              <div class="text-h5 text-weight-bold">{{ ratio.delivered }} / {{ ratio.total }}</div>
            </div>
            <div class="col-auto">
              <q-icon :name="statusIcon" size="18px" :color="statusColor" class="q-mr-xs" />
              <q-badge rounded :color="statusColor" :label="statusLabel" />
            </div>
          </div>

          <q-linear-progress
            :value="fraction"
            :color="statusColor"
            track-color="grey-3"
            size="8px"
            rounded
            class="q-mt-sm"
          />
        </q-card-section>

        <q-card-section>
          <div :class="ui.detailGridClass">
            <div
              v-for="(line, index) in lines"
              :key="line.label"
              class="items-center"
              :class="[ui.detailLineClass, ui.detailRowClass]"
              :style="rowDelay(index)"
            >
              <span :class="ui.detailKeyClass">{{ line.label }}</span>
              <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
                {{ line.value }}
              </span>
            </div>
          </div>
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script setup>
// What this run is and how far it has got. Blank rows are dropped, not padded with dashes.
// Self-guards its loading and empty states: View cards render outside `<AqlContentWrapper>`.
import { computed, onMounted } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useDeliveryView } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryView'
import { useDeliveryViewContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryViewContext'

defineOptions({ name: 'OutletDeliveriesViewManifestSummary', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Delivery Manifest' },
  // `(record, config) => 'positive'`. Overrides the Progress-derived status colour.
  color: { type: [String, Function], default: null },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useDeliveryViewContext()
const {
  record, pending, ratio, outletNames, unitsLabel, warehouseName, lines: manifestLines, preload,
  progressColor, progressIcon, progressLabel
} = useDeliveryView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const statusColor = computed(() => evaluate(props.color) || progressColor(record.value?.Progress))
const statusIcon = computed(() => progressIcon(record.value?.Progress))
const statusLabel = computed(() => progressLabel(record.value?.Progress))

// Guarded against a zero denominator: an empty manifest is 0 progress, not NaN.
const fraction = computed(() => (ratio.value.total ? ratio.value.delivered / ratio.value.total : 0))

const lines = computed(() => {
  const row = record.value
  if (!row) return []
  const stops = outletNames.value.length
  const items = manifestLines.value.length
  return [
    { label: 'Delivery', value: row.Code || '—' },
    { label: 'Date', value: row.Date || '—' },
    { label: 'Driver', value: row.UserName || '' },
    { label: 'Warehouse', value: warehouseName.value },
    // The count only. The names are the stop-by-stop card below, and repeating them here
    // made one summary row longer than the rest of the table put together.
    { label: 'Outlets', value: stops ? `${stops} Outlet${stops === 1 ? '' : 's'}` : '' },
    {
      label: 'Items',
      value: items
        ? [`${items} Item${items === 1 ? '' : 's'}`, unitsLabel.value].filter(Boolean).join(' • ')
        : ''
    }
  ].filter((line) => String(line.value).trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

// The hydration point for the whole View page: the record loader brings no lines,
// so this first card opens the item and restock sheets once for every card below.
onMounted(preload)
</script>
