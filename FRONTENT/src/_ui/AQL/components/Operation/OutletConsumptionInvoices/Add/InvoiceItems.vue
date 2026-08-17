<template>
  <div v-if="isActive" :class="gutterClass">
    <SectionDividerLabel label="ITEMS TO BILL" />

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

    <!-- An EXPANSION, not a dialog — the same control the consumption wizard's restock step
         uses. The remaining SKUs are already on screen with their own quantity box, so adding
         three items is three taps and the bill stays visible above.
         Hidden once every SKU is on the bill: an expansion promising items and opening onto
         nothing is worse than no control. -->
    <q-expansion-item
      v-if="skuCandidates.length"
      icon="add_circle_outline"
      label="Add more items"
      :caption="`${skuCandidates.length} more item(s) available`"
      header-class="text-primary text-weight-medium"
      class="rounded-borders"
      :class="ui.cardClass"
    >
      <q-card-section>
        <component
          :is="TextField"
          :model-value="search"
          :record="{}"
          :config="{ label: 'Search items', clearable: true }"
          header="Search"
          @update:model-value="(value) => (search = value)"
        />
      </q-card-section>

      <q-list separator>
        <q-item v-for="option in visibleCandidates" :key="option.value">
          <q-item-section :class="ui.flexWrapTextClass">
            <q-item-label>{{ option.primary }}</q-item-label>
            <q-item-label caption>{{ option.secondary }}</q-item-label>
          </q-item-section>

          <q-item-section side>
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
          </q-item-section>
        </q-item>

        <q-item v-if="!visibleCandidates.length">
          <q-item-section class="text-grey-7">No item matches that search.</q-item-section>
        </q-item>
      </q-list>
    </q-expansion-item>
  </div>
</template>

<script setup>
/**
 * OutletConsumptionInvoices › Add › Step 2 — the bill's lines, and their prices.
 *
 * ── ONE ROW PER SKU, NOT PER COUNT ──
 * The ticked consumptions are grouped by SKU upstream, and each row carries chips naming the
 * counts it came from. An outlet audited weekly and invoiced monthly gets one line per
 * product showing four sources, rather than four lines the customer has to add up.
 *
 * ── A CODE IS NOT A NAME ──
 * Every row leads with the PRODUCT and states the variant beneath it, from the SKUs domain's
 * own `skuLabelOf`. The code appears only where it is the sole distinguishing fact.
 *
 * ── WHY THE PRICE IS EDITABLE ──
 * The price list is the default, not the law: a negotiated one-off, a damaged-goods
 * concession or a stale list all need overriding at the moment of billing. Editing a price
 * re-runs the WHOLE engine — line tax, discount apportionment and the net payable move
 * together, because the override is passed to `calculateConsumptionInvoice` as a price
 * RESOLVER rather than patched onto a total the engine never saw. The caption under each row
 * updates on the same tick as the review step's grand total.
 *
 * The add-more expansion mirrors `OutletConsumptions/Add/RestockReview.vue` so the two
 * wizards' "add another item" control is one recurring pattern rather than two similar ones.
 * Already-billed SKUs are filtered out upstream.
 *
 * Fields mount through `resolveFieldComponent` (§2.4). Spacing comes from `pageProps.gutter`
 * via `$attrs`, never a hardcoded margin (§10.2).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, reactive, ref, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
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
const TextField = resolveFieldComponent('text', 'add')

const {
  ui, money, groupedLines, invoice, extraItems, selectedCodes,
  skuCandidatesFor, setLinePrice, removeLine, addExtraItem, step: currentStep
} = useInvoiceAddContext()

/**
 * Whether a line needs to say where its quantity came from.
 *
 * Only once the invoice BUNDLES more than one consumption. Until then every line has exactly
 * one origin — the single ticked count — and printing it under each row repeats the same
 * fact as many times as there are items.
 */
const showSources = computed(() => selectedCodes.value.length > 1)

const isActive = computed(() =>
  props.step == null || Number(props.step) === currentStep.value)

const search = ref('')

/**
 * Per-candidate quantity, keyed by SKU. A `reactive` map rather than one `ref` per row,
 * because the expansion renders an arbitrary number of them. Entries are dropped as they are
 * added, so the map never outgrows the list it mirrors.
 */
const pendingQty = reactive({})

const skuCandidates = computed(() => skuCandidatesFor(''))
// Capped: a list rendering a full SKU master is unusable on a phone, and the search box is
// the intended way through a large catalogue.
const visibleCandidates = computed(() => skuCandidatesFor(search.value).slice(0, 25))

/** SKUs the user added by hand — the only ones a remove button is offered for. */
const manualSkus = computed(() => new Set(extraItems.value.map((row) => String(row.SKU || '').trim())))

/**
 * The rows, joined to the CALCULATED lines so each shows the price actually used and the tax
 * it attracted. The calculation is read, never repeated — `invoice.lines` is the same array
 * the review step totals and the payload builder writes.
 */
const lines = computed(() => {
  const calculated = new Map(invoice.value.lines.map((line) => [line.SKU, line]))
  return groupedLines.value.map((line) => {
    const priced = calculated.get(line.SKU) || {}
    return {
      ...line,
      price: Number(priced.Price) || 0,
      total: Number(priced.Total) || 0,
      tax: Number(priced.TaxAmount) || 0,
      manual: manualSkus.value.has(line.SKU)
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
