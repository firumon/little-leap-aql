<template>
  <div :class="gutterClass">
    <SectionDividerLabel label="STOCK RETURNED TO THIS OUTLET" />
    <q-card v-if="restorations.length" flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-caption text-grey-8 q-pb-sm">
          These go back onto the outlet's shelf when the cancellation is sent.
        </div>
        <q-list separator dense>
          <q-item v-for="line in restorations" :key="`${line.sku}-${line.storageName}`" class="q-py-sm">
            <q-item-section :class="ui.flexWrapTextClass">
              <q-item-label>{{ line.sku }}</q-item-label>
              <q-item-label caption>{{ line.storageName }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-chip dense outline color="positive" :label="`+${line.qty}`" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-banner v-else dense rounded class="bg-grey-2 text-body2">
      This audit recorded no consumed units, so no stock moves back.
    </q-banner>
  </div>
</template>

<script setup>
// What physically moves back, line by line. Rendered from the same pure helper the batch
// builds its compensating movements from. No `<style>` block (ARCHITECTURE RULES §7).
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useConsumptionCancelContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/CancelConsumption/useConsumptionCancelContext'

defineOptions({ name: 'OutletConsumptionsCancelConsumptionStockRestoration', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, restorations } = useConsumptionCancelContext()
</script>
