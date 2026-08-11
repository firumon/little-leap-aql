<template>
  <div v-if="visible" :class="gutterClass">
    <q-card class="aql-premium-card aql-card-gradient-subtle" flat>
      <q-card-section :class="gutterClass">
        <!-- What is being decided, stated once. The approver arrived from a list
             and needs to know which request this is without going back. -->
        <div class="row no-wrap q-col-gutter-sm">
          <div class="col">
            <div class="text-caption text-grey-7">Restocking</div>
            <div class="text-subtitle1 text-weight-medium">{{ outletName }}</div>
          </div>
          <div class="col-auto text-right">
            <div class="text-caption text-grey-7">Requested on</div>
            <div class="text-subtitle1 text-weight-medium">{{ restock.Date || '—' }}</div>
          </div>
        </div>

        <q-separator />

        <!-- ONE control, not a default plus a list of extras. Which warehouses
             this approval may draw from is a single question, and splitting it in
             two made "stop drawing from the one I picked first" unreachable from
             the second control. Every selected warehouse is a source; order carries
             no meaning.

             Mounted through the `_fields/multiselect` control rather than a bare
             `q-select` so it inherits the shared search threshold, filter debounce
             and chip treatment (AQL_CUSTOM_UI_GUIDE §2.3). -->
        <component
          :is="WarehouseField"
          :model-value="selectedWarehouses"
          :config="warehouseFieldConfig"
          @update:model-value="setSelectedWarehouses"
        />

        <q-toggle
          :model-value="showOutsideStock"
          label="Show stock outside the selected warehouses"
          color="primary"
          data-testid="restock-approve-show-outside"
          @update:model-value="setShowOutsideStock"
        />
        <div class="text-caption text-grey-6 q-mt-none">
          Bins outside the selection are shown for reference only — allocation always
          draws from the warehouses selected above.
        </div>
      </q-card-section>
    </q-card>

    <!-- Allocation progress + the one-click fill. Its own card, because it acts on
         every line below rather than on the warehouse settings above. -->
    <q-card class="aql-premium-card aql-card-gradient-subtle" flat>
      <q-card-section class="q-gutter-y-sm">
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col">
            <div class="text-caption text-grey-7">Allocated so far</div>
            <div class="text-h6 text-weight-bold text-primary">
              {{ totalAllocated }} <span class="text-body2 text-grey-7">of {{ totalRequested }} units</span>
            </div>
          </div>
          <div class="col-auto">
            <q-btn
              class="aql-form-action-btn"
              glossy
              push
              color="primary"
              icon="bolt"
              label="Auto-allocate"
              :disable="!selectedWarehouses.length || !rows.length"
              data-testid="restock-approve-auto-allocate"
              @click="autoAllocateAll"
            />
          </div>
        </div>

        <q-linear-progress
          :value="progress"
          size="10px"
          rounded
          color="primary"
          track-color="grey-3"
        />

        <div class="row items-center justify-between no-wrap">
          <q-chip color="positive" text-color="white" icon="check_circle" :label="`${fullyCovered} fully covered`" />
          <q-chip color="warning" text-color="black" icon="pie_chart" :label="`${partlyCovered} partial`" />
          <q-chip color="grey-5" text-color="white" icon="remove_circle_outline" :label="`${notCovered} unallocated`" />
        </div>

        <div class="text-caption text-grey-6">
          Auto-allocation empties the smallest bins first, so the fewest storage
          locations are left holding a remnant.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 1a of the restock approval: where stock is drawn from.
 *
 * Also the page's hydration point. An `_action/:action` route is a custom
 * sub-route, so `usePageResolver` loads no record for it and there is no `Update`
 * content to seed pageState — `useRestockApproval` does both, and this is the
 * first content the contract renders, so it is where that composable is first
 * called (the pattern `EditRestockHeader` uses on the Edit page).
 *
 * Holds no state of its own: every control projects the `ApprovalPlan` control
 * field and writes straight back through the composable (ARCHITECTURE RULES §6).
 */
import { computed, inject, useAttrs } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { resolveFieldComponent } from 'components/_fields/useFieldResolver'
import { useRestockApproval } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockApproval'

defineOptions({ name: 'OutletRestocksApproveWarehouseAndLocation', inheritAttrs: false })

const props = defineProps({
  // Which wizard step this card belongs to. Declared by the page contract
  // (`Approve.js`), not hardcoded here, so the flow can be re-ordered from the
  // contract alone.
  step: { type: Number, default: 1 }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const outlets = useRecord('Outlets')

const {
  restock,
  rows,
  warehouseOptions,
  selectedWarehouses,
  showOutsideStock,
  setSelectedWarehouses,
  setShowOutsideStock,
  totalAllocated,
  autoAllocateAll
} = useRestockApproval()

// Resolved once: the registry is built eagerly, so this is a synchronous lookup
// and the control never flashes an empty cell while a chunk loads.
const WarehouseField = resolveFieldComponent('multiselect', 'add')

// The field controls declare `inheritAttrs: false` and do not re-bind `$attrs`
// (matching `_fields/select/`), so a plain attribute on the placeholder is
// dropped. `config` IS spread onto the inner control, which is why the test hook
// travels there rather than as a bare attribute.
const warehouseFieldConfig = computed(() => ({
  label: 'Source warehouses',
  options: warehouseOptions.value,
  hideBottomSpace: true,
  'data-testid': 'restock-approve-warehouses'
}))

const visible = computed(() => pageState?.meta.currentStep === props.step)

const outletName = computed(() => {
  const code = restock.value.OutletCode
  if (!code) return '—'
  return outlets.items.value.find((row) => row.Code === code)?.Name || code
})

const totalRequested = computed(() => rows.value.reduce((sum, row) => sum + row.requested, 0))
const progress = computed(() => (totalRequested.value ? totalAllocated.value / totalRequested.value : 0))

const fullyCovered = computed(() => rows.value.filter((row) => row.status === 'full').length)
const partlyCovered = computed(() => rows.value.filter((row) => row.status === 'partial').length)
const notCovered = computed(() => rows.value.filter((row) => row.allocated === 0).length)
</script>
