<template>
  <!-- Gated on there being ANY return work — a surplus counted on this visit, or an
       unsettled return from an earlier one. The sticky bar skips the step outright when
       both are empty, so this guard only ever fires for a user who arrived another way. -->
  <div v-if="visible && (returnRows.length || wizard.pendingReturns.value.length)" :class="gutterClass">

    <!-- ── Returns found on THIS visit ───────────────────────────────────────── -->
    <template v-if="returnRows.length">
      <SectionDividerLabel label="RETURNS FOUND TODAY" />

      <!-- Two toggles decide what a return DOES, and the four combinations are not
           intuitive, so the consequence of the current pair is spelled out per line rather
           than left for the user to infer from two switch positions (§10.5). -->
      <q-banner dense rounded class="bg-grey-2 text-body2">
        Each item needs a reason. Credit the outlet for it, send it back to a warehouse, or
        both — the two are independent.
      </q-banner>

      <q-card v-for="row in returnRows" :key="row.SKU" flat bordered :class="ui.cardClass">
        <q-card-section :class="gutterClass" class="q-mt-sm">
          <div class="row items-center no-wrap" :class="gutterClass">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle2 text-weight-medium">{{ wizard.skuLabel(row.SKU).primary }}</div>
              <div class="text-caption text-grey-7">{{ wizard.skuLabel(row.SKU).secondary }}</div>
            </div>
            <div class="col-auto">
              <q-chip square color="orange" text-color="white" :label="`Return: ${row.ReturnQty}`" class="q-ma-none" />
            </div>
          </div>

          <component
            :is="SelectField"
            :model-value="wizard.metaFor(row.SKU).Reason"
            :record="{}"
            :config="{ label: 'Reason', options: REASON_OPTIONS, clearable: false }"
            header="Reason"
            @update:model-value="(v) => wizard.setReturnMeta(row.SKU, { Reason: v })"
          />

          <component
            :is="TextareaField"
            :model-value="wizard.metaFor(row.SKU).ReasonComment"
            :record="{}"
            :config="{ label: 'Remarks (optional)', hideBottomSpace: true }"
            header="ReasonComment"
            @update:model-value="(v) => wizard.setReturnMeta(row.SKU, { ReasonComment: v })"
          />

          <div class="row items-center no-wrap q-mt-sm q-px-sm ">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-body2 text-weight-medium">Credit against the invoice</div>
              <div class="text-caption text-grey-8">
                Deducts this item's value from what the outlet is billed.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle
                :model-value="wizard.metaFor(row.SKU).InvoiceAdjustmentRequired"
                color="primary"
                :aria-label="`Credit ${wizard.skuLabel(row.SKU).primary} against the invoice`"
                @update:model-value="(v) => wizard.setReturnMeta(row.SKU, { InvoiceAdjustmentRequired: v === true })"
              />
            </div>
          </div>

          <div class="row items-center no-wrap q-my-sm q-px-sm ">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-body2 text-weight-medium">Send back to a warehouse</div>
              <div class="text-caption text-grey-8">
                The stock physically leaves the outlet. Leave off to write it off on site.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle
                :model-value="wizard.metaFor(row.SKU).WarehouseActionRequired"
                color="purple"
                :aria-label="`Send ${wizard.skuLabel(row.SKU).primary} back to a warehouse`"
                @update:model-value="(v) => setWarehouseAction(row.SKU, v)"
              />
            </div>
          </div>

          <!-- Required, and only shown when it can be answered: a target warehouse on a
               return that is not being shipped anywhere is a field with no meaning. -->
          <component
            v-if="wizard.metaFor(row.SKU).WarehouseActionRequired"
            :is="SelectField"
            :model-value="wizard.metaFor(row.SKU).WarehouseCode"
            :record="{}"
            :config="{ label: 'Target warehouse', options: warehouseOptions, clearable: false }"
            header="WarehouseCode"
            @update:model-value="(v) => wizard.setReturnMeta(row.SKU, { WarehouseCode: v })"
          />

          <!-- The resulting outcome, stated plainly. This is the line that makes the two
               toggles legible: the ledger effect of the four combinations is genuinely
               surprising, and two of them move no stock at all. -->
          <q-banner dense rounded :class="outcomeClass(row.SKU)">
            {{ outcomeText(row.SKU) }}
          </q-banner>
        </q-card-section>
      </q-card>
    </template>

    <!-- ── Unsettled returns from EARLIER visits ─────────────────────────────── -->
    <template v-if="wizard.pendingReturns.value.length">
      <SectionDividerLabel label="UNSETTLED RETURNS" />
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div class="text-caption text-grey-8 q-pb-sm">
            This outlet has returns that were meant to be credited and never were. Tick any
            to deduct from this invoice.
          </div>

          <q-list separator>
            <q-item v-for="row in wizard.pendingReturns.value" :key="row.code" tag="label" v-ripple>
              <q-item-section side top>
                <q-checkbox
                  :model-value="wizard.adjustedReturnCodes.value.includes(row.code)"
                  @update:model-value="() => wizard.toggleAdjustedReturn(row.code)"
                />
              </q-item-section>
              <q-item-section :class="ui.flexWrapTextClass">
                <q-item-label>{{ row.name }}</q-item-label>
                <q-item-label caption>{{ row.variant }}</q-item-label>
                <q-item-label caption>{{ row.reason }} · {{ formatDate(row.date) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label class="text-weight-medium">{{ row.qty }}</q-item-label>
                <q-item-label caption>{{ _C(row.value) }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <template v-if="wizard.returnDeduction.value > 0">
            <q-separator class="q-my-md" />
            <div class="row justify-between text-subtitle1 text-weight-bold">
              <span>Credit against this invoice</span>
              <span class="text-negative">− {{ _C(wizard.returnDeduction.value) }}</span>
            </div>
          </template>
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
/**
 * Step 5 — return management.
 *
 * Two different jobs, so two labelled sections (§7.1's "a view that unions two states
 * divides, it does not tab"):
 *
 *   RETURNS FOUND TODAY   every surplus the count produced, each needing its routing
 *                         decided — why it came back, whether the outlet is credited, and
 *                         whether the stock physically leaves.
 *   UNSETTLED RETURNS     returns raised on an EARLIER visit that were meant to credit an
 *                         invoice and never did. Ticked here, they settle against this one.
 *
 * THE TWO TOGGLES ARE INDEPENDENT, and that is the whole reason each line states its
 * outcome in a banner. The four combinations of `InvoiceAdjustmentRequired` (IAR) and
 * `WarehouseActionRequired` (WAR) map to genuinely non-obvious ledger effects — two of them
 * write no stock movement at all, for opposite reasons — and a user reading two switch
 * positions cannot be expected to derive that. The truth table itself lives in Layer 2
 * (`returnQtyChange` / `returnProgressFor`); this file only renders what it says, so the
 * sentence on screen and the movement the batch writes cannot drift apart.
 *
 * Defaults follow the spec: credit ON, warehouse OFF — the ordinary case is a damaged unit
 * the outlet is not charged for and nobody drives back to a warehouse.
 *
 * The step SKIPS ITSELF when neither section has rows; the skip lives in `Add/PageAction.js`
 * with the rest of the navigation.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useCurrency } from 'src/composables/useCurrency'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { RETURN_REASONS, returnQtyChange, returnProgressFor } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { useConsumptionWizard } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'
import { formatDate } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/View/useConsumptionView'

defineOptions({ name: 'OutletConsumptionsAddPendingReturns', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

/**
 * The reason vocabulary, projected from Layer 2's list — never restated here, so adding a
 * reason to the domain adds it to this dropdown with no second edit (§4.5).
 * Hoisted to a module constant: an inline literal would re-run the select's resolvers on
 * every render (§11 rule 5).
 */
const REASON_OPTIONS = RETURN_REASONS.map((reason) => ({
  value: reason,
  label: reason.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}))

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard
const { _C } = useCurrency()

const SelectField = resolveFieldComponent('select', 'add')
const TextareaField = resolveFieldComponent('textarea', 'add')

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

const returnRows = computed(() => wizard.returnRows.value)

const warehouseOptions = computed(() => wizard.regionWarehouses.value)

/** Indexed once, not scanned per render pass (CORE_ARCHITECTURE_RULES §6). */
const warehouseNameByCode = computed(() =>
  new Map(warehouseOptions.value.map((option) => [option.value, option.label])))

const warehouseName = (code) =>
  warehouseNameByCode.value.get(String(code || '').trim()) || 'a warehouse'

/**
 * Turning the warehouse toggle on seeds the only sensible default target; turning it off
 * clears it, so a stale code cannot ride along on a return that is staying put.
 */
function setWarehouseAction (sku, value) {
  const on = value === true
  wizard.setReturnMeta(sku, {
    WarehouseActionRequired: on,
    WarehouseCode: on ? (wizard.metaFor(sku).WarehouseCode || warehouseOptions.value[0]?.value || '') : ''
  })
}

/** The plain-language outcome of the current toggle pair, derived from Layer 2's table. */
function outcomeText (sku) {
  const meta = wizard.metaFor(sku)
  const change = returnQtyChange(1, meta)
  const progress = returnProgressFor(meta)
  const credited = meta.InvoiceAdjustmentRequired ? 'credited on the invoice' : 'not credited'
  // The warehouse's NAME, never its code. A raw `WH001` in a sentence is an opaque string
  // the reader cannot check against the dropdown right above it (§7.2).
  const destination = meta.WarehouseActionRequired
    ? `shipped to ${warehouseName(meta.WarehouseCode)}`
    : 'left at the outlet'
  const ledger = change > 0
    ? 'Outlet stock goes up.'
    : (change < 0 ? 'Outlet stock goes down.' : 'Outlet stock is unchanged.')
  return `${capitalise(destination)}, ${credited}. ${ledger} Marked ${progress.replace(/_/g, ' ').toLowerCase()}.`
}

/** Warning-tinted only when nothing at all happens — the one combination worth querying. */
function outcomeClass (sku) {
  const meta = wizard.metaFor(sku)
  const inert = !meta.InvoiceAdjustmentRequired && !meta.WarehouseActionRequired
  return inert ? 'bg-orange-1 text-body2' : 'bg-grey-2 text-body2'
}

const capitalise = (value) => String(value).replace(/^\w/, (c) => c.toUpperCase())
</script>
