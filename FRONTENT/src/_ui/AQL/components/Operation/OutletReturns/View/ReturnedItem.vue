<template>
  <div v-if="pending || record" :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="pending">
        <q-skeleton type="text" width="60%" class="q-mb-sm" />
        <q-skeleton type="text" width="35%" />
      </q-card-section>

      <q-card-section v-else>
        <!-- The product NAMES the card; the SKU code is what it is called in the system.
             Nothing else sits on this row: a figure floated to the right of it started a
             second column that the label/value grid below then failed to line up with. -->
        <div class="q-pb-sm" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">{{ productName || '—' }}</div>
          <div class="text-caption text-grey-8">{{ record?.SKU || '' }}</div>
        </div>

        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in lines"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>

      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletReturns › View › ReturnedItem — Section (tier 1: resource + page).
 *
 * What physically came back and why: the product, how many, at what unit credit, and the
 * reason the officer gave.
 *
 * ── ONE TITLE, THEN ONE GRID ──
 * The product names the card and its SKU code is the subtitle; everything else — quantity,
 * unit credit, credit value, reason, and the officer's own note — is a line in the same
 * label/value grid. Nothing floats beside the title and nothing hangs below the grid,
 * because a card this small cannot carry three alignments and still read as one thing.
 *
 * The credit total is DERIVED by Layer 2's `returnValueOf`, never multiplied here — the
 * Index metric, this card and the invoice deduction all read the same function, so what the
 * outlet is told they are owed cannot drift from what the bill deducts (§4).
 *
 * Money renders through `_C()` (ARCHITECTURE RULES §4) — no hardcoded symbol.
 *
 * Self-guards its own loading and empty states (§7.4, §10.4). No `<style>` block (§7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useReturnView } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnView'
import { useReturnViewContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/View/useReturnViewContext'

defineOptions({ name: 'OutletReturnsViewReturnedItem', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Returned Item' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useReturnViewContext()
const { record, pending, skuName, creditValue, reasonLabel } = useReturnView()
const { _C } = useCurrency()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const quantity = computed(() => Math.abs(Number(record.value?.Qty) || 0))
const reasonText = computed(() => reasonLabel(record.value?.Reason))
const reasonComment = computed(() => String(record.value?.ReasonComment ?? '').trim())

/**
 * The product alone, without its variants.
 *
 * `skuName` from the read model appends the variant string, which belongs in a list row
 * where one line has to identify the item completely. Here the SKU code sits directly
 * underneath as the subtitle, so the variants would be a third way of saying the same
 * thing on the same three lines.
 */
const productName = computed(() => {
  const sku = record.value?.$sku
  return String(sku?.$product?.Name || sku?.Name || skuName.value || '').trim()
})

/**
 * EVERY fact is a line, including the reason and the officer's note.
 *
 * The card used to float the quantity at display scale beside the title and print the note
 * as a loose block underneath, which gave one small card three different alignments. One
 * grid reads as one card — and the note is the reason it is `detailLineClass` rather than a
 * block: `ui.detailValClass` wraps, so prose of unknown length still lands in the column
 * every other value is in.
 */
const lines = computed(() => {
  const row = record.value
  if (!row) return []
  return [
    { label: 'Quantity', value: quantity.value },
    { label: 'Unit Credit', value: _C(Number(row.Price) || 0) },
    { label: 'Credit Value', value: _C(creditValue.value) },
    { label: 'Reason', value: reasonText.value },
    { label: 'Reason Comment', value: reasonComment.value }
  ].filter((line) => String(line.value).trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
