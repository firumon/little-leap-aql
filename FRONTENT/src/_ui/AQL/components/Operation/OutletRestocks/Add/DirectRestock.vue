<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col">
            <div class="text-subtitle1 text-weight-medium">Direct restock</div>
            <div class="text-caption text-grey-8">
              Take stock now from your region's warehouse, with no approval step.
            </div>
          </div>
          <div class="col-auto">
            <FieldToggleAdd v-model="direct" :config="{ color: 'primary' }" :header="CTRL.DIRECT" />
          </div>
        </div>
      </q-card-section>

      <q-card-section v-if="direct" class="q-pt-none">
        <FieldSelectAdd
          v-if="warehouses.length > 1"
          v-model="warehouseCode"
          :record="{}"
          :config="{ label: 'Source warehouse', options: warehouses, clearable: false }"
          :header="CTRL.WAREHOUSE"
        />
        <div v-else class="text-body2 text-grey-8">
          Taking stock from <span class="text-weight-medium">{{ warehouses[0].label }}</span>.
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Step 1b - route the request. Both toggles are controls on the restock node, and Layer
// 2's derive rules turn them into progress on the parent and every line. Whether the user
// may route at all is `restockDirectOptions()`, a domain answer relayed by the context.
import { computed, useAttrs } from 'vue'
import FieldSelectAdd from 'src/_fields/select/Add.vue'
import FieldToggleAdd from 'src/_fields/toggle/Add.vue'
import { RESTOCK_CONTROL as CTRL } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { useRestockAddContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/Add/useRestockAddContext'

defineOptions({ name: 'OutletRestocksDirectRestock', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, directOptions, ui } = useRestockAddContext()

const warehouses = computed(() => directOptions.value.warehouses)
const visible = computed(() => pageState?.meta.currentStep === 1 && directOptions.value.canDirect)

const direct = pageState.useControls(CTRL.DIRECT, false, 'OutletRestocks')
const warehouseCode = pageState.useControls(CTRL.WAREHOUSE, '', 'OutletRestocks')
</script>
