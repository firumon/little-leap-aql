<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="RESTOCK" />
    <q-card flat bordered :class="ui.cardClass">
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
         opening onto nothing is worse than no control. -->
    <q-expansion-item
      v-if="wizard.restockCandidates.value.length"
      icon="add_circle_outline"
      label="Add other items to restock"
      :caption="`${wizard.restockCandidates.value.length} more item(s) available`"
      header-class="text-primary text-weight-medium"
      class="rounded-borders"
      :class="ui.cardClass"
    >
      <q-list separator>
        <q-item v-for="option in wizard.restockCandidates.value" :key="option.value">
          <q-item-section>
            <q-item-label>{{ option.label }}</q-item-label>
          </q-item-section>
          <q-item-section side>
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
                   `add` glyph), so the two expansions read as one recurring control rather
                   than two similar ones. Only the colour differs, and it differs because
                   the two expansions mean different things: orange for a return, primary
                   for a restock — the same pairing the metric chips use. -->
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
          </q-item-section>
        </q-item>
      </q-list>
    </q-expansion-item>

    <!-- Only when a direct restock is actually being carried. A shortfall warning on a
         request someone else will allocate later would be describing stock levels that
         will have changed by the time it matters. -->
    <template v-if="wizard.directRestock.value && wizard.restockRows.value.length">
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
 * The delivery toggle is only offered for a direct restock — an approval-route request has
 * no allocated stock to deliver yet, so the question would be meaningless (§10.5).
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, reactive, useAttrs, onMounted } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddRestockReview', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard

const NumberField = resolveFieldComponent('number', 'add')

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
onMounted(() => wizard.syncRestockFromSales())
</script>
