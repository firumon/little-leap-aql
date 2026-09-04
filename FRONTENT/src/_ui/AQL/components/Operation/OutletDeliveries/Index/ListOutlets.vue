<template>
  <AppList
    :items="rows"
    :gutter="attrs.gutter || 'sm'"
    item-key="outletCode"
    icon="storefront"
    :icon-color="chipColor"
    :layout="['label', 'caption']"
    label="outletName"
    :caption="caption"
    :meta-layout="['chip']"
    :chip="chip"
    :chip-color="chipColor"
    chip-outline
    clickable
    empty-text="Nothing waiting to be loaded. Every allocated item is already on a delivery."
    empty-icon="local_shipping"
    empty-icon-color="positive"
    @click="goToAdd"
  />
</template>

<script setup>
/**
 * OutletDeliveries › Index › "Ready to Load" — the unassigned allocation queue.
 *
 * It lists the OUTLETS that have `OutletRestockItems` lines allocated and not yet on any
 * live run, not `OutletDeliveries` rows. `APP.Resources.ListViews` filters one resource's
 * own rows and cannot express that join, so this override ignores the `items` it is handed
 * (§7.1). WHICH lines qualify is Layer 2's answer, reached through the page relay.
 *
 * One row per outlet, in the same shape every other pill on this Index uses. Creating the
 * run is the FAB's job, not this list's (UI_ACTION_SYSTEM.md — `ResourceActions`), so
 * tapping a stop just opens the Add wizard.
 */
import { computed, useAttrs } from 'vue'
import AppList from 'components/app/AppList.vue'
import { toDateOnly } from 'src/utils/dateHelpers'
import { useDeliveryQueueContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/Index/useDeliveryQueueContext'
import {
  relativeAgeLabel,
  joinParts
} from 'src/_ui/AQL/composables/Operation/OutletDeliveries/Index/useDeliveryRowPresets'

defineOptions({ name: 'OutletDeliveriesIndexListOutlets', inheritAttrs: false })

const attrs = useAttrs()

const { nav, outletGroups, ageColor } = useDeliveryQueueContext()

const rows = computed(() => outletGroups.value)

const caption = (row) => joinParts([
  toDateOnly(row.oldestAt),
  `${row.itemCount} item${row.itemCount === 1 ? '' : 's'}`
])

// The outlet wears its worst line's age, so a stale stop reads as stale before it is opened.
const chip = (row) => relativeAgeLabel(row.oldestAt)
const chipColor = (row) => ageColor(row.oldestDays)

const goToAdd = () => nav.goTo('add')
</script>
