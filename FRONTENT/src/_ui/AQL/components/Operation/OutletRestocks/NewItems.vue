<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="New Items" />
    <StockMatchGroups
      :items="newRows"
      :show-warehouse="isDirect"
      empty-text="Every available SKU is already stocked at this outlet."
      empty-icon="add_shopping_cart"
      @update="setQuantity"
      @adjust="adjustQuantity"
    />
  </div>
</template>

<script setup>
/**
 * SKUs the outlet does not stock yet (`outletQuantity <= 0`), so any quantity
 * here opens a new line at the outlet.
 *
 * Same layout, same handlers and the same resource-tier placement as
 * `AdjustItems` — the split is purely which half of the stock-match aggregate
 * each card renders. See that file for why the step gate is a prop rather than a
 * direct `currentStep === 2` test.
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import StockMatchGroups from './StockMatchGroups.vue'
import { useRestockStockMatch } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockStockMatch'

defineOptions({ name: 'OutletRestocksNewItems', inheritAttrs: false })

const props = defineProps({
  // Wizard step this card belongs to; null = no wizard, always rendered.
  step: { type: [Number, String], default: null }
})

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — UI_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const visible = computed(() => props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

const { pageState, newRows, isDirect, setQuantity, adjustQuantity } = useRestockStockMatch()
</script>
