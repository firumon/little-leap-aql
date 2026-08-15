<template>
  <div v-if="visible" :class="gutterClass">
    <!-- Empty storage is a legitimate audit outcome, not an error: a new outlet, or one
         that sold out completely. The caption is what says which (§10.4). -->
    <q-card v-if="!wizard.hasCountRows.value" flat bordered :class="ui.cardClass">
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
      v-for="(row, i) in wizard.countRows.value"
      :key="row.SKU"
      flat
      bordered
      :class="ui.cardClass"
    >
      <q-card-section>
        <!-- Details LEFT, counter RIGHT. Everything identifying and describing the line
             reads down a single left column, so a scan of the card set moves in a straight
             line instead of zig-zagging between a centred name and a centred counter. -->
        <div class="row items-center no-wrap q-col-gutter-md">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-medium q-px-sm">{{ wizard.skuLabel(row.SKU).primary }}</div>
            <div class="text-caption text-grey-7 q-px-sm">{{ wizard.skuLabel(row.SKU).secondary }}</div>
            <div class="column q-mt-sm">
              <q-chip
                v-for="metric in metricsFor(row)"
                :key="metric.key"
                square
                :color="metric.value > 0 ? metric.color : 'grey-3'"
                :text-color="metric.value > 0 ? 'white' : 'grey-7'"
                :label="metric.label"
                class="q-ma-none"
              />
            </div>
          </div>

          <!-- A VERTICAL stepper: up on top, the figure in the middle, down beneath. A
               phone is held one-handed and counted with a thumb, and a horizontal −/+ pair
               puts the two buttons on opposite sides of the number, so raising a count by
               five means crossing the field five times. Stacked, the thumb stays put.
               Sized `lg` with a 32px glyph — the token floor is a MINIMUM, and this is the
               control the entire step exists to drive, so it is deliberately well above it. -->
          <div class="col-auto column items-center">
            <q-btn
              flat
              round
              size="lg"
              icon="keyboard_arrow_up"
              color="primary"
              aria-label="Increase counted quantity"
              @click="wizard.stepCurrentQty(i, 1)"
            />
            <div style="width: 84px">
              <component
                :is="NumberField"
                :model-value="row.CurrentQty"
                :record="row"
                :config="{ dense: true, inputClass: 'text-center text-weight-bold text-h6' }"
                header="CurrentQty"
                @update:model-value="(value) => wizard.setCurrentQty(i, value)"
              />
            </div>
            <q-btn
              flat
              round
              size="lg"
              icon="keyboard_arrow_down"
              color="primary"
              aria-label="Decrease counted quantity"
              :disable="Number(row.CurrentQty) <= 0"
              @click="wizard.stepCurrentQty(i, -1)"
            />
          </div>

          <div v-if="row.isManualReturn" class="col-auto">
            <q-btn
              flat
              round
              dense
              icon="delete"
              color="negative"
              aria-label="Remove this return line"
              :style="ui.tapTargetStyle"
              @click="wizard.removeManualReturn(i)"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- An EXPANSION, matching the restock step exactly. The dialog is gone: adding a
         damaged item meant opening a modal, searching a select, confirming and repeating,
         with the counts you are working against hidden behind the modal the whole time.
         Inline, the remaining SKUs are already on screen with their own quantity box, so
         logging three damages is three taps and the count list stays visible above.
         Hidden once every SKU is already on the count - an expansion promising items and
         opening onto nothing is worse than no control at all. -->
    <template v-if="wizard.returnCandidates.value.length">
      <SectionDividerLabel label="FOUND SOMETHING ELSE?" />
      <q-expansion-item
        icon="assignment_return"
        label="Add extra return items"
        :caption="`${wizard.returnCandidates.value.length} item(s) available`"
        header-class="text-orange-9 text-weight-medium"
        class="rounded-borders"
        :class="ui.cardClass"
      >
        <q-list separator>
          <q-item v-for="option in wizard.returnCandidates.value" :key="option.value">
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
                  :aria-label="`Add ${option.label} as a return`"
                  @click="addReturn(option.value)"
                />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </template>
  </div>
</template>

<script setup>
/**
 * Step 2 — the physical count.
 *
 * One card per SKU the outlet is recorded as holding, each seeded AT its system quantity
 * rather than at zero: the common outcome is "some of this sold", and starting at zero
 * would mean an officer who skips a line has silently declared the whole shelf gone.
 *
 * The three chips are the derivation, shown live so the officer sees the consequence of
 * the number they just typed. Sold and Return can never both be positive for one row —
 * that is guaranteed by the Layer 2 arithmetic, not by anything here.
 *
 * The "Add extra return items" expansion covers stock the storage balance does not know
 * about: damaged units, an unlisted SKU found on the shelf. Those rows carry
 * `SystemQty = 0`, so the shared arithmetic yields a pure return with no special case
 * anywhere downstream.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed, reactive, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionWizard } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddStockCount', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs();
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard

const NumberField = resolveFieldComponent('number', 'add')

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

/** Indexed, not scanned: this is read once per rendered row (CORE_ARCHITECTURE_RULES §6). */
const restockBySku = computed(() =>
  new Map(wizard.restockRows.value.map((row) => [String(row.SKU || '').trim(), Number(row.Quantity) || 0])))

const restockQtyFor = (sku) => restockBySku.value.get(String(sku || '').trim()) || 0

/**
 * The four metrics for one row, ALWAYS all four and always in this order.
 *
 * Returned as a list rather than written as four conditional chips in the template,
 * because the fixed length is the point: the card's height and the stepper's position must
 * not change as the user counts. A zero metric renders muted rather than disappearing.
 *
 * `Sold` states its arithmetic (`6 − 4 = 2`) so the derivation is legible rather than
 * implied (§10.5); the other three are plain readings.
 */
function metricsFor (row) {
  const sold = Number(row.SoldQty) || 0
  return [
    { key: 'system', label: `System: ${row.SystemQty}`, value: Number(row.SystemQty) || 0, color: 'grey-7' },
    { key: 'sold', label: sold > 0 ? `Sold: ${row.SystemQty} − ${row.CurrentQty} = ${sold}` : 'Sold: 0', value: sold, color: 'positive' },
    { key: 'restock', label: `Restock: ${restockQtyFor(row.SKU)}`, value: restockQtyFor(row.SKU), color: 'primary' },
    { key: 'return', label: `Return: ${Number(row.ReturnQty) || 0}`, value: Number(row.ReturnQty) || 0, color: 'orange' }
  ]
}

/** Per-candidate quantity for the expansion, keyed by SKU — same shape as step 4. */
const pendingQty = reactive({})

function addReturn (sku) {
  wizard.addManualReturn(sku, pendingQty[sku] ?? 1)
  delete pendingQty[sku]
}
</script>
