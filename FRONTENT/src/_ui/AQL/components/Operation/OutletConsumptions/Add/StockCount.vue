<template>
  <div v-if="visible" :class="gutterClass">
    <!-- Empty storage is a real audit outcome, not an error: a new outlet, or one that
         sold out. -->
    <q-card v-if="!rows.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing on record here</div>
        <div :class="ui.emptyCaptionClass">
          This outlet holds no recorded stock. You can still log damaged or unlisted items
          below.
        </div>
      </q-card-section>
    </q-card>

    <q-card
      v-for="row in rows"
      :key="row.SKU"
      flat
      bordered
      :class="ui.cardClass"
    >
      <q-card-section>
        <!-- Details left, counter right, so a scan of the cards reads down one column. -->
        <div class="row items-center no-wrap q-col-gutter-md">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-medium q-px-sm">{{ skuLabelOf(row.SKU).primary }}</div>
            <div class="text-caption text-grey-7 q-px-sm">{{ skuLabelOf(row.SKU).secondary }}</div>
            <div class="column q-mt-sm">
              <q-chip
                v-for="chip in chipsFor(row.SKU)"
                :key="chip.key"
                square
                :color="chip.value > 0 ? chip.color : 'grey-3'"
                :text-color="chip.value > 0 ? 'white' : 'grey-7'"
                :label="`${chip.label}: ${chip.value}`"
                class="q-ma-none"
              />
            </div>
          </div>

          <!-- A vertical stepper: a phone is counted one-handed with a thumb, and a
               horizontal pair puts the buttons on opposite sides of the number. -->
          <div class="col-auto column items-center">
            <q-btn
              flat
              round
              size="lg"
              icon="keyboard_arrow_up"
              color="primary"
              aria-label="Increase counted quantity"
              :disable="!returnsAllowed && qtyOf(row.SKU).value <= 0"
              @click="stepCounted(row.SKU, 1)"
            />
            <div style="width: 84px">
              <component
                :is="NumberField"
                :model-value="countedQty(row.SKU).value"
                :record="row"
                :config="{ dense: true, inputClass: 'text-center text-weight-bold text-h6' }"
                header="Qty"
                @update:model-value="(value) => (countedQty(row.SKU).value = value)"
              />
            </div>
            <q-btn
              flat
              round
              size="lg"
              icon="keyboard_arrow_down"
              color="primary"
              aria-label="Decrease counted quantity"
              :disable="countedQty(row.SKU).value <= 0"
              @click="stepCounted(row.SKU, -1)"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Inline, not a dialog: the counts stay on screen while an item is added. Hidden
         once every SKU is already listed. -->
    <template v-if="returnsAllowed && remainingSkus.length">
      <SectionDividerLabel label="FOUND SOMETHING ELSE?" />
      <AqlAddItemsExpansion
        :items="remainingSkus"
        icon="assignment_return"
        label="Add extra items"
        search-label="Search items"
        header-class="text-orange-9 text-weight-medium"
        :caption="`${remainingSkus.length} item(s) available`"
        :card-class="ui.cardClass"
      >
        <template #row="{ option }">
          <div class="row items-center no-wrap q-gutter-sm">
            <div style="width: 64px">
              <component
                :is="NumberField"
                :model-value="pendingQty[option.value] ?? 1"
                :record="{}"
                :config="{ dense: true, inputClass: 'text-center' }"
                header="Qty"
                @update:model-value="(v) => (pendingQty[option.value] = v)"
              />
            </div>
            <q-btn
              dense
              round
              no-caps
              color="orange"
              icon="add"
              :aria-label="`Add ${option.label}`"
              @click="addItem(option.value)"
            />
          </div>
        </template>
      </AqlAddItemsExpansion>
    </template>
  </div>
</template>

<script setup>
// Step 2 - the physical count. A counted line is an OutletConsumptionItems child; a
// surplus, and anything found that the shelf does not carry, is an OutletReturns record.
// The two never share a row.
import { computed, inject, reactive, useAttrs, watch } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlAddItemsExpansion from 'components/shared/AqlAddItemsExpansion.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'
import { consumptionNode, consumptionItemRow } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
import { soldQty, returnQty, defaultRestockQty } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { returnRow, returnsNode } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { restockNode, restockItemRow, restockRoutingOf } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'

