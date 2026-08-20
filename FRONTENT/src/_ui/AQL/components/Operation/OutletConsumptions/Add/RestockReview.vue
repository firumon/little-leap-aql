<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="RESTOCK" />

    <!-- The enable switch. A single line — label left, toggle right — not a bordered card:
         a heavy card around one control reads as a section of its own and competes with the
         restock list it governs. -->
    <q-item class="q-px-md q-py-sm">
      <q-item-section :class="ui.flexWrapTextClass">
        <q-item-label class="text-subtitle1 text-weight-medium">Restock</q-item-label>
        <q-item-label caption>Turn off if this visit sends nothing back to the outlet.</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle :model-value="wizard.enableRestock.value" color="primary" @update:model-value="setEnabled" />
      </q-item-section>
    </q-item>

    <!-- The routing choice, and it belongs HERE rather than on step 1: it is only
         meaningful once there IS a restock, and it is hidden with the rest of the step when
         there is not. Offered only where it can be honoured — the user's access region must
         contain a warehouse to draw from (§13.0). -->
    <template v-if="wizard.enableRestock.value && wizard.regionWarehouses.value.length">
      <q-item class="q-px-md q-py-sm">
        <q-item-section :class="ui.flexWrapTextClass">
          <q-item-label class="text-subtitle1 text-weight-medium">Direct restock</q-item-label>
          <q-item-label caption>
            Carry the stock from your region's warehouse now, instead of raising a request
            for someone to approve.
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle :model-value="wizard.directRestock.value" color="primary" @update:model-value="setDirect" />
        </q-item-section>
      </q-item>

      <q-card v-if="wizard.directRestock.value" flat bordered :class="ui.cardClass">
        <q-card-section>
          <component
            :is="SelectField"
            v-if="wizard.regionWarehouses.value.length > 1"
            :model-value="wizard.warehouseCode.value"
            :record="{}"
            :config="{ label: 'Source warehouse', options: wizard.regionWarehouses.value, clearable: false }"
            header="WarehouseCode"
            @update:model-value="(value) => wizard.set(FIELDS.WAREHOUSE, value)"
          />
          <div v-else class="text-body2 text-grey-8">
            Drawing from <span class="text-weight-medium">{{ wizard.regionWarehouses.value[0].label }}</span>.
          </div>
        </q-card-section>
      </q-card>
    </template>

    <q-card v-if="wizard.enableRestock.value" flat bordered :class="ui.cardClass">
      <q-card-section>
        <!-- The auto-fill states its rule on screen: a computed result the user did not
             specify is one they have to undo by hand to trust (§10.5). -->
        <div class="text-caption text-grey-8 q-pb-sm">
          Filled from what sold. Adjust anything you want to send differently.
        </div>

        <!-- The SAME layout as the stock count in step 2: details down the left, a vertical
             stepper on the right. Two consecutive steps asking the user to set a quantity
             per SKU should not ask it with two different controls — the muscle memory
             built on step 2 carries straight into step 4. -->
        <q-list v-if="wizard.restockRows.value.length" separator>
          <q-item v-for="(row, i) in wizard.restockRows.value" :key="row.SKU">
            <q-item-section class="col" :class="ui.flexWrapTextClass">
              <q-item-label class="text-weight-medium">{{ wizard.skuLabel(row.SKU).primary }}</q-item-label>
              <q-item-label caption>{{ wizard.skuLabel(row.SKU).secondary }}</q-item-label>
              <q-item-label v-if="wizard.directRestock.value" caption :class="coverageClass(row)">
                {{ coverageText(row) }}
              </q-item-label>
              <!-- A zeroed line SAYS it is being dropped rather than just showing 0, so the
                   pruning on Continue is not a surprise. -->
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
                  @click="wizard.setRestockQty(i, Number(row.Quantity) + 1)"
                />
                <div style="width: 84px">
                  <component
                    :is="NumberField"
                    :model-value="row.Quantity"
                    :record="row"
                    :config="{ dense: true, inputClass: 'text-center text-weight-bold text-h6' }"
                    header="Quantity"
                    @update:model-value="(value) => wizard.setRestockQty(i, value)"
                  />
                </div>
                <!-- Enabled all the way down to zero, and there is no delete button.
                     Removing a line is now "take it to zero and continue", which is one
                     control instead of two and is undoable right up until the transition —
                     a delete button beside a stepper the user is tapping repeatedly was a
                     mis-tap away from losing the line outright. -->
                <q-btn
                  flat
                  round
                  size="lg"
                  icon="keyboard_arrow_down"
                  color="primary"
                  aria-label="Decrease restock quantity"
                  :disable="Number(row.Quantity) <= 0"
                  @click="wizard.setRestockQty(i, Number(row.Quantity) - 1)"
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

    <!-- An EXPANSION, not a dialog. Adding a second SKU used to mean opening a modal,
         searching a select, confirming, and repeating — four interactions per item, with
         the list you are adding to hidden behind the modal the whole time. Inline, the
         remaining SKUs are already on screen with their own quantity box, so adding three
         items is three taps and the restock list stays visible above.
         Hidden entirely once every SKU is on the list — an expansion promising items and
         opening onto nothing is worse than no control.
         The shell (filter, row rhythm, leave transition) is the SHARED drawer; only the
         quantity box and the add button are this step's own. -->
    <AqlAddItemsExpansion
      v-if="wizard.enableRestock.value"
      :items="wizard.restockCandidates.value"
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
          <!-- Identical presentation to step 2's own add button (`dense round` with an
               `add` glyph), so the two drawers read as one recurring control rather than
               two similar ones. Only the colour differs, and it differs because they mean
               different things: orange for a return, primary for a restock — the same
               pairing the metric chips use. -->
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

    <!-- Only when a direct restock is actually being carried. A shortfall warning on a
         request someone else will allocate later would be describing stock levels that
         will have changed by the time it matters. -->
    <template v-if="wizard.enableRestock.value && wizard.directRestock.value && wizard.restockRows.value.length">
      <q-banner v-if="wizard.restockCoverage.value.shortfall > 0" dense rounded class="bg-orange-1 text-body2">
        <template #avatar><q-icon name="warning" color="warning" /></template>
        The warehouse cannot cover {{ wizard.restockCoverage.value.shortfall }} unit(s).
        You can still continue — what is in stock will be issued now, and the rest stays as
        a pending line for a later allocation.
      </q-banner>

      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle1 text-weight-medium">Delivered on this visit</div>
              <div class="text-caption text-grey-8">
                Tick if you are carrying this stock with you now. It will be added to the
                outlet's balance immediately.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle
                :model-value="wizard.markDelivered.value"
                color="primary"
                @update:model-value="(v) => wizard.set(FIELDS.MARK_DELIVERED, v === true)"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </template>

  </div>
