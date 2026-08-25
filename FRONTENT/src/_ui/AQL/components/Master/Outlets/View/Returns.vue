<template>
  <StreamCard
    :title="finalTitle"
    :items="returns"
    :list="list"
    empty-title="No returns"
    empty-text="Nothing has been sent back from this outlet."
    empty-icon="assignment_turned_in"
  />
</template>

<script setup>
/**
 * Outlets › View › Returns — Section (tier CP: resource + page).
 *
 * Stock sent back from this outlet, newest first. The caption leads with the REASON rather
 * than the document code: a return's reason is the fact a reader of an outlet's page is
 * actually after, and the code tells them nothing they can act on.
 *
 * `OutletReturns` carries no shared workflow vocabulary module of its own yet, so the chip
 * states the quantity — a value the row genuinely owns — rather than inventing a second,
 * unshared colour map for its `Progress` column. Inventing one here is exactly the per-page
 * copy §4.5 forbids; when that resource gains a vocabulary file, this chip switches to it.
 *
 * No `<style>` block (CORE_ARCHITECTURE_RULES §7).
 */
import { computed } from 'vue'
import StreamCard from './StreamCard.vue'
import { useOutletViewContext } from 'src/_ui/AQL/composables/Master/Outlets/View/useOutletViewContext'

defineOptions({ name: 'OutletsViewReturns', inheritAttrs: false })

const props = defineProps({
  title: { type: [String, Function], default: 'Returns' }
})

const { evaluate, returns, skuLabelOf, openRecord } = useOutletViewContext()

const finalTitle = computed(() => evaluate(props.title))
const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

const list = computed(() => ({
  itemKey: 'Code',
  layout: ['label', 'caption', 'caption'],
  content: [
    (row) => skuLabelOf(row.SKU).primary,
    (row) => text(row.Reason) || 'No reason recorded',
    (row) => [text(row.Date), text(row.Username)].filter(Boolean).join(' · ')
  ],
  metaLayout: ['chip'],
  chip: (row) => `${num(row.Qty)} ${skuLabelOf(row.SKU).uom}`,
  chipColor: 'grey-7',
  chipOutline: true,
  clickable: true,
  onClick: (row) => openRecord('outlet-returns', row?.Code)
}))
</script>
