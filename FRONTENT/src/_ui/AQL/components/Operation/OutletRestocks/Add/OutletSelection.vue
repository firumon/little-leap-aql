<template>
  <div v-if="pageState?.meta.currentStep === 1" :class="gutterClass">
    <q-card class="aql-premium-card" flat>
      <q-card-section :class="gutterClass">
        <div class="text-subtitle1 text-weight-medium">Select outlet</div>
        <FieldSelectAdd
          :model-value="parent.record.value.OutletCode"
          :record="parent.record.value"
          :config="{ label: 'Outlet', options: outletOptions, clearable: false }"
          header="OutletCode"
          @update:model-value="setOutlet"
        />
      </q-card-section>
    </q-card>

    <!-- Direct restock is only offered when the user's access region actually has
         a warehouse to draw from. With no match the card is not rendered at all
         and the request stays on the standard approval workflow. -->
    <q-card v-if="matchingWarehouses.length" class="aql-premium-card bg-primary-light" flat>
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col">
            <div class="text-subtitle1 text-weight-medium">Direct restock</div>
            <div class="text-caption text-grey-8">
              Allocate stock immediately from your region's warehouse, skipping approval.
            </div>
          </div>
          <div class="col-auto">
            <q-toggle :model-value="isDirect" color="primary" @update:model-value="setDirect" />
          </div>
        </div>
      </q-card-section>

      <q-card-section v-if="isDirect" class="q-pt-none">
        <FieldSelectAdd
          v-if="matchingWarehouses.length > 1"
          :model-value="warehouseCode"
          :record="{}"
          :config="{ label: 'Source warehouse', options: matchingWarehouses, clearable: false }"
          header="WarehouseCode"
          @update:model-value="setWarehouse"
        />
        <div v-else class="text-body2 text-grey-8">
          Allocating from <span class="text-weight-medium">{{ matchingWarehouses[0].label }}</span>.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * Step 1 of the restock wizard: outlet plus restock mode, in one content card set.
 *
 * The mode half is region-gated. A user whose AccessRegion matches no active
 * warehouse can only ever raise a standard request, so the toggle is not rendered
 * and `RestockMode` is left at STANDARD — rather than showing a control that
 * cannot be honoured. With exactly one matching warehouse the source is implicit
 * and stated as text; with several the user picks one.
 *
 * Navigation belongs to the sticky bar (`Add/PageAction.js`), which reads these
 * control fields back off pageState to gate `next`.
 */
import { computed, inject, onMounted, useAttrs } from 'vue'
import FieldSelectAdd from 'components/_fields/select/Add.vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'

defineOptions({ name: 'OutletRestocksOutletSelection', inheritAttrs: false })

// Vertical rhythm follows the page's own gutter token (drilled down from
// pageProps — AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.4) so the gap between these
// cards matches the gap between page sections instead of hardcoding its own scale.
const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const pageState = inject('pageState', null)
const resourceConfig = inject('resourceConfig', null)
const resourceRecord = inject('resourceRecord', null)
// Every resource this step reads goes through `useRecord`, which owns both the
// reactive rows and the `reload()` delta-sync — so no store is imported here
// (ARCHITECTURE RULES §5).
const outlets = useRecord('Outlets')
const warehouses = useRecord('Warehouses')
const skus = useRecord('SKUs')
const products = useRecord('Products')
const outletStorages = useRecord('OutletStorages')
const warehouseStorages = useRecord('WarehouseStorages')
const { user, hasRegionAccess } = useAuth()
const { query } = useRouteConfig()
const parent = pageState.useNode('OutletRestocks')

const outletOptions = computed(() => outlets.items.value
  .filter((row) => (row.Status || 'Active') === 'Active')
  .map((row) => ({ label: [row.Code, row.Name].filter(Boolean).join(' · '), value: row.Code })))

// `hasRegionAccess` also honours universe-scoped users and rolled-up child
// regions, which the previous flat `=== accessRegion.code` comparison silently
// excluded from direct restock.
const matchingWarehouses = computed(() => warehouses.items.value
  .filter((row) => (row.Status || 'Active') === 'Active')
  .filter((row) => hasRegionAccess(row.AccessRegion))
  .map((row) => ({ label: [row.Code, row.Name].filter(Boolean).join(' · '), value: row.Code })))

const isDirect = computed(() => pageState.getControlField('OutletRestocks', 'RestockMode') === 'DIRECT')
const warehouseCode = computed(() => pageState.getControlField('OutletRestocks', 'WarehouseCode') || '')

function setOutlet (value) { pageState.setField('OutletRestocks', 'OutletCode', value) }
function setWarehouse (value) { pageState.setControlField('OutletRestocks', 'WarehouseCode', value) }

// Turning DIRECT on seeds the source warehouse (the only one, or the first of
// several); turning it off clears it so a stale code cannot ride along on a
// standard request.
function setDirect (value) {
  const direct = value === true && matchingWarehouses.value.length > 0
  pageState.setControlField('OutletRestocks', 'RestockMode', direct ? 'DIRECT' : 'STANDARD')
  pageState.setControlField('OutletRestocks', 'WarehouseCode', direct ? (warehouseCode.value || matchingWarehouses.value[0].value) : '')
}

onMounted(async () => {
  pageState.initResource('OutletRestocks', {
    reset: true,
    isPrimaryKey: true,
    fields: {
      Date: new Date().toISOString().slice(0, 10),
      RequestedUser: resourceRecord?.value?.RequestedUser || user.value?.name || user.value?.email || '',
      Progress: 'DRAFT',
      Status: 'Active'
    }
  })
  pageState.setControlField('OutletRestocks', 'RestockMode', 'STANDARD')
  // Storages are loaded here, at step 1, so step 2's stock-match aggregate
  // (useRestockStockMatch) already has outlet + warehouse quantities the moment
  // the user advances, instead of each step-2 card issuing its own fetch.
  // `reload()` renders from whatever the store already holds and runs the sync
  // as a silent background delta, so a warm cache shows the form immediately.
  await Promise.all([outlets, warehouses, skus, products, outletStorages, warehouseStorages].map((resource) => resource.reload()))
  const queryOutlet = String(query.value.outletCode || '').trim()
  if (queryOutlet && outletOptions.value.some((option) => option.value === queryOutlet)) setOutlet(queryOutlet)
})
</script>
