<template>
  <div :class="gutterClass">
    <q-banner v-if="record && !eligible" rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ blockedMessage }}
    </q-banner>

    <template v-if="eligible && outstandingGroups.length">
      <SectionDividerLabel label="HANDED OVER" />

      <!-- Acts on every row on the page, so it gets its own card ahead of them (§7.5). -->
      <q-card flat bordered :class="ui.cardClass">
        <q-card-section class="row items-center q-col-gutter-sm">
          <div class="col-12 col-sm" :class="ui.flexWrapTextClass">
            <div class="text-subtitle2 text-weight-medium">{{ summaryLine }}</div>
            <div class="text-caption text-grey-8">{{ outstandingLine }}</div>
          </div>
          <div class="col-12 col-sm-auto">
            <q-btn flat no-caps label="All" :style="ui.tapTargetStyle" @click="selectAll" />
            <q-btn flat no-caps label="None" :style="ui.tapTargetStyle" @click="selectNone" />
          </div>
        </q-card-section>
      </q-card>

      <!-- Grouped by stop: a driver hands over one outlet at a time. -->
      <q-card
        v-for="group in outstandingGroups"
        :key="group.outletCode || group.outletName"
        flat
        bordered
        :class="ui.cardClass"
      >
        <q-card-section class="q-pb-none">
          <div class="row items-center no-wrap q-col-gutter-sm">
            <div class="col-auto">
              <q-checkbox
                :model-value="groupState(codesOf(group))"
                color="primary"
                @update:model-value="toggleGroup(group)"
              />
            </div>
            <div class="col" :class="ui.flexWrapTextClass">
              <div class="text-subtitle1 text-weight-medium">{{ group.outletName }}</div>
              <div class="text-caption text-grey-8">{{ group.items.length }} outstanding</div>
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <q-list separator>
            <q-item v-for="line in group.items" :key="line.Code" class="q-py-sm">
              <q-item-section side>
                <q-checkbox
                  :model-value="isSelected(line.Code)"
                  color="primary"
                  @update:model-value="(on) => toggleItem(line.Code, on)"
                />
              </q-item-section>
              <q-item-section :class="ui.flexWrapTextClass">
                <q-item-label>{{ line.productName }}</q-item-label>
                <q-item-label v-if="lineCaption(line)" caption>{{ lineCaption(line) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip square color="primary" text-color="white" :label="line.quantityLabel" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <SectionDividerLabel label="DELIVERY NOTE" />

      <q-card flat bordered :class="ui.cardClass">
        <q-card-section>
          <!-- `rows`, never `autogrow`: see `_fields/README.md` § Textarea Field Invariant. -->
          <FieldTextareaAdd
            :model-value="comment"
            :record="{}"
            :config="{ label: 'Proof-of-delivery note', rows: 4 }"
            header="ProgressDeliveredComment"
            @update:model-value="setComment"
          />
        </q-card-section>
      </q-card>
    </template>

    <!-- Everything on the run is already handed over. Not an error, so it is stated calmly
         and the sticky bar's own veto is what stops an empty submit. -->
    <q-card v-if="eligible && !outstandingGroups.length" flat bordered :class="ui.cardClass">
      <q-card-section class="text-center q-py-lg">
        <q-icon name="check_circle" :size="ui.emptyIconSize" color="positive" class="q-mb-sm block q-mx-auto" />
        <div :class="ui.emptyTitleClass">Everything delivered</div>
        <div :class="ui.emptyCaptionClass">Every item on this run has been handed over.</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// The driver ticks what came off the van, grouped by stop. Nothing is pre-ticked: the
// movement a proof of delivery writes is not easy to undo.
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldTextareaAdd from 'src/_fields/textarea/Add.vue'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'
import { useDeliveryView } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryView'
import {
  canDeliver,
  isCancelled,
  isCompleted
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

defineOptions({ name: 'OutletDeliveriesMarkDeliverSelectDeliveredItems', inheritAttrs: false })

const NODE = 'OutletDeliveries'
const SELECTION_FIELD = 'DeliverSelection'
const COMMENT_FIELD = 'DeliverComment'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, pageState, resourceRecord } = useDeliveryFormContext()
const { outletGroups, preload } = useDeliveryView()

const text = (value) => (value == null ? '' : String(value).trim())

const record = computed(() => resourceRecord?.record?.value || null)
const eligible = computed(() => !!record.value && canDeliver(record.value))

const blockedMessage = computed(() => {
  const row = record.value
  if (!row) return ''
  if (isCancelled(row)) return 'This delivery was cancelled. Nothing can be delivered against it.'
  if (isCompleted(row)) return 'This delivery is already complete.'
  return 'Items can no longer be delivered against this run.'
})

/** Stops with something still to hand over. A finished stop drops off the page entirely. */
const outstandingGroups = computed(() => outletGroups.value
  .map((group) => ({ ...group, items: group.items.filter((line) => !line.delivered && !line.missing) }))
  .filter((group) => group.items.length))

const codesOf = (group) => group.items.map((line) => text(line.Code))

const allOutstandingCodes = computed(() =>
  outstandingGroups.value.flatMap(codesOf))

// Held in a control field. The sticky bar reads it back to build the batch.

const selectedCodes = computed(() => {
  const raw = pageState?.getControls(SELECTION_FIELD, null, NODE)
  return Array.isArray(raw) ? raw.map(text).filter(Boolean) : []
})

const selectedSet = computed(() => new Set(selectedCodes.value))

const setSelection = (codes) =>
  pageState?.setControls(SELECTION_FIELD, [...new Set((codes || []).map(text).filter(Boolean))], NODE)

const isSelected = (code) => selectedSet.value.has(text(code))

function toggleItem (code, on) {
  const next = new Set(selectedSet.value)
  if (on === false) next.delete(text(code))
  else next.add(text(code))
  setSelection([...next])
}

function toggleCodes (codes, on) {
  const next = new Set(selectedSet.value)
  for (const code of codes) {
    if (on) next.add(text(code))
    else next.delete(text(code))
  }
  setSelection([...next])
}

// A stop sits at `null` when only some of its lines are ticked, and Quasar's own next value
// from there is `false` — which would clear a half-ticked stop instead of completing it.
// Only a fully ticked stop turns off, so the emitted value is ignored on purpose.
function toggleGroup (group) {
  const codes = codesOf(group)
  toggleCodes(codes, groupState(codes) !== true)
}

/** `null` is Quasar's indeterminate: some lines ticked, not all. */
function groupState (codes) {
  if (!codes.length) return false
  const hits = codes.filter((code) => selectedSet.value.has(code)).length
  if (hits === 0) return false
  if (hits === codes.length) return true
  return null
}

const selectAll = () => setSelection(allOutstandingCodes.value)
const selectNone = () => setSelection([])

const summaryLine = computed(() => {
  const count = selectedCodes.value.length
  return count ? `${count} Item${count === 1 ? '' : 's'} Selected` : 'Nothing Selected'
})

const outstandingLine = computed(() =>
  `${allOutstandingCodes.value.length} still to deliver on this run`)

const comment = computed(() => pageState?.getControls(COMMENT_FIELD, null, NODE) || '')
const setComment = (value) => pageState?.setControls(COMMENT_FIELD, value, NODE)

// Warehouse and bin are established on the manifest; repeating them per line pushed the
// variant that actually tells two SKUs apart out of view.
function lineCaption (line) {
  return line.skuVariant === line.productName ? line.skuCode : line.skuVariant
}

onMounted(async () => {
  setSelection([])
  pageState?.setControls(COMMENT_FIELD, '', NODE)
  await preload()
})
</script>
