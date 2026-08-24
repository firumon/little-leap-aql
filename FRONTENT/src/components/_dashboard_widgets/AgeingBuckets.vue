<template>
  <div v-if="buckets.length && total > 0" class="aql-ageing__row row wrap items-stretch">
    <div
      v-for="bucket in buckets"
      :key="bucket.key"
      class="aql-ageing__bucket col relative-position"
      :class="{ 'aql-ageing__bucket--empty': !bucket.count }"
      :style="{ '--aql-ageing-color': bucket.cssColor }"
    >
      <div class="aql-ageing__count text-weight-bold">{{ bucket.count }}</div>
      <div class="aql-ageing__label text-uppercase">{{ bucket.label }}</div>
      <div v-if="bucket.caption" class="aql-ageing__caption ellipsis">{{ bucket.caption }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { resolveCssColor } from 'src/utils/colorHelpers'

defineOptions({ name: 'DashboardWidgetAgeingBuckets', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] }
})

function toCount (val) {
  const num = Number(val)
  return Number.isFinite(num) && num > 0 ? num : 0
}

// Empty bands are KEPT and dimmed: the bands are a fixed scale, and "0 in 7+ days"
// is the reassuring half of the reading.
const buckets = computed(() =>
  (Array.isArray(props.items) ? props.items : [])
    .map((raw, index) => ({
      key: `${raw?.label ?? ''}-${index}`,
      label: raw?.label ?? '',
      caption: raw?.caption ?? '',
      count: toCount(raw?.count),
      cssColor: resolveCssColor(raw?.color, 'var(--q-primary)')
    }))
    .filter((bucket) => !!bucket.label))

const total = computed(() => buckets.value.reduce((sum, bucket) => sum + bucket.count, 0))
</script>
