<template>
  <div v-if="visible && restocking" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <!-- Say the fill rule on screen, so the user can trust it (§10.5). -->
        <div class="text-caption text-grey-8 q-pb-sm">
          Filled from what sold. Adjust anything you want to send differently.
        </div>

        <!-- Same stepper layout as step 2, so the muscle memory carries over. -->
        <q-list v-if="restockRows.length" separator>
          <q-item v-for="(row, i) in restockRows" :key="row.SKU">
            <q-item-section class="col" :class="ui.flexWrapTextClass">
              <q-item-label class="text-weight-medium">{{ skuLabel(row.SKU).primary }}</q-item-label>
              <q-item-label caption>{{ skuLabel(row.SKU).secondary }}</q-item-label>
              <q-item-label v-if="direct" caption :class="coverageClass(row)">
                {{ coverageText(row) }}
              </q-item-label>
              <!-- Say the line is dropped, so Continue is not a surprise. -->
              <q-item-label v-if="Number(row.Quantity) <= 0" caption class="text-grey-7">
                Set to zero — will be dropped when you continue.
              </q-item-label>
            </q-item-section>

            <q-item-section side>
              <div class="column items-center">
                <q-btn
                  flat
                  round
                  size="lg"
                  icon="keyboard_arrow_up"
                  color="primary"
                  aria-label="Increase restock quantity"
                  @click="setQty(i, Number(row.Quantity) + 1)"
                />
                <div style="width: 84px">
                  <component
                    :is="NumberField"
                    :model-value="row.Quantity"
                    :record="row"
                    :config="{ dense: true, inputClass: 'text-center text-weight-bold text-h6' }"
                    header="Quantity"
                    @update:model-value="(value) => setQty(i, value)"
                  />
                </div>
                <!-- No delete button. Zero the line instead — one control, and undoable. -->
                <q-btn
                  flat
                  round
                  size="lg"
                  icon="keyboard_arrow_down"
                  color="primary"
                  aria-label="Decrease restock quantity"
                  :disable="Number(row.Quantity) <= 0"
                  @click="setQty(i, Number(row.Quantity) - 1)"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center q-py-lg">
          <q-icon name="local_shipping" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">No restock</div>
          <div :class="ui.emptyCaptionClass">Nothing sold, so nothing needs sending. You can add items below.</div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Inline drawer, not a dialog: the list stays visible while items are added. -->
    <AqlAddItemsExpansion
      :items="restockCandidates"
      label="Add other items to restock"
      search-label="Search items to restock"
      :card-class="ui.cardClass + ' q-py-sm'"
    >
      <template #row="{ option }">
        <div class="row items-center no-wrap q-gutter-sm">
          <div style="width: 64px">
            <component
              :is="NumberField"
              :model-value="pendingQty[option.value] ?? 1"
              :record="{}"
              :config="{ dense: true, inputClass: 'text-center' }"
              header="Quantity"
              @update:model-value="(v) => (pendingQty[option.value] = v)"
            />
          </div>
          <!-- Same shape as step 2's add button. Primary here, orange for a return. -->
          <q-btn
            dense
            round
            no-caps
            color="primary"
            icon="add"
            :aria-label="`Add ${option.label} to the restock`"
            @click="addFromExpansion(option.value)"
          />
        </div>
      </template>
    </AqlAddItemsExpansion>

    <!-- Only for a direct restock. Stock levels move before an approved one is filled. -->
    <q-banner
      v-if="direct && restockRows.length && coverage.shortfall > 0"
      dense
      rounded
      class="bg-orange-1 text-body2"
    >
      <template #avatar><q-icon name="warning" color="warning" /></template>
      The warehouse cannot cover {{ coverage.shortfall }} unit(s).
      You can still continue — what is in stock will be issued now, and the rest stays as
      a pending line for a later allocation.
    </q-banner>
  </div>
</template>

<script setup>
// Step 4b - what is being sent back. The lines are the restock node's OWN children, the
// same rows step 2 writes and the same rows the submit reads. The routing decisions live
// in RestockOptions.
import { computed, inject, reactive, useAttrs } from 'vue'
import AqlAddItemsExpansion from 'components/shared/AqlAddItemsExpansion.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseStorageResource } from 'src/_resource/Operation/WarehouseStorages/composables/useWarehouseStorageResource'
import { RESTOCK_CONTROL, restockItemRow } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { splitByWarehouseStock } from 'src/_resource/Operation/OutletRestocks/composables/useRestockStockMatch'
import { NODE, RESTOCKING, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddRestockItems', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const ui = useAQLConfig()
const pageState = inject('pageState')
const { getSku } = useSkuResource()
const { index: warehouseStockIndex } = useWarehouseStorageResource()
const skus = useRecord('SKUs')

const NumberField = resolveFieldComponent('number', 'add')

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)
const isActive = (row) => !text(row?.Status) || text(row.Status).toUpperCase() === 'ACTIVE'

