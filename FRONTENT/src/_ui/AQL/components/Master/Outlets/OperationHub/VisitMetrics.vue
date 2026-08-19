<template>
  <MetricCards title="Visits" :items="items" :class="paddingClass" />
</template>

<script setup>
/**
 * Outlets › Operation Hub › VisitMetrics — Section (tier CP: resource + page).
 *
 * The field route, one week back and one week forward. Both cards read the domain's
 * `VISIT_WINDOW_DAYS`, which is deliberately narrower than the activity window the progress
 * card below uses: "who did the rep see this week" is a route question, and a fortnight of
 * visits is a report rather than a round.
 *
 * Counted in OUTLETS — two visits to one shop is still one stop. The window itself is stated
 * in the LABEL rather than beside the figure, so the number cannot be misread as an all-time
 * total (§9's scope rule) without a second number competing with it.
 *
 * ── NO `unit` STRINGS ──
 * Label and number only, matching the two metric rows above. The visit count that used to
 * sit beside each figure answered a question nobody was asking on this page: the reader is
 * deciding where to send someone, and that is a count of places.
 *
 * Sections render outside `AqlContentWrapper`, so this one self-guards on `pending` (§9.1).
 * The base hides the row entirely when both halves are zero.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useOutletOverviewContext } from 'src/_ui/AQL/composables/Master/Outlets/useOutletOverviewContext'

const props = defineProps({
  // Horizontal inset, supplied by `Page.vue` as `:padding="pageProps.sectionPadding"`.
  //
  // Needed because this component sets `inheritAttrs: false` (§12.1 — it is the leaf the
  // resolver mounts), which DROPS the `q-px-{sectionPadding}` class `Page.vue` also puts on
  // the placeholder. The framework passes the same token as a real PROP for exactly this
  // case: a declared `padding` prop is the sanctioned channel for a section's horizontal
  // inset (§7.5, §10.2) and the only one that survives a leaf. Vertical rhythm still belongs
  // to the page body's gutter.
  padding: { type: String, default: 'sm' }
})

defineOptions({ name: 'OutletsOperationHubVisitMetrics', inheritAttrs: false })

const paddingClass = computed(() => (props.padding ? `q-px-${props.padding}` : ''))

const { pending, visits } = useOutletOverviewContext()

const items = computed(() => {
  if (pending.value) return []

  const window = visits.value
  if (!window.recentOutlets && !window.upcomingOutlets) return []

  return [
    {
      label: `Visited (last ${window.windowDays} days)`,
      number: window.recentOutlets,
      color: window.recentOutlets > 0 ? 'positive' : 'grey-6'
    },
    {
      label: `Planned (next ${window.windowDays} days)`,
      number: window.upcomingOutlets,
      color: window.upcomingOutlets > 0 ? 'primary' : 'grey-6'
    }
  ]
})
</script>
