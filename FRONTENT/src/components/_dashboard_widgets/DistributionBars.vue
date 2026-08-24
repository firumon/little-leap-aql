<template>
  <q-card v-if="groups.length" flat bordered :class="cardClass" class="q-pa-md">
    <!-- A toggle with one option is a label wearing a button's clothes. -->
    <q-btn-toggle
      v-if="groups.length > 1"
      :model-value="activeKey"
      spread no-caps unelevated dense
      class="q-mb-md"
      padding="xs sm"
      toggle-color="primary"
      color="grey-2"
      text-color="grey-8"
      :options="toggleOptions"
      @update:model-value="selectGroup"
    />

    <!-- Row rhythm is a top margin on every row BUT THE FIRST, not `q-gutter-y-*`:
         the gutter's negative container margin silently eats the toggle's own margin. -->
    <div>
      <div
        v-for="(bar, i) in bars"
        :key="bar.label"
        class="aql-detail-row"
        :class="{ 'q-mt-md': i > 0 }"
        :style="rowDelay(i)"
      >
        <div class="row no-wrap items-center q-mb-xs">
          <div class="col ellipsis text-body2 text-weight-medium">{{ bar.label }}</div>
          <div class="col-auto q-ml-md text-right" style="min-width: 3.5rem">
            <span class="text-body2 text-weight-bold">{{ bar.count }}</span>
            <span class="text-caption text-grey-6 q-ml-xs">{{ bar.share }}</span>
          </div>
        </div>
        <q-linear-progress
          :value="bar.ratio"
          :color="color"
          track-color="grey-3"
          size="6px"
          rounded
        />
      </div>
    </div>

    <div v-if="hiddenCount" class="text-caption text-grey-6 q-pt-md">
      + {{ hiddenCount }} more with fewer records
    </div>
  </q-card>
</template>

<script setup>
import { computed, ref } from 'vue'

defineOptions({ name: 'DashboardWidgetDistributionBars', inheritAttrs: false })

const props = defineProps({
  // Flat `[{ label, count }]` or grouped `[{ key, label, items }]`.
  items: { type: Array, default: () => [] },
  color: { type: String, default: 'primary' },
  maxBars: { type: Number, default: 8 },
  cardClass: { type: [String, Array, Object], default: '' },
  rowStaggerMs: { type: Number, default: 40 }
})

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const groups = computed(() => {
  const resolved = Array.isArray(props.items) ? props.items : []
  if (!resolved.length) return []

  const raw = Array.isArray(resolved[0]?.items)
    ? resolved
    : [{ key: 'default', label: '', items: resolved }]

  return raw
    .map((group, groupIndex) => {
      const bars = (Array.isArray(group?.items) ? group.items : [])
        .map((entry) => ({ label: String(entry?.label ?? '').trim(), count: num(entry?.count) }))
        .filter((entry) => entry.label && entry.count > 0)
      return {
        key: String(group?.key ?? group?.label ?? groupIndex),
        label: String(group?.label ?? ''),
        bars
      }
    })
    .filter((group) => group.bars.length > 0)
})

const toggleOptions = computed(() =>
  groups.value.map((group) => ({ label: group.label || group.key, value: group.key })))

// Held apart from the resolved key so a choice that becomes invalid falls back to the
// first group instead of leaving the card blank.
const chosenKey = ref('')

const activeKey = computed(() => {
  const chosen = chosenKey.value
  if (chosen && groups.value.some((group) => group.key === chosen)) return chosen
  return groups.value[0]?.key ?? ''
})

const selectGroup = (key) => { chosenKey.value = key ?? '' }

const activeGroup = computed(() =>
  groups.value.find((group) => group.key === activeKey.value) || groups.value[0] || null)

// Bars scale against the LARGEST bar, but `share` is measured against the group TOTAL —
// the two answer different questions, and "48 (100%)" on the leading row would be wrong.
const bars = computed(() => {
  const source = activeGroup.value?.bars ?? []
  const peak = source.reduce((max, bar) => Math.max(max, bar.count), 0)
  const total = source.reduce((sum, bar) => sum + bar.count, 0)
  return source
    .slice(0, props.maxBars)
    .map((bar) => ({
      ...bar,
      ratio: peak > 0 ? bar.count / peak : 0,
      share: total > 0 ? `${Math.round((bar.count / total) * 100)}%` : ''
    }))
})

const hiddenCount = computed(() =>
  Math.max(0, (activeGroup.value?.bars.length ?? 0) - props.maxBars))

const rowDelay = (index) => ({ animationDelay: `${index * props.rowStaggerMs}ms` })
</script>
