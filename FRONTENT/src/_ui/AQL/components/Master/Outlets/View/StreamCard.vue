<template>
  <div>
    <SectionDividerLabel :label="title" />

    <q-card flat bordered :class="ui.cardClass" class="q-pa-md">
      <!-- Loading: a skeleton INSIDE the shell, so the surface does not appear and reflow
           as the stream lands (§10.4). -->
      <div v-if="pending">
        <q-skeleton type="text" width="40%" class="q-mb-sm" />
        <q-skeleton type="text" width="80%" />
      </div>

      <!-- Empty: the standard shell — icon, short bold line, and a caption saying whether
           this emptiness is normal. The caption is the required half (§10.4). -->
      <div v-else-if="!rows.length" class="text-center q-py-lg">
        <q-icon
          :name="emptyIcon"
          :size="ui.emptyIconSize"
          :color="ui.emptyIconColor"
          class="block q-mx-auto q-mb-sm"
        />
        <div :class="ui.emptyTitleClass">{{ emptyTitle }}</div>
        <div :class="ui.emptyCaptionClass">{{ emptyText }}</div>
      </div>

      <template v-else>
        <!-- Rows sit ON the card's own surface, not in boxes of their own.
             `bg-transparent` keeps the gradient shell continuous behind them, and
             `:item-bordered="false"` drops the per-row outline: the card is already the
             boundary, so a rule around every row draws a box inside a box and the reader
             counts two nested surfaces where there is one card. Rows stay separable by the
             list's own `q-gutter-y` rhythm, which is enough on a surface this quiet.

             Both are defaults of THIS card, not of the rows — a caller that genuinely wants
             boxed rows still passes them in its `list` bag, which is spread after these. -->
        <AppList
          item-class="bg-transparent"
          :item-bordered="true"
          v-bind="list"
          :items="rows"
        />

        <!-- One honest line rather than a card silently pretending to be the whole history. -->
        <div v-if="hiddenCount" class="q-pt-sm text-center text-caption text-grey-6">
          Showing the {{ rows.length }} most recent of {{ items.length }}
        </div>

        <!-- Totals, or anything else that summarizes the rows above rather than adding to
             them. Separated by a rule so it reads as a footer and is never miscounted as a
             final row. -->
        <template v-if="$slots.footer">
          <q-separator class="q-my-sm" />
          <div class="row no-wrap items-center justify-between">
            <slot name="footer" />
          </div>
        </template>
      </template>
    </q-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewStreamCard', inheritAttrs: false })

const props = defineProps({
  title: { type: String, required: true },
  items: { type: Array, default: () => [] },
  list: { type: Object, default: () => ({}) },
  limit: { type: Number, default: 5 },
  emptyTitle: { type: String, default: 'Nothing recorded' },
  emptyText: { type: String, default: '' },
  emptyIcon: { type: String, default: 'inbox' }
})

const { ui, pending } = useOutletViewContext()

const rows = computed(() => {
  const all = Array.isArray(props.items) ? props.items : []
  return Number.isFinite(props.limit) ? all.slice(0, props.limit) : all
})

const hiddenCount = computed(() => Math.max(0, (props.items?.length ?? 0) - rows.value.length))
</script>
