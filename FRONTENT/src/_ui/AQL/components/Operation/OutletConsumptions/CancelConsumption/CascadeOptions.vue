<template>
  <div :class="gutterClass">
    <SectionDividerLabel label="THIS WILL ALSO" />
    <CascadeOptionCard :option="cascade.restock" :control="CONTROL.RESTOCK" :node="NODE" />
    <CascadeOptionCard :option="cascade.returns" :control="CONTROL.RETURNS" :node="NODE" />
    <CascadeOptionCard :option="cascade.invoice" :control="CONTROL.INVOICE" :node="NODE" />
  </div>
</template>

<script setup>
// The three connected resources, one card each. Turning a toggle rewrites the live batch
// through the Layer 2 derive. No `<style>` block (ARCHITECTURE RULES §7).
import { computed, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import CascadeOptionCard from './CascadeOptionCard.vue'
import { CONSUMPTION_CANCEL_CONTROL, CONSUMPTION_CANCEL_NODE } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionCancel'
import { useConsumptionCancelContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/CancelConsumption/useConsumptionCancelContext'

defineOptions({ name: 'OutletConsumptionsCancelConsumptionCascadeOptions', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const CONTROL = CONSUMPTION_CANCEL_CONTROL
const NODE = CONSUMPTION_CANCEL_NODE
const { cascade } = useConsumptionCancelContext()
</script>
