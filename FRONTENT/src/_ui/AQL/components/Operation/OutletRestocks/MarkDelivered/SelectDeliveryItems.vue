<template>
  <div v-if="visible" :class="gutterClass">
    <!-- What is being confirmed, stated once. The driver arrived from a list and
         needs to know which request this is without going back. -->
    <q-card flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section>
        <div class="aql-detail-grid">
          <div
            v-for="(line, index) in summaryLines"
            :key="line.key"
            class="aql-detail-line items-center aql-detail-row"
            :style="rowDelay(index)"
          >
            <span class="aql-detail-key">{{ line.key }}</span>
            <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <SectionDividerLabel :label="title" />

    <q-card v-if="!productGroups.length" flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="local_shipping" size="48px" color="grey-4" class="q-mb-sm block q-mx-auto" />
        <div class="text-subtitle1 text-weight-bold text-grey-6">Nothing is out for delivery</div>
        <div class="text-caption text-grey-6">
          This request has no allocated items left to confirm.
        </div>
      </q-card-section>
    </q-card>

    <!-- Select-all sits outside the product cards: it acts on every line below
         rather than on any one product. -->
    <q-card v-if="productGroups.length" flat bordered class="page-card aql-premium-gradient-card">
      <q-card-section class="row items-center no-wrap q-col-gutter-sm">
        <div class="col aql-flex-wrap-text">
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
      class="page-card aql-premium-gradient-card"
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
          <div class="col aql-flex-wrap-text">
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
                :data-testid="`restock-delivery-sku-${group.sku}`"
                @update:model-value="(value) => toggleSku(product.productCode, group.sku, value === true)"
              />
            </div>
            <div class="col aql-flex-wrap-text">
              <div class="text-body2 text-weight-medium">{{ group.label }}</div>
            </div>
            <div class="col-auto text-right text-body2 text-weight-medium text-grey-7">
              {{ group.quantity }} {{ group.uom }}
            </div>
          </div>

          <!-- The storage row is the unit of the decision: it is what a bin
               actually holds, and a part-delivery is expressed by ticking some
               of them. Independently togglable, so the headers above are a
               convenience rather than the only way in. -->
          <div class="aql-detail-grid q-ml-lg">
            <div
              v-for="row in group.rows"
              :key="row.code"
              class="aql-detail-line items-center"
            >
              <span class="aql-detail-key">
                <q-checkbox
                  :model-value="row.selected"
                  color="primary"
                  :label="`${warehouseLabel(row)} | ${row.storageName}`"
                  dense
                  :data-testid="`restock-delivery-row-${row.code}`"
                  @update:model-value="(value) => toggleRow(row.code, value === true)"
                />
              </span>
              <span class="aql-detail-val col overflow-hidden flex justify-end items-center">
                {{ row.quantity }} {{ row.uom }}
              </span>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 1 of Mark As Delivered: which allocated lines actually arrived.
 *
 * Also the page's hydration point. An `_action/:action` route is a custom
 * sub-route, so `usePageResolver` loads no record for it and there is no `Update`
 * content to seed pageState — `useRestockDelivery` does both (and fetches the
 * child items, SKUs and Products the tree is built from), and this is the first
 * content the contract renders, so it is where that composable is first called.
 * The same pattern `Approve/WarehouseAndLocation.vue` uses for `WarehouseStorages`.
 *
 * Holds no state of its own: every checkbox projects the `DeliverySelection`
 * control field and writes straight back through the composable
 * (ARCHITECTURE RULES §6, UI_MODULE_DEVELOPER_GUIDE.md §10).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useRestockDelivery } from 'src/_ui/AQL/composables/Operation/OutletRestocks/MarkDelivered/useRestockDelivery'
import { useRestockDeliveryContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/MarkDelivered/useRestockDeliveryContext'

defineOptions({ name: 'OutletRestocksMarkDeliveredSelectDeliveryItems', inheritAttrs: false })

// A value Quasar's tri-state checkbox can never confuse with `true`/`false`, so
// a header rendered as partially selected reports back as neither.
const INDETERMINATE = null

// Hoisted rather than written inline in the template: a fresh object literal per
// render is a new prop identity every time, which defeats the child's own
// memoization for nothing.
const ROW_STAGGER_MS = 40

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
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, evaluate } = useRestockDeliveryContext()

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

// The same 40ms cadence the framework detail cards animate on, so a custom card
// stacked beside one enters in step (§10).
const rowDelay = (index) => ({ animationDelay: `${index * ROW_STAGGER_MS}ms` })

const summaryLines = computed(() => [
  { key: 'Outlet', value: outletName.value },
  { key: 'Requested on', value: restock.value.Date || '—' },
  { key: 'Request', value: restock.value.Code || '—' }
])

// Tri-state, derived from the group's own children: fully ticked, untouched, or
// partial. Quasar renders the indeterminate glyph only when `modelValue` IS the
// `indeterminate-value`, so the partial case has to be reported as that value
// rather than as a separate flag — a plain boolean would show a partly-delivered
// product as entirely unselected.
function checkState (group) {
  if (group.allSelected) return true
  return group.someSelected ? INDETERMINATE : false
}

// A warehouse row is labelled by its code alone: `Warehouses` is not among the
// resources this flow loads, and the code is the identifier printed on the
// pick list the driver is holding.
function warehouseLabel (row) {
  return row.warehouseCode || '—'
}

function onSelectAll (value) {
  if (value === true) selectAll()
  else clearSelection()
}
</script>
