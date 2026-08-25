<template>
  <div v-if="visible && wizard.enableRestock.value" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <!-- Say the fill rule on screen, so the user can trust it (§10.5). -->
        <div class="text-caption text-grey-8 q-pb-sm">
          Filled from what sold. Adjust anything you want to send differently.
        </div>

        <!-- Same stepper layout as step 2, so the muscle memory carries over. -->
        <q-list v-if="wizard.restockRows.value.length" separator>
          <q-item v-for="(row, i) in wizard.restockRows.value" :key="row.SKU">
            <q-item-section class="col" :class="ui.flexWrapTextClass">
              <q-item-label class="text-weight-medium">{{ wizard.skuLabel(row.SKU).primary }}</q-item-label>
              <q-item-label caption>{{ wizard.skuLabel(row.SKU).secondary }}</q-item-label>
              <q-item-label v-if="wizard.directRestock.value" caption :class="coverageClass(row)">
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
                <!-- No delete button. Zero the line instead — one control, and undoable. -->
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

    <!-- Inline drawer, not a dialog: the list stays visible while items are added. -->
    <AqlAddItemsExpansion
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
      v-if="wizard.directRestock.value && wizard.restockRows.value.length && wizard.restockCoverage.value.shortfall > 0"
      dense
      rounded
      class="bg-orange-1 text-body2"
    >
      <template #avatar><q-icon name="warning" color="warning" /></template>
      The warehouse cannot cover {{ wizard.restockCoverage.value.shortfall }} unit(s).
      You can still continue — what is in stock will be issued now, and the rest stays as
      a pending line for a later allocation.
    </q-banner>
  </div>
</template>

<script setup>
// Step 4b — what is being sent back: the restock lines, the add drawer and the
// coverage warning. The routing decisions live in RestockOptions.
import { computed, reactive, useAttrs, onMounted } from 'vue'
import AqlAddItemsExpansion from 'components/shared/AqlAddItemsExpansion.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionWizard } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddRestockItems', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard

const NumberField = resolveFieldComponent('number', 'add')

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

// Quantity per candidate SKU. Entries are dropped once added.
const pendingQty = reactive({})

function addFromExpansion (sku) {
  wizard.addRestockRow(sku, pendingQty[sku] ?? 1)
  // Deleted, not reset, so a re-added SKU starts at 1 again.
  delete pendingQty[sku]
}

// Indexed once per render pass, not scanned per row (CORE_ARCHITECTURE_RULES §6).
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

// Mirror on arrival too, so an untouched count still shows lines.
onMounted(() => { if (wizard.enableRestock.value) wizard.syncRestockFromSales() })
</script>
