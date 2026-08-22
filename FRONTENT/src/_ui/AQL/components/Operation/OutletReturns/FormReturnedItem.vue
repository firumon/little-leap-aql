<template>
  <div :class="spacingClass">
    <!-- Arrived from the Outlet Hub with the outlet already decided, or editing a return
         whose ledger movement is already scoped to it. Stated rather than offered, so the
         return cannot be silently re-pointed at another outlet. -->
    <q-banner v-if="outletLocked" dense rounded class="bg-blue-1 text-body2 q-mb-sm">
      <template #avatar><q-icon name="info" color="primary" /></template>
      {{ lockMessage }} <span class="text-weight-medium">{{ lockedOutletLabel }}</span>.
    </q-banner>

    <SectionDividerLabel label="RETURNED ITEM" />
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <!-- Stacked, not side by side: the outlet decides which invoices and which price
             list the SKU below is read against, so the two are a sequence rather than a
             pair. Both gaps come from the page's own gutter token (§10.2). -->
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
/**
 * OutletReturns › FormReturnedItem — card 1 of the shared return form (resource tier).
 *
 * WHICH OUTLET, WHICH SKU — nothing else on the page can be decided before these two, which
 * is why this card leads both contracts and why it is the page's HYDRATION POINT: neither
 * Add nor Edit carries a `Create`/`Update` content, so `useReturnFormSeed` seeds the node
 * and preloads every resource the six cards read, in one place, rather than each card
 * issuing its own fetch as the user scrolls (§13.5).
 *
 * `mode` is what makes the same six cards serve both pages — `Edit.js` passes `'edit'`, and
 * the seeder loads the server row instead of this module's defaults.
 *
 * Holds no state: every value is a projection of `pageState` and every writer goes straight
 * back to it (ARCHITECTURE RULES §6). No `<style>` block (§7).
 */
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
const spacingClass = computed(() => `q-gutter-y-${gutter.value}`)

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
