<template>
  <!-- Offered only when a visit was actually selected: with no planned visit there is
       nothing to complete, and a disabled toggle would still imply there should be. -->
  <q-card v-if="visible && wizard.visitCode.value" flat bordered :class="ui.cardClass">
    <q-card-section>
      <div class="row items-center no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">Mark visit as completed</div>
          <div class="text-caption text-grey-8">Closes the planned visit this consumption was made against.</div>
        </div>
        <div class="col-auto">
          <q-toggle :model-value="wizard.completeVisit.value" color="primary"
                    @update:model-value="(v) => wizard.set(FIELDS.COMPLETE_VISIT, v === true)" />
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
// Step 6b — close the planned visit. Its own content because it needs its own
// permission: the contract gates it on `OutletVisits:complete`, not on scheduling.
import { computed } from 'vue'
import { useConsumptionWizard, WIZARD_FIELDS as FIELDS } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'

defineOptions({ name: 'OutletConsumptionsAddCompleteVisit', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const wizard = useConsumptionWizard()
const { ui, pageState } = wizard

const visible = computed(() =>
  props.step == null || Number(props.step) === (pageState?.meta.currentStep || 1))
</script>
