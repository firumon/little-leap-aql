<template>
  <q-card v-if="rows.length" flat bordered :class="cardClass" class="q-pa-md">
    <!-- Legend first: with more than one bar per row the colours are the only thing
         telling the reader which bar is which. -->
    <div v-if="series.length > 1" class="row wrap items-center q-gutter-x-md q-mb-md">
      <div
        v-for="line in series"
        :key="`legend-${line.key}`"
        class="row no-wrap items-center"
      >
        <q-badge rounded :color="line.color" class="q-mr-xs" />
        <span class="text-caption text-grey-7">{{ line.label }}</span>
      </div>
    </div>

    <div>
      <div
        v-for="(row, i) in rows"
        :key="row.key"
        class="aql-detail-row"
        :class="{ 'q-mt-md': i > 0 }"
        :style="rowDelay(i)"
      >
        <div class="row no-wrap items-center q-mb-xs">
          <div class="col ellipsis text-body2 text-weight-medium">{{ row.label }}</div>
          <div class="col-auto q-ml-md text-right">
            <span
              v-for="cell in row.cells"
              :key="`count-${row.key}-${cell.key}`"
              class="text-body2 text-weight-bold q-ml-sm"
              :class="`text-${cell.color}`"
            >{{ cell.value }}</span>
          </div>
        </div>

        <!-- Inline: every series on ONE track, laid end to end. -->
        <div v-if="isInline" class="aql-funnel__bar row no-wrap items-stretch overflow-hidden">
          <div
            v-for="cell in row.cells"
            :key="`seg-${row.key}-${cell.key}`"
            class="aql-funnel__segment"
            :style="{ width: `${cell.percent}%`, '--aql-funnel-color': cell.cssColor }"
          >
            <q-tooltip>{{ cell.label }}: {{ cell.value }}</q-tooltip>
          </div>
        </div>

        <!-- Stacked: one bar per series, on its own line. -->
        <template v-else>
          <div
            v-for="(cell, index) in row.cells"
            :key="`bar-${row.key}-${cell.key}`"
            :class="{ 'q-mt-xs': index > 0 }"
          >
            <q-linear-progress
              :value="cell.ratio"
              :color="cell.color"
              :track-color="cell.trackColor"
              size="6px"
              rounded
            />
          </div>
        </template>
      </div>
    </div>

    <div v-if="hiddenCount" class="text-caption text-grey-6 q-pt-md">
      + {{ hiddenCount }} more
    </div>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { resolveCssColor } from 'src/utils/colorHelpers'

defineOptions({ name: 'DashboardWidgetMultiSeriesBars', inheritAttrs: false })

const props = defineProps({
  // [{ label, values: { seriesKey: number } }] — a flat `{ label, seriesKey: n }` also works.
  items: { type: Array, default: () => [] },
  // [{ key, label, color, trackColor }] — one entry per bar drawn in each row.
  series: { type: Array, default: () => [] },
  // `stacked` draws one bar per series on its own line. `inline` lays every series
  // end to end on ONE track, so a row reads as a whole made of parts.
  layout: { type: String, default: 'stacked' },
  // Shared denominator for every bar. Falls back to the largest value in the set.
  max: { type: [Number, String], default: null },
  maxRows: { type: Number, default: 12 },
  cardClass: { type: [String, Array, Object], default: '' },
  rowStaggerMs: { type: Number, default: 40 }
})

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const series = computed(() =>
  (Array.isArray(props.series) ? props.series : [])
    .map((line, index) => ({
      key: String(line?.key ?? index),
      label: String(line?.label ?? line?.key ?? ''),
      color: line?.color || 'primary',
      trackColor: line?.trackColor || 'grey-3'
    }))
    .filter((line) => !!line.key))

const entries = computed(() => {
  if (!series.value.length) return []
  return (Array.isArray(props.items) ? props.items : [])
    .map((raw, index) => {
      const label = String(raw?.label ?? '').trim()
      const values = series.value.map((line) => num(raw?.values?.[line.key] ?? raw?.[line.key]))
      return { key: `${label}-${index}`, label, values }
    })
    // A row with no label cannot be read, and an all-zero row is a blank line.
    .filter((entry) => entry.label && entry.values.some((value) => value > 0))
})

const isInline = computed(() => props.layout === 'inline')

const override = computed(() => {
  const value = Number(props.max)
  return Number.isFinite(value) && value > 0 ? value : null
})

// One shared denominator, so equal-looking bars mean equal counts. Inline uses the
// largest row TOTAL — its segments share a track and would else sum past 100%.
const peak = computed(() => {
  if (override.value !== null) return override.value
  return entries.value.reduce((max, entry) => Math.max(
    max,
    isInline.value
      ? entry.values.reduce((sum, value) => sum + value, 0)
      : Math.max(...entry.values)
  ), 0)
})

const rows = computed(() =>
  entries.value.slice(0, props.maxRows).map((entry) => ({
    key: entry.key,
    label: entry.label,
    cells: series.value.map((line, index) => {
      const value = entry.values[index]
      const ratio = peak.value > 0 ? value / peak.value : 0
      return {
        key: line.key,
        label: line.label,
        color: line.color,
        trackColor: line.trackColor,
        cssColor: resolveCssColor(line.color, 'var(--q-primary)'),
        value,
        ratio,
        percent: ratio * 100
      }
    })
  })))

const hiddenCount = computed(() => Math.max(0, entries.value.length - props.maxRows))

const rowDelay = (index) => ({ animationDelay: `${index * props.rowStaggerMs}ms` })
</script>
