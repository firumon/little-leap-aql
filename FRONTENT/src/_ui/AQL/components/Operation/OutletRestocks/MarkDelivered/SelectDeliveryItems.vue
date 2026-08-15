<template>
  <div v-if="visible" :class="gutterClass">
    <!-- What is being confirmed, stated once. The driver arrived from a list and
         needs to know which request this is without going back. -->
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in summaryLines"
            :key="line.key"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.key }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel :label="title" />

    <q-card v-if="!productGroups.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="local_shipping" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing is out for delivery</div>
        <div :class="ui.emptyCaptionClass">
          This request has no allocated items left to confirm.
        </div>
      </q-card-section>
    </q-card>

    <!-- Select-all sits outside the product cards: it acts on every line below
         rather than on any one product. -->
    <q-card v-if="productGroups.length" flat bordered :class="ui.cardClass">
      <q-card-section class="row items-center no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-caption text-grey-7">Selected</div>
          <div class="text-h6 text-weight-bold text-primary">
            {{ selectedQuantity }}
            <span class="text-body2 text-grey-7">of {{ totalQuantity }} units</span>
          </div>
        </div>
        <div class="col-auto">
          <q-toggle
            :model-value="allSelected"
            label="Select all"
            color="primary"
            data-testid="restock-delivery-select-all"
            @update:model-value="onSelectAll"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- One card per PRODUCT, its SKUs beneath it, and the storage rows beneath
         those. Stock is only ever allocated per (SKU, bin), which is why the
         checkboxes bottom out at a storage row — but a delivery is read
         product-first ("did the Fruit Feeders arrive?"), so that is what the
         headers group by. Each header toggles exactly the rows it displays. -->
    <q-card
      v-for="(product, index) in productGroups"
      :key="product.productCode"
      flat
      bordered
      :class="ui.cardClass"
      :style="rowDelay(index)"
    >
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col-auto">
            <q-checkbox
              :model-value="checkState(product)"
              :indeterminate-value="INDETERMINATE"
              color="primary"
              :data-testid="`restock-delivery-product-${product.productCode}`"
              @update:model-value="(value) => toggleProduct(product.productCode, value === true)"
            />
          </div>
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-bold">{{ product.productName }}</div>
            <div class="text-caption text-grey-6">
              {{ product.selectedQuantity }} of {{ product.quantity }} {{ product.uom }} selected
            </div>
          </div>
        </div>

        <q-separator />

        <div v-for="group in product.skus" :key="group.key" class="q-mt-sm">
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col-auto">
              <q-checkbox
                :model-value="checkState(group)"
                :indeterminate-value="INDETERMINATE"
                color="primary"
                :data-testid="`restock-delivery-sku-${group.skuCode}`"
                @update:model-value="(value) => toggleSku(product.productCode, group.skuCode, value === true)"
              />
            </div>
            <div class="col text-body2 text-weight-medium" :class="ui.flexWrapTextClass">{{ group.label }}</div>
            <div class="col-auto text-body2 text-weight-medium text-grey-7">
              {{ group.selectedQuantity }} of {{ group.quantity }} {{ group.uom }}
            </div>
          </div>

          <!-- The storage row is the unit of the decision: it is what a bin
               actually holds, and a part-delivery is expressed by ticking some
               of them. Independently togglable, so the headers above are a
               convenience rather than the only way in. -->
          <div class="q-ml-md" :class="ui.detailGridClass">
            <div
              v-for="row in group.rows"
              :key="row.code"
              class="items-center"
              :class="ui.detailLineClass"
            >
              <div class="row items-center no-wrap full-width">
                <q-checkbox
                  :model-value="row.selected"
                  color="primary"
                  dense
                  :data-testid="`restock-delivery-item-${row.code}`"
                  @update:model-value="(val) => toggleRow(row.code, val)"
                />
                <span class="q-ml-sm" :class="ui.detailKeyClass">{{ row.warehouseCode || '—' }} | {{ row.storageName }}</span>
                <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
                  {{ row.quantity }} {{ row.uom }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 1 of Mark As Delivered: pick what arrived at the outlet.
 *
 * Displays the allocated items of an APPROVED or PARTIALLY_DELIVERED restock
 * grouped hierarchically: Product → SKU → source storage.
 *
 * Each checkbox level drives and reflects its children:
 *   - ticking a Product ticks every SKU and storage row under it;
 *   - ticking an individual bin updates its SKU header, which updates the
 *     Product header;
 *   - partial selections show Quasar's indeterminate dash.
 *
 * Direct hydration: `useRestockDelivery` preloads the active restock's lines
 * from `OutletRestockItems` (and caches them). This component is the first
 * content the contract renders, so it is where that composable is first called.
 * The same pattern `Approve/WarehouseAndLocation.vue` uses for `WarehouseStorages`.
 *
 * Holds no state of its own: every checkbox projects the `DeliverySelection`
 * control field and writes straight back through the composable
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRestockDelivery } from 'src/_ui/AQL/composables/Operation/OutletRestocks/MarkDelivered/useRestockDelivery'
import { useRestockDeliveryContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/MarkDelivered/useRestockDeliveryContext'

defineOptions({ name: 'OutletRestocksMarkDeliveredSelectDeliveryItems', inheritAttrs: false })

// A value Quasar's tri-state checkbox can never confuse with `true`/`false`, so
// a header rendered as partially selected reports back as neither.
const INDETERMINATE = null

const props = defineProps({
  // Which wizard step this card belongs to. Declared by the page contract
  // (`MarkDelivered.js`), not hardcoded here, so the flow can be re-ordered from
  // the contract alone.
  step: { type: Number, default: 1 },
  // Customizable by any `_ui/` tier, as a value or as a function of
  // (record, config) — resolved through `evaluateProp` like every other
  // placeholder prop (UI_MODULE_DEVELOPER_GUIDE.md §8).
  title: { type: [String, Function], default: 'Items Out for Delivery' }
})

const attrs = useAttrs()
const { pageState, evaluate, ui } = useRestockDeliveryContext()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || ui.gutterFallback || 'sm'}`)

const {
  restock,
  outletName,
  productGroups,
  selectedQuantity,
  totalQuantity,
  allSelected,
  toggleRow,
  toggleSku,
  toggleProduct,
  selectAll,
  clearSelection
} = useRestockDelivery()

const visible = computed(() => pageState?.meta.currentStep === props.step)

const title = computed(() => evaluate(props.title) || '')

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })

const summaryLines = computed(() => [
  { key: 'Outlet', value: outletName.value },
  { key: 'Requested on', value: restock.value.Date || '—' },
  { key: 'Request', value: restock.value.Code || '—' }
])
function checkState (node) {
  if (node.allSelected) return true
  if (node.someSelected) return INDETERMINATE
  return false
}

function onSelectAll (val) {
  if (val) selectAll()
  else clearSelection()
}
</script>
