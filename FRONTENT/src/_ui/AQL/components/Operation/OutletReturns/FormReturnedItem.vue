<template>
  <div>
    <q-banner v-if="outletLocked" dense rounded class="bg-blue-1 text-body2 q-mb-sm">
      <template #avatar><q-icon name="info" color="primary" /></template>
      {{ lockMessage }} <span class="text-weight-medium">{{ lockedOutletLabel }}</span>.
    </q-banner>

    <SectionDividerLabel label="RETURNED ITEM" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row" :class="[gutterXClass, gutterYClass]">
          <div v-if="!outletLocked" class="col-12">
            <FieldSelectAdd
              :model-value="form.OutletCode"
              :record="form"
              :config="{ label: 'Outlet', options: outletOptions, clearable: false }"
              header="OutletCode"
              @update:model-value="setOutlet"
            />
          </div>
          <div class="col-12">
            <FieldSelectAdd
              :model-value="form.SKU"
              :record="form"
              :config="{ label: 'Item (SKU)', options: skuOptions, clearable: false }"
              header="SKU"
              @update:model-value="setSku"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldSelectAdd from 'src/_fields/select/Add.vue'
import { useReturnFormSeed } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields'

defineOptions({ name: 'OutletReturnsFormReturnedItem', inheritAttrs: false })

const props = defineProps({
  mode: { type: String, default: 'add' }
})

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')
const gutterXClass = computed(() => `q-col-gutter-x-${gutter.value}`)
const gutterYClass = computed(() => `q-gutter-y-${gutter.value}`)

const {
  ui,
  form,
  outletOptions,
  skuOptions,
  outletLocked,
  lockedOutletLabel,
  serverRecord,
  setOutlet,
  setSku
} = useReturnFormSeed(props.mode)

const lockMessage = computed(() => (serverRecord.value
  ? 'The outlet cannot be changed after a return is logged — this return belongs to'
  : 'Pre-selected from Outlet Hub — logging a return for'))
</script>
