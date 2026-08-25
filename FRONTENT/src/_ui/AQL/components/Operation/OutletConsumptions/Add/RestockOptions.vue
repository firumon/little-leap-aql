<template>
  <div v-if="visible" :class="gutterClass">
    <SectionDividerLabel label="RESTOCK" />

    <!-- A plain line, not a card: a card here would compete with the list it governs. -->
    <q-item class="q-px-md q-py-sm">
      <q-item-section :class="ui.flexWrapTextClass">
        <q-item-label class="text-subtitle1 text-weight-medium">Restock</q-item-label>
        <q-item-label caption>Turn off if this visit sends nothing back to the outlet.</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle :model-value="wizard.enableRestock.value" color="primary" @update:model-value="setEnabled" />
      </q-item-section>
    </q-item>

    <!-- Only shown when the region has a warehouse to draw from (§13.0). -->
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

      <!-- Sits with the routing choice it belongs to. -->
      <q-card v-if="wizard.directRestock.value && wizard.restockRows.value.length" flat bordered :class="ui.cardClass">
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
// Step 4a — the restock decisions: leave one at all, route it direct or for approval,
// and hand it over now. The lines themselves live in RestockItems.
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddRestockOptions', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard

// The source warehouse picker, resolved rather than deep-imported (§2.4).
const SelectField = resolveFieldComponent('select', 'add')

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))

// Turning restock off clears the lines, the mode and the delivery tick, so a stale
// DIRECT flag cannot route a request that no longer exists.
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

// DIRECT on seeds the source warehouse; off clears it and the delivery tick.
function setDirect (value) {
  const direct = value === true && wizard.regionWarehouses.value.length > 0
  wizard.set(FIELDS.DIRECT_RESTOCK, direct)
  wizard.set(FIELDS.WAREHOUSE, direct
    ? (wizard.warehouseCode.value || wizard.regionWarehouses.value[0].value)
    : '')
  if (!direct) wizard.set(FIELDS.MARK_DELIVERED, false)
}
</script>
