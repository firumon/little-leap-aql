<template>
  <AppList
    v-bind="preset"
    :gutter="gutter"
    empty-icon="assignment_turned_in"
    empty-text="Nothing outstanding — every return has been settled."
    @click="openReturn($event?.Code)"
  />
</template>

<script setup>
/**
 * OutletReturns › Index — the "Submitted" list view.
 *
 * Every return still moving: not completed, not cancelled. Oldest first, because the longest wait is the most urgent.
 *
 * ── WHY THIS VIEW IS A COMPONENT ──
 * The auto-generated view filters `Progress eq SUBMITTED`, which hides every return the
 * consumption path ever raised — those carry the LEGACY holding states
 * (`AWAITING_INVOICE_ADJUSTMENT`, `AWAITING_WAREHOUSE_RECEIPT`) and are just as
 * outstanding. A pre-filtered view can only be narrowed, so this one renders from the
 * full record set and asks the domain instead.
 *
 * The row shape is the module's one shared preset, so this list states a return exactly the
 * way its four siblings do and only the meta chip differs — see `useReturnRowPresets`.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useReturnIndexContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnIndexContext'
import { submittedPreset } from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnRowPresets'

defineOptions({ name: 'OutletReturnsIndexListSubmitted', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'xs')

const { records, filterReturns, openReturn } = useReturnIndexContext()

const preset = computed(() => submittedPreset(filterReturns(records.value)))
</script>
