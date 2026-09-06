<template>
  <div :class="gutterClass">
    <q-banner v-if="!gate.allowed" dense rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      This audit can no longer be cancelled. {{ gate.reason }}
    </q-banner>

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="text-subtitle1 text-weight-medium">Why is this being cancelled?</div>
        <div class="text-caption text-grey-8 q-pb-sm">
          The reason is saved on this record and copied onto everything cancelled with it.
        </div>
        <component
          :is="TextareaField"
          v-model="reason"
          :record="{}"
          :config="{ label: 'Cancellation reason', required: true, rows: 3 }"
          header="ProgressCancelledComment"
          :disable="!gate.allowed"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// The route's hydration point: this is the ONE card that imports the seed. It collects the
// mandatory reason and nothing else. No `<style>` block (ARCHITECTURE RULES §7).
import { computed, useAttrs } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'
import { useConsumptionCancelSeed } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/CancelConsumption/useConsumptionCancelSeed'

defineOptions({ name: 'OutletConsumptionsCancelConsumptionCancelReason', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { pageState, ui, gate } = useConsumptionCancelSeed()

const TextareaField = resolveFieldComponent('textarea', 'add')

// The live node record, not a control: the reason IS a column (§5B.5).
const reason = pageState.useRecord('ProgressCancelledComment', 'OutletConsumptions')
</script>