const restock = pageState.useNode(NODE.RESTOCKS)

const visible = computed(() => stepVisible(pageState, props.step))

const restocking = pageState.useControls(RESTOCKING, true)
const restockRows = computed(() => restock.children(NODE.RESTOCK_ITEMS).value || [])
const direct = pageState.useControls(RESTOCK_CONTROL.DIRECT, false, NODE.RESTOCKS)
const deliverInstantly = pageState.useControls(RESTOCK_CONTROL.DELIVER, false, NODE.RESTOCKS)
const warehouseCode = computed(() => text(pageState.getControls(RESTOCK_CONTROL.WAREHOUSE, '', NODE.RESTOCKS)))

function skuLabel (sku) {
  const info = getSku(text(sku)) || {}
  const variants = (info.variantValues || []).filter(Boolean).join(' / ')
  return { primary: text(info.productName) || text(sku), secondary: variants || text(sku) }
}

// Straight onto the node's child row - no mirror, so what is typed here is what is sent.
function setQty (index, value) {
  pageState.setChildren(NODE.RESTOCK_ITEMS, index, 'Quantity', Math.max(0, num(value)), NODE.RESTOCKS)
}

// The routing answers a new line inherits, so it lands with the same progress as the rest.
const routingContext = () => ({
  [RESTOCK_CONTROL.DIRECT]: direct.value === true,
  [RESTOCK_CONTROL.DELIVER]: deliverInstantly.value === true,
  [RESTOCK_CONTROL.WAREHOUSE]: warehouseCode.value
})

// Quantity per candidate SKU. Entries are dropped once added.
const pendingQty = reactive({})

function addFromExpansion (sku) {
  const code = text(sku)
  if (!code) return
  const qty = Math.max(1, num(pendingQty[code] ?? 1))
  const at = restockRows.value.findIndex((row) => text(row.SKU) === code)
  if (at >= 0) setQty(at, num(restockRows.value[at].Quantity) + qty)
  else pageState.addChild(NODE.RESTOCK_ITEMS, restockItemRow({ SKU: code, Quantity: qty }, routingContext()), NODE.RESTOCKS)
  // Deleted, not reset, so a re-added SKU starts at 1 again.
  delete pendingQty[code]
}

/** SKUs not yet on the restock list — what the "Add other items" expansion offers. */
const restockCandidates = computed(() => {
  const taken = new Set(restockRows.value.map((row) => text(row.SKU)))
  return skus.items.value
    .filter((row) => isActive(row) && !taken.has(text(row.Code)))
    .map((row) => {
      const label = skuLabel(row.Code)
      return { value: text(row.Code), label: `${label.primary} · ${label.secondary}` }
    })
})

// The same Layer 2 split the payload builder uses, so the warning and the batch agree.
const coverage = computed(() => {
  if (direct.value !== true || !warehouseCode.value) return { allocated: [], pending: [], shortfall: 0 }
  return splitByWarehouseStock(restockRows.value, warehouseCode.value, warehouseStockIndex.value)
})

// Indexed once per render pass, not scanned per row (CORE_ARCHITECTURE_RULES §6).
const allocatedBySku = computed(() =>
  new Map(coverage.value.allocated.map((row) => [text(row.SKU), num(row.Quantity)])))

function coverageText (row) {
  const covered = allocatedBySku.value.get(text(row.SKU)) || 0
  const wanted = num(row.Quantity)
  if (covered >= wanted) return `Warehouse can cover all ${wanted}`
  if (covered === 0) return 'Not in warehouse stock — will stay pending'
  return `Warehouse can cover ${covered} of ${wanted}`
}

function coverageClass (row) {
  const covered = allocatedBySku.value.get(text(row.SKU)) || 0
  const wanted = num(row.Quantity)
  if (covered >= wanted) return 'text-positive'
  return covered === 0 ? 'text-negative' : 'text-warning'
}
</script>