</template>

<script setup>
/**
 * Step 4 — replenishment review and, for a direct restock, the stock transfer.
 *
 * The lines arrive pre-filled from what sold, because replenishment mirrors consumption.
 * Editing a line latches it, so a later count change does not overwrite a quantity the
 * user deliberately set.
 *
 * PARTIAL COVER IS A STATED OUTCOME, not a failure. When the chosen warehouse cannot cover
 * everything, the banner says so and the flow continues: covered lines are issued and
 * deducted now, the shortfall survives as a PENDING line for a later allocation. Refusing
 * the whole submission would strand an officer who is standing in the outlet with some of
 * the stock in their hands.
 *
 * The coverage figures come from the same Layer 2 `splitByWarehouseStock` the payload
 * builder calls at submit time, so what the user reads here and what the batch writes
 * cannot disagree.
 *
 * The step also owns the two decisions that used to sit on step 1 — whether to leave a
 * restock at all, and whether it is carried directly or routed for approval. Both are only
 * meaningful once there IS a restock, and both are hidden together when there is not.
 *
 * The delivery toggle is only offered for a direct restock — an approval-route request has
 * no allocated stock to deliver yet, so the question would be meaningless (§10.5).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, reactive, useAttrs, onMounted } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import AqlAddItemsExpansion from 'components/shared/AqlAddItemsExpansion.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddRestockReview', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard

const NumberField = resolveFieldComponent('number', 'add')
// The source warehouse picker, resolved rather than deep-imported (§2.4).
const SelectField = resolveFieldComponent('select', 'add')

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

/**
 * Per-candidate quantity, keyed by SKU.
 *
 * A `reactive` map rather than one `ref` per row, because the expansion renders an
 * arbitrary number of them and each needs its own box. Entries are dropped as they are
 * added, so the map never outgrows the list it mirrors.
 */
const pendingQty = reactive({})

/**
 * Turning the restock OFF clears everything that only makes sense with one — the lines, the
 * mode and the delivery tick. A stale DIRECT flag left behind would otherwise route a
 * request that no longer exists, and re-enabling would silently restore choices the user
 * has already walked away from.
 */
function setEnabled (value) {
  const on = value === true
  wizard.set(FIELDS.ENABLE_RESTOCK, on)
  if (on) {
    wizard.syncRestockFromSales()
    return
  }
  wizard.set(FIELDS.RESTOCK_ROWS, [])
  wizard.set(FIELDS.DIRECT_RESTOCK, false)
  wizard.set(FIELDS.WAREHOUSE, '')
  wizard.set(FIELDS.MARK_DELIVERED, false)
}

/**
 * Turning DIRECT on seeds the source warehouse (the only one, or the first of several);
 * turning it off clears it so a stale code cannot ride along on a request that is no longer
 * direct, and drops the delivery tick with it.
 */
function setDirect (value) {
  const direct = value === true && wizard.regionWarehouses.value.length > 0
  wizard.set(FIELDS.DIRECT_RESTOCK, direct)
  wizard.set(FIELDS.WAREHOUSE, direct
    ? (wizard.warehouseCode.value || wizard.regionWarehouses.value[0].value)
    : '')
  if (!direct) wizard.set(FIELDS.MARK_DELIVERED, false)
}

function addFromExpansion (sku) {
  wizard.addRestockRow(sku, pendingQty[sku] ?? 1)
  // Removed rather than reset: the SKU has left the candidate list, so its entry is dead
  // weight — and if the user deletes the line and re-adds it, it should start at 1 again.
  delete pendingQty[sku]
}

/** Indexed once per render pass rather than scanned per row (CORE_ARCHITECTURE_RULES §6). */
const allocatedBySku = computed(() =>
  new Map(wizard.restockCoverage.value.allocated.map((row) => [row.SKU, row.Quantity])))

function coverageText (row) {
  const covered = allocatedBySku.value.get(String(row.SKU || '').trim()) || 0
  const wanted = Number(row.Quantity) || 0
  if (covered >= wanted) return `Warehouse can cover all ${wanted}`
  if (covered === 0) return 'Not in warehouse stock — will stay pending'
  return `Warehouse can cover ${covered} of ${wanted}`
}

function coverageClass (row) {
  const covered = allocatedBySku.value.get(String(row.SKU || '').trim()) || 0
  const wanted = Number(row.Quantity) || 0
  if (covered >= wanted) return 'text-positive'
  return covered === 0 ? 'text-negative' : 'text-warning'
}

// The mirror runs on arrival as well as on every count change, so a user who reaches this
// step without touching a counter still sees lines rather than an empty card.
onMounted(() => { if (wizard.enableRestock.value) wizard.syncRestockFromSales() })
</script>
