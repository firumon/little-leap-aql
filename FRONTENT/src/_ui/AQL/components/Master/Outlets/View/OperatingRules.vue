<template>
  <div v-if="record">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="45%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </q-card-section>

      <template v-else>
        <!-- A banner, not a card: it states a fact ABOUT the rows below rather than a fact of
             its own (§10.4). Neutral tint — an outlet running on defaults is a normal state,
             not a fault. -->
        <q-banner v-if="!record.hasRules" dense rounded class="bg-grey-2 text-grey-8">
          <template #avatar><q-icon name="info" color="grey-7" /></template>
          No operating rules are set for this outlet. The figures below are the system
          defaults, which is what every calculation currently uses.
        </q-banner>

        <q-card-section class="q-py-sm">
          <div :class="ui.detailGridClass">
            <div
              v-for="(line, i) in lines"
              :key="line.label"
              class="items-center"
              :class="[ui.detailLineClass, ui.detailRowClass]"
              :style="rowDelay(i)"
            >
              <div :class="ui.detailKeyClass">{{ line.label }}</div>
              <div :class="ui.detailValClass">{{ line.value }}</div>
            </div>
          </div>
        </q-card-section>
      </template>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Outlets › View › OperatingRules — Section (tier CP: resource + page).
 *
 * The `OutletOperatingRules` row joined onto this outlet — the stock ceiling, the visit
 * cadence, the invoice terms, the credit line and the price list every consumption is billed
 * against. A 1:1 relation, so it reads as a second detail card rather than as a list.
 *
 * ── EVERY ROW IS SHOWN, EVEN AT ITS DEFAULT ──
 * This card breaks the identity card's drop-blanks rule deliberately, and the banner above is
 * why: these five figures are the outlet's commercial terms, and "the visit cadence is 14
 * days because nobody set one" is a fact somebody needs, not an empty row. What the card must
 * never do is show a default silently as though it had been chosen.
 *
 * The values are read from the enriched outlet — `useOutletResource` already joined the rules
 * row and resolved the effective price list, including the tenant-wide fallback — so this
 * card never re-derives which price list applies (§4).
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewOperatingRules', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Operating Rules' }
})

const { evaluate, ui, pending, record, money } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

const days = (value) => `${Number(value) || 0} days`

const lines = computed(() => {
  const outlet = record.value
  if (!outlet) return []

  const priceList = outlet.priceList
  const priceListName = priceList?.name || priceList?.code || outlet.priceListCode

  return [
    { label: 'Price list', value: priceListName || 'Default price list' },
    { label: 'Visit every', value: days(outlet.visitFrequencyDays) },
    { label: 'Invoice due in', value: days(outlet.invoiceDueDays) },
    // A zero limit is "no ceiling set", not "a ceiling of nothing" — saying so is the whole
    // point of showing the row.
    {
      label: 'Max stock value',
      value: outlet.maxStockValueLimit > 0 ? money(outlet.maxStockValueLimit) : 'No limit set'
    },
    {
      label: 'Credit limit',
      value: outlet.creditLimit > 0 ? money(outlet.creditLimit) : 'No limit set'
    }
  ]
})
</script>
