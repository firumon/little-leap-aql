<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="ITEMS TO BILL" />

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
            <q-item-label caption>{{ line.secondary }}</q-item-label>
            <q-item-label class="text-weight-medium">{{ line.primary }}</q-item-label>
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
              <div class="text-subtitle1 text-weight-bold text-primary no-wrap">{{ line.Qty }} ×</div>
              <div style="width: 96px">
                <component
                  :is="CurrencyField"
                  :model-value="line.Price"
                  :record="line"
                  :config="{ label: 'Unit price', inputClass: 'text-right text-weight-bold' }"
                  header="Price"
                  @update:model-value="(value) => setLinePrice(line.at, value)"
                />
              </div>
              <q-btn
                v-if="line.manual"
                flat round dense
                icon="close"
                color="negative"
                :aria-label="`Remove ${line.primary}`"
                @click="removeLine(line.at)"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <AqlAddItemsExpansion
      :items="visibleCandidates"
      label="Add more items"
      search-label="Search items to bill"
      :caption="`${candidates.length} more item(s) available`"
      :card-class="ui.cardClass + ' q-py-sm'"
    >
      <template #row="{ option }">
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
import { computed, reactive, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlAddItemsExpansion from 'components/shared/AqlAddItemsExpansion.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import {
  useInvoiceAddContext,
  NODE,
  ITEMS,
  stepVisible,
  removeManualPart
} from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/Add/useInvoiceAddContext'

defineOptions({ name: 'OutletConsumptionInvoicesAddInvoiceItems', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: 2 } })

const CANDIDATE_LIMIT = 25

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, ui, skuLabelOf, skuCandidatesFor } = useInvoiceAddContext()

const NumberField = resolveFieldComponent('number', 'add')
const CurrencyField = resolveFieldComponent('currency', 'add')

const visible = computed(() => stepVisible(pageState, props.step))

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const node = pageState.useNode(NODE)

const lines = computed(() => {
  void node.value
  return pageState.getChildRows(ITEMS, NODE).map((row, at) => {
    const label = skuLabelOf(row.SKU)
    return {
      at,
      SKU: text(row.SKU),
      Qty: num(row.Qty),
      Price: num(row.Price),
      sources: Array.isArray(row._sources) ? row._sources : [],
      manual: row._manual === true,
      primary: label.primary,
      secondary: label.secondary
    }
  })
})

const isDirectInvoice = computed(() =>
  !text(pageState.getRecord('OutletConsumptionCode', NODE)))

const showSources = computed(() =>
  text(pageState.getRecord('OutletConsumptionCode', NODE)).split(',').filter(Boolean).length > 1)

const candidates = computed(() => skuCandidatesFor('', lines.value.map((line) => line.SKU)))
const visibleCandidates = computed(() => candidates.value.slice(0, CANDIDATE_LIMIT))

const pendingQty = reactive({})

const setLinePrice = (at, value) => pageState.setChildren(ITEMS, at, 'Price', num(value), NODE)

const removeLine = (at) => removeManualPart(pageState, at)

function addItem (sku) {
  const code = text(sku)
  const qty = num(pendingQty[code] ?? 1)
  if (!code || qty <= 0) return
  pageState.addChild(ITEMS, { SKU: code, Qty: qty, _manual: true, _manualQty: qty, _sources: [] }, NODE)
  delete pendingQty[code]
}
</script>
