<template>
  <div v-if="pageState?.meta.currentStep === 2" :class="gutterClass">
    <SectionDividerLabel label="Items in Outlet" />
    <StockMatchGroups
      :items="existingRows"
      :show-warehouse="isDirect"
      empty-text="This outlet has no stock on hand yet."
      empty-icon="storefront"
      @update="setQuantity"
      @adjust="adjustQuantity"
    />
  </div>
</template>

<script setup>
/**
 * Step 2a of the restock wizard: SKUs the outlet already stocks
 * (`outletQuantity > 0`), so the user is topping up a known line rather than
 * introducing one.
 *
 * Holds no state of its own — `useRestockStockMatch` derives every row from the
 * resource records plus pageState, and the adjust handlers write back to
 * pageState, which is what re-renders this list (ARCHITECTURE RULES §6).
 */
import { computed, inject, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import StockMatchGroups from './StockMatchGroups.vue'
import { useRestockStockMatch } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockStockMatch'

defineOptions({ name: 'OutletRestocksAdjustItems', inheritAttrs: false })

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const { existingRows, isDirect, setQuantity, adjustQuantity } = useRestockStockMatch()
</script>
