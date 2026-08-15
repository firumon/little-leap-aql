<template>
  <AqlGroupedList
    :items="items"
    item-key="SKU"
    group-key="productCode"
    header-label="productName"
    :empty-text="emptyText"
    :empty-icon="emptyIcon"
    :card-class="ui.cardClass"
    label="variantLabel"
    :caption="stockCaption"
  >
    <!-- The group header carries the whole product's arithmetic: what the outlet
         holds now, what this request adds, and what it ends up with. The old
         "+N" chip said strictly less than the middle term of this equation. -->
    <template #header-right="{ group }">
      <div class="row items-center no-wrap q-gutter-x-xs">
        <span class="text-subtitle1 text-weight-medium text-grey-7">{{ groupTotal(group, 'outletQuantity') }}</span>
        <q-icon name="add" size="14px" color="grey-5" />
        <span class="text-subtitle1 text-weight-bold" :class="groupTotal(group, 'restockQuantity') > 0 ? 'text-primary' : 'text-grey-5'">
          {{ groupTotal(group, 'restockQuantity') }}
        </span>
        <!-- material-icons (classic) ships no equals glyph, so the operator is a
             styled character matched to the `add` icon's weight and colour. -->
        <span class="text-body2 text-weight-bold text-grey-5">=</span>
        <q-chip
          dense square
          :color="groupTotal(group, 'restockQuantity') > 0 ? 'primary' : 'grey-3'"
          :text-color="groupTotal(group, 'restockQuantity') > 0 ? 'white' : 'grey-8'"
          class="text-h6 text-weight-bold q-my-none q-px-sm"
        >
          {{ groupTotal(group, 'finalQuantity') }}
        </q-chip>
      </div>
    </template>

    <template #btn="{ item }">
      <div class="row items-center no-wrap q-gutter-x-xs">
        <q-btn
          outline round color="secondary" icon="remove" padding="none"
          :style="ui.tapTargetStyle"
          :disable="item.restockQuantity <= 0"
          :aria-label="`Remove one ${item.variantLabel}`"
          @click="emit('adjust', item.SKU, -1)"
        />
        <FieldNumberAdd
          :model-value="item.restockQuantity"
          :record="item"
          :config="quantityConfig"
          header="Quantity"
          @update:model-value="emit('update', item.SKU, $event)"
        />
        <q-btn
          outline round color="secondary" icon="add" padding="none"
          :style="ui.tapTargetStyle"
          :disable="item.restockQuantity >= item.maxQuantity"
          :aria-label="`Add one ${item.variantLabel}`"
          @click="emit('adjust', item.SKU, 1)"
        />
      </div>
    </template>
  </AqlGroupedList>
</template>

<script setup>
/**
 * Shared row layout for both item cards (`AdjustItems`, `NewItems`), so the
 * existing-stock list and the new-stock list are literally the same control and
 * cannot drift apart. Private to `OutletRestocks` — it sits beside its two
 * consumers rather than under a page folder because they are shared by Add and
 * Edit, but it is not a page `contents:` entry, so `Content.vue` never resolves
 * it (ARCHITECTURE RULES §8).
 *
 * Purely presentational: quantities arrive as props and every change leaves as an
 * event, so the single source of truth stays in `useRestockStockMatch` → pageState.
 */
import { computed } from 'vue'
import AqlGroupedList from 'components/app/AqlGroupedList.vue'
import FieldNumberAdd from 'src/_fields/number/Add.vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'

defineOptions({ name: 'OutletRestocksStockMatchGroups', inheritAttrs: false })

const props = defineProps({
  items: { type: Array, default: () => [] },
  // Direct mode draws from a real warehouse, so each row also reports what the
  // source warehouse is left with. A standard request has no source yet.
  showWarehouse: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No items found.' },
  emptyIcon: { type: String, default: 'inventory_2' }
})

const emit = defineEmits(['update', 'adjust'])

const ui = useAQLConfig()

// `FieldNumberAdd` declares `inheritAttrs: false` and v-binds `config` straight
// onto its `q-input`, so the stepper's fixed width has to travel in `config` —
// a `style` on the component itself would be dropped.
//
// NOT `dense`. This is the primary control of the whole Add/Edit flow — the number
// the user is actually here to set — and a dense field gave it a smaller tap target
// than the +/- buttons flanking it. Standard height also matches every other input
// on the page, so the item cards stop reading as a denser, secondary form.
const quantityConfig = computed(() => ({
  min: 0,
  hideBottomSpace: true,
  style: 'width: 64px',
  inputClass: 'text-center text-weight-bold q-px-none'
}))

function groupTotal (group, key) {
  return (group?.items || []).reduce((sum, row) => sum + Number(row[key] || 0), 0)
}

function stockCaption (item) {
  const parts = [`Outlet ${item.outletQuantity}`]
  if (props.showWarehouse) parts.push(`Warehouse ${item.warehouseRemaining}`)
  return parts.join(' · ')
}
</script>
