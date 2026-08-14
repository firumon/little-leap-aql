<template>
  <div v-if="visible" :class="gutterClass">
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
 * SKUs the outlet already stocks (`outletQuantity > 0`), so the user is topping
 * up a known line rather than introducing one.
 *
 * Lives at the RESOURCE tier (not under `Add/`) so `useContentResolver` hands the
 * same component to both the Add wizard and the Edit page — the two pages must
 * offer the identical control or a restock could be edited into a shape the
 * wizard could never have produced.
 *
 * Which step it belongs to is therefore the PAGE's business, not this card's: the
 * Add contract declares `PropsAdjustItems: { step: 2 }`, the single-view Edit
 * contract declares nothing and the card is simply always on. Gating on
 * `currentStep === 2` directly would have hidden it forever on Edit, where
 * `usePageState` leaves `meta.currentStep` at its initial 1 and no bar moves it.
 *
 * Holds no state of its own — `useRestockStockMatch` derives every row from the
 * resource records plus pageState, and the adjust handlers write back to
 * pageState, which is what re-renders this list (ARCHITECTURE RULES §6).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import StockMatchGroups from './StockMatchGroups.vue'
import { useRestockStockMatch } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockStockMatch'

defineOptions({ name: 'OutletRestocksAdjustItems', inheritAttrs: false })

const props = defineProps({
  // Wizard step this card belongs to; null = no wizard, always rendered.
  step: { type: [Number, String], default: null }
})

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — UI_PAGE_AND_SECTION_SYSTEM.md §1.3.4).
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const visible = computed(() => props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

const { pageState, existingRows, isDirect, setQuantity, adjustQuantity } = useRestockStockMatch()
</script>
