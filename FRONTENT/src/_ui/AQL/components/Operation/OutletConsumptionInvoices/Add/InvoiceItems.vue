<template>
  <div v-if="isActive" :class="gutterClass">
    <SectionDividerLabel label="ITEMS TO BILL" />

    <!-- The one consequence people do not expect. An invoice raised WITHOUT a consumption
         behind it bills the outlet but changes no shelf: there was no count to deduct from
         the outlet, and no allocation to deduct from a warehouse. Said loudly, and only when
         it applies — a banner shown on every invoice would be read past on the one that
         matters (§10.4). -->
    <q-banner v-if="isDirectInvoice" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="warning" color="warning" /></template>
      Creating an invoice directly without a consumption will not record any outlet or
      warehouse stock movements.
    </q-banner>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section v-if="!lines.length" class="text-center q-py-lg">
        <q-icon name="receipt_long" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Nothing to bill</div>
        <div :class="ui.emptyCaptionClass">Add an item below, or go back and tick a consumption.</div>
      </q-card-section>

      <q-list v-else separator>
        <q-item v-for="line in lines" :key="line.SKU">
          <q-item-section :class="ui.flexWrapTextClass">
            <q-item-label class="text-weight-medium">{{ line.Qty }} x {{ line.primary }}</q-item-label>
            <q-item-label caption>{{ line.secondary }}</q-item-label>
            <!-- Only when there is something to disambiguate. With ONE consumption ticked
                 every line came from it, so a source line under each row restates the header
                 for every item and tells the reader nothing. -->
            <q-item-label
              v-for="source in (showSources ? line.sources : [])"
              :key="source.key"
              caption
            >
              {{ source.label }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row items-center no-wrap q-gutter-x-sm">
              <div style="width: 96px">
                <component
                  :is="CurrencyField"
                  :model-value="line.price"
                  :record="line"
                  :config="{ label: 'Unit price', inputClass: 'text-right text-weight-bold' }"
                  header="Price"
                  @update:model-value="(value) => setLinePrice(line.SKU, value)"
                />
              </div>
              <!-- Only a manually added line can be dropped here: a counted line's quantity
                   is a physical fact, and removing it would under-bill with no record. -->
              <q-btn
                v-if="line.manual"
                flat round dense
                icon="close"
                color="negative"
                :aria-label="`Remove ${line.primary}`"
                @click="removeLine(line.SKU)"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <!-- The SHARED drawer — the same control the consumption wizard's restock and return
         steps use, so "add another item" is one recurring pattern rather than three similar
         ones. It owns the filter, the row rhythm and the leave transition; the quantity box
         and the add button are this wizard's own.
         Hidden once every SKU is on the bill: a drawer promising items and opening onto
         nothing is worse than no control. -->
    <AqlAddItemsExpansion
      :items="visibleCandidates"
      label="Add more items"
      search-label="Search items to bill"
      :caption="`${skuCandidates.length} more item(s) available`"
      :card-class="ui.cardClass + ' q-py-sm'"
    >
      <template #row="{ option }">
        <!-- Quantity only. The price belongs to the LINE, not to the act of adding one: once
             the item is on the bill above it gets the same editable unit-price box every
             other line has, so asking for it twice would be two controls for one value. -->
        <div class="row items-center no-wrap q-gutter-x-sm">
          <div style="width: 72px">
            <component
              :is="NumberField"
              :model-value="pendingQty[option.value] ?? 1"
              :record="{}"
              :config="{ dense: true, inputClass: 'text-center' }"
              header="Qty"
              @update:model-value="(value) => (pendingQty[option.value] = value)"
            />
          </div>
          <q-btn
            dense round no-caps
            color="primary"
            icon="add"
            :aria-label="`Add ${option.primary} to the invoice`"
            @click="addItem(option.value)"
          />
        </div>
      </template>
    </AqlAddItemsExpansion>
  </div>
</template>

<script setup>
// Step 2 - the bill's lines and their prices. Ticked counts are grouped one row per SKU.
// The price list is a default, not the law: an edited price is passed to the engine as a
// resolver, so tax, discount and the payable all move with it.
import { computed, reactive, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlAddItemsExpansion from 'components/shared/AqlAddItemsExpansion.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useInvoiceAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Add/useInvoiceAddContext'

defineOptions({ name: 'OutletConsumptionInvoicesAddInvoiceItems', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: 2 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const CurrencyField = resolveFieldComponent('currency', 'add')
const NumberField = resolveFieldComponent('number', 'add')

const {
  ui, money, groupedLines, invoice, selectedCodes,
  skuCandidatesFor, setLinePrice, removeLine, addExtraItem, step: currentStep
} = useInvoiceAddContext()

// With one count ticked every line came from it, so naming the source tells nobody anything.
const showSources = computed(() => selectedCodes.value.length > 1)

const isActive = computed(() =>
  props.step == null || Number(props.step) === currentStep.value)

// Per-candidate quantity, keyed by SKU. Entries are dropped once added.
const pendingQty = reactive({})

// Nothing counted behind this bill, so no stock anywhere moves. The banner says so.
const isDirectInvoice = computed(() => !selectedCodes.value.length)

const skuCandidates = computed(() => skuCandidatesFor(''))
// Capped for the same reason, and the drawer's own filter narrows what is shown within it.
const visibleCandidates = computed(() => skuCandidates.value.slice(0, 25))

// Joined to the calculated lines, never recalculated: the same array the review step totals.
const lines = computed(() => {
  const calculated = new Map(invoice.value.lines.map((line) => [line.SKU, line]))
  return groupedLines.value.map((line) => {
    const priced = calculated.get(line.SKU) || {}
    return {
      ...line,
      price: Number(priced.Price) || 0,
      total: Number(priced.Total) || 0,
      tax: Number(priced.TaxAmount) || 0,
      manual: line.manual
    }
  })
})

function addItem (sku) {
  addExtraItem(sku, pendingQty[sku] ?? 1)
  // Removed rather than reset: the SKU has left the candidate list, so its entry is dead
  // weight — and if the user removes the line and re-adds it, it should start at 1 again.
  delete pendingQty[sku]
}
</script>
