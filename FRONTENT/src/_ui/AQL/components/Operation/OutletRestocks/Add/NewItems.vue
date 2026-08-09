<template>
  <div v-if="pageState?.meta.currentStep === 2" :class="gutterClass">
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
 * Step 2b of the restock wizard: SKUs the outlet does not stock yet
 * (`outletQuantity <= 0`), so any quantity here opens a new line at the outlet.
 *
 * Same layout and same handlers as `AdjustItems` — the split is purely which
 * half of the stock-match aggregate each card renders.
 */
import { computed, inject, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import StockMatchGroups from './StockMatchGroups.vue'
import { useRestockStockMatch } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockStockMatch'

defineOptions({ name: 'OutletRestocksNewItems', inheritAttrs: false })

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const { newRows, isDirect, setQuantity, adjustQuantity } = useRestockStockMatch()
</script>
