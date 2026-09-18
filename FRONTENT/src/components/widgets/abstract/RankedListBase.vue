<template>
  <div ref="el" class="aql-widget aql-widget-ranked-list">
    <div v-if="!hasValidData" class="aql-widget-empty">
      <slot name="empty">
        <q-icon :name="emptyIcon" size="28px" :color="emptyIconColor" />
        <div class="aql-widget-empty__text">
          <Renderable :value="emptyText" />
        </div>
      </slot>
    </div>

    <div
      v-else
      class="column full-width full-height"
    >
      <div
        v-for="(it, idx) in visibleItems"
        :key="idx"
        class="aql-widget-ranked-list__row"
        :class="rowSpacing === 'cozy' ? 'aql-widget-ranked-list__row--cozy' : 'aql-widget-ranked-list__row--tight'"
      >
        <div
          class="aql-widget-ranked-list__bar"
          :class="{ 'aql-widget-ranked-list__bar--capsule': barStyle === 'capsule' }"
          :style="{
            width: `${it.barPct}%`,
            backgroundColor: it.barColor
          }"
        />

        <div class="aql-widget-ranked-list__content">
          <span
            v-if="showRankNumber"
            class="aql-widget-ranked-list__badge"
          >
            <Renderable :value="idx + 1" :item="it" />
          </span>

          <div class="aql-widget-ranked-list__name-col">
            <span class="aql-widget-ranked-list__name">
              <Renderable :value="it.label" :item="it" />
            </span>
            <span
              v-if="tierAtLeast(tier, 'standard') && it.caption"
              class="aql-widget-ranked-list__caption"
            >
              <Renderable :value="it.caption" :item="it" />
            </span>
          </div>

          <span
            class="aql-widget-ranked-list__value"
            :style="{ color: it.isNeg ? 'var(--q-negative)' : undefined }"
          >
            <Renderable :value="it.formattedValue" :item="it" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export const ROW_HEIGHTS = {
  cozy: 44,
  tight: 32
}
</script>

<script setup>
import { computed } from 'vue'
import Renderable from 'src/components/abstract/Renderable.js'
import { useWidgetTier } from 'src/composables/widgets/useWidgetTier.js'
import { resolveCssColor } from 'src/utils/colorHelpers.js'
import { signed, formatValue, tierAtLeast } from 'src/utils/widgetGeometry.js'

defineOptions({
  inheritAttrs: false
})

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  rowSpacing: {
    type: String,
    default: 'tight',
    validator: (v) => ['tight', 'cozy'].includes(v)
  },
  barStyle: {
    type: String,
    default: 'fill',
    validator: (v) => ['fill', 'capsule'].includes(v)
  },
  captionPlacement: {
    type: String,
    default: 'below',
    validator: (v) => ['below', 'inline'].includes(v)
  },
  valueFormat: {
    type: Function,
    default: null
  },
  showRankNumber: {
    type: Boolean,
    default: true
  },
  emptyText: {
    type: [String, Function, Object],
    default: 'Nothing to show'
  },
  emptyIcon: {
    type: String,
    default: 'format_list_numbered'
  },
  emptyIconColor: {
    type: String,
    default: 'grey-5'
  }
})

const { el, height, tier } = useWidgetTier()

const hasValidData = computed(() => {
  return Array.isArray(props.items) && props.items.length > 0
})

const sortedItems = computed(() => {
  if (!hasValidData.value) return []
  return [...props.items].sort((a, b) => Math.abs(Number(b.value) || 0) - Math.abs(Number(a.value) || 0))
})

const hi = computed(() => {
  const values = sortedItems.value.map((i) => Math.abs(Number(i.value) || 0))
  return Math.max(1, ...values)
})

const visibleItems = computed(() => {
  const rowH = props.rowSpacing === 'cozy' ? ROW_HEIGHTS.cozy : ROW_HEIGHTS.tight
  const maxRows = Math.max(1, Math.floor(height.value / rowH))
  const slice = sortedItems.value.slice(0, maxRows)
  const maxVal = hi.value

  return slice.map((it) => {
    const val = Number(it.value) || 0
    const isNeg = val < 0
    const barPct = Math.min(100, (Math.abs(val) / maxVal) * 100)
    let barColor = 'var(--q-primary)'
    if (isNeg) {
      barColor = 'var(--q-negative)'
    } else if (it.color) {
      barColor = resolveCssColor(it.color)
    }

    const formattedValue = formatValue(val, props.valueFormat, signed(val))

    return {
      ...it,
      value: val,
      formattedValue,
      isNeg,
      barPct,
      barColor
    }
  })
})
</script>
