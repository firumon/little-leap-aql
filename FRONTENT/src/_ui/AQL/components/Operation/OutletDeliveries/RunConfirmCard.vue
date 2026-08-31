<template>
  <div :class="gutterClass">
    <q-banner v-if="record && !eligible" rounded class="bg-orange-1 text-body2">
      <template #avatar><q-icon name="lock" color="warning" /></template>
      {{ blockedMessage }}
    </q-banner>

    <!-- Read-only context: which run, whose, how far along. The operator is confirming
         something about a physical van, so the card names it. -->
    <SectionDividerLabel :label="contextLabel" />

    <q-card flat bordered :class="ui.cardClass">
      <q-card-section>
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col" :class="ui.flexWrapTextClass">
            <div class="text-subtitle1 text-weight-medium">{{ record?.Code || '—' }}</div>
            <div class="text-caption text-grey-8">{{ contextCaption }}</div>
          </div>
          <div class="col-auto text-right">
            <div class="text-h6 text-weight-bold">{{ ratio.delivered }} / {{ ratio.total }}</div>
            <div class="text-caption text-grey-8">delivered</div>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-banner v-if="eligible && outcome" rounded :class="outcomeClass">
      <template #avatar><q-icon :name="outcomeIcon" :color="outcomeColor" /></template>
      {{ outcome }}
    </q-banner>

    <SectionDividerLabel v-if="eligible" :label="commentRequired ? 'REASON' : 'COMMENT'" />

    <q-card v-if="eligible" flat bordered :class="ui.cardClass">
      <q-card-section>
        <!-- `rows`, never `autogrow`: see `_fields/README.md` § Textarea Field Invariant. -->
        <FieldTextareaAdd
          :model-value="comment"
          :record="{}"
          :config="{ label: commentLabel, rows: 4 }"
          :header="commentHeader"
          @update:model-value="setComment"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
// One card for three confirm routes: MakeInTransit, MarkComplete and Cancel.
// Each caller passes its own `eligible` gate, so this file never decides eligibility.
import { computed, onMounted, useAttrs } from 'vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import FieldTextareaAdd from 'src/_fields/textarea/Add.vue'
import { useDeliveryFormContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryFormContext'
import { useDeliveryView } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/View/useDeliveryView'

defineOptions({ name: 'OutletDeliveriesRunConfirmCard', inheritAttrs: false })

const props = defineProps({
  contextLabel: { type: String, default: 'DELIVERY RUN' },
  /** The caller's domain predicate result — never re-derived here. */
  eligible: { type: Boolean, default: true },
  blockedMessage: { type: String, default: '' },
  /** One sentence saying what confirming will actually do. */
  outcome: { type: String, default: '' },
  outcomeTone: { type: String, default: 'info' },
  commentRequired: { type: Boolean, default: false },
  commentLabel: { type: String, default: 'Comment' },
  /** The `pageState` control field this card reads and writes. */
  commentField: { type: String, default: 'ProgressInTransitComment' },
  /** Only used to give the `_fields` control a header name; nothing is written to it. */
  commentHeader: { type: String, default: 'ProgressInTransitComment' }
})

const NODE = 'OutletDeliveries'

const attrs = useAttrs()
const gutterClass = computed(() => `q-gutter-y-${attrs.gutter || 'sm'}`)

const { ui, pageState } = useDeliveryFormContext()
const { record, ratio, outletNames, unitsLabel, preload } = useDeliveryView()

const contextCaption = computed(() => {
  const row = record.value
  if (!row) return ''
  const stops = outletNames.value.length
  return [
    row.UserName,
    stops ? `${stops} Outlet${stops === 1 ? '' : 's'}` : '',
    unitsLabel.value
  ].filter(Boolean).join(' • ')
})

const outcomeColor = computed(() => (props.outcomeTone === 'negative' ? 'negative' : 'primary'))
const outcomeIcon = computed(() => (props.outcomeTone === 'negative' ? 'warning' : 'info'))
const outcomeClass = computed(() =>
  (props.outcomeTone === 'negative' ? 'bg-red-1 text-body2' : 'bg-blue-1 text-body2'))

// The note is a COLUMN on the manifest, bound straight through `useRecord`. Writing it
// re-cuts the live batch the page's `ready` keeps applied (UI_PAGE_STATE.md §5B).
const comment = pageState?.useRecord(props.commentField, NODE)
const setComment = (value) => { if (comment) comment.value = value ?? '' }

/**
 * Opens the item and restock sheets the ratio above is measured from. The node itself is
 * seeded by the page contract's `ready`, which also keeps the batch applied — a card
 * mounts and unmounts, and the batch must outlive it.
 */
onMounted(async () => {
  await preload()
})
</script>
