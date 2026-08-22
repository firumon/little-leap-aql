<template>
  <AppList
    v-bind="preset"
    :gutter="gutter"
    empty-icon="warehouse"
    empty-text="No stock is waiting to be received."
    @click="openReturn($event?.Code)"
  />
</template>

<script setup>
/**
 * OutletReturns › Index — the "Awaiting Warehouse Receipt" list view.
 *
 * Returns whose units have left the shelf on paper and not yet been received anywhere. Oldest first.
 *
 * ── WHY THIS VIEW IS A COMPONENT ──
 * Membership is a question about the PHYSICAL flag pair (required, not completed), on the
 * same reasoning as the credit queue beside it — and the two deliberately overlap, since
 * a return with both tracks open is genuinely two pieces of work owed to two people.
 *
 * The row shape is the module's one shared preset, so this list states a return exactly the
 * way its four siblings do and only the meta chip differs — see `useReturnRowPresets`.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import { useReturnIndexContext } from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnIndexContext'
import { awaitingWarehousePreset } from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnRowPresets'

defineOptions({ name: 'OutletReturnsIndexListAwaitingWarehouseReceipt', inheritAttrs: false })

const attrs = useAttrs()
const gutter = computed(() => attrs.gutter || 'xs')

const { records, filterReturns, openReturn } = useReturnIndexContext()

const preset = computed(() => awaitingWarehousePreset(filterReturns(records.value)))
</script>
