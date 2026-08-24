<template>
  <div v-if="segments.length && total > 0">
    <div class="aql-funnel__bar row no-wrap items-stretch overflow-hidden">
      <div
        v-for="segment in segments"
        :key="segment.key"
        class="aql-funnel__segment"
        :style="{ width: `${segment.percent}%`, '--aql-funnel-color': segment.cssColor }"
      >
        <q-tooltip>{{ segment.label }}: {{ segment.count }} ({{ segment.display }})</q-tooltip>
      </div>
    </div>

    <div class="aql-funnel__legend row wrap items-center q-mt-sm">
      <div
        v-for="segment in segments"
        :key="`legend-${segment.key}`"
        class="aql-funnel__legend-item row no-wrap items-center"
        :style="{ '--aql-funnel-color': segment.cssColor }"
      >
        <q-icon
          v-if="segment.icon"
          :name="segment.icon"
          size="16px"
          class="aql-funnel__legend-icon"
        />
        <span v-else class="aql-funnel__legend-dot" />
        <span class="aql-funnel__legend-label ellipsis">{{ segment.label }}</span>
        <span class="aql-funnel__legend-count text-weight-bold">{{ segment.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolveCssColor } from 'src/utils/colorHelpers'

defineOptions({ name: 'DashboardWidgetWorkflowFunnel', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] }
})

function toCount (val) {
  const num = Number(val)
  return Number.isFinite(num) && num > 0 ? num : 0
}

// Zero-count stages are DROPPED: an invisible segment still costs a legend row.
const normalized = computed(() =>
  (Array.isArray(props.items) ? props.items : [])
    .map((raw, index) => ({
      key: `${raw?.label ?? ''}-${index}`,
      label: raw?.label ?? '',
      icon: raw?.icon ?? '',
      count: toCount(raw?.count),
      cssColor: resolveCssColor(raw?.color, 'var(--q-primary)')
    }))
    .filter((segment) => segment.count > 0))

const total = computed(() => normalized.value.reduce((sum, segment) => sum + segment.count, 0))

const segments = computed(() => {
  const sum = total.value
  if (!sum) return []
  return normalized.value.map((segment) => {
    const percent = (segment.count / sum) * 100
    return {
      ...segment,
      percent,
      display: `${Math.round(percent * 10) / 10}%`
    }
  })
})
</script>
