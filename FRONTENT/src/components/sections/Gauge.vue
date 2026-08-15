<template>
  <!-- Strict hide rule, matching every other widget base: a gauge needs a denominator to
       mean anything, and a 0% dial on a day with nothing scheduled reads as a failure
       rather than as an empty calendar (UI_MODULE_DEVELOPER_GUIDE.md §9.2 rule 2). -->
  <div
    v-if="dials.length"
    class="aql-gauge"
  >
    <SectionDividerLabel v-if="finalTitle" :label="finalTitle" />

    <div class="aql-gauge__row row wrap items-stretch justify-center">
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
          <!-- The centre readout. Slot-shaped so a tenant can put a chip, an icon or a
               different figure in the middle without replacing the dial. -->
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
  </div>
</template>

<script setup>
/**
 * Gauge — a proportional dial for a ratio the reader is expected to close.
 *
 * The gap this fills next to the existing widget bases: `LinearProgress` states a ratio as
 * a bar, which reads as steady accumulation and is right for a fulfilment rate measured
 * over a backlog. A gauge reads as a TARGET — a bounded thing that is either finished
 * today or is not — so it suits a same-day completion ratio, where the denominator resets
 * every morning and "82%" is a standing instruction rather than a trend.
 *
 * Entirely ratio-agnostic. Numerator, denominator, colour and wording all arrive as
 * `items`, so the projection from records to a percentage belongs to the calling
 * resource's JS modifier — the same division of labour as `AgeingBuckets` and
 * `WorkflowFunnel`. See
 * `_ui/AQL/components/Operation/OutletConsumptions/Index/Gauge.js` for a worked projection.
 *
 * `QCircularProgress`, not `QKnob`: a knob is an INPUT, and a reading the user cannot
 * change should not be draggable. The two render near-identically, and the difference is
 * whether a stray touch rewrites a figure the page is reporting.
 *
 * RENDERABLE CONTRACT (UI_RENDERABLE_CONTRACT.md). Three cells are slot-shaped — the
 * centre `display`, the `label` beneath the dial, and its `caption`. Each is somewhere a
 * tenant could plausibly want a chip or a component rather than text, and each therefore
 * routes through one `<Renderable>` node so that change stays a JS modifier instead of a
 * `.vue` override. `value`/`max`/`color`/`size`/`thickness` are consumed as values, never
 * rendered, and stay directly typed so their checks keep doing real work.
 *
 * No `<style>` block — `.aql-gauge*` lives in `src/css/custom.scss` (ARCHITECTURE RULES §7),
 * because this is an override target and a tenant `.vue` cannot inherit a scoped style.
 */
import { computed, inject, useSlots } from 'vue'
import { QItemLabel } from 'quasar'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { resolveCssColor } from 'src/utils/colorHelpers'
import Renderable from 'components/abstract/Renderable.js'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'

// `inheritAttrs: false` because this renders a DOM root and every `Props<Identity>` block
// on the page is in its `$attrs` — with fallthrough on, those objects land on the div as
// `propsgauge="[object Object]"` (UI_MODULE_DEVELOPER_GUIDE.md §12.1).
defineOptions({ name: 'SectionsGauge', inheritAttrs: false })

const props = defineProps({
  // Section-level divider label rendered above the dials.
  title: { type: [String, Function], default: '' },
  // [{ label, caption, value, max, color, display }] — each field may itself be a closure.
  // Falls back to the single-dial props below when it resolves empty, so a one-ratio
  // caller need not wrap a lone object in an array.
  items: { type: [Array, Function], default: null },

  // ── Single-dial fallback surface ──
  // Slot-shaped, hence widened to accept a component definition (§3.2).
  label: { type: [String, Function, Object], default: '' },
  caption: { type: [String, Function, Object], default: '' },
  // The centre readout. Defaults to the computed percentage when not supplied.
  display: { type: [String, Function, Object], default: null },
  value: { type: [Number, String, Function], default: null },
  max: { type: [Number, String, Function], default: null },
  color: { type: [String, Function], default: 'primary' },

  // Consumed as values, never rendered — deliberately NOT widened.
  size: { type: String, default: '96px' },
  thickness: { type: Number, default: 0.18 }
})

const slots = useSlots()

// ── Contexts ──
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)

function evaluate (val) {
  return evaluateProp(val, resourceRecord, resourceConfig)
}

const finalTitle = computed(() => evaluate(props.title) || '')

/**
 * A resolved figure, or `null` when there is none.
 *
 * The blank check comes BEFORE `Number()`, and that ordering is the whole contract:
 * `Number(null)` and `Number('')` are both `0`, so coercing first makes "no value was
 * supplied" indistinguishable from "the value is zero". That collapse defeats the strict
 * hide rule — an unconfigured single-dial fallback would resolve to a real `0`, build a
 * dial, and render a permanent empty 0% ring on every page that mounts this section
 * without props.
 */
function toNumber (val) {
  const resolved = evaluate(val)
  if (resolved === null || resolved === undefined || resolved === '') return null
  const num = Number(resolved)
  return Number.isFinite(num) ? num : null
}

/**
 * One dial's percentage.
 *
 * `max > 0` makes it `(value / max) * 100`. With no usable `max`, `value` IS the
 * percentage — and a figure in `(0..1]` is read as a fraction and scaled, which is what
 * lets a caller pass either `0.82` or `82` without the widget silently rendering 0.82%.
 * Every result is clamped to 0..100, so a numerator that exceeds its denominator (more
 * consumptions than planned visits — a real outcome when walk-ins are counted) pins the
 * dial at full rather than overflowing the ring.
 *
 * The same normalization `LinearProgress` performs, deliberately identical: two widgets
 * fed the same pair must not disagree about what it means.
 */
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
  const label = evaluate(raw?.label) ?? ''
  const color = evaluate(raw?.color) || 'primary'
  return {
    key: `${label}-${index}`,
    label,
    caption: evaluate(raw?.caption) ?? '',
    // A caller that supplies no centre readout gets the rounded percentage, which is the
    // only figure the dial is guaranteed to be able to state.
    display: evaluate(raw?.display) ?? `${Math.round(percent)}%`,
    percent,
    color,
    cssColor: resolveCssColor(color, 'var(--q-primary)'),
    value: toNumber(raw?.value),
    max: toNumber(raw?.max)
  }
}

const dials = computed(() => {
  const resolved = evaluate(props.items)
  const source = Array.isArray(resolved) && resolved.length
    ? resolved
    : [{ label: props.label, caption: props.caption, display: props.display, value: props.value, max: props.max, color: props.color }]

  return source
    .map(buildDial)
    // A dial with no resolvable figure is not a reading; dropping it is what makes the
    // section's hide rule fire on a widget with nothing to say.
    .filter(Boolean)
})
</script>
