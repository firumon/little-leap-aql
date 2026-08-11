<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="Requested Items" />

    <q-card v-if="!productGroups.length" class="aql-premium-card" flat>
      <q-card-section class="text-center q-py-xl">
        <q-icon name="inventory_2" size="48px" color="grey-4" class="q-mb-sm block q-mx-auto" />
        <div class="text-subtitle1 text-weight-bold text-grey-6">Nothing left to allocate</div>
        <div class="text-caption text-grey-6">Every line on this request has already been settled.</div>
      </q-card-section>
    </q-card>

    <!-- One card per PRODUCT. The card is a separate component so this stays a
         thin list, and so the card itself is overridable on its own at any of the
         10 `_ui/` tiers. -->
    <SkuAllocatingCard
      v-for="group in productGroups"
      :key="group.productCode"
      :group="group"
      @allocate="autoAllocateProduct"
      @clear="clearProduct"
      @quantity="onQuantity"
      @cancel="setCancelled"
    />
  </div>
</template>

<script setup>
/**
 * Step 1b of the restock approval: which bins each requested line draws from.
 *
 * A pass-through between `useRestockApproval` and the per-product cards. Every
 * input the card emits is routed straight into the composable, and every figure
 * the card renders was read back out of the same projection — so the quantity an
 * input shows is by construction the quantity the payload will carry
 * (ARCHITECTURE RULES §6).
 *
 * The composable clamps each write to what the bin can still give and to the
 * line's own outstanding requirement, so nothing here performs arithmetic and
 * no input can over-allocate.
 */
import { computed, inject, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import SkuAllocatingCard from './SkuAllocatingCard.vue'
import { useRestockApproval } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockApproval'

defineOptions({ name: 'OutletRestocksApproveItemAllocating', inheritAttrs: false })

const props = defineProps({
  step: { type: Number, default: 1 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const {
  productGroups,
  setLineQuantity,
  setCancelled,
  autoAllocateProduct,
  clearProduct
} = useRestockApproval()

const visible = computed(() => pageState?.meta.currentStep === props.step)

// The card emits the whole bin so this layer never has to reconstruct the
// warehouse/storage pair from a key it would first have to split.
function onQuantity (skuCode, bin, value) {
  setLineQuantity(skuCode, bin.warehouseCode, bin.storageName, value)
}
</script>
