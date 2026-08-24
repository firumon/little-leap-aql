<template>
  <div v-if="dials.length" class="aql-gauge__row row wrap items-stretch justify-center">
    <div
      v-for="dial in dials"
      :key="dial.key"
      class="aql-gauge__dial col column items-center"
      :style="{ '--aql-gauge-color': dial.cssColor }"
    >
      <q-circular-progress
        show-value
        :value="dial.percent"
        :size="size"
        :thickness="thickness"
        :color="dial.color"
        track-color="grey-3"
        class="aql-gauge__ring"
      >
        <Renderable
          :slot-fn="slots.display"
          :value="dial.display"
          :item="dial"
          :is="QItemLabel"
          class="aql-gauge__value text-weight-bold"
        />
      </q-circular-progress>

      <Renderable
        :slot-fn="slots.label"
        :value="dial.label"
        :item="dial"
        :is="QItemLabel"
        class="aql-gauge__label text-uppercase"
      />

      <Renderable
        v-if="dial.caption"
        :slot-fn="slots.caption"
        :value="dial.caption"
        :item="dial"
        :is="QItemLabel"
        class="aql-gauge__caption"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import { QItemLabel } from 'quasar'
import { resolveCssColor } from 'src/utils/colorHelpers'
import Renderable from 'components/abstract/Renderable.js'

defineOptions({ name: 'DashboardWidgetGauge', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] },
  size: { type: String, default: '96px' },
  thickness: { type: Number, default: 0.18 }
})

const slots = useSlots()

// The blank check comes BEFORE Number(): Number(null) and Number('') are both 0, so
// coercing first makes "nothing supplied" look like a real zero and defeats the hide rule.
function toNumber (val) {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

function toPercent (rawValue, rawMax) {
  const value = toNumber(rawValue)
  if (value === null) return null
  const max = toNumber(rawMax)
  if (max !== null && max > 0) return Math.min(100, Math.max(0, (value / max) * 100))
  const scaled = value > 0 && value <= 1 ? value * 100 : value
  return Math.min(100, Math.max(0, scaled))
}

function buildDial (raw, index) {
  const percent = toPercent(raw?.value, raw?.max)
  if (percent === null) return null
  const label = raw?.label ?? ''
  const color = raw?.color || 'primary'
  return {
    key: `${label}-${index}`,
    label,
    caption: raw?.caption ?? '',
    display: raw?.display ?? `${Math.round(percent)}%`,
    percent,
    color,
    cssColor: resolveCssColor(color, 'var(--q-primary)'),
    value: toNumber(raw?.value),
    max: toNumber(raw?.max)
  }
}

const dials = computed(() =>
  (Array.isArray(props.items) ? props.items : [])
    .map(buildDial)
    .filter(Boolean))
</script>
