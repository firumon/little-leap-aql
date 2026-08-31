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
        <q-toggle v-model="restocking" color="primary" />
      </q-item-section>
    </q-item>

    <!-- Only shown when the region has a warehouse to draw from (§13.0). -->
    <template v-if="restocking && regionWarehouses.length">
      <q-item class="q-px-md q-py-sm">
        <q-item-section :class="ui.flexWrapTextClass">
          <q-item-label class="text-subtitle1 text-weight-medium">Direct restock</q-item-label>
          <q-item-label caption>
            Carry the stock from your region's warehouse now, instead of raising a request
            for someone to approve.
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="direct" color="primary" />
        </q-item-section>
      </q-item>

      <q-card v-if="direct" flat bordered :class="ui.cardClass">
        <q-card-section>
          <component
            :is="SelectField"
            v-if="regionWarehouses.length > 1"
            v-model="warehouseCode"
            :record="{}"
            :config="{ label: 'Source warehouse', options: regionWarehouses, clearable: false }"
            header="WarehouseCode"
          />
          <div v-else class="text-body2 text-grey-8">
            Drawing from <span class="text-weight-medium">{{ regionWarehouses[0].label }}</span>.
          </div>
        </q-card-section>
      </q-card>

      <!-- Sits with the routing choice it belongs to. -->
      <q-card v-if="direct && restockRows.length" flat bordered :class="ui.cardClass">
        <q-card-section>
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle1 text-weight-medium">Deliver Instantly</div>
              <div class="text-caption text-grey-8">
                Tick if you are carrying this stock with you now. It will be added to the
                outlet's balance immediately.
              </div>
            </div>
            <div class="col-auto">
              <q-toggle v-model="deliver" color="primary" />
            </div>
          </div>
        </q-card-section>
      </q-card>
    </template>
  </div>
</template>

<script setup>
// Step 4a - the restock decisions: leave one at all, route it direct or for approval,
// and hand it over now. Every toggle is a control on the restock node, and Layer 2's
// derive rules turn them into progress. The lines live in RestockItems, same node.
import { computed, inject, useAttrs, watch } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { RESTOCK_CONTROL, restockNodeForConsumption } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { NODE, RESTOCKING, stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddRestockOptions', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const ui = useAQLConfig()
const pageState = inject('pageState')
const { hasRegionAccess } = useAuth()
const warehouses = useRecord('Warehouses')

const SelectField = resolveFieldComponent('select', 'add')

const text = (value) => (value == null ? '' : String(value).trim())
const isActive = (row) => !text(row?.Status) || text(row.Status).toUpperCase() === 'ACTIVE'

const consumption = pageState.useNode(NODE.CONSUMPTION)
const restock = pageState.useNode(NODE.RESTOCKS)

const visible = computed(() => stepVisible(pageState, props.step))

const restocking = pageState.useControls(RESTOCKING, true)
const direct = pageState.useControls(RESTOCK_CONTROL.DIRECT, false, NODE.RESTOCKS)
const deliver = pageState.useControls(RESTOCK_CONTROL.DELIVER, false, NODE.RESTOCKS)
const warehouseCode = pageState.useControls(RESTOCK_CONTROL.WAREHOUSE, '', NODE.RESTOCKS)

const restockRows = computed(() => restock.children(NODE.RESTOCK_ITEMS).value || [])

// `hasRegionAccess`, not a flat equality test: it also honours universe-scoped users
// and rolled-up child regions.
const regionWarehouses = computed(() => warehouses.items.value
  .filter((row) => isActive(row) && hasRegionAccess(row.AccessRegion))
  .map((row) => ({ value: text(row.Code), label: text(row.Name) || text(row.Code) })))

// Turned back on it refills from what sold. What that means is OutletRestocks' own rule,
// so the consumption and its sold rows go to Layer 2 and the node comes back ready.
function seedRestockNode () {
  pageState.setResource(NODE.RESTOCKS, null, restockNodeForConsumption(
    consumption.node.value.record,
    consumption.children(NODE.ITEMS).value,
    {
      warehouseCodes: regionWarehouses.value.map((house) => house.value),
      warehouseCode: warehouseCode.value
    }))
}

// Warehouses arrive after mount, so this waits for them rather than settling on `false`
// while the list is still empty. Keyed on the LINE COUNT, not on the node: a disabled
// field writing its control back re-creates an empty node, and an existence test then
// reads that shell as a filled restock and never refills it.
watch([restocking, regionWarehouses, () => restockRows.value.length], ([on, houses, lines]) => {
  if (on !== true) return
  if (lines === 0) seedRestockNode()
  if (!houses.length) return (direct.value = false)
  if (direct.value !== true) direct.value = true
  if (deliver.value !== true) deliver.value = true
  if (!warehouseCode.value) warehouseCode.value = houses[0].value
}, { immediate: true })

// Off clears the warehouse, so no stale allocation reaches the batch. `deliver` is left
// alone — Layer 2 already ignores it while `direct` is off.
// Guarded on the node: writing a control CREATES the node, so an unguarded clear here
// resurrected the node step 2 had just dropped. The re-created node hid the removal from
// the routing watcher above, which then never re-seeded and left the restock PENDING.
watch(direct, (on) => {
  if (!restock.exists.value) return
  if (on !== true) return (warehouseCode.value = '')
  if (!warehouseCode.value && regionWarehouses.value.length) warehouseCode.value = regionWarehouses.value[0].value
})
</script>
