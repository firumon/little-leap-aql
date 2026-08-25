<template>
  <StreamCard
    :title="finalTitle"
    :items="stock"
    :list="list"
    :limit="NO_LIMIT"
    empty-title="Nothing on the shelf"
    empty-text="This outlet is holding no stock right now."
    empty-icon="inventory"
  >
    <template #footer>
      <div class="text-caption text-grey-7">
        {{ lineCount }} {{ lineCount === 1 ? 'item' : 'items' }}
      </div>
      <div class="text-body2 text-weight-bold">
        {{ totalUnits.toLocaleString() }} units
      </div>
    </template>
  </StreamCard>
</template>

<script setup>
/**
 * Outlets › View › CurrentStock — Section (tier CP: resource + page).
 *
 * What this outlet is holding right now, largest quantity first.
 *
 * `OutletStorages` is a DERIVED balance maintained by a post-write hook on the movement
 * ledger — the frontend reads it and never edits it (SHEET_OPERATION_STRUCTURE.md). So this
 * card is strictly a readout, with no adjustment control of any kind; a stock correction is
 * a movement, raised on the resource that owns movements.
 *
 * The SKU is named through the SKU domain's own `skuLabelOf`, so the reader sees a product
 * and its variants rather than a code like `CK3-09` that identifies a row to the system and
 * nothing to a person (§7.2 — never surface an unresolved identifier).
 *
 * ── EVERY LINE, NO TAIL ──
 * Alone among the cards on this page, this one is a POSITION rather than a history. The
 * others are summaries whose full record lives on the owning resource's own page, so
 * truncating them costs nothing; truncating a position produces a stock figure that is
 * simply wrong, and there is no other page that shows this outlet's shelf. So it renders
 * unbounded and states its own totals instead of a "showing 8 of 40" apology.
 *
 * ── THE FOOTER ──
 * Two figures in two different units, which is exactly why they are a footer and not two
 * more metric cards: they are the COLUMN TOTALS of the rows immediately above, and they only
 * mean anything read against them. The distinct-SKU count is on the left in caption weight
 * because it merely says how long the list is; the unit sum is on the right in bold, on the
 * same edge as every quantity in the column it totals.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import StreamCard from './StreamCard.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewCurrentStock', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Current Stock' }
})

const { evaluate, stock, stockUnits, skuLabelOf } = useOutletViewContext()

// Hoisted rather than written inline: `Infinity` is not in Vue's template-expression global
// whitelist, so `:limit="Infinity"` resolves to undefined and silently restores the default.
const NO_LIMIT = Number.POSITIVE_INFINITY

const finalTitle = computed(() => evaluate(props.title))
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

/** How many distinct SKU positions the outlet holds. */
const lineCount = computed(() => stock.value.length)

/**
 * The unit sum across every SKU.
 *
 * Read from the page composable's `stockUnits`, not re-added here: the same total already
 * backs the Open Positions card's guard, and two independent sums over one list is exactly
 * the drift one shared projection exists to prevent (§7.4).
 */
const totalUnits = computed(() => stockUnits.value)

const list = computed(() => ({
  itemKey: 'Code',
  layout: ['label', 'caption'],
  content: [
    (row) => skuLabelOf(row.SKU).primary,
    (row) => skuLabelOf(row.SKU).secondary
  ],
  metaLayout: ['label'],
  metaLabel: (row) => `${num(row.Quantity).toLocaleString()} ${skuLabelOf(row.SKU).uom}`,
  // Read-only balances: nothing on this card navigates, because `OutletStorages` has no
  // record page a reader could usefully land on.
  clickable: false
}))
</script>
