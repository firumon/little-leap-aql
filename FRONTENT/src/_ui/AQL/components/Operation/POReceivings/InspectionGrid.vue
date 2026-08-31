<template>
  <div v-if="visible" :class="gutterClass">
    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center justify-between q-mb-xs">
          <div class="text-subtitle1 text-weight-medium">Counted so far</div>
          <q-btn
            flat dense no-caps color="primary" label="Receive all expected"
            :disable="!editable || !lines.length"
            @click="receiveAllExpected"
          />
        </div>
        <div class="text-caption text-grey-7">
          Fills every line with the ordered quantity. Adjust the ones that differ.
        </div>

        <q-separator class="q-my-sm" />

        <div class="row items-center q-gutter-xs">
          <q-chip dense square color="primary" text-color="white" :label="`${summary.received} received`" />
          <q-chip dense square color="positive" text-color="white" :label="`${summary.accepted} accepted`" />
          <q-chip v-if="summary.short" dense square color="warning" text-color="white" :label="`${summary.short} short`" />
          <q-chip v-if="summary.excess" dense square color="purple" text-color="white" :label="`${summary.excess} excess`" />
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="!lines.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="inventory_2" :size="ui.emptyIconSize" :color="ui.emptyIconColor" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">No lines to count</div>
        <div :class="ui.emptyCaptionClass">Pick a purchase order that carries items.</div>
      </q-card-section>
    </q-card>

    <InspectionLineCard
      v-for="line in lines"
      :key="line.key"
      :line="line"
      :editable="editable"
      @update="onUpdate"
    />
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import InspectionLineCard from './InspectionLineCard.vue'
import { useReceivingFormContext } from 'src/_ui/AQL/composables/Operation/POReceivings/useReceivingFormContext'

defineOptions({ name: 'POReceivingsInspectionGrid', inheritAttrs: false })

const props = defineProps({
  step: { type: [Number, String], default: null }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, lines, setLineField, receiveAllExpected, summary, editable, currentStep } = useReceivingFormContext()

const visible = computed(() => props.step == null || Number(props.step) === currentStep.value)

function onUpdate ({ key, field, value }) {
  setLineField(key, field, value)
}
</script>
