<template>
  <div :class="spacingClass">
    <SectionDividerLabel :label="finalTitle" />

    <AqlGroupedList
      :items="rows"
      :loading="pending"
      item-key="key"
      group-key="productCode"
      header-label="productName"
      empty-text="No items on this restock."
      empty-icon="inventory_2"
      :card-class="ui.cardClass"
      label="label"
      :metaLabel="restockCaption"
    >
      <!-- The group header carries the product's own total. Only the restock
           figure: this card states what was asked for, and the outlet's own
           holding is a fact about the outlet, not about this request. -->
      <template #header-right="{ group }">
        <q-chip
          dense square
          :color="groupTotal(group) > 0 ? 'primary' : 'grey-3'"
          :text-color="groupTotal(group) > 0 ? 'white' : 'grey-8'"
          class="text-subtitle1 text-weight-bold q-my-none q-px-sm"
        >
          {{ groupTotal(group) }}
        </q-chip>
      </template>
    </AqlGroupedList>
  </div>
</template>

<script setup>
/**
 * OutletRestocks › View › Items — Section (tier 1: resource + page).
 *
 * What was requested, grouped Product → SKU. A restock is read product-first —
 * "how much Fruit Feeder is going out?" — while quantities are only ever held per
 * SKU, so the product names the group and the variants sit beneath it.
 *
 * Rows show the VARIANT and the quantity, nothing else: the product code is
 * already the group it is sitting in, and repeating it on every row is noise.
 *
 * Every figure is a projection of `useRestockView().productGroups`, the same tree
 * `AllocationDetails` reads, so the two cards cannot state different totals for
 * one request (ARCHITECTURE RULES §6).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlGroupedList from 'components/app/AqlGroupedList.vue'
import { useRestockView } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockView'
import { useRestockViewContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockViewContext'

defineOptions({ name: 'OutletRestocksViewItems', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Items Summary' },
  // The Product → SKU tree to render. Defaults to the request's own items; a
  // caller (or a JS modifier) may narrow it without this card re-deriving anything.
  items: { type: Array, default: null },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useRestockViewContext()

const { productGroups, pending } = useRestockView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

const groups = computed(() => (Array.isArray(props.items) ? props.items : productGroups.value))

// `AqlGroupedList` groups a FLAT array, so the tree is flattened back to one row
// per SKU rather than re-grouped here — the grouping stays a single fact stated
// once, in the composable.
const rows = computed(() => groups.value.flatMap((product) => product.skus.map((group) => ({
  key: group.key,
  productCode: product.productCode,
  productName: product.productName,
  label: group.label,
  quantity: group.quantity,
  uom: group.uom
}))))

function groupTotal (group) {
  return (group?.items || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0)
}

function restockCaption (item) {
  return `${item.quantity} ${item.uom}`.trim()
}
</script>
