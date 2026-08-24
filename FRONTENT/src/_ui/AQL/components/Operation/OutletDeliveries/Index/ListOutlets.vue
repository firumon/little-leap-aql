<template>
  <div :class="gutterClass">
    <q-card v-if="totals.items" flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
      <q-card-section class="row items-center no-wrap q-col-gutter-sm">
        <div class="col" :class="ui.flexWrapTextClass">
          <div class="text-subtitle1 text-weight-medium">{{ totals.items }} items ready to load</div>
          <div class="text-caption text-grey-8">
            {{ totals.units }} units across {{ totals.outlets }} outlet{{ totals.outlets === 1 ? '' : 's' }}
          </div>
        </div>
        <div class="col-auto">
          <q-btn
            v-bind="ui.primaryActionBtnProps"
            :class="ui.primaryActionBtnClass"
            color="primary"
            icon="add"
            label="Create Delivery"
            @click="goToAdd"
          />
        </div>
      </q-card-section>
    </q-card>

    <AqlGroupedList
      v-if="rows.length"
      :items="rows"
      group-key="outletCode"
      header-label="outletName"
      :header-caption="headerCaption"
      header-icon="storefront"
      :header-chip="headerChip"
      :header-chip-color="headerChipColor"
      header-chip-outline
      :card-class="ui.cardClass"
      label="skuLabel"
      :caption="rowCaption"
      :layout="['label', 'caption']"
      :meta-layout="['chip']"
      :chip="(row) => String(row.quantity)"
      chip-color="primary"
      chip-outline
      :clickable="false"
    />

    <AppList
      v-else
      :items="[]"
      empty-text="Nothing waiting to be loaded. Every allocated item is already on a delivery."
      empty-icon="local_shipping"
    />
  </div>
</template>

<script setup>
/**
 * OutletDeliveries › Index › "Outlets" — the unassigned allocation queue.
 *
 * It lists `OutletRestockItems` lines that are ALLOCATED and not yet on any live run, not
 * `OutletDeliveries` rows. `APP.Resources.ListViews` filters one resource's own rows and
 * cannot express that join, so this override ignores the `items` it is handed (§7.1).
 * WHICH lines qualify is Layer 2's answer, reached through the page relay.
 */
import { computed, useAttrs } from 'vue'
import AqlGroupedList from 'components/app/AqlGroupedList.vue'
import AppList from 'components/app/AppList.vue'
import { useDeliveryQueueContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/Index/useDeliveryQueueContext'

defineOptions({ name: 'OutletDeliveriesIndexListOutlets', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { nav, ui, outletGroups, totals, ageColor } = useDeliveryQueueContext()

// `AqlGroupedList` groups a FLAT array, so the two-level tree is flattened back to lines
// that carry their outlet. The composable's oldest-first order survives the flatten.
const rows = computed(() => outletGroups.value.flatMap((group) => group.items.map((item) => ({
  ...item,
  outletCode: group.outletCode || '__unresolved',
  outletName: group.outletName,
  city: group.city,
  oldestDays: group.oldestDays
}))))

const groupHead = (group) => group.items[0] || {}

// Blank when the age is unknown, so a missing stamp never reads as a fresh line.
function waitText (days) {
  if (!Number.isFinite(days)) return ''
  if (days <= 0) return 'allocated today'
  return `waiting ${days} day${days === 1 ? '' : 's'}`
}

function headerCaption (group) {
  const head = groupHead(group)
  const units = group.items.reduce((sum, row) => sum + row.quantity, 0)
  return [head.city, `${units} unit${units === 1 ? '' : 's'}`, waitText(head.oldestDays)]
    .filter(Boolean).join(' • ')
}

const headerChip = (group) => `${group.items.length} item${group.items.length === 1 ? '' : 's'}`

// The outlet wears its worst line's age, so a stale stop is visible before it is opened.
const headerChipColor = (group) => ageColor(groupHead(group).oldestDays)

// The header already states the outlet's worst wait, so a row repeats it only when it
// differs — otherwise every line under a header echoes the same phrase.
function rowCaption (row) {
  const age = row.days === row.oldestDays ? '' : waitText(row.days)
  return [row.WarehouseCode, row.StorageName, age].filter(Boolean).join(' • ')
}

const goToAdd = () => nav.goTo('add')
</script>
