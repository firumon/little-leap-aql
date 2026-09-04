<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col">
            <div class="text-subtitle1 text-weight-medium">Instant delivery</div>
            <div class="text-caption text-grey-8">
              Tick if you are carrying this stock now. It is added to the outlet's balance
              straight away, with no delivery step later.
            </div>
          </div>
          <div class="col-auto">
            <FieldToggleAdd v-model="deliver" :config="{ color: 'primary' }" :header="CTRL.DELIVER" />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// Step 1c - hand the stock over now. Sits with the routing choice it depends on: Layer 2
// ignores this control while `direct` is off, so the card is hidden rather than disabled.
import { computed, useAttrs } from 'vue'
import FieldToggleAdd from 'src/_fields/toggle/Add.vue'
import { RESTOCK_CONTROL as CTRL } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { useRestockAddContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/Add/useRestockAddContext'

defineOptions({ name: 'OutletRestocksInstantDelivery', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, directOptions, ui } = useRestockAddContext()

const direct = pageState.useControls(CTRL.DIRECT, false, 'OutletRestocks')
const warehouseCode = pageState.useControls(CTRL.WAREHOUSE, '', 'OutletRestocks')
const deliver = pageState.useControls(CTRL.DELIVER, false, 'OutletRestocks')

const visible = computed(() => pageState?.meta.currentStep === 1 &&
  directOptions.value.canDeliver && direct.value === true && !!warehouseCode.value)
</script>
