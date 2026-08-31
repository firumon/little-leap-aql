<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <q-btn v-bind="BTN" icon="visibility" color="grey-7" aria-label="View purchase order" @click.stop="goToView">
      <q-tooltip>View Purchase Order</q-tooltip>
    </q-btn>

    <AdditionalActionsButtons
      v-if="allowedActions.length"
      resource="PurchaseOrders" :record="item" :only="allowedActions"
    >
      <template #default="{ actions, open }">
        <q-btn
          v-for="action in ordered(actions)" :key="action.action"
          v-bind="BTN"
          :icon="action.icon || 'bolt'" :color="action.color || 'primary'"
          :aria-label="action.label || action.action"
          @click.stop="open(action)"
        >
          <q-tooltip>{{ action.label || action.action }}</q-tooltip>
        </q-btn>
      </template>
    </AdditionalActionsButtons>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AdditionalActionsButtons from 'components/app/AdditionalActionsButtons.vue'
import { useProcurementIndexContext } from 'src/_ui/AQL/composables/Operation/useProcurementIndexContext'
import {
  progressOf,
  CREATED,
  SENT,
  ACKNOWLEDGED
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderProgress'

defineOptions({ name: 'PurchaseOrdersIndexPurchaseOrderActionButtons' })

const props = defineProps({
  item: { type: Object, required: true }
})

const { nav } = useProcurementIndexContext()

const BTN = { flat: true, round: true, dense: true, size: 'md' }

// Cancel needs a written reason, so it stays on the record page.
const ACTIONS_BY_PROGRESS = {
  [CREATED]: ['Send'],
  [SENT]: ['Acknowledge'],
  [ACKNOWLEDGED]: ['Accept']
}

const progress = computed(() => progressOf(props.item))
const allowedActions = computed(() => ACTIONS_BY_PROGRESS[progress.value] || [])

function ordered (actions) {
  const order = allowedActions.value
  return actions.slice().sort((a, b) => order.indexOf(a.action) - order.indexOf(b.action))
}

function goToView () {
  nav.goTo('view', { code: props.item?.Code })
}
</script>
