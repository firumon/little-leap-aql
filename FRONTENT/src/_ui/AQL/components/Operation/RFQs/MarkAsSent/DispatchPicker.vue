<template>
  <div :class="gutterClass">
    <q-banner v-if="!canDispatch && rfq" dense rounded class="bg-orange-2">
      <template #avatar>
        <q-icon name="lock" color="orange-9" />
      </template>
      Only a sent RFQ can have its suppliers dispatched.
    </q-banner>

    <q-card v-else flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-subtitle1 text-weight-medium">Mark as sent</div>
          <div class="text-caption text-grey-7">{{ selectedRowCodes.length }} of {{ dispatchable.length }} selected</div>
        </div>

        <div v-if="!dispatchable.length" class="text-center q-py-lg">
          <q-icon name="mark_email_read" :size="ui.emptyIconSize" color="positive" class="q-mb-sm block q-mx-auto" />
          <div :class="ui.emptyTitleClass">Everyone has been sent</div>
          <div :class="ui.emptyCaptionClass">No supplier on this RFQ is still waiting to be dispatched.</div>
        </div>

        <template v-else>
          <q-list separator>
            <q-item v-for="row in dispatchable" :key="row.code" clickable @click="toggleRow(row.code)">
              <q-item-section side top>
                <q-checkbox
                  :model-value="isSelected(row.code)"
                  :style="ui.tapTargetStyle"
                  :aria-label="`Select ${row.name}`"
                  @update:model-value="toggleRow(row.code)"
                />
              </q-item-section>
              <q-item-section :class="ui.flexWrapTextClass">
                <q-item-label>{{ row.name }}</q-item-label>
                <q-item-label caption>{{ captionOf(row) }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <q-banner dense rounded class="bg-grey-2 q-mt-sm text-caption">
            Today's date is stamped on each supplier as the send date. The procurement moves
            on once nobody is left waiting.
          </q-banner>
        </template>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue'
import { useRFQSupplierFlowContext } from 'src/_ui/AQL/composables/Operation/RFQs/useRFQSupplierFlowContext'

defineOptions({ name: 'RFQsMarkAsSentDispatchPicker', inheritAttrs: false })

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, rfq, canDispatch, dispatchable, selectedRowCodes, toggleRow } = useRFQSupplierFlowContext()

const selectedSet = computed(() => new Set(selectedRowCodes.value))

function isSelected (code) {
  return selectedSet.value.has(code)
}

function captionOf (row) {
  return [row.country, row.contact].filter(Boolean).join(' • ')
}
</script>
