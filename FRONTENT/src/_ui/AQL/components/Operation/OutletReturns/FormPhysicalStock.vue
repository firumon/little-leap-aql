<template>
  <div>
    <SectionDividerLabel label="PHYSICAL STOCK" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap" :class="gutterXClass">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-medium">Stock Leaving Outlet</div>
            <div class="text-caption text-grey-8">
              Physical stock is being removed from the outlet shelf.
            </div>
          </div>
          <div class="col-auto">
            <q-toggle
              :model-value="warehouseRequired"
              color="purple"
              @update:model-value="setWarehouseRequired"
            />
          </div>
        </div>

        <div v-if="warehouseRequired" class="row q-pt-sm" :class="[gutterXClass, gutterYClass]">
          <div class="col-12">
            <FieldSelectAdd
              :model-value="form.WarehouseCode"
              :record="form"
              :config="{ label: 'Target Warehouse *', options: warehouseOptions, clearable: false }"
              header="WarehouseCode"
              @update:model-value="setWarehouse"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-banner
      v-if="blockingMessage"
      dense
      rounded
      class="text-body2"
      :class="noTrackChosen ? 'bg-red-1 text-negative' : 'bg-orange-1'"
    >
      <template #avatar>
        <q-icon
          :name="noTrackChosen ? 'error' : 'warning'"
          :color="noTrackChosen ? 'negative' : 'warning'"
        />
      </template>
      {{ blockingMessage }}
    </q-banner>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldSelectAdd from 'src/_fields/select/Add.vue'
import { useReturnFormFields } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields'

defineOptions({ name: 'OutletReturnsFormPhysicalStock', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')
const gutterXClass = computed(() => `q-col-gutter-x-${gutter.value}`)
const gutterYClass = computed(() => `q-gutter-y-${gutter.value}`)

const {
  ui,
  form,
  warehouseRequired,
  warehouseOptions,
  setWarehouseRequired,
  setWarehouse,
  noTrackChosen,
  blockingMessage
} = useReturnFormFields()
</script>
