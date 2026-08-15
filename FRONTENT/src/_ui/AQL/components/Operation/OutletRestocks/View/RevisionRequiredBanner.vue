<template>
  <!-- v-if at the ROOT, not v-show: when the request is not awaiting a revision
       this section must contribute nothing at all. A hidden root would still
       occupy a slot in the page body's gutter stack and open a blank gap between
       the header and the details card. -->
  <div v-if="visible" :class="spacingClass">
    <q-card flat bordered :class="[ui.cardClass, ui.accentCardClass]" :style="ui.accentBorderStyle">
      <q-card-section>
        <!-- The heading carries the whole point of the card, so it is stated in
             the workflow's own icon and words rather than left to the reader to
             infer from the rows beneath it. -->
        <div class="row items-center no-wrap q-gutter-x-sm q-mb-sm">
          <q-icon name="undo" size="22px" color="orange" />
          <div class="text-subtitle1 text-weight-bold text-orange-9">{{ finalTitle }}</div>
        </div>

        <div :class="ui.detailGridClass">
          <div
            v-for="(line, index) in lines"
            :key="line.label"
            class="items-center"
            :class="[ui.detailLineClass, ui.detailRowClass]"
            :style="rowDelay(index)"
          >
            <span :class="ui.detailKeyClass">{{ line.label }}</span>
            <span class="col overflow-hidden flex justify-end items-center" :class="ui.detailValClass">
              {{ line.value }}
            </span>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
/**
 * OutletRestocks › View › RevisionRequiredBanner — Section (tier 1: resource + page).
 *
 * The one card on the View page that is an INSTRUCTION rather than a statement:
 * the request has been sent back, and until someone acts on it nothing else on
 * the page matters. That is why it sits above `RestockHeader` and why it is the
 * only card here carrying a warm tint and a left accent — the page is otherwise
 * uniformly neutral, so the colour is doing work rather than decorating.
 *
 * Row grammar is `RestockHeader`'s exactly (`.aql-detail-*` on a
 * `ui.cardClass` shell, shared stagger), so the emphasis
 * reads as emphasis and not as a differently-built card.
 *
 * Renders NOTHING outside `REVISION_REQUIRED` — see the template note on `v-if`.
 *
 * No `<style>` block (ARCHITECTURE RULES §7).
 */
import { computed } from 'vue'
import { useRestockView } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockView'
import { useRestockViewContext } from 'src/_ui/AQL/composables/Operation/OutletRestocks/View/useRestockViewContext'

defineOptions({ name: 'OutletRestocksViewRevisionRequiredBanner', inheritAttrs: false })

const REVISION_REQUIRED = 'REVISION_REQUIRED'

const props = defineProps({
  title: { type: [String, Function], default: 'Revision Required' },
  padding: { type: String, default: 'sm' }
})

const { evaluate, ui } = useRestockViewContext()

const { restock, pending, formatStampDate } = useRestockView()

const spacingClass = computed(() => `q-px-${props.padding}`)
const finalTitle = computed(() => evaluate(props.title))

// Hidden while the record is still loading too: flashing an instruction card in
// and out on a slow fetch is worse than showing it a moment late.
const visible = computed(() =>
  !pending.value && String(restock.value?.Progress || '').trim() === REVISION_REQUIRED)

// Blank rows are dropped rather than padded with em dashes — an instruction reads
// better short, and a "Note: —" row states nothing while looking like it does.
const lines = computed(() => {
  const record = restock.value
  if (!record) return []
  return [
    { label: 'Sent back by', value: record.ProgressRevisionRequiredBy },
    { label: 'At', value: formatStampDate(record.ProgressRevisionRequiredAt) },
    { label: 'Note', value: record.ProgressRevisionRequiredComment }
  ].filter((line) => String(line.value ?? '').trim())
})

const rowDelay = (index) => ({ animationDelay: `${index * ui.rowStaggerMs}ms` })
</script>
