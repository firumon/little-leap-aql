<template>
  <div :class="paddingClass">
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
/**
 * Outlets › View › StreamCard — resource-private sub-component (§2.3).
 *
 * The ONE card shell every stream breakdown on this page is built from: visits, restocks,
 * returns, invoices, payments and current stock. Each of those is a titled card holding a
 * list, differing only in the rows it holds and the words on its empty state — so they share
 * one component and a caller supplies the difference as a prop bag.
 *
 * Not a placeholder: no page names it in `sections:`, and it is imported by relative path.
 * Its name is deliberately not one any contract would list, so the resolver can never pick
 * it up by accident.
 *
 * It performs NO arithmetic and holds no state. Every figure arrives already computed on
 * `items` (or rendered into the `footer` slot by the caller), which is what guarantees the
 * number a card prints is the number the page's one composable derived (§3.5).
 *
 * ── TWO KINDS OF SPACING, TWO CHANNELS ──
 * The `q-px-{padding}` on the root is the page's HORIZONTAL INSET, arriving as a declared
 * prop from the section that mounts this card. It has to arrive as a prop: `Page.vue` also
 * puts the same token on the placeholder as a class, but `inheritAttrs: false` (§12.1,
 * mandatory on the leaf the resolver mounts) drops `$attrs` and the class with it — so the
 * declared `padding` prop is the only channel that survives (§7.5, §10.2).
 *
 * The `q-pa-md` on the card is INTERNAL spacing: breathing room between the shell and its
 * own contents. That is the card's own composition, not the page's rhythm, and routing it
 * through the page's tokens would couple one to the other. Vertical spacing BETWEEN cards
 * remains the page body's gutter and appears nowhere in this file.
 *
 * ── STRICT VIEW CONTRACT ──
 * There is no action slot and no button anywhere in this card, by design. An outlet's View
 * page reports; the four operational entry points live in the FAB cluster, where the Action
 * subsystem owns their permission gating. The `footer` slot is for SUMMARY figures only.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import AppList from 'components/app/AppList.vue'
import SectionDividerLabel from 'components/shared/SectionDividerLabel.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewStreamCard', inheritAttrs: false })

const props = defineProps({
  // Heading above the card. Resolved by the caller, never a closure at this depth.
  title: { type: String, required: true },
  // Already-filtered, already-sorted rows from the page composable.
  items: { type: Array, default: () => [] },
  // The `AppList` prop bag — label/caption/chip resolvers for this stream's row shape.
  list: { type: Object, default: () => ({}) },
  // How many rows before the tail is summarized in one line. A HISTORY card is a summary of
  // a relationship, not its ledger; the owning resource's own page holds the full record.
  // A card showing a POSITION rather than a history passes `Number.POSITIVE_INFINITY` — a
  // truncated position is simply a wrong number.
  limit: { type: Number, default: 8 },
  // Bold line on the empty state.
  emptyTitle: { type: String, default: 'Nothing recorded' },
  // The required caption saying whether that emptiness is normal.
  emptyText: { type: String, default: '' },
  emptyIcon: { type: String, default: 'inbox' },
  // Horizontal inset, forwarded by the SECTION that mounts this card.
  //
  // This card is a resource-private sub-component (§2.3), so `Page.vue` never reaches it —
  // its caller (`Visits.vue`, `CurrentStock.vue`, …) IS the resolved section, receives
  // `:padding="pageProps.sectionPadding"` there, and hands it down. Applying it here rather
  // than in six callers keeps the six identical (§10.2).
  padding: { type: String, default: 'sm' }
})

const { ui, pending } = useOutletViewContext()

const paddingClass = computed(() => (props.padding ? `q-px-${props.padding}` : ''))

const rows = computed(() => {
  const all = Array.isArray(props.items) ? props.items : []
  return Number.isFinite(props.limit) ? all.slice(0, props.limit) : all
})

const hiddenCount = computed(() => Math.max(0, (props.items?.length ?? 0) - rows.value.length))
</script>
