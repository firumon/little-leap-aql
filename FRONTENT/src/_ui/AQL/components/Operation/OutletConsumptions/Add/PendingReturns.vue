<template>
  <div v-if="visible" :class="gutterClass">
    <ReturnsFoundToday :gutter="gutter" />
    <UnsettledReturns :gutter="gutter" />
  </div>
</template>

<script setup>
// Step 5 — return management. The shell owns the step gate only; each half decides for
// itself whether it has anything to say. No `<style>` block (ARCHITECTURE RULES §7).
import { computed, useAttrs } from 'vue'
import ReturnsFoundToday from './ReturnsFoundToday.vue'
import UnsettledReturns from './UnsettledReturns.vue'
import { useConsumptionAddContext } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionAddContext'
import { stepVisible } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'

defineOptions({ name: 'OutletConsumptionsAddPendingReturns', inheritAttrs: false })

const props = defineProps({ step: { type: [Number, String], default: null } })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'sm')
const gutterClass = computed(() => `q-gutter-y-${gutter.value}`)

const { pageState } = useConsumptionAddContext()

const visible = computed(() => stepVisible(pageState, props.step))
</script>
