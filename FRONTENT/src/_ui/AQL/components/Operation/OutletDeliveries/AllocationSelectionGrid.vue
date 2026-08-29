<template>
  <div v-if="isActive" :class="gutterClass">
    <q-card v-if="hasRows" flat bordered :class="ui.cardClass">
      <q-card-section :class="gutterClass">
        <q-select
          :model-value="groupBy"
          :options="GROUP_BY_OPTIONS"
          label="Group By"
          outlined
          emit-value
          map-options
          @update:model-value="setGroupBy"
        />

        <div :class="ui.flexWrapTextClass">
          <div class="text-subtitle2 text-weight-medium">{{ summaryLine }}</div>
        </div>
      </q-card-section>
    </q-card>

    <q-card v-if="hasRows" flat bordered :class="ui.cardClass">
      <AllocationTree
        :nodes="treeNodes"
        :open-keys="openKeys"
        :state-of="stateOf"
        @toggle="onToggle"
        @toggle-open="toggleOpen"
      />
    </q-card>

    <AppList
      v-if="!hasRows"
      :items="[]"
      :empty-text="emptyText"
      empty-icon="local_shipping"
    />
  </div>
</template>

<script setup>
// Shared by Add step 1 and Edit. The `record` prop is the only difference between them.
// Also the hydration point: it opens every resource the selection reads.
import { computed, onMounted, useAttrs, watch } from 'vue'
import AppList from 'components/app/AppList.vue'
import AllocationTree from './AllocationTree.vue'
import { useDeliverySelection, GROUP_BY_OPTIONS } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliverySelection'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'
import { orsisForDelivery } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

defineOptions({ name: 'OutletDeliveriesAllocationSelectionGrid', inheritAttrs: false })

const props = defineProps({
  /** Supplied by the Edit contract; absent on Add, where there is no manifest yet. */
  record: { type: Object, default: null },
  /** Null on Edit, which is a single screen. */
  step: { type: [Number, String], default: null },
  emptyText: {
    type: String,
    default: 'No allocated items are waiting for a delivery. Approve a restock request first.'
  }
})

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, pageState, resourceRecord } = useDeliveryFormContext()

const manifest = () => props.record || resourceRecord?.record?.value || null

const {
  SELECTION,
  treeNodes,
  visibleItems,
  groupBy,
  setGroupBy,
  selectionSummary,
  isSelected,
  toggleItem,
  toggleCodes,
  groupState,
  setSelection,
  preload
} = useDeliverySelection({ record: manifest })

const currentStep = computed(() => pageState?.meta?.currentStep || 1)
const isActive = computed(() => props.step == null || Number(props.step) === currentStep.value)

const hasRows = computed(() => visibleItems.value.length > 0)

const summaryLine = computed(() => selectionSummary.value.label)

// ─── Expansion ────────────────────────────────────────────────────────────────

const openKeys = computed(() => {
  const raw = pageState?.getControls('OpenKeys', null, SELECTION)
  return new Set(Array.isArray(raw) ? raw : [])
})

const setOpenKeys = (keys) => pageState?.setControls('OpenKeys', [...keys], SELECTION)

function toggleOpen (key) {
  const next = new Set(openKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  setOpenKeys(next)
}

// Top level starts open so the user sees the shape of the queue, not a row of closed bars.
watch(() => [groupBy.value, treeNodes.value.length], () => {
  const top = treeNodes.value.map((node) => node.key)
  const kept = [...openKeys.value].filter((key) => key.startsWith(`${groupBy.value}/`))
  setOpenKeys(new Set(kept.length ? kept : top))
}, { immediate: true })

// ─── Ticking ──────────────────────────────────────────────────────────────────

const stateOf = (node) => (node.item ? isSelected(node.key) : groupState(node.codes))

const onToggle = (node, on) => {
  if (node.item) toggleItem(node.item, on)
  else toggleCodes(node.codes, on)
}

// ─── Hydration ────────────────────────────────────────────────────────────────

// Keyed, not unconditional: the record arrives late, and re-seeding on every tick would
// wipe edits already made.
const hydratedFor = () => String(pageState?.getControls('HydratedFor', null, SELECTION) ?? '').trim()

function seedSelection () {
  const record = manifest()
  const code = String(record?.Code ?? '').trim()

  if (!code) {
    if (hydratedFor() !== '__add') {
      pageState?.setControls('HydratedFor', '__add', SELECTION)
      setSelection([])
    }
    return
  }

  if (hydratedFor() === code) return
  pageState?.setControls('HydratedFor', code, SELECTION)
  setSelection(orsisForDelivery(record))
}

onMounted(async () => {
  seedSelection()
  await preload()
  seedSelection()
})

watch(() => String(manifest()?.Code ?? '').trim(), seedSelection)
</script>
