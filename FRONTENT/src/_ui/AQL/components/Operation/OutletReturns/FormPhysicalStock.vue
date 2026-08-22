<template>
  <div :class="spacingClass">
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

    <!-- The conditions that stop a submit and are not obvious from the fields (§13.4).
         DANGER while both tracks are off, because that one is not a field the reader can
         look at and fix — it is the shape of the return itself. -->
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
/**
 * OutletReturns › FormPhysicalStock — card 6 of the shared return form (resource tier).
 *
 * Track 2: is stock leaving the shelf. It closes the form because it is the only card that
 * can GROW — the target warehouse appears in response to the switch — and a control that
 * pushes the rest of the page down reads better as the last thing on it.
 *
 * The blocking banner lives here for the same reason: it is the last word before the sticky
 * bar, and the condition it most often reports (neither track chosen) is answered by the
 * two switches immediately above it.
 *
 * Holds no state (§6). No `<style>` block (§7).
 */
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldSelectAdd from 'src/_fields/select/Add.vue'
import { useReturnFormFields } from 'src/_ui/AQL/composables/Operation/OutletReturns/useReturnFormFields'

defineOptions({ name: 'OutletReturnsFormPhysicalStock', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')
const gutterXClass = computed(() => `q-col-gutter-x-${gutter.value}`)
const gutterYClass = computed(() => `q-gutter-y-${gutter.value}`)
const spacingClass = computed(() => `q-gutter-y-${gutter.value}`)

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
