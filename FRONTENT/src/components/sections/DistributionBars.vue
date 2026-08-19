<template>
  <!-- Strict hide rule: nothing renders unless some group has a bar worth drawing. -->
  <div v-if="groups.length" :class="paddingClass">
    <SectionDividerLabel v-if="resolvedTitle" :label="resolvedTitle" />

    <q-card flat bordered :class="cardClass" class="q-pa-md">
      <!-- The dimension selector. Omitted for a single group: a toggle with one option is
           a label wearing a button's clothes. -->
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

      <!-- Row rhythm is a top margin on every row BUT THE FIRST — deliberately not
           `q-gutter-y-*`.

           Quasar's gutter classes work by putting a NEGATIVE top margin on the container
           (`-16px` for `md`) and a matching positive one on each child. Inside a card that
           negative margin has nothing to be absorbed by, so it silently swallows whatever
           spacing the element above sets: a `q-mb-md` on the toggle and the container's
           `-16px` cancel to a zero gap, and every attempt to fix it from above appears to do
           nothing until it exceeds 32px. Spacing the rows themselves keeps the arithmetic
           honest and leaves the toggle's own margin working.

           This is card-internal composition, not page rhythm — the sanctioned use of a
           Quasar spacing class per §10.2. Spacing BETWEEN cards is still the page's gutter. -->
      <div>
        <div
          v-for="(bar, i) in bars"
          :key="bar.label"
          class="aql-detail-row"
          :class="{ 'q-mt-md': i > 0 }"
          :style="rowDelay(i)"
        >
          <!-- Label and count on one baseline, the count in a fixed-width right column so
               every figure in the set aligns on the same edge. A count that drifts left and
               right with the length of its label turns a ranked list into a ragged one. -->
          <div class="row no-wrap items-center q-mb-xs">
            <div class="col ellipsis text-body2 text-weight-medium">{{ bar.label }}</div>
            <div class="col-auto q-ml-md text-right" style="min-width: 3.5rem">
              <span class="text-body2 text-weight-bold">{{ bar.count }}</span>
              <span class="text-caption text-grey-6 q-ml-xs">{{ bar.share }}</span>
            </div>
          </div>
          <!-- Thin and tracked: the bar is a comparison between rows, not a control. A
               heavy bar reads as a progress indicator toward a target that does not exist
               here. `track-color` is what makes the unfilled remainder legible, which is
               half of what a proportional reading is. -->
          <q-linear-progress
            :value="bar.ratio"
            :color="resolvedColor"
            track-color="grey-3"
            size="6px"
            rounded
          />
        </div>
      </div>

      <!-- One honest line rather than a truncated list pretending to be the whole set. -->
      <div v-if="hiddenCount" class="text-caption text-grey-6 q-pt-md">
        + {{ hiddenCount }} more with fewer records
      </div>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Section-subsystem DISTRIBUTION BARS — a ranked breakdown of a record set across one
 * categorical dimension, with an optional selector for switching between dimensions.
 *
 * Answers "where is this concentrated?", which a row of counters cannot: each bar is drawn
 * relative to the largest, so the shape of the distribution is readable at a glance rather
 * than reconstructed from numbers. Built entirely from `q-linear-progress` and Quasar
 * utility classes — no charting library, per CORE_ARCHITECTURE_RULES §7 (Quasar-First).
 *
 * Entirely dimension-agnostic. Provinces, cities, warehouses, suppliers, payment modes — the
 * projection from records to `{ label, count }` belongs to the calling resource's JS
 * modifier, exactly as it does for `MetricCards` and `WorkflowFunnel`.
 *
 * `items` accepts either shape:
 *   - a flat list      `[{ label, count }]`                        → one group, no selector
 *   - grouped          `[{ key, label, items: [{ label, count }] }]` → a selector per group
 *
 * A group whose bars are all zero (or absent) is DROPPED from the selector rather than
 * offered and then found empty — a tenant that never fills `Area` should not be given an
 * Area tab. When every group drops, the whole section removes itself (§9.2 rule 2).
 *
 * Bars are capped at `maxBars` and the remainder is stated as one caption line: a ranked
 * breakdown is a shape, and thirty bars is a table.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7) — every class used here is either Quasar's
 * own or one of the canonical shared families already in `custom.scss`.
 */
import { computed, inject, ref } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

defineOptions({ name: 'SectionsDistributionBars', inheritAttrs: false })

const props = defineProps({
  // Divider label above the card. Omitted renders no divider.
  title: { type: [String, Function], default: '' },
  // Flat `[{ label, count }]` or grouped `[{ key, label, items }]`. Function-valued so a JS
  // modifier stays reactive — a modifier's return is resolved once and cached, so a plain
  // array would freeze at whatever the store held on the first tick (§9.2 rule 1).
  items: { type: [Array, Function], default: null },
  // Bar colour. One colour for the whole set: the bars are one measurement, not a legend.
  color: { type: [String, Function], default: 'primary' },
  // How many bars before the tail collapses into a "+ N more" line.
  maxBars: { type: Number, default: 8 },
  // The calling UI's card shell. Left EMPTY here on purpose: a framework base under
  // `src/components/` may not import a `_ui/{Ui}/_config/`, and hardcoding one UI's shell
  // class would hand every other UI a look it never chose (§10.1). The resource's JS
  // modifier passes its own `ui.cardClass` down.
  cardClass: { type: [String, Array, Object], default: '' },
  // Per-row entrance delay in ms, matching the UI's row stagger.
  rowStaggerMs: { type: Number, default: 40 },
  // Horizontal inset, supplied by `Page.vue` as `:padding="pageProps.sectionPadding"`.
  //
  // This component sets `inheritAttrs: false` (§12.1 — it is the leaf the resolver mounts),
  // which DROPS the `q-px-{sectionPadding}` class `Page.vue` also puts on the placeholder.
  // That is why the framework passes the token as a real PROP as well: a declared `padding`
  // prop is the sanctioned channel for a section's horizontal inset (§7.5, §10.2), and the
  // only one that survives a leaf. Vertical rhythm still belongs to the page body's gutter.
  padding: { type: String, default: 'sm' }
})

const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

const paddingClass = computed(() => (props.padding ? `q-px-${props.padding}` : ''))

const evaluate = (value) => evaluateProp(value, resourceRecord, resourceConfig)

const resolvedTitle = computed(() => evaluate(props.title) || '')
const resolvedColor = computed(() => evaluate(props.color) || 'primary')

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Normalize either accepted shape into one grouped form, dropping every empty group. */
const groups = computed(() => {
  const resolved = evaluate(props.items)
  if (!Array.isArray(resolved) || !resolved.length) return []

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

// The user's choice, when they have made one. Held separately from the resolved active key
// so a selection that becomes invalid (its group emptied out as data landed) falls back
// silently to the first available group instead of leaving the card blank.
const chosenKey = ref('')

const activeKey = computed(() => {
  const chosen = chosenKey.value
  if (chosen && groups.value.some((group) => group.key === chosen)) return chosen
  return groups.value[0]?.key ?? ''
})

const selectGroup = (key) => { chosenKey.value = key ?? '' }

const activeGroup = computed(() =>
  groups.value.find((group) => group.key === activeKey.value) || groups.value[0] || null)

/**
 * Bars scaled against the LARGEST in the active group, so the shape uses the full width.
 *
 * The `share` beside each count is measured against the group TOTAL, not against the peak —
 * the two answer different questions, and a "48 (100%)" on the leading row would be plainly
 * wrong to anyone reading it as a proportion of the estate.
 */
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
