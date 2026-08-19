<template>
  <MetricCards :title="finalTitle" :items="items" :class="paddingClass" />
</template>

<script setup>
/**
 * Outlets › View › SummaryStats — Section (tier CP: resource + page).
 *
 * The four standing positions this outlet is in right now: visits on the book, restocks still
 * moving, returns still open, and money still owed. This is the one card on the page that
 * answers "what is outstanding here" without the reader having to count rows in the five
 * cards beneath it.
 *
 * Every figure is a filter over the SAME per-outlet slices those five cards render, so the
 * "3 pending restocks" here and the three chips down there are one computation (§7.4).
 *
 * Built on the framework `MetricCards` base rather than a bespoke tile row, so the grid, the
 * colour resolution, the divider and the hide rule all come from the widget catalogue (§9.2)
 * and this file supplies only the numbers.
 *
 * Hides itself while loading and when every position is clear — an outlet with nothing
 * outstanding should read as a quiet page, not as four zeroes.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import MetricCards from 'components/sections/MetricCards.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewSummaryStats', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Open Positions' },
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

const {
  evaluate, pending, money, plannedVisits, pendingRestocks, openReturns, outstanding, stockUnits
} = useOutletViewContext()

const paddingClass = computed(() => (props.padding ? `q-px-${props.padding}` : ''))
const finalTitle = computed(() => evaluate(props.title))

const items = computed(() => {
  if (pending.value) return []

  const visits = plannedVisits.value.length
  const restocks = pendingRestocks.value.length
  const returns = openReturns.value.length
  const owed = outstanding.value

  // Tested on the AMOUNT as well as the counts: an outlet whose only open item is a
  // fully-settled invoice would otherwise keep a wall of zeroes on screen (§9.2 rule 2).
  if (!visits && !restocks && !returns && !owed && !stockUnits.value) return []

  return [
    {
      label: 'Planned visits',
      number: visits,
      unit: '',
      color: visits > 0 ? 'primary' : 'grey-6'
    },
    {
      label: 'Restocks in flight',
      number: restocks,
      unit: '',
      color: restocks > 0 ? 'teal-7' : 'grey-6'
    },
    {
      label: 'Open returns',
      number: returns,
      unit: '',
      color: returns > 0 ? 'warning' : 'grey-6'
    },
    {
      label: 'Outstanding',
      number: money(owed),
      unit: '',
      color: owed > 0 ? 'negative' : 'positive'
    }
  ]
})
</script>
