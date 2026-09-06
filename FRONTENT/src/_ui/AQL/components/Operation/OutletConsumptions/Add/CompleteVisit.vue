<template>
  <!-- Offered only when a visit was actually selected: with no planned visit there is
       nothing to complete, and a disabled toggle would still imply there should be. -->
  <q-card v-if="visible && visitCode" flat bordered :class="ui.cardClass">
    <q-card-section>
      <div class="row items-center no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">Mark visit as completed</div>
          <div class="text-caption text-grey-8">Closes the planned visit this consumption was made against.</div>
        </div>
        <div class="col-auto">
          <q-toggle
            :model-value="completeVisit"
            color="primary"
            :disable="!canComplete"
            @update:model-value="(v) => { completeVisit = v === true }"
          />
        </div>
      </div>
    </q-card-section>

    <q-card-section v-if="completeVisit" class="q-pt-none">
      <q-input
        v-model="completeComment"
        type="textarea"
        label="Completion comment"
        outlined
        hide-bottom-space
        rows="3"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
// Step 6b - close the planned visit. Its own content because it needs its own
// permission: the contract gates it on `OutletVisits:complete`, not on scheduling.
import { computed } from 'vue'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import {
  NODE,
  CTRL,
  VISIT_COMPLETE_COMMENT_FIELD,
  getCtrl,
  setCtrl,
  stepVisible
} from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddCompleteVisit', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const ACTION = 'Complete'

const { pageState, ui, allowed } = useConsumptionAddContext()

const consumption = pageState.useNode(NODE.CONSUMPTION)

const visible = computed(() => stepVisible(pageState, props.step))

const visitCode = computed(() => String(consumption.node.value.record.OutletVisitCode || '').trim())

const canComplete = computed(() =>
  !!visitCode.value && allowed(NODE.VISITS, 'complete'))

// A page control, not the node: the answer must survive the queued action being pulled
// and re-queued as the outlet or the visit changes.
const completeVisit = computed({
  get: () => canComplete.value && getCtrl(pageState, CTRL.COMPLETE_VISIT, true) === true,
  set: (value) => setCtrl(pageState, CTRL.COMPLETE_VISIT, value === true)
})

// The action's own field, edited in place — no local mirror to fall out of step. Bound to
// the DERIVED header, which is the only address the queued entry actually carries.
const completeComment = pageState.useActions(
  ACTION, `fields.${VISIT_COMPLETE_COMMENT_FIELD}`, NODE.VISITS)
</script>