defineOptions({ name: 'OutletConsumptionsAddStockCount', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const PARENT = 'OutletConsumptions'
const CHILD = 'OutletConsumptionItems'
const RETURNS = 'OutletReturns'
const RESTOCKS = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const ui = useAQLConfig()
const pageState = inject('pageState')

const { activeSkus, skuLabelOf, skuLabelText } = useSkuResource()
const { stockRowsOf, stockOf } = useOutletStorageResource()

const NumberField = resolveFieldComponent('number', 'add')

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

// A surplus found on the shelf is a return, so the whole return side of this step is
// offered only to a role that may write one.
const returnsAllowed = useResourceConfig(RETURNS).allowed('create') === true

// Same for the replenishment side: no restock is written, and no line is even mirrored,
// for a role that may not raise one.
const restocksAllowed = useResourceConfig(RESTOCKS).allowed('create') === true

const outletCode = pageState.useRecord('OutletCode')
const items = pageState.useNode(PARENT).children(CHILD)
const returnsState = pageState.useNode(RETURNS)
// { SKU: index } - what turns a code into the row that carries it.
const indexBySku = pageState.useChildrenIndex(CHILD, 'SKU')
const returnIndexBySku = pageState.useRecordsIndex('SKU', RETURNS)
const restockIndexBySku = pageState.useChildrenIndex(RESTOCK_ITEMS, 'SKU', RESTOCKS)

const text = (value) => (value == null ? '' : String(value).trim())

// What the system says is on the shelf. Read straight off the storage index, never stored
// on the row - it is a fact about the outlet, not an answer the officer gives.
const systemQtyOf = (sku) => stockOf(outletCode.value, text(sku))

// What the outlet is recorded as holding. The count sheet, and the reason a card cannot
// vanish: the shelf is a fact about the outlet, not a row the wizard may drop.
const storageSkus = computed(() => stockRowsOf(outletCode.value)
  .filter((row) => Number(row.Quantity) > 0)
  .map((row) => text(row.SKU)))

// The shelf FIRST, then anything found on top of it. Purifying the zero lines on the way
// to step 3 therefore cannot empty this list when the officer steps back.
const rows = computed(() => {
  const seen = new Set()
  const list = []
  const push = (sku) => {
    const code = text(sku)
    if (!code || seen.has(code)) return
    seen.add(code)
    list.push({ SKU: code })
  }
  storageSkus.value.forEach(push)
  ;(items.value || []).forEach((row) => push(row.SKU))
  ;(returnsState.node.value.records || []).forEach((row) => push(row.SKU))
  return list
})

const listedSkus = computed(() => new Set(rows.value.map((row) => row.SKU)))

// SKUs no card already carries - what the expansion offers.
const remainingSkus = computed(() => activeSkus.value
  .filter((row) => !listedSkus.value.has(text(row.code)))
  .map((row) => ({ value: text(row.code), label: skuLabelText(row.code) })))

// The outlet's own stock becomes the count sheet: one child per SKU it holds, starting at
// zero. A different outlet is a different sheet, so it is rebuilt whole and what was found
// at the last one goes with it.
watch(outletCode, (code) => {
  if (!code) return
  const lines = stockRowsOf(code)
    .filter((row) => Number(row.Quantity) > 0)
    .map((row) => ({ SKU: text(row.SKU), Qty: 0 }))
  pageState.applyNodes(consumptionNode({ ...pageState.useNode(PARENT).record.value }, lines))
  pageState.removeNode(RETURNS)
  pageState.removeNode(RESTOCKS)
}, { immediate: true })

// A card exists for every shelf SKU, so every one of these reads an address that may hold
// no row yet. Missing is not unknown - it is zero, and writing one creates it.
function memoise (models, make) {
  return (sku) => {
    const code = text(sku)
    if (!models.has(code)) models.set(code, make(code))
    return models.get(code)
  }
}

// What left the shelf, as this SKU's OutletConsumptionItems row.
const qtyModels = new Map()
const qtyOf = memoise(qtyModels, (code) => {
  const bound = pageState.useChildren(CHILD, () => indexBySku.value[code], 'Qty', PARENT, '$default')
  return computed({
    get: () => Number(bound.value) || 0,
    set: (value) => setSoldQty(code, Math.max(0, Number(value) || 0))
  })
})

function setSoldQty (code, qty) {
  const index = indexBySku.value[code]
  if (index !== undefined) return pageState.setChildren(CHILD, index, 'Qty', qty, PARENT)
  if (qty > 0) pageState.addChild(CHILD, consumptionItemRow({ SKU: code, Qty: qty }), PARENT)
}

// The surplus for one SKU, as its own record on the OutletReturns many-node.
const returnModels = new Map()
const returnQtyOf = memoise(returnModels, (code) => {
  const bound = pageState.useRecords(() => returnIndexBySku.value[code], 'Qty', RETURNS)
  return computed({
    get: () => Number(bound.value) || 0,
    set: (value) => setReturnQty(code, Math.max(0, Number(value) || 0))
  })
})

// A return back at zero KEEPS its record. Zero rows are dropped on the step-2 transition.
function setReturnQty (code, qty) {
  if (!returnsAllowed) return
  const index = returnIndexBySku.value[code]
  if (index !== undefined) return pageState.setRecords(index, 'Qty', qty, RETURNS)
  if (qty > 0) addReturn(code, qty)
}

// The node may not exist yet, and a many-node is opened through its own Layer 2 builder
// rather than by a bare addRecord onto nothing.
function addReturn (code, qty) {
  const row = returnRow({ SKU: code, Qty: qty }, { OutletCode: outletCode.value })
  if (pageState.hasNode(RETURNS)) return pageState.addRecord(row, RETURNS)
  pageState.setResource(RETURNS, null, returnsNode([row]))
}

// What goes back to the outlet, as a line on the OutletRestocks node.
const restockModels = new Map()
const restockQtyOf = memoise(restockModels, (code) => {
  const bound = pageState.useChildren(RESTOCK_ITEMS, () => restockIndexBySku.value[code], 'Quantity', RESTOCKS)
  return computed({
    get: () => Number(bound.value) || 0,
    set: (value) => setRestockQty(code, Math.max(0, Number(value) || 0))
  })
})

// Replenishment mirrors consumption: what sold is what needs sending back. The header is
// MERGED so lines already added survive; the OutletRestocks domain fills its own columns.
// The routing answers are handed BACK IN: `restockNode` always writes all three controls,
// so building without them resets a direct restock to "pending, no warehouse", and step 4a
// never notices because the node kept existing.
function setRestockQty (code, qty) {
  if (!restocksAllowed) return
  const index = restockIndexBySku.value[code]
  if (index !== undefined) return pageState.setChildren(RESTOCK_ITEMS, index, 'Quantity', qty, RESTOCKS)
  if (qty <= 0) return
  const routing = restockRoutingOf(pageState)
  pageState.updateResource(RESTOCKS, null, restockNode({ OutletCode: outletCode.value }, [], routing))
  pageState.addChild(RESTOCK_ITEMS, restockItemRow({ SKU: code, Quantity: qty }, routing), RESTOCKS)
}

/**
 * The one number the officer moves: what is COUNTED on the shelf.
 *
 * At or below the system figure the difference is a sale; above it, a surplus, which is a
 * return. The two land on different nodes and can never both be positive.
 */
const countedModels = new Map()
function countedQty (sku) {
  const code = text(sku)
  if (!countedModels.has(code)) {
    countedModels.set(code, computed({
      get: () => systemQtyOf(code) - qtyOf(code).value + returnQtyOf(code).value,
      set: (value) => {
        const counted = Math.max(0, Number(value) || 0)
        const system = systemQtyOf(code)
        // The arithmetic is the domain's, not this card's — see useConsumptionStock.
        setSoldQty(code, soldQty(system, counted))
        setReturnQty(code, returnQty(system, counted))
        setRestockQty(code, defaultRestockQty(system, counted))
      }
    }))
  }
  return countedModels.get(code)
}

const stepCounted = (sku, delta) => {
  const model = countedQty(sku)
  model.value = model.value + delta
}

// Always the same chips in the same order: the card must not change height as the officer
// counts, so a zero chip renders muted rather than disappearing.
function chipsFor (sku) {
  return [
    { key: 'system', label: 'System', value: systemQtyOf(sku), color: 'grey-7' },
    { key: 'sold', label: 'Sold', value: qtyOf(sku).value, color: 'positive' },
    ...(restocksAllowed
      ? [{ key: 'restock', label: 'Restock', value: restockQtyOf(sku).value, color: 'primary' }]
      : []),
    ...(returnsAllowed
      ? [{ key: 'return', label: 'Return', value: returnQtyOf(sku).value, color: 'orange' }]
      : [])
  ]
}

const pendingQty = reactive({})

// Found on the shelf but not on it in the system: a return, never a consumption line.
function addItem (sku) {
  const code = text(sku)
  if (!code) return
  const found = Math.max(0, Number(pendingQty[code] ?? 1) || 0)
  if (found > 0) addReturn(code, found)
  delete pendingQty[code]
}
</script>
