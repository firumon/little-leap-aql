<template>
  <!-- Strict hide rule: nothing renders unless some group has a bar worth drawing. -->
  <div v-if="items.length">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />
    <DistributionBarsWidget
      :items="items"
      :color="resolvedColor"
      :max-bars="maxBars"
      :card-class="resolvedCardClass"
      :row-stagger-ms="rowStaggerMs"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import DistributionBarsWidget from 'components/_dashboard_widgets/DistributionBars.vue'

defineOptions({ name: 'SectionsDistributionBars', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: '' },
  // Flat `[{ label, count }]` or grouped `[{ key, label, items }]`.
  items: { type: [Array, Function], default: null },
  color: { type: [String, Function], default: 'primary' },
  maxBars: { type: Number, default: 8 },
  // Empty by design: the resource's modifier relays its own `ui.cardClass`.
  cardClass: { type: [String, Array, Object, Function], default: '' },
  rowStaggerMs: { type: Number, default: 40 }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const evaluate = (val) => evaluateProp(val, resourceRecord, resourceConfig)

const resolvedTitle = computed(() => evaluate(props.title) || '')
const resolvedColor = computed(() => evaluate(props.color) || 'primary')
const resolvedCardClass = computed(() => evaluate(props.cardClass) || '')

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// Both accepted shapes are folded into one grouped form here, and every empty group is
// dropped — a tenant that never fills `Area` should not be offered an Area tab.
const items = computed(() => {
  const resolved = evaluate(props.items)
  if (!Array.isArray(resolved) || !resolved.length) return []

  const raw = Array.isArray(resolved[0]?.items)
    ? resolved
    : [{ key: 'default', label: '', items: resolved }]

  return raw
    .map((group, groupIndex) => ({
      key: String(group?.key ?? group?.label ?? groupIndex),
      label: String(group?.label ?? ''),
      items: (Array.isArray(group?.items) ? group.items : [])
        .map((entry) => ({
          label: String(evaluate(entry?.label) ?? '').trim(),
          count: num(evaluate(entry?.count))
        }))
        .filter((entry) => entry.label && entry.count > 0)
    }))
    .filter((group) => group.items.length > 0)
})
</script>
